# async_batch_pdf.py
import asyncio
import io
import json
import mimetypes
import os
import random
import tempfile
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List, Optional, Dict, Any

from dotenv import load_dotenv
from pdf2image import convert_from_path
from google import genai
from google.genai import types
from PIL import Image
import io as _io  # you already had `import io`; using alias to avoid shadowing
import logging
from app.config import GEMINI_API_KEY, GEMINI_MODEL

_logger = logging.getLogger(__name__)

# import your preprocess helper functions from preprocessor.py
# which should expose: simple_preprocess_page(pil_page, ...) and cv2_to_pil(img)
from preprocessor import simple_preprocess_page, cv2_to_pil

# reuse your prompt module
import prompt

# reuse your Pydantic model + parse_and_validate_llm implementation (copy/paste from working code)
from pydantic import BaseModel, field_validator, ValidationError
import re

# ---------------- CONFIG ----------------
# load_dotenv(".env")
# API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

MODEL_NAME = GEMINI_MODEL
CONCURRENCY = 4
MAX_RETRIES = 3
BASE_BACKOFF = 1.0
OUTPUT_DIR = Path("llm_results")
FAILED_DIR = OUTPUT_DIR / "failed_responses"
MARKDOWN_OUTFILE = OUTPUT_DIR / "all_pages.md"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
FAILED_DIR.mkdir(parents=True, exist_ok=True)

# ThreadPool executor for blocking work
_EXECUTOR = ThreadPoolExecutor(max_workers=CONCURRENCY + 4)


# ---------------- Pydantic model + helpers (use your working version) ----------------
class OCRResponse(BaseModel):
    page_content: str
    tags: List[str]
    date: Optional[str] = None

    model_config = {"extra": "forbid"}

    @field_validator('tags')
    def tags_nonempty(cls, v):
        if not v or any(not isinstance(t, str) or not t.strip() for t in v):
            raise ValueError("tags must be a non-empty list of non-empty strings")
        return v

    @field_validator('date', mode='before')
    def normalize_date(cls, v):
        if v is None:
            return None
        if not isinstance(v, str):
            raise ValueError("date must be a string or None")
        s = v.strip()
        if s == "":
            return None
        if s.upper() in {"NONE", "N/A", "NA", "NULL", "[ILLEGIBLE]", "UNREADABLE"}:
            return None
        s = s.replace('/', '-')
        if re.match(r'^\d{2}-\d{2}-\d{4}$', s):
            return s
        if re.match(r'^\d{4}-\d{2}-\d{2}$', s):
            parts = s.split('-')
            return f"{parts[2]}-{parts[1]}-{parts[0]}"
        from datetime import datetime
        for fmt in ("%d %b %Y", "%d %B %Y", "%Y %b %d", "%Y %B %d"):
            try:
                dt = datetime.strptime(s, fmt)
                return dt.strftime("%d-%m-%Y")
            except Exception:
                pass
        raise ValueError("date must be dd-mm-yyyy, YYYY-mm-dd, a common textual date, or a NONE token")


def _find_json_substring(s: str) -> Optional[str]:
    start = s.find('{')
    if start == -1:
        return None
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(s)):
        ch = s[i]
        if ch == '"' and not escape:
            in_string = not in_string
        if ch == '\\' and in_string:
            escape = not escape
        else:
            escape = False
        if not in_string:
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return s[start:i + 1]
    return None


def parse_and_validate_llm(text: str, debug: bool = False) -> Optional[OCRResponse]:
    # identical semantics to your earlier function: returns model or None
    try:
        obj = json.loads(text)
    except Exception:
        sub = _find_json_substring(text)
        if not sub:
            if debug:
                print("DEBUG: no JSON object found. first 400 chars:", repr(text[:400]))
            return None
        try:
            obj = json.loads(sub)
        except Exception as e:
            if debug:
                print("DEBUG: found JSON-like substring but failed to parse:", e)
                print("SUBSTRING (first 400):", repr(sub[:400]))
            return None

    try:
        if hasattr(OCRResponse, "model_validate"):
            model = OCRResponse.model_validate(obj)
        else:
            model = OCRResponse.parse_obj(obj)
    except ValidationError as e:
        if debug:
            print("DEBUG: pydantic validation failed:", e)
        return None

    return model


