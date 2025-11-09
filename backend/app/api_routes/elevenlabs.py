# app/api_routes/elevenlabs.py
import ast
import base64
import os
import uuid
import json
import time
import datetime
import logging
from google import genai

from .documents import get_or_create_meili_index, meili_client
from ..db import get_db
from sqlalchemy.orm import Session

from fastapi.responses import StreamingResponse
from ..models import Document, User

from starlette.concurrency import run_in_threadpool
from elevenlabs.client import ElevenLabs
from datetime import datetime
from ..config import (
    ELEVENLABS_VOICE_ID, ELEVENLABS_API_KEY, MEILI_INDEX_NAME, GEMINI_API_KEY, GEMINI_MODEL
)

print("ElevenLabs API Key:", ELEVENLABS_API_KEY)
print("ElevenLabs Voice ID:", ELEVENLABS_VOICE_ID)
print("Gemini API Key:", GEMINI_API_KEY)
print("Gemini Model:", GEMINI_MODEL)
print("Meili Index Name:", MEILI_INDEX_NAME)

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, requests
from fastapi.responses import JSONResponse
from ..dependencies import get_current_user  # common name

API_KEY = ELEVENLABS_API_KEY
VOICE_ID = ELEVENLABS_VOICE_ID
MODEL_ID = "eleven_flash_v2"
if not API_KEY:
    raise RuntimeError("Missing ELEVENLABS_API_KEY in .env")
client = ElevenLabs(api_key=API_KEY)

from ..schemas import SearchRequest, DownloadRequest, TTSRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/elevenlabs", tags=["TTS and STT"])


def _to_bytes_from_audio_obj(audio_obj) -> bytes:
    """
    Convert possible return types from ElevenLabs text_to_speech.convert(...)
    into a single bytes object.
    This runs in a threadpool to avoid blocking the event loop.
    """
    # Case: already bytes-like
    if isinstance(audio_obj, (bytes, bytearray)):
        return bytes(audio_obj)

    # Case: file-like object (has read())
    if hasattr(audio_obj, "read"):
        data = audio_obj.read()
        if isinstance(data, (bytes, bytearray)):
            return bytes(data)
        # sometimes .read() may yield an iterator; fallthrough to iterable handling

    # Case: requests.Response-like with iter_content
    if hasattr(audio_obj, "iter_content"):
        buf = bytearray()
        for chunk in audio_obj.iter_content(chunk_size=8192):
            if chunk:
                buf.extend(chunk)
        return bytes(buf)

    # Case: iterable/generator of byte chunks
    if hasattr(audio_obj, "__iter__") and not isinstance(audio_obj, (str, bytes, bytearray)):
        buf = bytearray()
        for chunk in audio_obj:
            if isinstance(chunk, str):
                chunk = chunk.encode("utf-8")
            if chunk:
                buf.extend(chunk)
        return bytes(buf)

    # Unknown type
    raise TypeError(f"Unhandled audio object type: {type(audio_obj)}")


@router.post("/tts")
async def tts_endpoint(req: TTSRequest):
    """
    Request body JSON:
    {
      "text": "Hello world",
      "voice_id": "your_voice_id",            # optional, will use default if None
      "model_id": "eleven_multilingual_v2",   # optional
      "output_format": "mp3_44100_128"        # optional
    }
    Returns: audio/mpeg streaming response (mp3)
    """
    if not req.text:
        raise HTTPException(status_code=400, detail="Missing 'text' in request")

    # call ElevenLabs in threadpool (sync client)
    def get_audio_bytes():
        audio_obj = client.text_to_speech.convert(
            text=req.text,
            voice_id=req.voice_id,
            model_id=req.model_id,
            output_format=req.output_format,
        )
        return _to_bytes_from_audio_obj(audio_obj)

    try:
        audio_bytes = await run_in_threadpool(get_audio_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {e}")

    # Optional: set filename
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"eleven_tts_{ts}.mp3"

    async def streamer():
        # yield the whole bytes object in one chunk
        yield audio_bytes

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"'
    }
    return StreamingResponse(streamer(), media_type="audio/mpeg", headers=headers)


@router.post("/stt")
async def stt_endpoint(file: UploadFile = File(...)):
    """
    Accepts multipart/form-data 'file' field (audio file).
    Returns JSON with the transcription.
    """
    # Basic validation
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    # Use the UploadFile.file (a SpooledTemporaryFile) directly in threadpool
    def do_transcribe():
        # Ensure pointer at start
        file.file.seek(0)
        transcription = client.speech_to_text.convert(
            file=file.file,
            model_id="scribe_v1",
            tag_audio_events=False,
            language_code="eng",  # let model auto-detect (or set "eng")
            diarize=False,
        )
        return transcription

    try:
        result = await run_in_threadpool(do_transcribe)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STT failed: {e}")

    # The SDK may return different shapes (dict/object). Try to unwrap common fields.
    # If it's a dict-like object, try standard keys; otherwise return repr.
    try:
        # if object has .text attribute
        text = getattr(result, "text", None)
        if text is None and isinstance(result, dict):
            # try nested structures
            text = result.get("text") or result.get("transcription") or result.get("result")
        if text is None:
            # fallback to string representation
            text = str(result)
    except Exception:
        text = str(result)

    return JSONResponse(content={"transcription": text})



