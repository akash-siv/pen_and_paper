# app/config.py

import os
from dotenv import load_dotenv

# Load the .env file (adjust path if your .env is elsewhere)
env_path = 'app/.env'
load_dotenv(dotenv_path=env_path)

# Local Postgres Database
POSTGRES_USER = os.getenv("POSTGRES_USER")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_DB = os.getenv("POSTGRES_DB")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")

# Supabase URL (full connection string)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET_NAME")

# Final SQLAlchemy URL used by db.py
SQLALCHEMY_DATABASE_URL = os.getenv("SUPABASE_POSTGRESS_URL")  # or build from POSTGRES_* if you prefer local

# JWT
SECRET_KEY = os.getenv("SECRET_KEY", "CHANGE_THIS_TO_SOMETHING_SECURE")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# CORS
cors_origins_raw = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]


# MeiliSearch Configuration
MEILI_URL = os.getenv("MEILI_URL", "http://192.168.2.15:7700")
MEILI_MASTER_KEY = os.getenv("MEILI_MASTER_KEY")
MEILI_INDEX_NAME = os.getenv("MEILI_INDEX_NAME", "handwritten_notes")

# Gemini API Key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL")

# ElevenLabs API Key
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")