def upload_pil_image_client(pil_img: Image.Image, filename: str = "page.png"):
    """
    Upload a PIL Image to Gemini client.files.upload using an in-memory BytesIO.
    Returns whatever client.files.upload returns.
    """
    buf = _io.BytesIO()
    pil_img.save(buf, format="PNG")
    buf.seek(0)
    # config keys match your working example
    config = {"mime_type": "image/png", "display_name": filename}
    return client.files.upload(file=buf, config=config)


# ---------------- Blocking helpers to run in threads ----------------
def pil_to_png_bytes(pil_img) -> bytes:
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()


def _sanitize_resource_name(filename: str) -> str:
    """
    Convert a filename into a service-safe resource name:
    - remove extension
    - lowercase
    - allow only a-z, 0-9 and dashes
    - replace other chars with dash, collapse multiple dashes, strip edge dashes
    - if empty, fall back to file-<8hex>
    """
    base = os.path.splitext(filename)[0]
    base = base.lower()
    # replace invalid chars with dash
    base = re.sub(r'[^a-z0-9-]+', '-', base)
    # collapse repeated dashes
    base = re.sub(r'-{2,}', '-', base)
    # strip leading/trailing dashes
    base = base.strip('-')
    if not base:
        base = f"file-{uuid.uuid4().hex[:8]}"
    return base


def blocking_upload_bytes(img_bytes: bytes, filename: str = "page.png", resource_name: str | None = None):
    """
    Preferred: upload using an in-memory PIL BytesIO (works reliably in your tests).
    Fallback: write bytes to a temp file and upload that (Windows-safe).
    """
    # ensure filename has an extension for display purposes
    name, ext = os.path.splitext(filename)
    if not ext:
        ext = ".png"
        filename = filename + ext

    # Try in-memory PIL path first (most reliable per your tests)
    try:
        # Wrap bytes in BytesIO and open with PIL to ensure valid image and let PIL normalize
        bio = _io.BytesIO(img_bytes)
        pil_img = Image.open(bio)
        pil_img.load()  # force load to surface errors early

        # Optionally, you could sanitize or convert modes here (e.g., ensure "RGB")
        # if pil_img.mode != "RGB":
        #     pil_img = pil_img.convert("RGB")

        # Upload via in-memory helper
        return upload_pil_image_client(pil_img, filename=filename)

    except Exception as e_inmem:
        # Log the in-memory failure and fall back to disk-based upload
        _logger.debug("In-memory upload failed (%s). Falling back to temp-file upload.", repr(e_inmem))

    # Fallback: write to a real temp file and upload (existing safe approach)
    fd, path = tempfile.mkstemp(suffix=ext)
    os.close(fd)
    try:
        with open(path, "wb") as f:
            f.write(img_bytes)

        # open in blocking binary mode (seekable) and upload
        with open(path, "rb") as fh:
            config = {
                "mime_type": "image/png",
                "display_name": filename,
            }
            return client.files.upload(file=fh, config=config)
    finally:
        try:
            os.remove(path)
        except Exception:
            pass


def blocking_model_inference(uploaded_file, user_prompt, model_name=MODEL_NAME):
    return client.models.generate_content(
        model=model_name,
        contents=[uploaded_file, user_prompt],
        config=types.GenerateContentConfig(
            temperature=0.0,
            max_output_tokens=8192,
            top_p=0.95,
        ),
    )


