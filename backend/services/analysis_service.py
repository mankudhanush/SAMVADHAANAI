"""
Analysis service — document analysis engine.

Provides:
  - Risk extraction
  - Key clause extraction
  - Summary generation
  - Document classification
  - Full combined analysis

Uses the LLM service for all AI calls.  Completely separate from /api/query.

PERFORMANCE OPTIMISATIONS (v2):
  - full_analysis() runs all 4 LLM calls IN PARALLEL via ThreadPoolExecutor
  - Document text retrieved ONCE, shared across all sub-tasks
  - Input truncation to reduce token count
"""
import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.services.llm_service import generate, generate_fast
from backend.vectorstore.store import vector_store

logger = logging.getLogger(__name__)

# Thread pool for parallel LLM calls — 4 workers for 4 analysis tasks
_analysis_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="analysis")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_document_text() -> str:
    """Retrieve all stored document text from ChromaDB."""
    all_chunks = vector_store.get_all_chunks()
    if not all_chunks:
        return ""
    return "\n\n".join(c["chunk"] for c in all_chunks)


def _parse_json_response(text: str) -> dict | list | None:
    """Try to parse JSON from LLM output, stripping markdown fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------------------
# Analysis functions
# ---------------------------------------------------------------------------
def extract_risks(document_text: str | None = None) -> dict:
    """Extract risk factors from the document."""
    text = document_text or _get_document_text()
    if not text:
        return {"status": "error", "message": "No document text available"}

    prompt = f"""Analyze the following legal document and extract ALL risk factors.

For each risk found, provide:
- risk_description: what the risk is
- risk_level: Low / Medium / High / Critical
- affected_party: who is affected
- clause_reference: quote the relevant text

Return as JSON: {{"risks": [...]}}

DOCUMENT TEXT:
{text[:4000]}"""

    result = generate(prompt, system_prompt="You are a legal risk analysis expert. Return valid JSON only.")
    parsed = _parse_json_response(result["text"])
    return parsed if parsed else {"raw_analysis": result["text"]}


def extract_key_clauses(document_text: str | None = None) -> dict:
    """Extract key clauses from the document."""
    text = document_text or _get_document_text()
    if not text:
        return {"status": "error", "message": "No document text available"}

    prompt = f"""Extract ALL key clauses from this legal document.

For each clause, provide:
- clause_title: descriptive name
- clause_text: exact text from document
- significance: why this clause matters
- category: (payment / liability / termination / confidentiality / penalty / other)

Return as JSON: {{"clauses": [...]}}

DOCUMENT TEXT:
{text[:4000]}"""

    result = generate(prompt, system_prompt="You are a legal clause extraction expert. Return valid JSON only.")
    parsed = _parse_json_response(result["text"])
    return parsed if parsed else {"raw_analysis": result["text"]}


def generate_summary(document_text: str | None = None) -> dict:
    """Generate a concise summary of the document."""
    text = document_text or _get_document_text()
    if not text:
        return {"status": "error", "message": "No document text available"}

    prompt = f"""Summarize this legal document concisely.

Provide:
- document_type: type of document
- parties: who is involved
- key_dates: important dates
- summary: 3-5 sentence plain-English summary
- key_points: list of the most important points

Return as JSON.

DOCUMENT TEXT:
{text[:4000]}"""

    result = generate(prompt, system_prompt="You are a legal document summarizer. Return valid JSON only.")
    parsed = _parse_json_response(result["text"])
    return parsed if parsed else {"raw_analysis": result["text"]}


def classify_document(document_text: str | None = None) -> dict:
    """Classify the document type and jurisdiction."""
    text = document_text or _get_document_text()
    if not text:
        return {"status": "error", "message": "No document text available"}

    prompt = f"""Classify this legal document.

Provide:
- document_type: (contract / FIR / court_order / insurance_policy / legal_notice / agreement / other)
- jurisdiction: applicable jurisdiction
- governing_law: applicable laws
- language: document language
- confidence: your confidence level (high / medium / low)

Return as JSON.

DOCUMENT TEXT:
{text[:2000]}"""

    result = generate_fast(prompt, system_prompt="You are a legal document classifier. Return valid JSON only.", max_tokens=256)
    parsed = _parse_json_response(result["text"])
    return parsed if parsed else {"raw_analysis": result["text"]}


# ---------------------------------------------------------------------------
# Full analysis (orchestrates all above)
# ---------------------------------------------------------------------------
def full_analysis() -> dict:
    """
    Run comprehensive document analysis combining all analysis functions.

    OPTIMISED: All 4 LLM calls execute in parallel (ThreadPoolExecutor)
    instead of sequentially.  ~4x faster on multi-core or when using
    external LLM APIs with network latency.

    Returns:
        {
            "risks": ...,
            "key_clauses": ...,
            "summary": ...,
            "classification": ...,
        }
    """
    text = _get_document_text()
    if not text:
        return {"status": "error", "message": "No documents uploaded yet."}

    logger.info(f"Running PARALLEL full analysis on {len(text)} chars of document text")

    # Submit all 4 tasks concurrently — each receives the same text
    futures = {
        _analysis_pool.submit(extract_risks, text): "risks",
        _analysis_pool.submit(extract_key_clauses, text): "key_clauses",
        _analysis_pool.submit(generate_summary, text): "summary",
        _analysis_pool.submit(classify_document, text): "classification",
    }

    results: dict = {}
    for future in as_completed(futures):
        key = futures[future]
        try:
            results[key] = future.result()
        except Exception as exc:
            logger.exception(f"Analysis sub-task '{key}' failed: {exc}")
            results[key] = {"raw_analysis": f"Error: {exc}"}

    logger.info("Full parallel analysis complete")

    return results
