# app/api_routes/documents.py
import ast
import base64
import os
import uuid
import json
import time
import datetime
import logging
import mimetypes
import re
from pathlib import Path
from typing import Optional, List, Dict, Any

import aiofiles
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, requests
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from fastapi import Body

from supabase import create_client as create_supabase_client
import meilisearch

from sqlalchemy.orm import Session

from async_batch_pdf import run_pdf_async, aggregate_to_markdown, OUTPUT_DIR

from ..db import get_db
from ..models import Document, User
from ..crud import get_user_by_id
from ..config import (
    SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET,
    MEILI_URL, MEILI_MASTER_KEY, MEILI_INDEX_NAME
)
from ..schemas import SearchRequest, DownloadRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["documents"])

# Try to import the auth dependency; adjust if your project uses a different module path.
from ..dependencies import get_current_user  # common name

# storage & limits
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100 MiB
DEFAULT_BUCKET = SUPABASE_BUCKET or "pen_and_paper"

# create supabase client (use SUPABASE_KEY)
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in config / environment")
_supabase_key = SUPABASE_KEY.strip()
supabase = create_supabase_client(SUPABASE_URL, _supabase_key)

# meilisearch client
meili_client = meilisearch.Client(MEILI_URL, MEILI_MASTER_KEY)

# default concurrency (no longer provided in payload)
DEFAULT_CONCURRENCY = 4

_tag_re = re.compile(r"tags\s*=\s*(\[[^\]]*\])", re.IGNORECASE | re.DOTALL)
_date_trailer_re = re.compile(r"date\s*=\s*['\"]([^'\"]+)['\"]", re.IGNORECASE | re.DOTALL)
_date_any_re = re.compile(r'(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})')

DOWNLOAD_BASE_DIR = Path("downloads").resolve()
DOWNLOAD_BASE_DIR.mkdir(parents=True, exist_ok=True)


def _normalize_date_str(raw: str) -> Optional[str]:
    """
    Normalize date like 5-2-22 or 05/02/2022 -> DD-MM-YYYY.
    Two-digit years are assumed to be 2000+.
    Return None if cannot parse.
    """
    if not raw:
        return None
    m = _date_any_re.search(raw.strip())
    if not m:
        return None
    d = int(m.group(1));
    mth = int(m.group(2));
    y = int(m.group(3))
    if y < 100:
        y = 2000 + y
    try:
        dt = datetime.date(y, mth, d)
        return dt.strftime("%d-%m-%Y")
    except Exception:
        # fallback to zero-padded string
        return f"{d:02d}-{mth:02d}-{y:04d}"


def extract_tags_and_date_from_trailer(text: str):
    """
    If text contains `tags=[...]` and/or `date='...'` (anywhere),
    return (tags_list_or_empty, date_str_or_None, cleaned_text).
    cleaned_text has the matched trailer spans removed.
    """
    if not text:
        return [], None, text

    tags = []
    date_val = None
    spans = []

    # find tags
    tmatch = _tag_re.search(text)
    if tmatch:
        tags_text = tmatch.group(1)
        try:
            parsed = ast.literal_eval(tags_text)
            if isinstance(parsed, (list, tuple)):
                # ensure list of strings
                tags = [str(t).strip() for t in parsed if t is not None]
        except Exception:
            # fallback: crude parse of items inside brackets
            inner = tags_text.strip()[1:-1]
            items = re.split(r'\s*,\s*', inner)
            tags = [re.sub(r"^['\"]|['\"]$", "", it).strip() for it in items if it.strip()]
        spans.append(tmatch.span())

    # find date
    dmatch = _date_trailer_re.search(text)
    if dmatch:
        raw_date = dmatch.group(1)
        date_val = _normalize_date_str(raw_date)
        spans.append(dmatch.span())

    # remove matched spans from text (in reverse order)
    if spans:
        parts = []
        last = 0
        for start, end in sorted(spans):
            parts.append(text[last:start])
            last = end
        parts.append(text[last:])
        cleaned = "".join(parts).strip()
    else:
        cleaned = text

    return tags, date_val, cleaned


def _is_pdf(filename: str, content_type: Optional[str]) -> bool:
    if content_type and content_type.lower() == "application/pdf":
        return True
    return filename.lower().endswith(".pdf")


def _sanitize_filename(name: str, max_len: int = 200) -> str:
    if not name:
        return f"book-{uuid.uuid4().hex[:8]}"
    s = name.strip()
    s = re.sub(r'[^A-Za-z0-9 _\-.]', '_', s)
    s = re.sub(r'[\s_]+', '_', s).strip('_')
    if not s:
        return f"book-{uuid.uuid4().hex[:8]}"
    return s[:max_len]


