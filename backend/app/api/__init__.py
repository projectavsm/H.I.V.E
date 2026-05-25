import json
import logging
import os
import shutil
import httpx
from fastapi import APIRouter, Request, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from app.models import ChatCompletionRequest
from app.config import settings

# 🧵 IMPORT ADVANCED CONTEXT HARVESTING SUITES
from app.services.rag_service import LocalRAGEngine
from app.tools.web_tool import AutonomousWebScraper

# Initialize high-performance logger mapped to the H.I.V.E Router channel
logger = logging.getLogger("H.I.V.E.Router")

# Instantiate the API Router asset cleanly
router = APIRouter()

# Instantiate the local vector database retrieval model
rag_engine = LocalRAGEngine()

# 📥 CONFIGURE LOCAL STORAGE VAULT DIRECTORY CONTRACT
VAULT_DIR = os.path.join(os.getcwd(), "storage_vault")

# Ensure the physical drop zone exists at system boot runtime
if not os.path.exists(VAULT_DIR):
    os.makedirs(VAULT_DIR)
    logger.info(f"📁 Initialized empty document ingestion target matrix at: {VAULT_DIR}")

# =========================================================================
# 1. ASYNCHRONOUS OLLAMA STREAM GENERATOR INTERFACE
# =========================================================================
async def stream_ollama_tokens(payload: dict, telemetry: dict = None):
    """
    Asynchronous generator connecting directly to the local Ollama daemon socket.
    Consumes chunked JSON lines, extracts content tokens, and yields standard 
    Server-Sent Events (SSE) data lines. Includes early transmission of system telemetry data.
    """
    # Defensive connection and payload generation timeouts
    timeout = httpx.Timeout(60.0, connect=5.0)
    
    # NEW: Emits telemetry dataset cleanly as the absolute first item down the wire
    if telemetry:
        yield f"data: {json.dumps({'telemetry': telemetry})}\n\n"
    
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            # Connect asynchronously to the local Ollama generation pipeline socket
            async with client.stream(
                "POST", 
                f"{settings.OLLAMA_BASE_URL}/api/chat", 
                json=payload
            ) as response:
                
                # Intercept non-OK states before streaming engine begins consumption
                if response.status_code != 200:
                    error_detail = await response.aread()
                    logger.error(f"Ollama operational error: {response.status_code} - {error_detail}")
                    yield f"data: {json.dumps({'error': 'Failed to communicate with underlying AI runtime.'})}\n\n"
                    return

                # Read incoming lines off the stream buffer asynchronously as they are generated
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    
                    try:
                        chunk = json.loads(line)
                        
                        # Extract the token payload text from Ollama's native nested schema
                        content_token = chunk.get("message", {}).get("content", "")
                        done_flag = chunk.get("done", False)
                        
                        # Package token into a standard, UI-compliant Server-Sent Events (SSE) data frame
                        yield f"data: {json.dumps({'token': content_token, 'done': done_flag})}\n\n"
                        
                        # Terminate consumption loop immediately upon signal receipt
                        if done_flag:
                            break
                    except json.JSONDecodeError:
                        continue
                        
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            # Enforce living documentation recovery behavior for daemon drops
            logger.critical(f"Runtime communication collapse: {str(e)}")
            yield f"data: {json.dumps({'error': 'Local AI engine runtime is currently offline.'})}\n\n"

