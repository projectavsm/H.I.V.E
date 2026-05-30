import json
import logging
import os
import shutil
import time
import asyncio
import httpx
from fastapi import APIRouter, Request, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from app.models import ChatCompletionRequest
from app.config import settings

# 🧵 IMPORT ADVANCED CONTEXT HARVESTING SUITES
from app.services.rag_service import LocalRAGEngine
from app.tools.web_tool import AutonomousWebScraper
from app.services.cache_service import SemanticCacheManager, cache_manager

# Initialize high-performance logger mapped to the H.I.V.E Router channel
logger = logging.getLogger("H.I.V.E.Router")

# Instantiate the API Router asset cleanly
router = APIRouter()

# Instantiate the local vector database retrieval model
rag_engine = LocalRAGEngine()

# Instantiating the brand new Semantic Vector Cache Engine
cache_manager = SemanticCacheManager(rag_engine)

# 📥 CONFIGURE LOCAL STORAGE VAULT DIRECTORY CONTRACT
VAULT_DIR = os.path.join(os.getcwd(), "storage_vault")

# Ensure the physical drop zone exists at system boot runtime
if not os.path.exists(VAULT_DIR):
    os.makedirs(VAULT_DIR)
    logger.info(f"📁 Initialized empty document ingestion target matrix at: {VAULT_DIR}")

# =========================================================================
# 1. UI PERFORMANCE & VAULT ANALYTICS ENDPOINTS (GET & DELETE)
# =========================================================================
@router.get("/vault/analytics")
async def get_performance_analytics():
    """Exposes current performance optimization metrics to the frontend ticker dashboards"""
    try:
        all_files = rag_engine.get_all_ingested_files()
        
        # Pull total counts directly out of ChromaDB collections mapping metrics
        total_chunks = len(rag_engine.collection.get(include=[])["ids"])
        
        return {
            "cache_hits": cache_manager.hit_count,
            "cache_misses": cache_manager.miss_count,
            "vram_seconds_saved": round(cache_manager.vram_seconds_saved, 2),
            "active_documents": len(all_files),
            "total_vector_fragments": total_chunks
        }
    except Exception as e:
        logger.error(f"❌ Error compiling telemetry parameters: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/vault/files")
async def get_vault_files():
    """Returns list of all successfully vectorized files for the sidebar UI"""
    try:
        return {"files": rag_engine.get_all_ingested_files()}
    except Exception as e:
        logger.error(f"❌ Error fetching storage vault file manifest: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/vault/files/{filename}")
async def delete_vault_file(filename: str):
    """
    ⚡ REFACTOR UPGRADE: DOCUMENT DELETION PROTOCOL
    Removes physical tracking files and completely purges vectorized nodes from ChromaDB.
    """
    target_path = os.path.join(VAULT_DIR, filename)
    logger.warning(f"🗑️ Purge request intercepted for document: {filename}")
    try:
        # 1. Instruct the RAG Engine to un-index the structural chunks inside ChromaDB
        rag_engine.delete_document_from_vector_store(filename)
        
        # 2. Safely wipe the physical file footprint from local drive matrix if it exists
        if os.path.exists(target_path):
            os.remove(target_path)
            logger.info(f"💾 Physical workspace clone unlinked safely: {target_path}")
        else:
            logger.warning(f"⚠️ Physical file path not present on local machine workspace, skipped disk cycle.")

        return {
            "status": "success",
            "detail": f"Document '{filename}' fully expunged from system boundaries."
        }
    except Exception as e:
        logger.error(f"❌ Deletion lifecycle broken: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to execute document execution clean cycle: {str(e)}")

