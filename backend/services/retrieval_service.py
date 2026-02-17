"""
Retrieval service — wraps the hybrid retriever with similarity score logging.
"""
import logging
from backend.rag.retriever import hybrid_retrieve
from backend.vectorstore.store import vector_store

logger = logging.getLogger(__name__)


def retrieve(question: str, top_k: int = 5) -> list[dict]:
    """
    Retrieve the most relevant document chunks for a question.

    Uses hybrid retrieval (semantic + BM25 + reciprocal rank fusion + re-ranking).

    Args:
        question: The user's question.
        top_k:    Maximum number of results (actual count depends on re-ranker).

    Returns:
        list of {"chunk": str, "metadata": dict, "rerank_score": float}
    """
    if vector_store.size == 0:
        logger.warning("Retrieval called but vector store is empty")
        return []

    results = hybrid_retrieve(question)

    # Log similarity scores
    for i, r in enumerate(results):
        score = r.get("rerank_score", 0)
        doc = r.get("metadata", {}).get("document", "unknown")
        page = r.get("metadata", {}).get("page", "?")
        logger.info(
            f"  Retrieval hit [{i+1}]: score={score:.4f} "
            f"doc='{doc}' page={page}"
        )

    return results[:top_k]


def get_min_similarity(results: list[dict]) -> float:
    """Return the minimum rerank score from results (for confidence threshold)."""
    if not results:
        return 0.0
    return min(r.get("rerank_score", 0.0) for r in results)


def get_max_similarity(results: list[dict]) -> float:
    """Return the maximum rerank score from results."""
    if not results:
        return 0.0
    return max(r.get("rerank_score", 0.0) for r in results)
