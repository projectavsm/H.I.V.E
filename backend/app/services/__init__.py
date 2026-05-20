import httpx
import json
from app.config import settings

class OllamaInferenceService:
    """
    Broker service handling safe network boundaries between the FastAPI API Gateway 
    and the localized Ollama inference process on Port 11434.
    """
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model_target = settings.OLLAMA_MODEL

    async def verify_runtime_liveness(self) -> bool:
        """Pings the underlying local AI runtime to guarantee availability."""
        async with httpx.AsyncClient(timeout=3.0) as client:
            try:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
            except (httpx.ConnectError, httpx.TimeoutException):
                return False

# Export as a service singleton asset
inference_service = OllamaInferenceService()