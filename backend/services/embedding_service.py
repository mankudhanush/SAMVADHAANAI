"""
Embedding service — wraps the embeddings/embedder module.
"""
import logging
from backend.embeddings.embedder import embed_texts as _embed_texts
from backend.embeddings.embedder import embed_query as _embed_query

logger = logging.getLogger(__name__)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of text strings."""
    vectors = _embed_texts(texts)
    logger.info(f"Embedded {len(texts)} texts → {len(vectors)} vectors")
    return vectors


def embed_query(query: str) -> list[float]:
    """Embed a single query string."""
    return _embed_query(query)
