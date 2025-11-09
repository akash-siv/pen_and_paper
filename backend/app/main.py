# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api_routes import auth
from .api_routes import documents
from .api_routes import elevenlabs
from .config import CORS_ORIGINS
from .models import Base
from .db import engine
import os

app = FastAPI(title="Pen and Paper")

app.add_middleware(
    CORSMiddleware,
    # allow_origins=[origin for origin in __import__("app.config").config.CORS_ORIGINS] if hasattr(
    #     __import__("app.config").config, "CORS_ORIGINS") else ["*"],
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(elevenlabs.router)


# @app.on_event("startup")
# def on_startup():
#     # create tables if they don't exist
#     Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"ok": True, "msg": "Pen & Paper API"}
