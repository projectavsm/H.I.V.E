import sqlite3
import os
import logging
from datetime import datetime

logger = logging.getLogger("H.I.V.E.Cache")

DB_PATH = os.path.join(os.getcwd(), "storage_vault", "semantic_cache.db")

class SemanticCacheManager:
    def __init__(self):
        # Ensure the directory layer is initialized safely
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cache_matrix (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_query TEXT UNIQUE,
                    ai_response TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def lookup_exact_cache(self, query: str) -> str:
        """Instantly checks if an identical string query exists to save execution VRAM overhead."""
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT ai_response FROM cache_matrix WHERE LOWER(user_query) = LOWER(?)", 
                    (query.strip(),)
                )
                row = cursor.fetchone()
                if row:
                    logger.info("🎯 Cache HIT! Retreiving matrix frames directly from SQLite.")
                    return row[0]
        except Exception as e:
            logger.error(f"Cache lookup anomaly: {str(e)}")
        return None

    def commit_to_cache(self, query: str, response: str):
        """Commits an inferred sequence to the cache database matrix."""
        try:
            with sqlite3.connect(DB_PATH) as conn:
                conn.execute(
                    "INSERT OR REPLACE INTO cache_matrix (user_query, ai_response) VALUES (?, ?)",
                    (query.strip(), response)
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to commit transaction matrix to cache: {str(e)}")

cache_manager = SemanticCacheManager()