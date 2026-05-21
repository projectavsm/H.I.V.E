import os
import asyncio
import logging
from app.services.rag_service import LocalRAGEngine

# Configure clean console logging visibility
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("H.I.V.E.IngestTool")

VAULT_DIR = os.path.join(os.getcwd(), "storage_vault")

async def main():
    logger.info("⚡ Starting H.I.V.E. Local Vector Store Compilation System...")
    
    if not os.path.exists(VAULT_DIR):
        os.makedirs(VAULT_DIR)
        logger.warning(f"📁 Created empty 'storage_vault' directory. Drop your PDF, TXT, or MD documents here.")
        return

    # Initialize our unified RAG backend processing service
    rag_engine = LocalRAGEngine(chunk_size=500, chunk_overlap=50)
    
    # Extract structural valid formats matching architectural specifications
    valid_extensions = (".txt", ".md", ".pdf")
    files_to_process = [
        f for f in os.listdir(VAULT_DIR) 
        if os.path.splitext(f)[1].lower() in valid_extensions
    ]

    if not files_to_process:
        logger.warning("📭 Storage vault matrix is currently empty. No documents detected for ingestion.")
        logger.info(f"💡 Place file targets directly inside: {VAULT_DIR}")
        return

    logger.info(f"✨ Found {len(files_to_process)} candidate target files inside storage vault arrays.")
    
    for filename in files_to_process:
        full_path = os.path.join(VAULT_DIR, filename)
        logger.info(f"🚀 Parsing and vector-mapping content arrays for: {filename}")
        try:
            await rag_engine.ingest_document(full_path)
            logger.info(f"✅ Document successfully committed to vector store map: {filename}")
        except Exception as e:
            logger.error(f"❌ Aborted processing loop on '{filename}' due to exception: {str(e)}")

    logger.info("🎯 Data ingestion engine loop terminated safely. System storage synchronized.")

if __name__ == "__main__":
    asyncio.run(main())