# =========================================================================
# 2. CORE CHAT COMPLETION & CONCURRENT CONTEXT HARVESTING ROUTE
# =========================================================================
@router.post("/chat/stream")
async def chat_completion_endpoint(request: Request, body: ChatCompletionRequest):
    """
    Hardened API Gateway Route enforcing Pydantic structural validation,
    applying proactive server-side FIFO context sliding-window pruning,
    and executing simultaneous Local RAG Ingestion & Web Scraping loops.
    """
    # Initialize reactive telemetry model array for real-time frontend instrumentation
    telemetry_payload = {
        "rag_matched": False,
        "rag_blocks_found": 0,
        "web_triggered": False,
        "web_fragments_ingested": 0,
        "total_payload_chars": 0,
        "history_pruned": False,
        "pruned_count": 0
    }

    # -------------------------------------------------------------------------
    # DEFENSE LAYER 1: MIDDLEWARE-LEVEL SLIDING CONTEXT WINDOW (FIFO PRUNING)
    # -------------------------------------------------------------------------
    MAX_HISTORIC_MESSAGES = 10
    raw_message_count = len(body.messages)
    messages_payload = [msg.model_dump() for msg in body.messages]
    
    if raw_message_count > MAX_HISTORIC_MESSAGES:
        logger.warning(
            f"⚠️ Context bloat caught ({raw_message_count} messages). "
            f"Pruning oldest records to match strict FIFO VRAM safety bounds."
        )
        messages_payload = messages_payload[-MAX_HISTORIC_MESSAGES:]
        telemetry_payload["history_pruned"] = True
        telemetry_payload["pruned_count"] = raw_message_count - MAX_HISTORIC_MESSAGES

    # Extract the raw statement of the active user query turn
    last_user_message = messages_payload[-1]["content"] if messages_payload else ""
    logger.info(f"⚡ Processing core inference stream for turn query: '{last_user_message[:40]}...'")
    
    # =========================================================================
    # REINFORCED DUAL-HARVESTING ENGINE IMPLEMENTATION (THE SWAP)
    # =========================================================================
    
    # 🧵 INTERCEPT PATH A: Query Local Semantic Vector Store (RAG)
    rag_context = ""
    try:
        # Pass the extracted user message turn to your similarity engine
        raw_rag_data = await rag_engine.query_knowledge_base(last_user_message)
        
        # Guard check: Ensure content isn't just an empty container or None string
        if raw_rag_data and len(str(raw_rag_data).strip()) > 0:
            rag_context = f"\n[VERIFIED LOCAL RAG FILE CONTEXT]:\n{raw_rag_data}\n"
            logger.info("📂 RAG Match: Local semantic context successfully extracted from vector database memory store.")
            telemetry_payload["rag_matched"] = True
            # Log occurrence as 1 dense compiled context metadata chunk block
            telemetry_payload["rag_blocks_found"] = 1
        else:
            logger.warning("⚠️ RAG Warning: Vector search executed successfully but found 0 matching text blocks inside storage_vault.")
    except Exception as e:
        logger.error(f"❌ RAG Retrieval internal fault: {str(e)}")
        
    # 🧵 INTERCEPT PATH B: Deploy Asynchronous Web Scraper (Agent Trigger Words)
    web_context = ""
    trigger_words = ["web", "live", "current", "search", "latest", "google"]
    if any(word in last_user_message.lower() for word in trigger_words):
        telemetry_payload["web_triggered"] = True
        try:
            logger.info(f"🌐 Scraper Match: Target trigger detected. Dispatching DuckDuckGo scraper loop...")
            raw_web_data = await AutonomousWebScraper.fetch_live_web_context(last_user_message)
            if raw_web_data:
                web_context = f"\n[LIVE WEB SEARCH CONTEXT]:\n{raw_web_data}\n"
                # The engine scraper returns the top 3 extracted snippet rows on success
                telemetry_payload["web_fragments_ingested"] = 3
        except Exception as e:
            logger.error(f"❌ Web Scraper execution internal fault: {str(e)}")

    # -------------------------------------------------------------------------
    # DEFENSE LAYER 2: HARDENED ENVIRONMENT-AWARE HARDWARE LIMITS
    # -------------------------------------------------------------------------
    ollama_payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": messages_payload,
        "stream": True,
        "options": {
            "num_ctx": 4096,      # Limit total token pool allocation
            "temperature": 0.4,   # Keep reasoning path deterministic
            "num_predict": 1024   # Cap the output response length
        }
    }

    # =========================================================================
    # CONTEXT RE-ALIGNMENT MATRIX WITH COMPLIANT SYSTEM DIRECTIVES
    # =========================================================================
    base_system_prompt = body.system_prompt or "You are H.I.V.E., a hardened local AI orchestration assistant."
    
    augmented_system_instructions = (
        f"{base_system_prompt}\n\n"
        f"CRITICAL SYSTEM DIRECTIVE:\n"
        f"You are running within local machine limits. Prioritize facts, metrics, and data provided "
        f"in the context blocks below over your pre-trained textbook base weights. If the data is present, "
        f"use it as your absolute source-of-truth.\n"
        f"STRICT WEB RULE: When responding to a live search or web query, use ONLY the specific text strings "
        f"provided inside the [LIVE WEB SEARCH CONTEXT] block below. Do not invent news headlines or fallback to historical data loops.\n"
        f"{rag_context}"
        f"{web_context}"
    ) 
    
    # Inject the final compiled instruction dictionary straight into index position 0
    ollama_payload["messages"].insert(0, {
        "role": "system",
        "content": augmented_system_instructions
    })
    
    # Compute complete layout scale metric
    telemetry_payload["total_payload_chars"] = len(augmented_system_instructions)
    logger.info(f"💾 System context array compiled successfully. Total injected payload length: {telemetry_payload['total_payload_chars']} chars.")

    # -------------------------------------------------------------------------
    # RESPONSE GENERATION OUTPUT STREAM TRANSFERS
    # -------------------------------------------------------------------------
    return StreamingResponse(
        stream_ollama_tokens(ollama_payload, telemetry=telemetry_payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disables proxy buffering to force instant UI token updates
        }
    )

# =========================================================================
# 3. REAL-TIME UI KNOWLEDGE INGESTION PIPELINE (FILE UPLOADER)
# =========================================================================
@router.post("/upload")
async def upload_document_endpoint(file: UploadFile = File(...)):
    """
    Secure file upload interceptor receiving binary file data frames via the UI,
    writing them safely to storage_vault, and executing real-time vector indexing.
    """
    valid_extensions = (".txt", ".md", ".pdf")
    ext = os.path.splitext(file.filename)[1].lower()
    
    if ext not in valid_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported format standard. Matrix only permits: {', '.join(valid_extensions)}"
        )
    
    target_path = os.path.join(VAULT_DIR, file.filename)
    logger.info(f"📥 Incoming UI upload detected: {file.filename}. Staging data frame stream...")
    
    try:
        # Write the uploaded file blocks down to the secure vault directory disk layer
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        logger.info(f"💾 Staged file saved locally. Deploying real-time semantic chunking...")
        
        # Instantly compile vectors into your database without requiring admin_ingest.py scripts
        await rag_engine.ingest_document(target_path)
        
        return {
            "status": "success",
            "filename": file.filename,
            "detail": "Document committed to local system vector storage map successfully."
        }
    except Exception as e:
        logger.error(f"❌ Real-time UI ingestion failure for {file.filename}: {str(e)}")
        if os.path.exists(target_path):
            os.remove(target_path)  # Clean up partial fragments upon failure conditions
        raise HTTPException(status_code=500, detail=f"Internal database ingestion compilation error: {str(e)}")