# ---------------- per-page async processing ----------------
async def process_page(pil_page, page_number: int, sem: asyncio.Semaphore, debug: bool = False) -> Dict[str, Any]:
    """
    - preprocess page (in thread)
    - convert to PNG bytes (in thread)
    - upload (in thread)
    - call model (in thread)
    - validate (in thread)
    Returns dict with "page", "ok", "result" (OCRResponse or None), "raw_text", "attempts", "error"
    """
    attempt = 0
    last_raw = None
    async with sem:
        while attempt < MAX_RETRIES:
            attempt += 1
            try:
                # 1) preprocess in worker thread (use your simple_preprocess_page)
                # it returns dict with 'binary' (numpy uint8 image) when save_steps=False
                preproc = await asyncio.get_event_loop().run_in_executor(
                    _EXECUTOR, simple_preprocess_page, pil_page
                )
                # convert preproc['binary'] (numpy) to PIL and then bytes
                pil_bin = await asyncio.get_event_loop().run_in_executor(_EXECUTOR, cv2_to_pil, preproc['binary'])
                png_bytes = await asyncio.get_event_loop().run_in_executor(_EXECUTOR, pil_to_png_bytes, pil_bin)

                # 2) upload bytes (in thread)
                uploaded = await asyncio.get_event_loop().run_in_executor(_EXECUTOR, blocking_upload_bytes, png_bytes,
                                                                          f"page_{page_number:03d}.png")

                # 3) model inference (in thread)
                response = await asyncio.get_event_loop().run_in_executor(_EXECUTOR, blocking_model_inference, uploaded,
                                                                          prompt.prompt_9, MODEL_NAME)

                raw_text = getattr(response, "text", str(response))
                last_raw = raw_text

                # 4) validate (in thread)
                validated = await asyncio.get_event_loop().run_in_executor(_EXECUTOR, parse_and_validate_llm, raw_text,
                                                                           debug)

                if validated is not None:
                    if debug:
                        print(f"[+] page {page_number} success (attempt {attempt})")
                    return {"page": page_number, "ok": True, "result": validated, "raw_text": raw_text,
                            "attempts": attempt, "error": None}

                # failed validation -> retry after backoff
                backoff = BASE_BACKOFF * (2 ** (attempt - 1)) + random.random() * 0.5
                if debug:
                    print(f"[-] page {page_number} attempt {attempt} failed validation. backoff {backoff:.1f}s")
                await asyncio.sleep(backoff)

            except Exception as exc:
                last_raw = repr(exc)
                backoff = BASE_BACKOFF * (2 ** (attempt - 1)) + random.random() * 0.5
                if debug:
                    print(f"[-] page {page_number} exception on attempt {attempt}: {exc}. backoff {backoff:.1f}s")
                await asyncio.sleep(backoff)

    # exhausted retries
    return {"page": page_number, "ok": False, "result": None, "raw_text": last_raw, "attempts": attempt,
            "error": "exhausted_retries"}


# ---------------- runner & aggregator ----------------
async def run_pdf_async(pdf_path: str, concurrency: int = CONCURRENCY, debug: bool = False) -> List[Dict[str, Any]]:
    # convert_from_path is blocking -> run in thread
    pil_pages = await asyncio.get_event_loop().run_in_executor(_EXECUTOR, convert_from_path, pdf_path, 300)
    sem = asyncio.Semaphore(concurrency)
    tasks = [asyncio.create_task(process_page(p, i, sem, debug)) for i, p in enumerate(pil_pages, start=1)]
    results = await asyncio.gather(*tasks)
    # save failed raw responses to disk for later inspection
    for r in results:
        if not r["ok"]:
            fname = FAILED_DIR / f"page_{r['page']:03d}_failed.txt"
            with open(fname, "w", encoding="utf-8") as fh:
                fh.write(str(r["raw_text"] or ""))
    return results


def aggregate_to_markdown(results: List[Dict[str, Any]], out_path: Path = MARKDOWN_OUTFILE) -> Path:
    results_sorted = sorted(results, key=lambda r: r["page"])
    lines: List[str] = ["# Combined OCR Pages\n"]
    for r in results_sorted:
        lines.append(f"## Page {r['page']}\n")
        if r["ok"] and r["result"] is not None:
            model = r["result"]
            page_md = model.model_dump().get("page_content") if hasattr(model, "model_dump") else model.dict().get(
                "page_content")
            lines.append(page_md + "\n")
            tags = model.model_dump().get("tags") if hasattr(model, "model_dump") else model.dict().get("tags")
            date = model.model_dump().get("date") if hasattr(model, "model_dump") else model.dict().get("date")
            if tags:
                lines.append(f"_Tags: {', '.join(tags)}_\n")
            if date:
                lines.append(f"_Date: {date}_\n")
        else:
            lines.append("> **UNREADABLE / FAILED — saved raw response for manual review**\n")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


# ---------------- CLI-style entrypoint ----------------
def run(pdf_path: str, concurrency: int = CONCURRENCY, debug: bool = True):
    results = asyncio.run(run_pdf_async(pdf_path, concurrency=concurrency, debug=debug))
    md_file = aggregate_to_markdown(results)
    succeeded = len([r for r in results if r["ok"]])
    failed = len(results) - succeeded
    print(f"[+] Done. {succeeded} succeeded, {failed} failed. Markdown: {md_file}")
    if failed:
        print(f"[+] Failed raw outputs saved in {FAILED_DIR}")


if __name__ == "__main__":
    run("C:\\Users\\einst\\PycharmProjects\\pen_and_paper\\2-22_4-22-1-3.pdf", concurrency=4, debug=True)
