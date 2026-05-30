import logging
import time
from app.services.rag_service import LocalRAGEngine

# Initialize high-performance logger mapped to the H.I.V.E Cache channel
logger = logging.getLogger("H.I.V.E.Cache")

class SemanticCacheManager:
    def __init__(self, rag_engine: LocalRAGEngine):
        self.rag_engine = rag_engine
        # Leverage the persistent client to establish a dedicated caching index
        self.cache_collection = self.rag_engine.chroma_client.get_or_create_collection(
            name="hive_semantic_cache",
            metadata={"hnsw:space": "cosine"}
        )
        # Tracking states for the real-time analytics ticker
        self.hit_count = 0
        self.miss_count = 0
        self.vram_seconds_saved = 0.0

    async def lookup_semantic_cache(self, user_query: str, similarity_threshold: float = 0.92):
        """
        Calculates cosine similarity of the incoming query against cached history vectors.
        Returns a tuple of (cached_text, latency_saved) if above threshold, else (None, 0.0).
        """
        try:
            cleaned_query = user_query.strip()
            if not cleaned_query:
                return None, 0.0

            # Generate embedding vector frame for incoming query turn
            query_vector = await self.rag_engine._get_single_embedding(cleaned_query)

            results = self.cache_collection.query(
                query_embeddings=[query_vector],
                n_results=1,
                include=["documents", "metadatas", "distances"]
            )

            if results and results["documents"] and results["documents"][0]:
                distance = results["distances"][0][0]
                # Cosine distance to similarity conversion
                cosine_similarity = 1.0 - distance

                logger.info(f"🧠 Cache Match Evaluated. Cosine Similarity: {cosine_similarity:.4f}")

                if cosine_similarity >= similarity_threshold:
                    self.hit_count += 1
                    cached_response = results["documents"][0][0]
                    metadata = results["metadatas"][0][0]
                    generation_time = metadata.get("generation_time", 2.5) # Fallback baseline estimation
                    
                    self.vram_seconds_saved += generation_time
                    logger.info("🎯 Semantic Cache HIT! Bypassing LLM execution parameters.")
                    return cached_response, generation_time

            self.miss_count += 1
            return None, 0.0
        except Exception as e:
            logger.error(f"❌ Error evaluating semantic cache matrix: {str(e)}")
            return None, 0.0

    def commit_to_cache(self, user_query: str, ai_response: str, generation_time: float):
        """Maps query vector directly to text response blocks for future semantic hits."""
        try:
            if not user_query.strip() or not ai_response.strip():
                return

            # Run synchronously since insertion parameters are short arrays
            import asyncio
            query_vector = asyncio.run(self.rag_engine._get_single_embedding(user_query))
            
            # Use query as primary key tracking identity safely
            doc_id = f"cache_{hash(user_query)}"
            
            self.cache_collection.add(
                embeddings=[query_vector],
                documents=[ai_response],
                metadatas=[{"query_string": user_query, "generation_time": round(generation_time, 2)}],
                ids=[doc_id]
            )
            logger.info("💾 Frame committed successfully into Semantic Vector Cache index.")
        except Exception as e:
            logger.error(f"❌ Failed to commit node sequence to vector cache: {str(e)}")

# Global instance reference contract initialized by sub-router injection context
cache_manager = None