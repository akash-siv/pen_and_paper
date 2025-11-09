# app/auth_utils.py
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import jwt, JWTError
from typing import Optional, Dict, Any
from fastapi import HTTPException, status

from .config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
        subject: str,
        expires_delta: Optional[timedelta] = None,
        additional_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Create a JWT where `subject` is stored in the `sub` claim.
    `subject` can be the user id (recommended) or any identifier.
    `additional_claims` can include email, roles, etc.
    """
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode: Dict[str, Any] = {"sub": subject, "iat": now, "exp": expire}
    if additional_claims:
        # don't overwrite 'sub', 'exp', 'iat'
        for k, v in additional_claims.items():
            if k in ("sub", "exp", "iat"):
                continue
            to_encode[k] = v

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate token. Raises HTTPException(401) if invalid.
    Returns the token payload (dict) on success.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
