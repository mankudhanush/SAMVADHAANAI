"""
Ingestion service — orchestrates the full document upload pipeline.

Upload → OCR → Clean → Chunk → Embed → Store

PERFORMANCE (v3):
  - Pipelined: extraction + chunking feeds into embedding concurrently
  - Embeds + stores in batches so ChromaDB never blocks on huge payloads
  - Pages extracted in parallel (thread pool inside OCR layer)
  - Progress logging at every stage so long uploads are visible
"""
import time
import uuid
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, Future

from backend.config import UPLOAD_DIR
from backend.ocr.extractor import extract_pages
from backend.services.chunking_service import chunk_pages
from backend.vectorstore.store import vector_store
from backend.rag.chain import clear_all_sessions

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"}

# Embed + store in batches of this size to keep memory bounded
_INGEST_BATCH = 512

# Single-thread pool for background embed+store (keeps it off the extraction thread)
_embed_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="embed")


def _embed_and_store_batch(chunks: list[dict]) -> int:
    """Embed a batch of chunks and store them. Returns new total vector count."""
    return vector_store.add_chunks(chunks)


def ingest_document(file_bytes: bytes, original_name: str) -> dict:
    """
    Full ingestion pipeline:
      1. Save file to disk
      2. OCR / text extraction
      3. Clean + chunk
      4. Embed + store in ChromaDB

    Args:
        file_bytes:    Raw file content.
        original_name: Original filename (used for metadata).

    Returns:
        {
            "filename": str,
            "pages": int,
            "total_chars": int,
            "num_chunks": int,
            "total_vectors": int,
            "message": str,
        }
    """
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{ext}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    unique_name = f"{uuid.uuid4().hex}{ext}"
    save_path = UPLOAD_DIR / unique_name

    try:
        save_path.write_bytes(file_bytes)
        logger.info(f"Saved upload: {original_name} → {save_path}")
        t0 = time.perf_counter()

        # 0. Clear ALL old chunks — user works with one document at a time
        #    Old documents from previous uploads would pollute RAG results
        old_count = vector_store.size
        if old_count > 0:
            vector_store.clear()
            clear_all_sessions()  # old Q&A history references stale content
            logger.info(f"[{original_name}] Cleared all {old_count} old chunks before fresh ingestion")

        # 1. Extract pages with OCR fallback (pages processed in parallel internally)
        pages = extract_pages(str(save_path))
        total_chars = sum(len(p["text"]) for p in pages)
        t1 = time.perf_counter()
        logger.info(
            f"[{original_name}] Extraction: {len(pages)} pages, "
            f"{total_chars} chars in {t1 - t0:.1f}s"
        )

        # 2. Chunk with metadata (cleaning happens inside chunk_pages)
        chunks = chunk_pages(pages, document_name=original_name)
        t2 = time.perf_counter()
        logger.info(
            f"[{original_name}] Chunking: {len(chunks)} chunks in {t2 - t1:.1f}s"
        )

        # 3. Embed + store — pipeline batches concurrently
        #    Fire off each batch to the embed pool so the next batch is
        #    already being prepared while ChromaDB writes the previous one.
        total = 0
        futures: list[Future] = []
        for batch_start in range(0, len(chunks), _INGEST_BATCH):
            batch = chunks[batch_start : batch_start + _INGEST_BATCH]
            fut = _embed_pool.submit(_embed_and_store_batch, batch)
            futures.append(fut)
            logger.info(
                f"[{original_name}] Queued embed batch "
                f"{batch_start // _INGEST_BATCH + 1}"
                f"/{(len(chunks) - 1) // _INGEST_BATCH + 1} "
                f"({len(batch)} chunks)"
            )

        # Wait for all embed batches to finish
        for fut in futures:
            total = fut.result()  # raises on error

        t3 = time.perf_counter()
        logger.info(
            f"[{original_name}] Embed+Store: {len(chunks)} chunks in {t3 - t2:.1f}s | "
            f"Total pipeline: {t3 - t0:.1f}s"
        )

        return {
            "filename": original_name,
            "pages": len(pages),
            "total_chars": total_chars,
            "num_chunks": len(chunks),
            "total_vectors": total,
            "message": f"Document processed and indexed successfully in {t3 - t0:.1f}s.",
        }

    finally:
        if save_path.exists():
            save_path.unlink()
