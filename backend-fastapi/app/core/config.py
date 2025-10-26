"""Application configuration settings"""

from typing import List

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load environment variables from .env file
load_dotenv()


class Settings(BaseSettings):
    """Application settings"""

    # Basic settings
    PROJECT_NAME: str = "Harmoniq API"
    VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]

    # LavaLabs settings (forwards to Anthropic)
    LAVA_API_KEY: str = ""
    LAVA_BASE_URL: str = "https://api.lavapayments.com/v1/forward?u=https://api.anthropic.com/v1/messages"
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20240620"
    ANTHROPIC_VERSION: str = "2023-06-01"

    # Database settings (add when needed)
    # DATABASE_URL: str = "postgresql://user:password@localhost/dbname"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


settings = Settings()

