import os
import json
import logging
import asyncio
from contextlib import asynccontextmanager
import httpx

from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.api import router as api_router
from app.services.rag_service import LocalRAGEngine  # Hook into updated memory engine class

# =========================================================================
# 1. INITIALIZE STRUCTURED LOGGING
# =========================================================================
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("H.I.V.E.Gateway")

# =========================================================================
# 2. CONFIGURE RATE LIMITER ENGINE
# =========================================================================
limiter = Limiter(key_func=get_remote_address)

# Global memory queue map tracking file streaming status updates for live telemetry feed hooks
telemetry_logs = []

# Instantiate the local RAG engine singleton wrapper
rag_engine = LocalRAGEngine()

# =========================================================================
# 3. LIFECYCLE MANAGEMENT (LIFESPAN)
# =========================================================================
@asynccontextmanager
async def app_lifespan(app: FastAPI):
    """
    Manages safe, unblocked resource initialization and graceful teardown
    contracts for local engine runtimes.
    """
    logger.info(f"🛡️ H.I.V.E. Core Boot Sequence initiated. Targets: {settings.OLLAMA_MODEL}")
    yield
    logger.info("🛑 H.I.V.E. Core System Teardown Complete.")

# =========================================================================
# 4. INSTANTIATE FASTAPI ENGINE
# =========================================================================
app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,  # Hardened Security: Sandbox Swagger Docs to Debug mode only
    redoc_url=None,
    lifespan=app_lifespan
)

# Bind the operational rate limiting reference state
app.state.limiter = limiter

# =========================================================================
# 5. ERROR & EXCEPTION MANAGEMENT HANDLERS
# =========================================================================
@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Gracefully intercepts client spam vectors, responding with isolated 429 schemas."""
    logger.warning(f"⚠️ Security Event: Rate limit tripped from Host IP: {request.client.host}")
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many operational requests. Please wait before executing more inference tasks."}
    )

# =========================================================================
# 6. ENFORCE CROSS-ORIGIN RESOURCE SHARING (CORS) BOUNDARIES
# =========================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"], # Maintained origins alongside wildcard stream fallback
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================================
# 7. MOUNT ARCHITECTURAL SUB-ROUTERS
# =========================================================================
# This guarantees that all sub-endpoints within your api folder parse reliably
app.include_router(api_router, prefix="/api")

# =========================================================================
# 8. NEW CORE ENGINE RAG & STREAMING PIPELINE ROUTINGS
# =========================================================================

@app.get("/api/telemetry")
async def get_telemetry():
    """Flushes active state updates straight to UI visualization blocks."""
    global telemetry_logs
    current_snapshots = list(telemetry_logs)
    telemetry_logs.clear()
    return {"events": current_snapshots}

@app.post("/api/upload")
async def upload_document_endpoint(file: UploadFile = File(...)):
    """
    Receives binary document frames natively, updates logging array layers, 
    and awaits the asynchronous RAG engine ingestion safely.
    """
    try:
        # 1. Read binary blocks straight from memory payload
        file_bytes = await file.read()
        
        # 2. Local telemetry logging callback helper
        def log_to_telemetry(msg: str):
            # If you maintain a global telemetry array in main.py, append it here
            # e.g., telemetry_logs.append(msg)
            logger.info(f"[TELEMETRY] {msg}")

        # 3. CRITICAL: Both the endpoint must be 'async def' and this line must use 'await'
        result = await rag_engine.ingest_document(
            file_bytes=file_bytes, 
            filename=file.filename, 
            telemetry_callback=log_to_telemetry
        )
        
        # 4. Explicitly return the raw dictionary result to the serialization array
        return result

    except Exception as e:
        logger.error(f"❌ Real-time UI ingestion failure inside main gateway: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal database ingestion compilation error: {str(e)}")

#@app.post("/api/chat/stream")
#async def stream_chat_response(payload: dict):
#    """Fuses database semantic context strings with model generations using local SSE frames."""
#    user_prompt = payload.get("message", "")
#    target_file = payload.get("target_file", None) # Maintains structural Vault filters
#    
#    # Extract historical vector contexts natively using your preserved threshold scoring logic
#    contexts = await rag_engine.query_knowledge_base(user_prompt, top_k=2, target_file=target_file)
#    
#    system_prompt = "You are H.I.V.E Core, an advanced, highly strategic localized AI intelligence construct."
#    if contexts:
#        context_str = "\n\n".join([c["text"] for c in contexts])
#        system_prompt += f"\nInject the following localized structural system database context profiles into your final response logic:\n{context_str}"
#
#   async def ollama_generator():
#       # Build URL dynamically via config singleton to protect Windows loopbacks
#        ollama_url = f"{settings.OLLAMA_BASE_URL}/api/generate"
#        ollama_payload = {
#            "model": settings.OLLAMA_MODEL,
#            "prompt": f"{system_prompt}\n\nUser: {user_prompt}\nResponse:",
#            "stream": True
#        }
#        
#        async with httpx.AsyncClient(timeout=60.0) as client:
#            async with client.stream("POST", ollama_url, json=ollama_payload) as response:
#                if response.status_code != 200:
#                    yield f"data: {json.dumps({'error': 'Ollama connection failed'})}\n\n"
#                    return
#                
#                async_lines = response.aiter_lines()
#                async for line in async_lines:
#                    if line:
#                        parsed_line = json.loads(line)
#                        token = parsed_line.get("response", "")
#                        done = parsed_line.get("done", False)
#                        
#                        # Pack individual string components inside Server-Sent Event envelopes
#                        yield f"data: {json.dumps({'token': token, 'done': done})}\n\n"
#                       
#                        if done:
#                            break
#
#    return StreamingResponse(ollama_generator(), media_type="text/event-stream")


# =========================================================================
# 9. CORE ROOT LIVENESS ENDPOINT
# =========================================================================
@app.get("/api/health")
@limiter.limit("5/minute")
async def health_check_endpoint(request: Request):
    """Self-hosted telemetry diagnostic heartbeat asset."""
    return {
        "status": "healthy",
        "engine": settings.APP_NAME,
        "active_model": settings.OLLAMA_MODEL,
        "isolation_mode": "strict-local"
    }

logger.info(f"🚀 H.I.V.E. Middleware Operational Mode: [Isolated] on Local Interface Matrix")