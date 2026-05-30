import asyncio
import json  # Fixes: "json" is not defined
from fastapi import APIRouter  # Used to initialize the router
from fastapi.responses import StreamingResponse

# Initialize the APIRouter instance
# Fixes: "router" is not defined
router = APIRouter()

async def telemetry_streamer():
    while True:
        # Mock payload: Replace with your actual system/VRAM monitoring logic
        data = {
            "vram_usage": "2.4GB", 
            "cache_hits": 12,
            "status": "online"
        } 
        
        # Yield as a Server-Sent Event (SSE) formatted string
        yield f"data: {json.dumps(data)}\n\n"
        
        # Throttled update interval (updates every 2 seconds instead of spamming)
        await asyncio.sleep(2.0)

@router.get("/api/telemetry")
async def get_telemetry():
    """
    Streams runtime engine telemetry metrics back to the client interface
    using a persistent Server-Sent Events (SSE) connection.
    """
    return StreamingResponse(telemetry_streamer(), media_type="text/event-stream")