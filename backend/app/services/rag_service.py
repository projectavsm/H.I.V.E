import os
import json
import numpy as np
import httpx
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter

try:
    from docx import Document as DocxReader
except ImportError:
    DocxReader = None

OLLAMA_URL = "http://localhost:11434/api/embeddings"
EMBED_MODEL = "all-minilm"  # Ensure you ran `ollama pull all-minilm`
VECTOR_STORE_PATH = os.path.join(os.getcwd(), "vector_store", "knowledge_base.json")

class LocalRAGEngine:
    def __init__(self, chunk_size=500, chunk_overlap=50):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            is_separator_regex=False
        )
        self.db_memory = self._load_vector_db()

    def _load_vector_db(self):
        # Guarantee that parent vectors directory maps out perfectly to avoid IO Error Drops
        os.makedirs(os.path.dirname(VECTOR_STORE_PATH), exist_ok=True)
        if os.path.exists(VECTOR_STORE_PATH):
            with open(VECTOR_STORE_PATH, "r") as f:
                return json.load(f)
        return []

    def _save_vector_db(self):
        os.makedirs(os.path.dirname(VECTOR_STORE_PATH), exist_ok=True)
        with open(VECTOR_STORE_PATH, "w") as f:
            json.dump(self.db_memory, f, indent=2)

    def extract_text(self, file_path: str) -> str:
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext in (".txt", ".md"):
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
                
        elif ext == ".pdf":
            reader = PdfReader(file_path)
            return "".join([page.extract_text() or "" for page in reader.pages])
            
        elif ext == ".docx":
            if DocxReader is None:
                raise ImportError("Target package 'python-docx' missing. Run `pip install python-docx` to handle Word files.")
            doc = DocxReader(file_path)
            return "\n".join([p.text for p in doc.paragraphs])
            
        raise ValueError(f"Unsupported storage format layout: {ext}")

    async def get_embedding(self, text: str) -> list:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(OLLAMA_URL, json={"model": EMBED_MODEL, "prompt": text})
            if response.status_code == 200:
                return response.json()["embedding"]
            raise Exception(f"Ollama vector generation fault error code: {response.status_code}")

    async def ingest_document(self, file_path: str):
        print(f"[RAG] Compiling vector matrices for: {file_path}")
        raw_text = self.extract_text(file_path)
        chunks = self.splitter.split_text(raw_text)
        
        indexed_count = 0
        for chunk in chunks:
            # 🛡️ THE TEXT GUARD LAYER: Reject white-spaces, isolated characters, or structural margin layout noise
            cleaned_chunk = chunk.strip()
            if not cleaned_chunk or len(cleaned_chunk) < 15: 
                continue
                
            vector = await self.get_embedding(cleaned_chunk)
            self.db_memory.append({
                "source": os.path.basename(file_path),
                "text": cleaned_chunk,
                "vector": vector
            })
            indexed_count += 1
            
        self._save_vector_db()
        print(f"[RAG] Ingestion matrix sequence finalized. Accumulated {indexed_count} valid structural fragments.")

    async def query_knowledge_base(self, user_prompt: str, top_k: int = 2) -> str:
        if not self.db_memory: 
            return ""
        
        query_vector = np.array(await self.get_embedding(user_prompt))
        scored_chunks = []

        for item in self.db_memory:
            item_vector = np.array(item["vector"])
            # Compute structural Cosine Similarity dot products
            similarity = np.dot(query_vector, item_vector) / (np.linalg.norm(query_vector) * np.linalg.norm(item_vector))
            scored_chunks.append((similarity, item["text"]))

        # Sort descending by correlation score
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        
        # Fixed the tuple index extraction alignment bug (score is x[0], text string is x[1])
        relevant_matches = [text for score, text in scored_chunks[:top_k] if score > 0.4]
        
        if relevant_matches:
            return "\n[LOCAL DOCUMENT MATRIX CONTEXT]:\n" + "\n---\n".join(relevant_matches)
        return ""