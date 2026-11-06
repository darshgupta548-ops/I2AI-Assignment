import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Root directory of the repository
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
BACKEND_DIR = BASE_DIR / "backend"
STORAGE_DIR = BACKEND_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
DATASETS_DIR = STORAGE_DIR / "datasets"

class Settings(BaseSettings):
    APP_NAME: str = "Smart Hostel Energy Advisor"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # SQLite Database
    DATABASE_URL: str = f"sqlite:///{BACKEND_DIR}/smart_hostel_energy.db"
    
    # Gemini AI API Configuration
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    
    # Storage Paths
    UPLOADS_DIR: Path = UPLOADS_DIR
    DATASETS_DIR: Path = DATASETS_DIR

    model_config = {
        "env_file": str(BASE_DIR / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }

# Ensure directories exist
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
DATASETS_DIR.mkdir(parents=True, exist_ok=True)

settings = Settings()