# Then the endpoint:
@router.post("/voice_query")
async def voice_query_endpoint(
    file: UploadFile = File(...),
    top_k: int = Form(5),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Single endpoint that:
      1) transcribes uploaded audio,
      2) searches Meili for relevant docs (user-scoped),
      3) sends context+query to Gemini (genai) for summarization,
      4) synthesizes summary to audio (ElevenLabs),
      5) returns JSON: { transcription, summary, audio_base64, audio_mime }.
    """
    # 1) STT (run in threadpool to avoid blocking)
    def do_transcribe():
        # Ensure pointer at start
        file.file.seek(0)
        stt_result = client.speech_to_text.convert(
            file=file.file,
            model_id="scribe_v1",
            tag_audio_events=False,
            language_code="eng",  # or let it auto-detect
            diarize=False,
        )
        # try to extract text similar to your existing logic
        text = getattr(stt_result, "text", None)
        if text is None and isinstance(stt_result, dict):
            text = stt_result.get("text") or stt_result.get("transcription") or stt_result.get("result")
        if text is None:
            text = str(stt_result)
        return text

    try:
        transcription = await run_in_threadpool(do_transcribe)
    except Exception as e:
        logger.exception("STT failed")
        raise HTTPException(status_code=500, detail=f"STT failed: {e}")

    transcription = (transcription or "").strip()
    if not transcription:
        raise HTTPException(status_code=400, detail="Transcription empty")

    # 2) Search Meili (threadpool)
    def do_search(query_text: str, k: int):
        idx = get_or_create_meili_index(meili_client, MEILI_INDEX_NAME)
        # build user-scoped filter
        user_filter = f'user_id = "{str(current_user.id)}"'
        params = {
            "limit": max(1, min(50, k)),
            "offset": 0,
            "attributesToRetrieve": ["id", "content", "title", "date", "book_id", "tags"],
        }
        # include filter
        params["filter"] = user_filter
        res = idx.search(query_text, params)
        return res

    try:
        search_res = await run_in_threadpool(do_search, transcription, top_k)
    except Exception as e:
        logger.exception("Meili search failed")
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")

    hits = search_res.get("hits", []) if isinstance(search_res, dict) else []
    # Build a compact context: join top results (trim long docs)
    parts = []
    for h in hits[:top_k]:
        title = h.get("title") or h.get("book_id") or "doc"
        content = h.get("content") or ""
        snippet = content.strip()
        if len(snippet) > 2000:
            snippet = snippet[:2000] + " …"
        parts.append(f"---\nTitle: {title}\n{snippet}\n---")

    context_text = "\n\n".join(parts) if parts else ""

    # 3) Build RAG prompt and call Gemini (run in threadpool)
    prompt = (
        "You are a helpful retrieval-augmented assistant. Answer the user's question using ONLY the relevant parts "
        "of the retrieved context. Do not hallucinate. If the answer is not in the context, say so concisely.\n\n"
        f"User query (from audio): {transcription}\n\n"
        f"Context:\n{context_text}\n\n"
        "Provide a short, clear concise summary/answer (one to three short paragraphs)."
    )

    def do_genai(prompt_text: str):
        gen_ai_client = genai.Client(api_key=GEMINI_API_KEY)
        resp = gen_ai_client.models.generate_content(
            model="gemma-3-4b-it",
            contents=prompt_text,
        )
        # genai SDK: prefer .text but be defensive
        out = getattr(resp, "text", None)
        if out is None and isinstance(resp, dict):
            out = resp.get("output", resp.get("text")) or str(resp)
        return out

    try:
        genai_summary = await run_in_threadpool(do_genai, prompt)
    except Exception as e:
        logger.exception("GenAI call failed")
        raise HTTPException(status_code=500, detail=f"GenAI summarization failed: {e}")

    genai_summary = (genai_summary or "").strip()
    if not genai_summary:
        genai_summary = "I couldn't generate a summary."

    # 4) TTS: synthesize the summary with ElevenLabs (run in threadpool)
    def do_tts_and_get_bytes(text_to_speak: str):
        # call SDK convert (sync)
        tts_obj = client.text_to_speech.convert(
            text=text_to_speak,
            voice_id=VOICE_ID,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )
        # _to_bytes_from_audio_obj exists earlier in your module; reuse it
        audio_bytes = _to_bytes_from_audio_obj(tts_obj)
        return audio_bytes

    try:
        audio_bytes = await run_in_threadpool(do_tts_and_get_bytes, genai_summary)
    except Exception as e:
        logger.exception("TTS failed")
        raise HTTPException(status_code=500, detail=f"TTS failed: {e}")

    # 5) encode audio as base64 and return JSON with transcription + summary
    b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
    audio_mime = "audio/mpeg"  # matches mp3_44100_128

    return JSONResponse(
        content={
            "transcription": transcription,
            "summary": genai_summary,
            "meili_hits": hits[:top_k],
            "audio_base64": b64_audio,
            "audio_mime": audio_mime,
        }
    )
