import json
import logging
import httpx
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from app.models import ChatCompletionRequest
from app.config import settings

logger = logging.getLogger("H.I.V.E.Router")

# Instantiate the API Router asset cleanly
router = APIRouter()

async def stream_ollama_tokens(payload: dict):
    """
    Asynchronous generator connecting directly to the local Ollama daemon socket.
    Consumes chunked JSON objects and yields standard text/event-stream data lines.
    """
    timeout = httpx.Timeout(60.0, connect=5.0)
    
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            # Connect asynchronously to the local Ollama generation pipeline
            async with client.stream(
                "POST", 
                f"{settings.OLLAMA_BASE_URL}/api/chat", 
                json=payload
            ) as response:
                
                if response.status_code != 200:
                    error_detail = await response.aread()
                    logger.error(f"Ollama operational error: {response.status_code} - {error_detail}")
                    yield f"data: {json.dumps({'error': 'Failed to communicate with underlying AI runtime.'})}\n\n"
                    return

                # Read incoming lines off the stream buffer as they are generated
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    
                    try:
                        chunk = json.loads(line)
                        # Extract the token payload text from the standard Ollama schema
                        content_token = chunk.get("message", {}).get("content", "")
                        done_flag = chunk.get("done", False)
                        
                        # Package the token into a compliant Server-Sent Events (SSE) data frame
                        yield f"data: {json.dumps({'token': content_token, 'done': done_flag})}\n\n"
                        
                        if done_flag:
                            break
                    except json.JSONDecodeError:
                        continue
                        
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.critical(f"Runtime communication collapse: {str(e)}")
            yield f"data: {json.dumps({'error': 'Local AI engine runtime is currently offline.'})}\n\n"

@router.post("/chat/stream")
async def chat_completion_endpoint(request: Request, body: ChatCompletionRequest):
    """
    Hardened API Gateway Route enforcing Pydantic structural validation
    and executing isolated streaming passes.
    """
    logger.info(f"⚡ Processing inference execution stream request. Message count: {len(body.messages)}")
    
    # Restructure incoming validated arrays to match Ollama's expected API signature
    ollama_payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": [msg.model_dump() for msg in body.messages],
        "stream": True
    }
    
    # Inject systemic baseline instructions if custom system prompt definitions exist
    if body.system_prompt:
        ollama_payload["messages"].insert(0, {
            "role": "system",
            "content": body.system_prompt
        })

    return StreamingResponse(
        stream_ollama_tokens(ollama_payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )