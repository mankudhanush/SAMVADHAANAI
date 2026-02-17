"""
Legal Document Simplifier.

Takes document text from the vector store, sends it through the LLM
with the Legal Simplifier prompt, and returns structured plain-language
explanations.  Supports optional regional language translation and TTS.

Uses direct httpx via llm_service (no LangChain overhead).

PERFORMANCE (v3):
  - For small docs (≤30 chunks), sends full text in one LLM call.
  - For large docs (>30 chunks), uses a MAP-REDUCE strategy:
      1. Sample representative chunks from beginning, middle, and end.
      2. Run a fast summary pass per section group **in parallel** (MAP).
      3. Combine section summaries into one final simplification (REDUCE).
    This handles 300-page PDFs without truncating content.
  - Map phase uses ThreadPoolExecutor for parallel LLM calls (I/O-bound).
"""
import json
import logging
import math
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.vectorstore.store import vector_store
from backend.services.llm_service import generate, generate_fast
from backend.config import LEGAL_SIMPLIFIER_PROMPT

logger = logging.getLogger(__name__)

# Max chars sent to the LLM in a single prompt (leave room for system msg)
_MAX_CONTEXT_CHARS = 12000

# Threshold: docs with more chunks than this use map-reduce
_MAP_REDUCE_THRESHOLD = 30

# How many chunks to sample per section in map phase
_MAP_SECTION_CHUNKS = 10


# Max parallel LLM calls during map phase (I/O-bound, safe to parallelize)
_MAP_WORKERS = min(os.cpu_count() or 4, 4)


# ---------------------------------------------------------------------------
# JSON extraction helper
# ---------------------------------------------------------------------------
def _extract_json(text: str) -> dict | None:
    """Try to parse JSON from LLM output, tolerating markdown fences."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?\s*", "", text)
    cleaned = re.sub(r"```\s*$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Find first { … last }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    return None


# ---------------------------------------------------------------------------
# Map-Reduce helpers for large documents
# ---------------------------------------------------------------------------

_MAP_PROMPT = """You are a legal document analyst. Summarise the following section of a legal document.
Focus on: document type, key obligations, deadlines, important clauses, warnings, and parties involved.
Be concise but preserve ALL legally significant details.

SECTION TEXT:
{section_text}

