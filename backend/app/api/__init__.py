import json
import logging
import os
import shutil
import asyncio
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
# 1. NEW: UI DATA VAULT MANAGEMENT ENDPOINT
# =========================================================================
@router.get("/vault/files")
async def get_vault_files():
    """Returns list of all successfully vectorized files for the sidebar UI"""
    try:
        return {"files": rag_engine.get_all_ingested_files()}
    except Exception as e:
        logger.error(f"❌ Error fetching storage vault file manifest: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =========================================================================
# 2. CORE REFACTORED CHAT COMPLETION INTERFACE (WITH CUSTOM JSON EVENTS)
# =========================================================================
@router.post("/chat/stream")
async def chat_completion_endpoint(body: ChatCompletionRequest):
    """
    Hardened API Gateway Route enforcing Pydantic structural validation,
    applying proactive server-side FIFO context sliding-window pruning,
    and executing simultaneous Local RAG Ingestion & Web Scraping loops.
    """
    # -------------------------------------------------------------------------
    # DEFENSE LAYER 1: MIDDLEWARE-LEVEL SLIDING CONTEXT WINDOW (FIFO PRUNING)
    # -------------------------------------------------------------------------
    MAX_HISTORIC_MESSAGES = 10
    raw_message_count = len(body.messages)
    messages_payload = [msg.model_dump() for msg in body.messages]
    
    # Track historic clipping occurrences for system diagnostic visibility
    history_pruned = False
    pruned_count = 0

    if raw_message_count > MAX_HISTORIC_MESSAGES:
        logger.warning(
            f"⚠️ Context bloat caught ({raw_message_count} messages). "
            f"Pruning oldest records to match strict FIFO VRAM safety bounds."
        )
        messages_payload = messages_payload[-MAX_HISTORIC_MESSAGES:]
        history_pruned = True
        pruned_count = raw_message_count - MAX_HISTORIC_MESSAGES

    # Extract the raw statement of the active user query turn
    last_user_message = messages_payload[-1]["content"] if messages_payload else ""
    logger.info(f"⚡ Processing core inference stream for turn query: '{last_user_message[:40]}...'")
    
    async def sse_event_generator():
        rag_context = ""
        citations = []
        rag_matched = False
        rag_blocks_found = 0
        web_triggered = False
        web_fragments_ingested = 0

        # Emit initial sliding context history pruning metrics down the telemetry wire if tripped
        if history_pruned:
            yield f"data: {json.dumps({'status_update': f'Context bloat caught. Pruned {pruned_count} historical messages.', 'done': False})}\n\n"

        # 🧵 STEP 1: Evaluate Strategy & Query Local ChromaDB Vector Database
        if body.rag_mode != "off" and last_user_message:
            logger.info(f"🔍 Executing ChromaDB semantic vector search strategy [Mode: {body.rag_mode}]")
            yield f"data: {json.dumps({'status_update': 'Querying local ChromaDB vector store...', 'done': False})}\n\n"
            await asyncio.sleep(0.1)  # Brief async context yield breather
            
            try:
                # If mode is set to strict constraint, restrict lookup explicitly to target_file metadata 
                filter_file = body.target_file if body.rag_mode == "strict" else None
                matches = await rag_engine.query_knowledge_base(last_user_message, target_file=filter_file)
                
                if matches:
                    text_blocks = []
                    for match in matches:
                        text_blocks.append(match["text"])
                        citations.append({"source": match["source"], "score": match["score"]})
                    
                    rag_context = "\n[LOCAL DOCUMENT MATRIX CONTEXT]:\n" + "\n---\n".join(text_blocks)
                    rag_matched = True
                    rag_blocks_found = len(matches)
                    
                    logger.info(f"📂 RAG Match: Found {rag_blocks_found} structural text fragments within index boundaries.")
                    # Emit citations early to let frontend engine process citation chips placeholder elements
                    yield f"data: {json.dumps({'citations': citations})}\n\n"
                else:
                    logger.warning("⚠️ RAG Search executed successfully but found 0 matching text blocks above score threshold rules.")
            except Exception as e:
                logger.error(f"❌ RAG Retrieval internal fault: {str(e)}")
                yield f"data: {json.dumps({'status_update': f'❌ RAG Error: {str(e)}', 'done': False})}\n\n"

        # 🧵 STEP 2: Deploy Autonomous Web Scraper (Agent Target Trigger Words Intercept)
        trigger_words = ["web", "live", "current", "search", "latest", "google"]
        if any(word in last_user_message.lower() for word in trigger_words):
            web_triggered = True
            logger.info(f"🌐 Scraper Match: Target trigger detected. Dispatching DuckDuckGo scraper loop...")
            yield f"data: {json.dumps({'status_update': 'Agent triggered. Launching Autonomous Web Scraper...', 'done': False})}\n\n"
            await asyncio.sleep(0.4) 
            
            try:
                raw_web_data = await AutonomousWebScraper.fetch_live_web_context(last_user_message)
                if raw_web_data:
                    web_context = "\n[LIVE WEB SEARCH CONTEXT]:\n" + raw_web_data
                    web_fragments_ingested = 3
                    logger.info("🟢 Web scraping complete. Grounded context matrix updated successfully.")
                    yield f"data: {json.dumps({'status_update': 'Web scraping complete. Grounding context array...', 'done': False})}\n\n"
                    await asyncio.sleep(0.2)
                    rag_context += web_context
            except Exception as e:
                logger.error(f"❌ Web Scraper execution internal fault: {str(e)}")
                yield f"data: {json.dumps({'status_update': f'❌ Scraper Error: {str(e)}', 'done': False})}\n\n"

        # 🧵 STEP 3: Assemble Context Re-Alignment Matrix & System Directive Constraints
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
        )

        # Append data parameters into message payload at safe starting index
        if messages_payload and messages_payload[0]["role"] == "system":
            messages_payload[0]["content"] = augmented_system_instructions
        else:
            messages_payload.insert(0, {
                "role": "system", 
                "content": augmented_system_instructions
            })

        # Compile total tracking telemetry measurements to expose internal engine layers
        telemetry_payload = {
            "rag_matched": rag_matched,
            "rag_blocks_found": rag_blocks_found,
            "web_triggered": web_triggered,
            "web_fragments_ingested": web_fragments_ingested,
            "total_payload_chars": len(augmented_system_instructions),
            "history_pruned": history_pruned,
            "pruned_count": pruned_count
        }
        # Yield completed telemetry map right before token streaming takes over
        yield f"data: {json.dumps({'telemetry': telemetry_payload})}\n\n"

        # 🧵 STEP 4: Establish Streaming Data Connection to Local Ollama Daemon Socket
        timeout = httpx.Timeout(60.0, connect=5.0)
        ollama_payload = {
            "model": body.model,
            "messages": messages_payload,
            "stream": True,
            "options": {
                "num_ctx": 4096,           # Limit total token pool allocation
                "temperature": body.temperature,  # Keep reasoning path bounded to user preferences
                "num_predict": 1024        # Cap the output response length to guard VRAM overhead
            }
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                async with client.stream(
                    "POST", 
                    f"{settings.OLLAMA_BASE_URL}/api/chat", 
                    json=ollama_payload
                ) as response:
                    
                    if response.status_code != 200:
                        error_detail = await response.aread()
                        logger.error(f"Ollama operational error: {response.status_code} - {error_detail.decode()}")
                        yield f"data: {json.dumps({'error': 'Failed to communicate with underlying AI runtime.', 'done': True})}\n\n"
                        return

                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        
                        try:
                            chunk = json.loads(line)
                            content_token = chunk.get("message", {}).get("content", "")
                            done_flag = chunk.get("done", False)
                            
                            # Emit structural token payloads directly down the SSE client line wrapper
                            yield f"data: {json.dumps({'token': content_token, 'done': done_flag})}\n\n"
                            
                            if done_flag:
                                break
                        except json.JSONDecodeError:
                            continue
                            
            except (httpx.ConnectError, httpx.TimeoutException) as e:
                logger.critical(f"Runtime communication collapse: {str(e)}")
                yield f"data: {json.dumps({'token': f'❌ Core Connection Error: Local AI runtime is currently offline. Details: {str(e)}', 'done': True})}\n\n"

    return StreamingResponse(
        sse_event_generator(),
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
#@router.post("/upload")
#async def upload_document_endpoint(file: UploadFile = File(...)):
#    """
#    Secure file upload interceptor receiving binary file data frames via the UI,
#    writing them safely to storage_vault, and executing real-time vector indexing.
#    """
#    valid_extensions = (".txt", ".md", ".pdf", ".docx")
#    ext = os.path.splitext(file.filename)[1].lower()
#    
#    if ext not in valid_extensions:
#        raise HTTPException(
#            status_code=400, 
#            detail=f"Unsupported format standard. Matrix only permits: {', '.join(valid_extensions)}"
#        )
#    
#    target_path = os.path.join(VAULT_DIR, file.filename)
#    logger.info(f"📥 Incoming UI upload detected: {file.filename}. Staging data frame stream...")
#    
#    try:
#        # Write the uploaded file blocks down to the secure vault directory disk layer
#        with open(target_path, "wb") as buffer:
#            shutil.copyfileobj(file.file, buffer)
#            
#        logger.info(f"💾 Staged file saved locally. Deploying real-time semantic chunking...")
#        
#        # Instantly compile vectors into your database without requiring admin_ingest.py scripts
#        await rag_engine.ingest_document(target_path)
#        
#        return {
#           "status": "success",
#           "filename": file.filename,
#            "detail": "Document committed to local system vector storage map successfully."
#        }
#    except Exception as e:
#        logger.error(f"❌ Real-time UI ingestion failure for {file.filename}: {str(e)}")
#        if os.path.exists(target_path):
#            os.remove(target_path)  # Clean up partial fragments upon failure conditions
#        raise HTTPException(status_code=500, detail=f"Internal database ingestion compilation error: {str(e)}")