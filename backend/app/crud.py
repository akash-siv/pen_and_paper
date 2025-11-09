# app/crud.py
from uuid import UUID
from sqlalchemy.orm import Session
from .models import User
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
import logging

logger = logging.getLogger(__name__)


def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, uid):
    """
    Synchronous helper: returns User by UUID or string id, or None.
    Accepts either a UUID object or a string.
    """
    try:
        uid_val = uid if isinstance(uid, UUID) else UUID(str(uid))
    except Exception:
        return None
    return db.query(User).filter(User.id == uid_val).first()


def create_user(db, email: str, password: str, name: str):
    try:
        user = User(email=email, password=password, name=name)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except SQLAlchemyError as e:
        db.rollback()
        logger.exception("create_user failed")
        # re-raise so caller can inspect, or return an error object
        raise
