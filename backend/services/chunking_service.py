"""
Chunking service — wraps the processing/chunker module with logging.
"""
import logging
from backend.processing.chunker import chunk_document as _chunk_document
from backend.config import CHUNK_SIZE, CHUNK_OVERLAP

logger = logging.getLogger(__name__)


def chunk_pages(pages: list[dict], document_name: str) -> list[dict]:
    """
    Chunk extracted pages into overlapping text chunks with metadata.

    Args:
        pages:         list of {"page": int, "text": str, "method": str}
        document_name: original filename

    Returns:
        list of {"text": str, "metadata": dict}
    """
    chunks = _chunk_document(pages, document_name=document_name)
    logger.info(
        f"Chunking complete: {len(chunks)} chunks created "
        f"(size={CHUNK_SIZE}, overlap={CHUNK_OVERLAP}) "
        f"from {len(pages)} pages of '{document_name}'"
    )
    return chunks
