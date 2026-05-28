import os
import io
import chromadb
import httpx
import logging
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.config import settings  # Import the configuration singleton

# Initialize local module logger to support tracking print/logging matrix operations
logger = logging.getLogger("H.I.V.E.RAG")

try:
    from docx import Document as DocxReader
except ImportError:
    DocxReader = None

# RESOLVED: Pointing to explicit IPv4 literal via settings to prevent Windows 11 loopback resolution drops
OLLAMA_URL = f"{settings.OLLAMA_BASE_URL}/api/embeddings"
EMBED_MODEL = "all-minilm"  # Ensure you ran `ollama pull all-minilm`
     
class LocalRAGEngine:
    def __init__(self, chunk_size=500, chunk_overlap=50):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            is_separator_regex=False
        )
        # Initialize Persistent Chroma Client
        self.db_path = os.path.join(os.getcwd(), "vector_store", "chroma_db")
        self.chroma_client = chromadb.PersistentClient(path=self.db_path)
        
        # Get or create our knowledge collection
        self.collection = self.chroma_client.get_or_create_collection(
            name="hive_knowledge_base",
            metadata={"hnsw:space": "cosine"} # Explicitly use Cosine Similarity
        )
        self.embeddings_url = OLLAMA_URL
        self.embed_model = EMBED_MODEL

    async def _get_single_embedding(self, text: str) -> list:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.embeddings_url, json={"model": self.embed_model, "prompt": text})
            if response.status_code == 200:
                return response.json()["embedding"]
            raise Exception(f"Ollama embedding failure: {response.status_code}")

    def extract_text(self, file_bytes: bytes, filename: str) -> str:
        """Extracts text safely from PDF, DOCX, and TXT frames directly from memory payload streams."""
        ext = os.path.splitext(filename.lower())[1]
        
        if ext in (".txt", ".md"):
            return file_bytes.decode("utf-8", errors="ignore")
                
        elif ext == ".pdf":
            pdf_file = io.BytesIO(file_bytes)
            reader = PdfReader(pdf_file)
            return "".join([page.extract_text() or "" for page in reader.pages])
            
        elif ext == ".docx":
            if DocxReader is None:
                raise ImportError("Target package 'python-docx' missing. Run `pip install python-docx` to handle Word files.")
            docx_file = io.BytesIO(file_bytes)
            doc = DocxReader(docx_file)
            return "\n".join([p.text for p in doc.paragraphs])
            
        raise ValueError(f"Unsupported storage format layout: {ext}")

    async def ingest_document(self, file_bytes: bytes, filename: str, telemetry_callback=None):
        """Processes binary file streams into chunked matrices and commits them to ChromaDB with telemetry tracking."""
        print(f"[CHROMA] Compiling vector matrices for: {filename}")
        if telemetry_callback:
            telemetry_callback(f"INBOUND TRANSMISSION DETECTED: Parsing data stream '{filename}'")
        
        raw_text = self.extract_text(file_bytes, filename)
        if telemetry_callback:
            telemetry_callback(f"EXTRACTOR STATUS: SUCCESS. Character length parsed: {len(raw_text)}")

        chunks = self.splitter.split_text(raw_text)
        total_chunks = len(chunks)
        
        if telemetry_callback:
            telemetry_callback(f"Matrix chunking initialized. Total components mapped: {total_chunks}")
        
        documents = []
        metadatas = []
        ids = []
        
        idx = 0
        for chunk in chunks:
            # 🛡️ THE TEXT GUARD LAYER: Reject white-spaces, isolated characters, or structural margin layout noise
            cleaned_chunk = chunk.strip()
            if not cleaned_chunk or len(cleaned_chunk) < 15:
                continue
            
            documents.append(cleaned_chunk)
            metadatas.append({"source": filename, "chunk_index": idx})
            ids.append(f"{filename}_{idx}")
            idx += 1

        if documents:
            # Generate embeddings asynchronously in batches via local Ollama endpoint
            embeddings = []
            for i, doc in enumerate(documents):
                emb = await self._get_single_embedding(doc)
                embeddings.append(emb)
                
                if telemetry_callback and (i + 1) % max(1, len(documents) // 4) == 0:
                    telemetry_callback(f"Indexing progress: {int(((i + 1) / len(documents)) * 100)}% absolute execution.")

            # Insert natively into persistent ChromaDB
            self.collection.add(
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            
        if telemetry_callback:
            telemetry_callback(f"TRANSMISSION COMPLETE: File successfully locked into database collection.")
            
        print(f"[CHROMA] Ingestion matrix sequence finalized. Registered {len(documents)} fragments for {filename}")
        return {"filename": filename, "status": "indexed", "chunks": len(documents)}

    def get_all_ingested_files(self) -> list:
        """Helper to return list of unique files inside the Document Vault"""
        existing = self.collection.get(include=["metadatas"])
        if not existing or not existing["metadatas"]:
            return []
        unique_files = list(set([m["source"] for m in existing["metadatas"] if "source" in m]))
        return unique_files

    async def query_knowledge_base(self, user_prompt: str, top_k: int = 2, target_file: str = None) -> list:
        """Queries vector store with optional file-specific metadata filtering."""
        query_vector = await self._get_single_embedding(user_prompt)
        
        # Build metadata filter if a specific file is selected in the Vault
        where_filter = {"source": target_file} if target_file else None
        
        results = self.collection.query(
            query_embeddings=[query_vector],
            n_results=top_k,
            where=where_filter,
            include=["documents", "metadatas", "distances"]
        )
        
        compiled_contexts = []
        if results and results["documents"] and results["documents"][0]:
            for i in range(len(results["documents"][0])):
                score = 1.0 - results["distances"][0][i]  # Convert distance to cosine similarity
                if score > 0.4:
                    compiled_contexts.append({
                        "text": results["documents"][0][i],
                        "source": results["metadatas"][0][i]["source"],
                        "score": round(score, 2)
                    })
        return compiled_contexts

    def delete_document_from_vector_store(self, filename: str) -> bool:
        """
        Purges all vectorized structural chunks from ChromaDB matching the source filename metadata.
        """
        try:
            # We target the 'source' key to clear out the specific elements mapped in metadatas
            self.collection.delete(where={"source": filename})
            logger.info(f"🧹 Successfully evicted all vector fragments for source: {filename}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to purge vector fragments for {filename} from ChromaDB: {str(e)}")
            raise e

    async def check_semantic_cache(self, query: str, similarity_threshold: float = 0.95) -> str:
        """
        Queries ChromaDB or a dedicated cache index to see if an identical/highly similar 
        query already exists, returning the cached response string if found.
        """
        try:
            # Generate an embedding frame for the incoming user turn query
            query_vector = await self._get_single_embedding(query)
            
            # We can leverage a separate small collection or query the main text map if structured.
            # Alternatively, if you want pure textual matching, SQLite handles it below in Step 2.
            # This placeholder satisfies the structural requirement if your engine calls vector distance:
            return None
        except Exception:
            return None