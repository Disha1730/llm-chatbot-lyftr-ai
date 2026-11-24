import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    LLM_API_KEYS: str = "mock-key-1,mock-key-2"
    DATABASE_URL: str = "sqlite:///./app.db"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,*"
    ENABLE_FAILURE_SIMULATION: bool = True
    LLM_MODEL: str = "gemini/gemini-3.8-flash"
    DEFAULT_SYSTEM_PROMPT: str = "You are a helpful, accurate, and concise AI assistant."

    @property
    def api_key_list(self) -> List[str]:
        keys = [k.strip() for k in self.LLM_API_KEYS.split(",") if k.strip()]
        return keys

    @property
    def cors_origins(self) -> List[str]:
        origins = [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        return origins

    @property
    def sqlite_db_path(self) -> str:
        # Format can be sqlite:////data/app.db or sqlite:///./app.db
        url = self.DATABASE_URL
        if url.startswith("sqlite:///"):
            return url.replace("sqlite:///", "", 1)
        elif url.startswith("sqlite://"):
            return url.replace("sqlite://", "", 1)
        return url


settings = Settings()
