from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from .schemas import TokenData
from .crud import get_user_by_id
from .db import get_db
from .auth_utils import decode_access_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # decode_access_token raises HTTPException(401) on invalid token
    payload = decode_access_token(token)

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise credentials_exception

    # convert subject -> UUID (adjust if you stored plain int/string ids)
    try:
        user_uuid = UUID(user_id_str)
    except Exception:
        raise credentials_exception

    user = get_user_by_id(db, user_uuid)
    if user is None:
        raise credentials_exception

    return user