def get_or_create_meili_index(client: meilisearch.Client, index_name: str):
    try:
        return client.get_index(index_name)
    except Exception:
        client.create_index(index_name, {"primaryKey": "page_id"})
        return client.index(index_name)


def extract_page_content_from_result(result_item: Dict[str, Any]):
    for key in ("result", "llm_result", "text", "content", "output"):
        if key in result_item and result_item[key] is not None:
            return result_item[key]
    return ""


@router.post("/upload", response_model=dict)
async def upload_document_and_process(
        file: UploadFile = File(...),
        book_name: Optional[str] = Form(None),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),  # automatically obtain user from token
):
    """
    Upload a PDF (authenticated user inferred), create a new book_id (UUID) used as Document.id,
    save the PDF & consolidated markdown to Supabase under <user_id>/<book_id>/,
    create Document row with ocr_status=False, process pages and index them, set ocr_status=True.
    """

    # validate incoming file
    if not _is_pdf(file.filename, file.content_type):
        raise HTTPException(status_code=400, detail="Uploaded file is not a PDF")

    # current_user is fetched by dependency - ensure it has id
    if not current_user or not getattr(current_user, "id", None):
        raise HTTPException(status_code=401, detail="Unable to identify authenticated user")

    # generate book id (use as Document.id)
    book_uuid = uuid.uuid4()
    book_id_local = str(book_uuid)

    # filename sanitization
    safe_book_base = _sanitize_filename(book_name or Path(file.filename).stem)
    pdf_filename = f"{safe_book_base}.pdf"

    # local save path
    safe_name = Path(file.filename).name
    local_path = UPLOAD_DIR / f"{uuid.uuid4().hex}_{safe_name}"

    # save to disk (async)
    total_bytes = 0
    chunk_size = 1024 * 1024
    try:
        async with aiofiles.open(local_path, "wb") as out_f:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_SIZE:
                    await out_f.flush()
                    try:
                        await file.close()
                    except Exception:
                        pass
                    try:
                        os.remove(local_path)
                    except Exception:
                        pass
                    raise HTTPException(status_code=413, detail="File too large")
                await out_f.write(chunk)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to write uploaded file locally")
        try:
            await file.close()
        except Exception:
            pass
        try:
            if local_path.exists():
                os.remove(local_path)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Failed to save uploaded file")
    finally:
        try:
            await file.close()
        except Exception:
            pass

    # Upload PDF to Supabase storage
    bucket_name = SUPABASE_BUCKET or DEFAULT_BUCKET
    bucket_path = f"{current_user.id}/{book_id_local}/{pdf_filename}"

    upload_resp = None
    try:
        # prefer path-style upload (works for many storage3 client versions)
        try:
            upload_resp = supabase.storage.from_(bucket_name).upload(bucket_path, str(local_path))
        except Exception as e_path:
            logger.debug("Path upload failed: %s", repr(e_path))
            # fallback: file-object style
            try:
                with open(local_path, "rb") as fobj:
                    upload_resp = supabase.storage.from_(bucket_name).upload(
                        path=bucket_path,
                        file=fobj,
                        file_options={"content-type": "application/pdf"},
                    )
            except Exception as e_file:
                logger.exception("Supabase upload failed (both attempts). path_err=%s file_err=%s", repr(e_path),
                                 repr(e_file))
                try:
                    os.remove(local_path)
                except Exception:
                    pass
                raise HTTPException(status_code=500,
                                    detail="Failed to upload PDF to Supabase storage (see server logs)")
        # some client versions return dicts with 'error'
        if isinstance(upload_resp, dict) and upload_resp.get("error"):
            logger.error("Supabase returned error payload: %s", upload_resp)
            try:
                os.remove(local_path)
            except Exception:
                pass
            raise HTTPException(status_code=500,
                                detail="Failed to upload PDF to Supabase storage (storage returned error)")
    except HTTPException:
        raise
    except Exception:
        logger.exception("Supabase upload unexpected error")
        try:
            os.remove(local_path)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Failed to upload PDF to Supabase storage")

    # create Document DB record using generated book_uuid as the primary id
    try:
        doc = Document(id=book_uuid, user_id=current_user.id, filename=bucket_path, ocr_status=False)
        db.add(doc)
        db.commit()
        db.refresh(doc)
    except Exception:
        logger.exception("Failed to create Document row")
        try:
            os.remove(local_path)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Failed to create document record")

    # Meili index (get or create)
    index = get_or_create_meili_index(meili_client, MEILI_INDEX_NAME)

    # run pipeline with fixed concurrency
    concurrency = DEFAULT_CONCURRENCY
    try:
        results = await run_pdf_async(str(local_path), concurrency=concurrency, debug=False)
        try:
            md_path = aggregate_to_markdown(results)
        except Exception:
            md_path = None
    except Exception:
        logger.exception("PDF processing failed")
        raise HTTPException(status_code=500, detail="Failed to process PDF")

    # Upload consolidated markdown to Supabase (same base name but .md)
    uploaded_md = None
    if md_path:
        try:
            md_local = Path(md_path)
            md_filename = f"{safe_book_base}.md"
            md_bucket_path = f"{current_user.id}/{book_id_local}/{md_filename}"

            md_upload_resp = None
            try:
                md_upload_resp = supabase.storage.from_(bucket_name).upload(md_bucket_path, str(md_local))
            except Exception as e_md_path:
                logger.debug("MD path upload failed: %s", repr(e_md_path))
                try:
                    with open(md_local, "rb") as fmd:
                        md_upload_resp = supabase.storage.from_(bucket_name).upload(
                            path=md_bucket_path,
                            file=fmd,
                            file_options={"content-type": "text/markdown"},
                        )
                except Exception as e_md_file:
                    logger.exception("MD upload failed (both methods). path_err=%s file_err=%s", repr(e_md_path),
                                     repr(e_md_file))
                    md_upload_resp = None

            if isinstance(md_upload_resp, dict) and md_upload_resp.get("error"):
                logger.error("Supabase returned error for md upload: %s", md_upload_resp)
                uploaded_md = None
            elif md_upload_resp is not None:
                uploaded_md = f"{bucket_name}/{md_bucket_path}"
                logger.info("Uploaded consolidated markdown to supabase: %s", uploaded_md)
            else:
                uploaded_md = None
        except Exception:
            logger.exception("Unexpected error while uploading markdown to Supabase")
            uploaded_md = None
    else:
        uploaded_md = None

    # index pages into Meilisearch
    indexed_pages: List[Dict[str, Any]] = []
    failed_pages: List[Dict[str, Any]] = []
    for r in sorted(results, key=lambda x: x.get("page", 0)):
        page_num = r.get("page")
        page_id = str(uuid.uuid4())
        page_content = extract_page_content_from_result(r)

        # normalize content text
        if isinstance(page_content, dict):
            content_text = page_content.get("page_content") or json.dumps(page_content)
        else:
            content_text = str(page_content)

        # Extract tags and date from trailer like: tags=[...] date='...'
        tags, date_val, cleaned_content = extract_tags_and_date_from_trailer(content_text)

        meili_doc = {
            "page_id": page_id,
            "user_id": str(current_user.id),
            "book_id": book_id_local,
            "book_name": book_name if book_name else safe_book_base,
            "page_number": page_num,
            "content": cleaned_content,
            "tags": tags,
            "date": date_val,
        }

        try:
            task = index.add_documents([meili_doc])
            task_id = None
            if hasattr(task, "task_uid"):
                task_id = task.task_uid
            elif isinstance(task, dict):
                task_id = task.get("taskUid") or task.get("task_uid") or task.get("uid")
            elif isinstance(task, int):
                task_id = task

            if task_id is not None:
                for _ in range(60):
                    try:
                        status = index.get_task(task_id)
                    except Exception:
                        status = None
                    if status:
                        st = status.get("status") if isinstance(status, dict) else getattr(status, "status", None)
                        if st in ("succeeded", "done"):
                            break
                        if st == "failed":
                            raise RuntimeError(f"Meili indexing failed for page {page_num}: {status}")
                    time.sleep(1)
            indexed_pages.append({"page": page_num, "page_id": page_id})
        except Exception:
            logger.exception("Failed to index page %s", page_num)
            failed_pages.append({"page": page_num})

    # mark ocr_status True
    try:
        doc.ocr_status = True
        db.add(doc)
        db.commit()
        db.refresh(doc)
    except Exception:
        logger.exception("Failed to update document ocr_status")
        try:
            os.remove(local_path)
        except Exception:
            pass
        return JSONResponse({
            "status": "partial_success",
            "uploaded_to_supabase": f"{bucket_name}/{bucket_path}",
            "uploaded_markdown": uploaded_md,
            "saved_local_path": str(local_path),
            "pages_indexed": indexed_pages,
            "pages_failed": failed_pages,
            # "document_id": str(doc.id),
            "book_id": book_id_local,
            "markdown_path": str(md_path) if md_path else None
        }, status_code=200)

    # cleanup local file
    try:
        os.remove(local_path)
    except Exception:
        pass

    return JSONResponse({
        "status": "success",
        "uploaded_to_supabase": f"{bucket_name}/{bucket_path}",
        "uploaded_markdown": uploaded_md,
        "saved_local_path": str(local_path),
        "pages_indexed": indexed_pages,
        "pages_failed": failed_pages,
        "document_id": str(doc.id),
        "book_id": book_id_local,
        "markdown_path": str(md_path) if md_path else None
    }, status_code=200)



    # NOTE: we intentionally do NOT accept user_id in the body — user is determined from JWT


