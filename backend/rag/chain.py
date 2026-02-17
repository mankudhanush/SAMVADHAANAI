"""
RAG query chain with:
  - Hybrid retrieval (semantic + BM25 + re-ranking)
  - **Full-document mode** for small docs (all chunks sent)
  - Structured citations
  - Conversation memory per session
  - Direct httpx calls (no LangChain overhead)
"""
import logging
import re
from collections import defaultdict

from backend.vectorstore.store import vector_store
from backend.rag.retriever import hybrid_retrieve
from backend.services.llm_service import generate
from backend.config import (
    RAG_SYSTEM_PROMPT,
    MAX_HISTORY_TURNS,
)

logger = logging.getLogger(__name__)

# If total stored chunks ≤ this threshold, skip retrieval and
# send EVERY chunk to the LLM so nothing is missed.
_FULL_DOC_CHUNK_THRESHOLD = 40

# Regex patterns to detect page references in user questions
_PAGE_PATTERNS = [
    re.compile(r'\bpages?\s+(\d+)\s*(?:to|through|[-–—])\s*(\d+)\b', re.I),   # page 3 to 5
    re.compile(r'\bpages?\s+(\d+(?:\s*,\s*\d+)+)\b', re.I),                    # pages 2, 4, 7
    re.compile(r'\bpages?\s*#?\s*(\d+)\b', re.I),                               # page 3, page #3
    re.compile(r'\bpg\.?\s*(\d+)\b', re.I),                                     # pg 3, pg.3
    re.compile(r'\b(?:on|in|at|from)\s+page\s*(\d+)\b', re.I),                  # on page 5
]


def _extract_page_numbers(question: str) -> list[int]:
    """Extract explicit page number references from a user question."""
    pages: set[int] = set()
    for pat in _PAGE_PATTERNS:
        for m in pat.finditer(question):
            groups = m.groups()
            if len(groups) == 2 and groups[1] is not None:
                # Range: page 3 to 5
                try:
                    start, end = int(groups[0]), int(groups[1])
                    pages.update(range(start, end + 1))
                except ValueError:
                    pass
            else:
                # Single or comma-separated: pages 2, 4, 7
                raw = groups[0]
                for num_str in re.findall(r'\d+', raw):
                    pages.add(int(num_str))
    return sorted(pages)

# ---------------------------------------------------------------------------
# Session-based conversation memory (bounded to prevent memory leaks)
# ---------------------------------------------------------------------------
_MAX_SESSIONS = 200          # evict oldest when exceeded
_MAX_TURNS_PER_SESSION = 50  # hard cap on stored turns per session
_sessions: dict[str, list[dict]] = defaultdict(list)


def _evict_sessions_if_needed():
    """Drop oldest sessions when count exceeds _MAX_SESSIONS."""
    while len(_sessions) > _MAX_SESSIONS:
        oldest = next(iter(_sessions))
        del _sessions[oldest]


def _get_history(session_id: str) -> list[dict]:
    """Return the recent conversation turns for a session."""
    return _sessions[session_id][-(MAX_HISTORY_TURNS * 2):]


def _add_turn(session_id: str, role: str, content: str):
    turns = _sessions[session_id]
    turns.append({"role": role, "content": content})
    # Trim to hard cap to prevent unbounded growth
    if len(turns) > _MAX_TURNS_PER_SESSION:
        _sessions[session_id] = turns[-_MAX_TURNS_PER_SESSION:]
    _evict_sessions_if_needed()


def clear_session(session_id: str):
    _sessions.pop(session_id, None)


def clear_all_sessions():
    """Wipe all conversation history (e.g. when a new document replaces old ones)."""
    _sessions.clear()
    logger.info("All conversation sessions cleared")


# ---------------------------------------------------------------------------
# Build context with labeled sources
# ---------------------------------------------------------------------------
def _build_context(results: list[dict]) -> str:
    """Format retrieved chunks as numbered sources with metadata."""
    parts = []
    for i, r in enumerate(results, 1):
        meta = r.get("metadata", {})
        doc = meta.get("document", "unknown")
        page = meta.get("page", "?")
        header = f"[Source {i}] (Document: {doc}, Page: {page})"
        parts.append(f"{header}\n{r['chunk']}")
    return "\n\n---\n\n".join(parts)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def query_rag(question: str, session_id: str = "default") -> dict:
    """
    Full RAG flow:
      1. Hybrid retrieve (semantic + BM25 + re-rank)
      2. Build labeled context
      3. Include conversation history
      4. Call LLM
      5. Return structured result with citations
    """
    if vector_store.size == 0:
        return {
            "answer": "No documents have been uploaded yet. Please upload a document first.",
            "sources": [],
            "session_id": session_id,
        }

    # 1. Retrieve — page-targeted mode → full-document mode → hybrid
    requested_pages = _extract_page_numbers(question)
    total_chunks = vector_store.size

    if requested_pages:
        # User asked about specific page(s) — fetch those chunks directly
        logger.info("Page-targeted retrieval: pages %s", requested_pages)
        page_data = vector_store.get_chunks_by_pages(requested_pages)
        if page_data:
            results = [
                {
                    "chunk": item["chunk"],
                    "metadata": item["metadata"],
                    "rerank_score": 1.0,
                }
                for item in page_data
            ]
        else:
            # Pages not found — fall through to normal retrieval
            logger.warning("No chunks found for pages %s, using hybrid retrieval", requested_pages)
            results = hybrid_retrieve(question)
    elif total_chunks <= _FULL_DOC_CHUNK_THRESHOLD:
        # Send EVERY chunk so the LLM sees the entire document
        logger.info(
            f"Full-document mode: {total_chunks} chunks "
            f"(≤ {_FULL_DOC_CHUNK_THRESHOLD} threshold)"
        )
        all_data = vector_store.get_all_chunks()
        results = [
            {
                "chunk": item["chunk"],
                "metadata": item["metadata"],
                "rerank_score": 1.0,
            }
            for item in all_data
        ]
    else:
        # Normal hybrid retrieval for large collections
        results = hybrid_retrieve(question)
    if not results:
        return {
            "answer": "No relevant content found for your question.",
            "sources": [],
            "session_id": session_id,
        }

    # 2. Build context
    context_text = _build_context(results)
    system_msg = RAG_SYSTEM_PROMPT.format(context=context_text)

    # 3. Build prompt with conversation history
    history_parts = []
    for turn in _get_history(session_id):
        role = "User" if turn["role"] == "human" else "Assistant"
        history_parts.append(f"{role}: {turn['content']}")

    prompt_parts = []
    if history_parts:
        prompt_parts.append("Previous conversation:\n" + "\n".join(history_parts))
    prompt_parts.append(f"Question: {question}")
    full_prompt = "\n\n".join(prompt_parts)

    # 4. Call LLM directly via httpx (no LangChain overhead)
    result = generate(full_prompt, system_prompt=system_msg)
    answer = result["text"]

    # 5. Save to history
    _add_turn(session_id, "human", question)
    _add_turn(session_id, "ai", answer)

    # 6. Return
    sources = []
    for i, r in enumerate(results, 1):
        meta = r.get("metadata", {})
        sources.append({
            "source_id": i,
            "document": meta.get("document", "unknown"),
            "page": meta.get("page", "?"),
            "chunk_preview": r["chunk"][:200] + ("..." if len(r["chunk"]) > 200 else ""),
            "rerank_score": round(r.get("rerank_score", 0), 4),
        })

    return {
        "answer": answer,
        "sources": sources,
        "session_id": session_id,
    }
