"""
Text summarisation using the local Ollama LLM.

Reuses the same Ollama instance already running for the RAG pipeline.
No paid APIs.

PERFORMANCE OPTIMISATION (v2):
  - Uses the shared persistent httpx.Client from llm_service (connection pooling)
  - Trimmed prompt for fewer tokens → faster inference
"""
import logging

from backend.services.llm_service import generate_fast

logger = logging.getLogger(__name__)

_SUMMARIZE_SYSTEM = "You are a concise summariser. Be brief. English only."

_SUMMARIZE_PROMPT = """\
Summarize briefly. Key facts, dates, names, legal provisions.

Content:
{text}

Summary:"""


def summarize(text: str) -> str:
    """
    Summarise text using the configured LLM provider (via llm_service).

    Parameters
    ----------
    text : str
        The transcript or document text to summarise.

    Returns
    -------
    str  – English summary.
    """
    if not text.strip():
        return ""

    # Truncate very long inputs to avoid excessive token usage
    prompt = _SUMMARIZE_PROMPT.format(text=text[:3000])

    try:
        result = generate_fast(prompt, system_prompt=_SUMMARIZE_SYSTEM, max_tokens=384)
        return result["text"].strip()
    except Exception as exc:
        logger.exception("Summarisation failed")
        raise RuntimeError(f"Summarisation failed: {exc}")
