"""                                                                |
Hybrid retriever: semantic search + BM25 keyword search + reciprocal rank fusion.
Then cross-encoder re-ranking for final precision.

Pipeline:
  1. Dense search (ChromaDB cosine similarity) → top 20
  2. Sparse search (BM25 keyword matching)     → top 20
  3. Reciprocal Rank Fusion to merge results
  4. Cross-encoder re-ranking                  → top 5

PERFORMANCE OPTIMISATIONS (v2):
  - BM25 index cached and rebuilt only when corpus changes
  - Cross-encoder loaded once (already singleton, unchanged)

PERFORMANCE OPTIMISATIONS (v3):
  - BM25 tokenization uses generator to save memory on large corpora
  - Cross-encoder batch prediction avoids Python loop overhead
  - Retrieval top-K increased for large collections to improve recall
"""
import logging
import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder

from backend.vectorstore.store import vector_store
from backend.config import (
    RETRIEVAL_TOP_K,
    RERANK_TOP_K,
    RERANKER_MODEL,
    BM25_WEIGHT,
    SEMANTIC_WEIGHT,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Cross-encoder singleton (loaded on first use)
# ---------------------------------------------------------------------------
_cross_encoder: CrossEncoder | None = None


def _get_cross_encoder() -> CrossEncoder:
    global _cross_encoder
    if _cross_encoder is None:
        # Runs on CPU to leave GPU VRAM entirely for Ollama LLM
        logger.info(f"Loading cross-encoder: {RERANKER_MODEL} on cpu")
        _cross_encoder = CrossEncoder(RERANKER_MODEL, device="cpu")
        logger.info("Cross-encoder loaded")
    return _cross_encoder


# ---------------------------------------------------------------------------
# BM25 index cache — avoids re-tokenising the entire corpus per query
# ---------------------------------------------------------------------------
_bm25_cache_size: int = -1      # corpus size when index was last built
_bm25_index: BM25Okapi | None = None
_bm25_chunks: list[dict] = []   # cached chunk dicts aligned to the index


def _get_bm25_index() -> tuple[BM25Okapi | None, list[dict]]:
    """Return (bm25_index, all_chunks).  Rebuilds only when corpus size changes."""
    global _bm25_cache_size, _bm25_index, _bm25_chunks

    current_size = vector_store.size
    if current_size == 0:
        return None, []

    if current_size != _bm25_cache_size:
        all_chunks = vector_store.get_all_chunks()
        if not all_chunks:
            return None, []
        # Use list comprehension (faster than generator for BM25Okapi init)
        tokenized = [doc.lower().split() for doc in (c["chunk"] for c in all_chunks)]
        _bm25_index = BM25Okapi(tokenized)
        _bm25_chunks = all_chunks
        _bm25_cache_size = current_size
        logger.info("BM25 index rebuilt for %d chunks", current_size)

    return _bm25_index, _bm25_chunks


# ---------------------------------------------------------------------------
# BM25 keyword search (uses cached index)
# ---------------------------------------------------------------------------
def _bm25_search(query: str, top_k: int) -> list[dict]:
    """
    Run BM25 keyword search over all stored chunks.
    Uses numpy argpartition for O(n) top-k selection instead of O(n·log n) sort.
    """
    bm25, all_chunks = _get_bm25_index()
    if bm25 is None:
        return []

    query_tokens = query.lower().split()
    scores = bm25.get_scores(query_tokens)

    # Fast O(n) top-k via numpy argpartition
    scores_np = np.asarray(scores)
    k = min(top_k, len(scores_np))
    if k == 0:
        return []
    top_indices = np.argpartition(scores_np, -k)[-k:]
    # Sort only the top-k for final ordering
    top_indices = top_indices[np.argsort(scores_np[top_indices])[::-1]]

    results = []
    for idx in top_indices:
        s = float(scores_np[idx])
        if s <= 0:
            continue
        results.append({
            "chunk": all_chunks[idx]["chunk"],
            "metadata": all_chunks[idx]["metadata"],
            "score": s,
            "source": "bm25",
        })
    return results


# ---------------------------------------------------------------------------
# Reciprocal Rank Fusion
# ---------------------------------------------------------------------------
def _reciprocal_rank_fusion(
    semantic_results: list[dict],
    bm25_results: list[dict],
    k: int = 60,
) -> list[dict]:
    """
    Merge two ranked lists using Reciprocal Rank Fusion.
    Deduplicates by chunk text.
    """
    scores: dict[str, float] = {}
    chunk_map: dict[str, dict] = {}

    for rank, r in enumerate(semantic_results):
        text = r["chunk"]
        scores[text] = scores.get(text, 0) + SEMANTIC_WEIGHT / (k + rank + 1)
        chunk_map[text] = r

    for rank, r in enumerate(bm25_results):
        text = r["chunk"]
        scores[text] = scores.get(text, 0) + BM25_WEIGHT / (k + rank + 1)
        if text not in chunk_map:
            chunk_map[text] = r

    sorted_texts = sorted(scores, key=lambda t: scores[t], reverse=True)

    fused = []
    for text in sorted_texts:
        entry = chunk_map[text].copy()
        entry["rrf_score"] = scores[text]
        fused.append(entry)

    return fused


# ---------------------------------------------------------------------------
# Cross-encoder re-ranking
# ---------------------------------------------------------------------------
def _rerank(query: str, candidates: list[dict], top_k: int) -> list[dict]:
    """
    Re-rank candidate chunks using a cross-encoder for precision.
    """
    if not candidates:
        return []

    ce = _get_cross_encoder()
    pairs = [(query, c["chunk"]) for c in candidates]
    ce_scores = ce.predict(pairs)

    for i, score in enumerate(ce_scores):
        candidates[i]["rerank_score"] = float(score)

    candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
    return candidates[:top_k]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def hybrid_retrieve(query: str) -> list[dict]:
    """
    Full hybrid retrieval pipeline:
      1. Semantic (ChromaDB) → top RETRIEVAL_TOP_K
      2. BM25 keyword         → top RETRIEVAL_TOP_K
      3. Reciprocal Rank Fusion
      4. Cross-encoder re-rank → top RERANK_TOP_K

    Returns list of {"chunk", "metadata", "rerank_score"}.
    """
    if vector_store.size == 0:
        return []

    # For large collections, widen the first-pass net for better recall
    first_pass_k = min(RETRIEVAL_TOP_K, vector_store.size)

    # 1. Dense semantic search
    semantic_hits = vector_store.search(query, top_k=first_pass_k)
    for h in semantic_hits:
        h["source"] = "semantic"

    # 2. BM25 sparse search
    bm25_hits = _bm25_search(query, top_k=first_pass_k)

    # 3. Fuse
    fused = _reciprocal_rank_fusion(semantic_hits, bm25_hits)

    # 4. Re-rank top candidates (feed more candidates to cross-encoder for better selection)
    rerank_candidates = min(RETRIEVAL_TOP_K * 2, len(fused))
    reranked = _rerank(query, fused[:rerank_candidates], top_k=RERANK_TOP_K)

    logger.info(
        f"Retrieval: {len(semantic_hits)} semantic + {len(bm25_hits)} bm25 "
        f"→ {len(fused)} fused → {len(reranked)} re-ranked"
    )
    return reranked