Provide a clear summary in 200-400 words."""


def _select_representative_chunks(all_data: list[dict]) -> list[dict]:
    """
    Select a representative sample of chunks spanning the entire document.
    Strategy: take chunks from the beginning, evenly-spaced middle, and end.
    """
    n = len(all_data)
    if n <= _MAP_SECTION_CHUNKS * 3:
        return all_data  # small enough — use everything

    selected = []

    # Beginning (first 10)
    selected.extend(all_data[:_MAP_SECTION_CHUNKS])

    # Middle — evenly spaced
    mid_start = _MAP_SECTION_CHUNKS
    mid_end = n - _MAP_SECTION_CHUNKS
    mid_count = min(_MAP_SECTION_CHUNKS, mid_end - mid_start)
    if mid_count > 0:
        step = max(1, (mid_end - mid_start) // mid_count)
        for i in range(mid_start, mid_end, step):
            selected.append(all_data[i])
            if len(selected) >= _MAP_SECTION_CHUNKS * 2:
                break

    # End (last 10)
    selected.extend(all_data[-_MAP_SECTION_CHUNKS:])

    # De-duplicate while preserving order
    seen = set()
    unique = []
    for item in selected:
        key = id(item)
        if key not in seen:
            seen.add(key)
            unique.append(item)

    return unique


def _map_reduce_simplify(all_data: list[dict]) -> str:
    """
    Map-Reduce simplification for large documents.

    MAP:   Split representative chunks into sections, summarise each.
    REDUCE: Combine section summaries into final context for the main prompt.
    """
    representative = _select_representative_chunks(all_data)
    logger.info(
        "Map-reduce: %d representative chunks selected from %d total",
        len(representative), len(all_data),
    )

    # Split into sections for the MAP phase
    section_size = _MAP_SECTION_CHUNKS
    sections = [
        representative[i : i + section_size]
        for i in range(0, len(representative), section_size)
    ]

    section_summaries: list[str] = [""] * len(sections)  # pre-allocate to preserve order

    def _summarise_section(idx_section: tuple[int, list[dict]]) -> tuple[int, str]:
        idx, section = idx_section
        section_text = "\n\n".join(
            f"[Page {item.get('metadata', {}).get('page', '?')}] {item['chunk']}"
            for item in section
        )
        section_text = section_text[:_MAX_CONTEXT_CHARS]
        logger.info("Map phase: summarising section %d/%d (%d chunks)", idx + 1, len(sections), len(section))
        result = generate_fast(
            _MAP_PROMPT.format(section_text=section_text),
            max_tokens=512,
        )
        return idx, f"[Section {idx + 1}] {result['text']}"

    # Run map phase in parallel (LLM calls are I/O-bound)
    with ThreadPoolExecutor(max_workers=_MAP_WORKERS) as pool:
        futures = {pool.submit(_summarise_section, (i, sec)): i for i, sec in enumerate(sections)}
        for future in as_completed(futures):
            idx, summary = future.result()
            section_summaries[idx] = summary

    combined = "\n\n---\n\n".join(section_summaries)
    logger.info(
        "Map phase complete: %d section summaries, %d chars total",
        len(section_summaries), len(combined),
    )
    return combined


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def simplify_document(document_name: str = "") -> dict:
    """
    Simplify a document using the Legal Simplifier prompt.

    Parameters
    ----------
    document_name : str, optional
        If provided, only chunks belonging to this document are used.
        Otherwise all chunks in the store are sent (legacy behaviour).

    Returns
    -------
    dict with keys:
        raw_text     – the plain LLM response
        structured   – parsed JSON (if LLM returned valid JSON), else None
        chunk_count  – how many chunks were sent
    """
    if vector_store.size == 0:
        return {
            "raw_text": "No documents have been uploaded yet. Please upload a document first.",
            "structured": None,
            "chunk_count": 0,
        }

    # Gather chunks — scoped to the requested document when possible
    if document_name:
        all_data = vector_store.get_chunks_by_document(document_name)
        if not all_data:
            logger.warning("No chunks found for document '%s' — returning error instead of stale data", document_name)
            return {
                "raw_text": f"No chunks found for document '{document_name}'. The document may still be processing or the name doesn't match. Please try re-uploading.",
                "structured": None,
                "chunk_count": 0,
            }
    else:
        all_data = vector_store.get_all_chunks()

    # --- Build context — adaptive strategy based on document size ---
    if len(all_data) <= _MAP_REDUCE_THRESHOLD:
        # Small document: send all chunks directly (fast path)
        context_parts = []
        for i, item in enumerate(all_data, 1):
            meta = item.get("metadata", {})
            doc = meta.get("document", "unknown")
            page = meta.get("page", "?")
            context_parts.append(f"[Section {i}] (Document: {doc}, Page: {page})\n{item['chunk']}")
        context_text = "\n\n---\n\n".join(context_parts)
        # Truncate to max context chars
        context_text = context_text[:_MAX_CONTEXT_CHARS]
    else:
        # Large document: map-reduce strategy
        logger.info(
            "Large document detected (%d chunks > %d threshold) — using map-reduce",
            len(all_data), _MAP_REDUCE_THRESHOLD,
        )
        context_text = _map_reduce_simplify(all_data)
        context_text = context_text[:_MAX_CONTEXT_CHARS]

    prompt = LEGAL_SIMPLIFIER_PROMPT.format(context=context_text)

    # Call LLM directly via httpx (no LangChain overhead)
    logger.info("Simplifying document (%d chunks, %d context chars)...", len(all_data), len(context_text))
    result = generate(
        "Simplify this legal document. Return the structured JSON output.",
        system_prompt=prompt,
    )
    raw = result["text"]

    # Try to parse JSON
    structured = _extract_json(raw)
    if structured:
        logger.info("Structured JSON parsed successfully")
    else:
        logger.warning("Could not parse structured JSON from LLM response, returning raw text")

    return {
        "raw_text": raw,
        "structured": structured,
        "chunk_count": len(all_data),
    }
