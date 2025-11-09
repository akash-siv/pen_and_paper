# app/api_routes/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import logging
from typing import List, Optional

from pydantic import BaseModel

from ..schemas import UserCreate, Token, LoginRequest, LoginResponse
from ..crud import get_user_by_id, create_user, get_user_by_email
from ..db import get_db
from ..auth_utils import create_access_token, verify_password
from ..config import ACCESS_TOKEN_EXPIRE_MINUTES, SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# Create a supabase client for storage listing (server-side)
try:
    from supabase import create_client as create_supabase_client
except Exception:
    create_supabase_client = None

if create_supabase_client and SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_supabase_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception:
        supabase = None
        logger.exception("Failed to initialize Supabase client in auth.py")
else:
    supabase = None



@router.post("/signup", response_model=Token)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    existing = get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    try:
        # ensure create_user stores a hashed password (see crud.create_user)
        user = create_user(db, payload.email, payload.password, payload.name)
    except Exception as e:
        logger.exception("signup: create_user raised")
        raise HTTPException(status_code=500, detail="Unable to create user (see server logs)")

    # put user.id (UUID) as a string in `sub`
    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        additional_claims={"email": user.email},
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = get_user_by_email(db, payload.email)
    # plain text check (you said you want raw passwords for now)
    if not user or user.password != payload.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        additional_claims={"email": user.email},
    )

    book_ids: List[str] = []
    bucket_name = SUPABASE_BUCKET or "pen_and_paper"

    if supabase and bucket_name:
        try:
            # Different supabase client versions use different signatures.
            # Common: supabase.storage.from_(bucket).list(path)
            # Try listing with the user prefix; adapt if your client expects `path=` keyword.
            raw_list = supabase.storage.from_(bucket_name).list(str(user.id))
            data_list = []
            if isinstance(raw_list, dict):
                data_list = raw_list.get("data") or []
            elif isinstance(raw_list, list):
                data_list = raw_list
            else:
                data_list = []

            found = []
            for item in data_list:
                name = None
                if isinstance(item, dict):
                    name = item.get("name") or item.get("path") or item.get("id")
                else:
                    name = str(item)

                if not name:
                    continue

                parts = name.split("/")
                if parts[0] == str(user.id):
                    if len(parts) >= 2:
                        candidate = parts[1]
                    else:
                        continue
                else:
                    candidate = parts[0]

                # skip obvious filenames
                if "." in candidate:
                    continue

                found.append(candidate)

            book_ids = sorted(set(found))
        except Exception:
            logger.exception("Failed to list supabase storage for user %s", user.id)
            book_ids = []
    else:
        logger.debug("Supabase client or bucket not configured; skipping book listing")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "book_ids": book_ids,
    }