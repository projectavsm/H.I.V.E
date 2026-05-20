import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator

class HiveSettings(BaseSettings):
    """
    H.I.V.E. Configuration Engine.
    Leverages Pydantic to strictly parse and validate runtime environment parameters.
    """
    APP_NAME: str = Field(default="H.I.V.E. Core Engine")
    DEBUG: bool = Field(default=False)
    
    OLLAMA_BASE_URL: str = Field(default="http://localhost:11434")
    OLLAMA_MODEL: str = Field(default="llama3.1")
    
    BASE_DIR: str = Field(default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    VECTOR_STORE_DIR: str = Field(default="")

    @field_validator("OLLAMA_BASE_URL")
    @classmethod
    def sanitize_base_url(cls, v: str) -> str:
        if v.endswith("/"):
            return v.rstrip("/")
        return v

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

# This instantiates the singleton asset that main.py tries to import!
settings = HiveSettings()

# Dynamically map the target relative to your desktop layout
settings.VECTOR_STORE_DIR = os.path.abspath(os.path.join(settings.BASE_DIR, "..", "vector_store"))