import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse

from app.config import settings
from app.api import router as api_router

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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
# 8. CORE ROOT LIVENESS ENDPOINT
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