# =========================================================================
# 2. CORE REFACTORED CHAT COMPLETION INTERFACE (WITH SEMANTIC CACHE MATRIX)
# =========================================================================
@router.post("/chat/stream")
async def chat_completion_endpoint(body: ChatCompletionRequest):
    """
    Hardened API Gateway Route enforcing Pydantic structural validation,
    applying proactive server-side FIFO context sliding-window pruning,
    evaluating semantic cache matches, and executing simultaneous Local RAG Ingestion & Web Scraping loops.
    """
    MAX_HISTORIC_MESSAGES = 10
    raw_message_count = len(body.messages)
    messages_payload = [msg.model_dump() for msg in body.messages]
    
    # Track historic clipping occurrences for system diagnostic visibility
    history_pruned = raw_message_count > MAX_HISTORIC_MESSAGES
    pruned_count = raw_message_count - MAX_HISTORIC_MESSAGES if history_pruned else 0

    if history_pruned:
        logger.warning(
            f"⚠️ Context bloat caught ({raw_message_count} messages). "
            f"Pruning oldest records to match strict FIFO VRAM safety bounds."
        )
        messages_payload = messages_payload[-MAX_HISTORIC_MESSAGES:]

    # Extract the raw statement of the active user query turn
    last_user_message = messages_payload[-1]["content"] if messages_payload else ""
    logger.info(f"⚡ Core Stream Evaluation initiated for turn query: '{last_user_message[:40]}...'")
    
    # 🧠 SEMANTIC BREAKPOINT INTERCEPT: Check vector distances before engaging Ollama VRAM channels
    cached_ai_answer, latency_saved = await cache_manager.lookup_semantic_cache(last_user_message)
    
    if cached_ai_answer:
        logger.info("🚀 Routing inference query down high-speed semantic cache shortcut.")
        async def cached_stream_generator():
            yield f"data: {json.dumps({'status_update': f'🎯 Semantic Cache Hit! saved approx {latency_saved}s VRAM load time.', 'done': False})}\n\n"
            await asyncio.sleep(0.04)
            # Break down text into small chunks to preserve the look and feel of real-time streaming tokens
            words = cached_ai_answer.split(" ")
            for i, word in enumerate(words):
                spaced_word = word if i == 0 else " " + word
                yield f"data: {json.dumps({'token': spaced_word, 'done': False})}\n\n"
                await asyncio.sleep(0.01) # Ultra-fast response latency
            yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"
        
        return StreamingResponse(
            cached_stream_generator(), 
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )

    # If cache is a MISS, drop down into standard engine retrieval matrix pipelines natively...
    async def sse_event_generator():
        start_generation_time = time.time()
        rag_context = ""
        citations = []
        rag_matched = False
        rag_blocks_found = 0
        web_triggered = False
        web_fragments_ingested = 0
        full_response_accumulator = [] # 🧠 Track output tokens to cache at final generation slice

        # Emit initial sliding context history pruning metrics down the telemetry wire if tripped
        if history_pruned:
            yield f"data: {json.dumps({'status_update': f'Context pruned by {pruned_count} indices.', 'done': False})}\n\n"

        # 🧵 STEP 1: Evaluate Strategy & Query Local ChromaDB Vector Database
        if body.rag_mode != "off" and last_user_message:
            logger.info(f"🔍 Executing ChromaDB semantic vector search strategy [Mode: {body.rag_mode}]")
            yield f"data: {json.dumps({'status_update': 'Querying local ChromaDB vector store...', 'done': False})}\n\n"
            
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
                logger.error(f"❌ Search breakdown: {str(e)}")
                yield f"data: {json.dumps({'status_update': f'❌ RAG Error: {str(e)}', 'done': False})}\n\n"

        # 🧵 STEP 2: Deploy Autonomous Web Scraper (Agent Target Trigger Words Intercept)
        trigger_words = ["web", "live", "current", "search", "latest", "google"]
        if any(word in last_user_message.lower() for word in trigger_words):
            web_triggered = True
            logger.info(f"🌐 Scraper Match: Target trigger detected. Dispatching DuckDuckGo scraper loop...")
            yield f"data: {json.dumps({'status_update': 'Agent triggered. Deploying Web Crawler...', 'done': False})}\n\n"
            
            try:
                raw_web_data = await AutonomousWebScraper.fetch_live_web_context(last_user_message)
                if raw_web_data:
                    rag_context += "\n[LIVE WEB SEARCH CONTEXT]:\n" + raw_web_data
                    web_fragments_ingested = 3
                    logger.info("🟢 Web scraping complete. Grounded context matrix updated successfully.")
            except Exception as e:
                logger.error(f"❌ Scraper failure: {str(e)}")
                yield f"data: {json.dumps({'status_update': f'❌ Scraper Error: {str(e)}', 'done': False})}\n\n"

        # 🧵 STEP 3: Assemble Context Re-Alignment Matrix & System Directive Constraints
        base_system_prompt = body.system_prompt or "You are H.I.V.E., a hardened local AI orchestration assistant."
        augmented_system_instructions = (
            f"{base_system_prompt}\n\n"
            f"CRITICAL SYSTEM DIRECTIVE:\n"
            f"Prioritize facts, metrics, and data provided in context blocks over base weights.\n"
            f"{rag_context}"
        )

        # Append data parameters into message payload at safe starting index
        if messages_payload and messages_payload[0]["role"] == "system":
            messages_payload[0]["content"] = augmented_system_instructions
        else:
            messages_payload.insert(0, {"role": "system", "content": augmented_system_instructions})

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
                            
                            if content_token:
                                full_response_accumulator.append(content_token)

                            # Emit structural token payloads directly down the SSE client line wrapper
                            yield f"data: {json.dumps({'token': content_token, 'done': done_flag})}\n\n"
                            
                            if done_flag:
                                total_generation_latency = time.time() - start_generation_time
                                complete_text = "".join(full_response_accumulator)
                                if complete_text.strip():
        # Check if we can commit asynchronously to prevent loop collisions
                                    try:
                                        loop = asyncio.get_running_loop()
                                        if asyncio.iscoroutinefunction(cache_manager.commit_to_cache):
                                            loop.create_task(cache_manager.commit_to_cache(last_user_message, complete_text, total_generation_latency))
                                        else:
                # If it's a regular synchronous def function, run it in an executor thread
                                            loop.run_in_executor(None, cache_manager.commit_to_cache, last_user_message, complete_text, total_generation_latency)
                                    except Exception as cache_err:
                                        logger.error(f"⚠️ Cache tracking optimization bypass: {cache_err}")
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