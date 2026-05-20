import json
import logging
import httpx
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from app.models import ChatCompletionRequest
from app.config import settings

# Initialize high-performance logger mapped to the H.I.V.E Router channel
logger = logging.getLogger("H.I.V.E.Router")

# Instantiate the API Router asset cleanly
router = APIRouter()

async def stream_ollama_tokens(payload: dict):
    """
    Asynchronous generator connecting directly to the local Ollama daemon socket.
    Consumes chunked JSON lines, extracts content tokens, and yields standard 
    Server-Sent Events (SSE) data lines.
    """
    # Defensive connection and payload generation timeouts
    timeout = httpx.Timeout(60.0, connect=5.0)
    
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

@router.post("/chat/stream")
async def chat_completion_endpoint(request: Request, body: ChatCompletionRequest):
    """
    Hardened API Gateway Route enforcing Pydantic structural validation,
    applying proactive server-side FIFO context sliding-window pruning,
    and reserving execution space for localized Top-K RAG injections.
    """
    # -------------------------------------------------------------------------
    # DEFENSE LAYER 1: MIDDLEWARE-LEVEL SLIDING CONTEXT WINDOW (FIFO PRUNING)
    # -------------------------------------------------------------------------
    # Restrict active historic elements to a strict count limit. This keeps the prompt size 
    # lean and prevents prompt-bloat from expanding the KV cache into shared GPU memory.
    MAX_HISTORIC_MESSAGES = 10
    messages_payload = [msg.model_dump() for msg in body.messages]
    
    if len(messages_payload) > MAX_HISTORIC_MESSAGES:
        logger.warning(
            f"⚠️ Context bloat caught ({len(messages_payload)} messages). "
            f"Pruning oldest records to match strict FIFO VRAM safety bounds."
        )
        # Keep only the N most recent message nodes
        messages_payload = messages_payload[-MAX_HISTORIC_MESSAGES:]

    logger.info(f"⚡ Processing inference stream. Active payload count: {len(messages_payload)}")
    
    # -------------------------------------------------------------------------
    # DEFENSE LAYER 2: TOP-K RAG SERVICE INJECTION PIPELINE PRESET (FUTURE PHASE)
    # -------------------------------------------------------------------------
    # [ARCHITECTURAL CONTRACT]: When ChromaDB/FAISS vector indexes are attached next, 
    # query results must be restricted to a hard cap of K=3 chunks max (500 chars/chunk).
    # Those 3 retrieved text nodes will be appended directly below this point into the 
    # messages_payload array as context data frames before passing upstream to the model.

    # -------------------------------------------------------------------------
    # DEFENSE LAYER 3: HARDENED ENVIRONMENT-AWARE HARDWARE LIMITS
    # -------------------------------------------------------------------------
    # Explicitly configure options to keep model execution inside the 8GB physical VRAM pool.
    ollama_payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": messages_payload,
        "stream": True,
        "options": {
            "num_ctx": 4096,      # Limit total token pool allocation for the memory context cache
            "temperature": 0.4,   # Keep reasoning path deterministic and professional
            "num_predict": 1024   # Cap the output response length allowed per user turn
        }
    }
    
    # -------------------------------------------------------------------------
    # CORE RE-ALIGNMENT: IMMUTABLE SYSTEM PROMPT ANCHORING
    # -------------------------------------------------------------------------
    # Always insert the overarching system-level baseline instructions at Index 0.
    # This prevents your FIFO sliding logic from accidentally pruning away the core H.I.V.E identity.
    if body.system_prompt:
        ollama_payload["messages"].insert(0, {
            "role": "system",
            "content": body.system_prompt
        })

    # Return the real-time stream with forced low-latency cache proxy bypass controls
    return StreamingResponse(
        stream_ollama_tokens(ollama_payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disables proxy buffering to force instant UI token updates
        }
    )