@router.post("/search")
async def search_documents(
        body: SearchRequest = Body(...),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """
    POST /documents/search
    - The authenticated user's id (from JWT/current_user) is used to scope results (multitenant safe).
    - Supports q, pagination, book_id, tags (and/or), and exact date matching using date_equals.
    """
    # Enforce bounds again (defensive)
    limit = max(1, min(100, body.limit))
    offset = max(0, body.offset)

    # Get or create index
    try:
        index = get_or_create_meili_index(meili_client, MEILI_INDEX_NAME)
    except Exception:
        logger.exception("Failed to access Meili index")
        raise HTTPException(status_code=500, detail="MeiliSearch index access failure")

    # Build filters - always scope to the authenticated user to enforce tenant isolation
    filters: List[str] = []
    filters.append(f'user_id = "{str(current_user.id)}"')

    if body.book_id:
        filters.append(f'book_id = "{body.book_id}"')

    if body.tags:
        tag_parts = []
        for t in body.tags:
            tclean = t.strip()
            if tclean:
                tag_parts.append(f'tags = "{tclean}"')
        if tag_parts:
            if body.tags_mode == "and":
                filters.append(" AND ".join(tag_parts))
            else:
                filters.append(" OR ".join(tag_parts))

    if body.date_equals:
        date_norm = _normalize_date_str(body.date_equals)
        if not date_norm:
            raise HTTPException(status_code=400, detail="date_equals could not be parsed")
        filters.append(f'date = "{date_norm}"')

    # combine filters with AND at top level
    filter_expr = " AND ".join(f"({f})" if (" OR " in f or " AND " in f and not f.startswith("(")) else f for f in
                               filters) if filters else None

    # Build search params
    search_params = {
        "limit": limit,
        "offset": offset,
        "attributesToHighlight": ["content"],
    }
    if filter_expr:
        search_params["filter"] = filter_expr

    # Run search (allow empty query for filter-only searches)
    try:
        query_text = body.q or ""
        res = index.search(query_text, search_params)
        hits = res.get("hits", [])
        nbHits = res.get("nbHits", res.get("estimatedTotalHits", 0) or 0)
        processing = res.get("processingTimeMs", None)
    except Exception:
        logger.exception("MeiliSearch query failed")
        raise HTTPException(status_code=500, detail="Search failed")

    return {
        "query": body.q,
        "limit": limit,
        "offset": offset,
        "total": nbHits,
        "processingTimeMs": processing,
        "filters": filter_expr,
        "hits": hits,
    }

MAX_TOTAL_BYTES = int(os.getenv("EXPORT_MAX_TOTAL_BYTES", "0"))  # 0 = no limit

@router.post("/download")
def download_books_as_base64(
    body: DownloadRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Download requested book files from Supabase and return JSON:
      {
        "status": "done",
        "files": [
           {"book_id": "...", "filename": "...", "mime": "...", "b64": "..." },
           ...
        ],
        "failed": { "<book_id>": [ ... ] }
      }

    NOTE: This encodes files as base64 in memory. Use with caution for large files.
    """

    bucket_name = SUPABASE_BUCKET or DEFAULT_BUCKET

    # (Optional) keep same target_path checks for parity with previous behavior,
    # but we will ignore target_path for output location (client receives blobs).
    if body.target_path:
        requested = Path(body.target_path)
        if requested.is_absolute():
            raise HTTPException(status_code=400, detail="target_path must be relative")
        target_root = (DOWNLOAD_BASE_DIR / requested).resolve()
    else:
        target_root = DOWNLOAD_BASE_DIR

    try:
        if not str(target_root).startswith(str(DOWNLOAD_BASE_DIR)):
            raise HTTPException(status_code=400, detail="target_path resolves outside allowed download base")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid target_path")

    files_out: List[Dict] = []
    failed: Dict[str, List[str]] = {}
    total_bytes_accum = 0

    def get_bytes_from_supabase_object(object_path: str):
        """Download fallback logic — returns bytes or None"""
        try:
            raw_download = supabase.storage.from_(bucket_name).download(object_path)
        except Exception:
            logger.exception("Supabase download() raised for %s", object_path)
            raw_download = None

        file_bytes = None
        if isinstance(raw_download, dict):
            data = raw_download.get("data") or raw_download.get("body") or raw_download.get("content")
            if isinstance(data, (bytes, bytearray)):
                file_bytes = bytes(data)
            elif isinstance(data, str):
                try:
                    file_bytes = base64.b64decode(data)
                except Exception:
                    file_bytes = data.encode("utf-8")
        elif isinstance(raw_download, (bytes, bytearray)):
            file_bytes = bytes(raw_download)
        elif raw_download is not None:
            try:
                file_bytes = getattr(raw_download, "content", None)
                if callable(file_bytes):
                    file_bytes = file_bytes()
            except Exception:
                file_bytes = None

        # fallback: public url
        if not file_bytes:
            try:
                pub = supabase.storage.from_(bucket_name).get_public_url(object_path)
                if isinstance(pub, dict):
                    public_url = pub.get("publicUrl") or pub.get("public_url") or pub.get("publicURL")
                elif isinstance(pub, str):
                    public_url = pub
                else:
                    public_url = None

                if public_url:
                    r = requests.get(public_url, timeout=30)
                    if r.status_code == 200:
                        file_bytes = r.content
            except Exception:
                logger.exception("Public-url fallback failed for %s", object_path)

        return file_bytes

    for book_id in body.book_ids:
        failed.setdefault(book_id, [])

        prefix = f"{current_user.id}/{book_id}"
        try:
            raw_list = supabase.storage.from_(bucket_name).list(prefix)
        except Exception:
            logger.exception("Supabase list failed for prefix=%s", prefix)
            failed[book_id].append("supabase_list_failed")
            continue

        if isinstance(raw_list, dict):
            data_list = raw_list.get("data") or []
        elif isinstance(raw_list, list):
            data_list = raw_list
        else:
            data_list = []

        if not data_list:
            failed[book_id].append("no_files_found")
            continue

        # iterate listed items and download each file
        for item in data_list:
            if isinstance(item, dict):
                name = item.get("name") or item.get("path") or item.get("id")
            else:
                name = str(item)
            if not name:
                continue

            # normalize object_path and filename like your original logic
            if name.startswith(str(current_user.id) + "/"):
                object_path = name
                filename = "/".join(name.split("/")[2:])
            else:
                if name.startswith(book_id + "/"):
                    object_path = f"{current_user.id}/{name}"
                    filename = "/".join(name.split("/")[1:])
                elif name.startswith(book_id):
                    parts = name.split("/", 1)
                    filename = parts[1] if len(parts) > 1 else ""
                    object_path = f"{current_user.id}/{name}"
                else:
                    object_path = f"{prefix}/{name.split('/')[-1]}"
                    filename = name.split("/")[-1]

            if not filename:
                # folder entry -> skip
                continue

            # Download bytes (same fallback logic)
            file_bytes = get_bytes_from_supabase_object(object_path)
            if not file_bytes:
                logger.error("Failed to get bytes for %s", object_path)
                failed[book_id].append(object_path)
                continue

            # safety: check total bytes limit if configured
            total_bytes_accum += len(file_bytes)
            if MAX_TOTAL_BYTES and total_bytes_accum > MAX_TOTAL_BYTES:
                logger.error("Export exceeded MAX_TOTAL_BYTES (%s bytes)", MAX_TOTAL_BYTES)
                raise HTTPException(status_code=413, detail="Requested files exceed maximum allowed total size")

            # infer mime
            mime_type, _ = mimetypes.guess_type(filename)
            if not mime_type:
                mime_type = "application/octet-stream"

            # encode base64
            try:
                b64 = base64.b64encode(file_bytes).decode("ascii")
            except Exception:
                logger.exception("Failed base64-encoding %s", object_path)
                failed[book_id].append(object_path)
                continue

            files_out.append({
                "book_id": book_id,
                "filename": Path(filename).name,
                "mime": mime_type,
                "b64": b64,
                "size_bytes": len(file_bytes),
            })

    return JSONResponse(content={
        "status": "done",
        "files": files_out,
        "failed": failed,
        "total_bytes": total_bytes_accum,
    })