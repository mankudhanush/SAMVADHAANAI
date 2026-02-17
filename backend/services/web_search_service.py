"""
Web search service — DuckDuckGo-based web search with RAG fallback.

Provides:
  - General web search returning structured {title, url, snippet} results
  - RAG-integrated search: if RAG similarity < threshold, merge web context

PERFORMANCE OPTIMISATION (v2):
  - DDGS instance reused (avoids per-call init overhead)
  - Simple LRU cache for repeated queries

Completely separate from RAG retrieval code.
"""
import hashlib
import logging
from collections import OrderedDict
from ddgs import DDGS

from backend.config import WEB_SEARCH_CONFIDENCE_THRESHOLD
from backend.services.llm_service import generate

logger = logging.getLogger(__name__)

# Reusable DDGS instance
_ddgs: DDGS | None = None


def _get_ddgs() -> DDGS:
    global _ddgs
    if _ddgs is None:
        _ddgs = DDGS()
    return _ddgs


# Simple cache for repeated web searches
_WEB_CACHE_MAX = 32
_web_cache: OrderedDict[str, list[dict]] = OrderedDict()


def search(query: str, max_results: int = 5) -> list[dict]:
    """
    Search the web using DuckDuckGo.
    """
    logger.info(f"Web search: query='{query}', max_results={max_results}")

    # Check cache
    cache_key = hashlib.md5(f"{query}:{max_results}".encode()).hexdigest()
    if cache_key in _web_cache:
        _web_cache.move_to_end(cache_key)
        logger.info("Web search cache HIT")
        return _web_cache[cache_key]

    try:
        ddgs = _get_ddgs()
        raw_results = list(ddgs.text(query, max_results=max_results))

        results = []
        for r in raw_results:
            results.append({
                "title": r.get("title", ""),
                "url": r.get("href", r.get("link", "")),
                "snippet": r.get("body", r.get("snippet", "")),
            })

        # Cache result
        _web_cache[cache_key] = results
        if len(_web_cache) > _WEB_CACHE_MAX:
            _web_cache.popitem(last=False)

        logger.info(f"Web search returned {len(results)} results")
        return results

    except Exception as exc:
        logger.exception(f"Web search failed: {exc}")
        # Reset DDGS instance on failure
        global _ddgs
        _ddgs = None
        return []


def search_with_rag_fallback(
    question: str,
    rag_results: list[dict],
    rag_answer: str,
    threshold: float | None = None,
) -> dict:
    """
    If RAG similarity is below threshold, trigger web search, merge
    external context, and pass to LLM for an enhanced answer.

    Args:
        question:    The user's question.
        rag_results: Retrieval results with rerank_score.
        rag_answer:  The RAG-generated answer.
        threshold:   Confidence threshold (default from config).

    Returns:
        {
            "answer": str,
            "web_results": list[dict],
            "used_web_search": bool,
            "max_rag_score": float,
        }
    """
    threshold = threshold or WEB_SEARCH_CONFIDENCE_THRESHOLD

    # Determine max RAG similarity
    max_score = 0.0
    if rag_results:
        max_score = max(r.get("rerank_score", 0.0) for r in rag_results)

    logger.info(
        f"RAG confidence check: max_score={max_score:.4f}, threshold={threshold}"
    )

    if max_score >= threshold:
        # RAG is confident enough
        return {
            "answer": rag_answer,
            "web_results": [],
            "used_web_search": False,
            "max_rag_score": round(max_score, 4),
        }

    # RAG not confident — trigger web search
    logger.info("RAG below threshold, triggering web search")
    web_results = search(question, max_results=5)

    if not web_results:
        return {
            "answer": rag_answer,
            "web_results": [],
            "used_web_search": False,
            "max_rag_score": round(max_score, 4),
        }

    # Build external context
    external_ctx = "\n\n".join(
        f"[{i+1}] {r['title']}\n{r['snippet']}"
        for i, r in enumerate(web_results)
    )

    # Merge and call LLM
    prompt = f"""The user asked: "{question}"

The document search was not confident enough. Here is additional web search context:

{external_ctx}

Original document answer (may be incomplete):
{rag_answer}

Provide a comprehensive answer combining both document and web information.
Clearly distinguish what comes from the document vs. web sources."""

    result = generate(
        prompt,
        system_prompt="You are a legal document assistant. Combine document and web context to provide a helpful answer.",
    )

    return {
        "answer": result["text"],
        "web_results": web_results,
        "used_web_search": True,
        "max_rag_score": round(max_score, 4),
    }
