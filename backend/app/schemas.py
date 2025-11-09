# app/schemas.py
import os
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID, uuid4
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")

API_KEY = os.getenv("ELEVENLABS_API_KEY")
VOICE_ID = os.getenv("ELEVEN_VOICE_ID")
MODEL_ID = "eleven_flash_v2"


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    created_at: Optional[datetime]

    class Config:
        orm_mode = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


class LoginResponse(Token):
    user_id: Optional[str] = None
    book_ids: List[str] = []


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SearchRequest(BaseModel):
    q: Optional[str] = Field("", description="Query text; empty string allowed to run filter-only queries")
    limit: int = Field(20, ge=1, le=100, description="Number of results to return (1-100)")
    offset: int = Field(0, ge=0, description="Result offset")
    book_id: Optional[str] = Field(None, description="Filter by book_id")
    tags: Optional[List[str]] = Field(None, description="Filter by tags. Provide multiple tags in an array")
    tags_mode: str = Field("or", pattern="^(or|and)$", description="How to combine multiple tags: 'or' or 'and'")
    date_equals: Optional[str] = Field(None, description="Exact date to match (e.g. '5-2-22' or '05/02/2022')")


class DownloadRequest(BaseModel):
    book_ids: List[str] = Field(..., min_items=1, description="List of book_id folder names to download")
    # optional target path under the server DOWNLOAD_BASE_DIR (relative). If omitted uses default downloads dir.
    target_path: Optional[str] = Field(None, description="Optional relative sub-path under server download base")


class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = VOICE_ID
    model_id: Optional[str] = MODEL_ID
    output_format: Optional[str] = "mp3_44100_128"
