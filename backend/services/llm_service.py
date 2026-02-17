"""
Dedicated LLM service — ALL LLM calls go through this file.

Supports Ollama (local) and Groq (cloud).  Streaming is disabled by default.

PERFORMANCE OPTIMISATIONS (v3):
  - Persistent httpx.Client (connection pooling / keep-alive — saves ~200ms per call)
  - Configurable connect timeout separate from read timeout
  - num_thread set to CPU count for maximum Ollama throughput
"""
import logging
import os
import httpx

# Use all CPU cores for Ollama inference
_NUM_THREADS = os.cpu_count() or 4

from backend.config import (
    LLM_PROVIDER,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    GROQ_API_KEY,
    GROQ_MODEL,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Timeout (seconds) for LLM requests — split connect vs read
# ---------------------------------------------------------------------------
LLM_TIMEOUT = httpx.Timeout(300.0, connect=15.0)

# ---------------------------------------------------------------------------
# Persistent HTTP clients (connection pooling)
# ---------------------------------------------------------------------------
_ollama_client: httpx.Client | None = None
_groq_client: httpx.Client | None = None


def _get_ollama_client() -> httpx.Client:
    global _ollama_client
    if _ollama_client is None or _ollama_client.is_closed:
        _ollama_client = httpx.Client(
            base_url=OLLAMA_BASE_URL,
            timeout=LLM_TIMEOUT,
            limits=httpx.Limits(max_connections=6, max_keepalive_connections=3),
        )
    return _ollama_client


def _get_groq_client() -> httpx.Client:
    global _groq_client
    if _groq_client is None or _groq_client.is_closed:
        _groq_client = httpx.Client(
            base_url="https://api.groq.com",
            timeout=LLM_TIMEOUT,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            limits=httpx.Limits(max_connections=6, max_keepalive_connections=3),
        )
    return _groq_client


# ---------------------------------------------------------------------------
# Ollama direct HTTP call (no LangChain dependency)
# ---------------------------------------------------------------------------
def _call_ollama(prompt: str, system_prompt: str | None = None) -> dict:
    """
    Call Ollama's /api/generate endpoint via persistent client.

    Returns:
        {"text": str, "model": str, "done": bool}
    """
    payload: dict = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "keep_alive": "30m",
        "options": {
            "num_predict": 2048,
            "num_ctx": 8192,
            "temperature": 0.1,
            "top_p": 0.9,
            "repeat_penalty": 1.1,
            "num_thread": _NUM_THREADS,
        },
    }
    if system_prompt:
        payload["system"] = system_prompt

    logger.info("Ollama request → model=%s, prompt_len=%d", OLLAMA_MODEL, len(prompt))

    try:
        client = _get_ollama_client()
        resp = client.post("/api/generate", json=payload)
        resp.raise_for_status()
        data = resp.json()

        text = data.get("response", "")
        logger.info("Ollama response → %d chars", len(text))
        return {"text": text, "model": OLLAMA_MODEL, "done": data.get("done", True)}

    except httpx.TimeoutException:
        logger.error("Ollama request timed out")
        raise RuntimeError(f"Ollama timed out after 300s")
    except httpx.HTTPStatusError as exc:
        logger.error(f"Ollama HTTP error: {exc.response.status_code}")
        raise RuntimeError(f"Ollama HTTP error: {exc.response.status_code}")
    except Exception as exc:
        logger.exception("Ollama call failed")
        raise RuntimeError(f"Ollama call failed: {exc}")


# ---------------------------------------------------------------------------
# Groq cloud call
# ---------------------------------------------------------------------------
def _call_groq(prompt: str, system_prompt: str | None = None) -> dict:
    """Call Groq cloud API via persistent client."""
    if not GROQ_API_KEY:
        raise RuntimeError(
            "GROQ_API_KEY env var is not set. "
            "Get a free key at https://console.groq.com"
        )

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.1,
        "stream": False,
    }

    logger.info("Groq request → model=%s, prompt_len=%d", GROQ_MODEL, len(prompt))

    try:
        client = _get_groq_client()
        resp = client.post("/openai/v1/chat/completions", json=payload)
        resp.raise_for_status()
        data = resp.json()

        text = data["choices"][0]["message"]["content"]
        logger.info("Groq response → %d chars", len(text))
        return {"text": text, "model": GROQ_MODEL, "done": True}

    except httpx.TimeoutException:
        logger.error("Groq request timed out")
        raise RuntimeError(f"Groq timed out after 300s")
    except Exception as exc:
        logger.exception("Groq call failed")
        raise RuntimeError(f"Groq call failed: {exc}")


# ---------------------------------------------------------------------------
# Public API — provider-agnostic
# ---------------------------------------------------------------------------
def generate(prompt: str, system_prompt: str | None = None) -> dict:
    """
    Generate a response from the configured LLM provider.

    Args:
        prompt:        The user/query prompt.
        system_prompt: Optional system-level instruction.

    Returns:
        {"text": str, "model": str, "done": bool}
    """
    provider = LLM_PROVIDER.lower()
    if provider == "ollama":
        return _call_ollama(prompt, system_prompt)
    elif provider == "groq":
        return _call_groq(prompt, system_prompt)
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider}")


def generate_fast(prompt: str, system_prompt: str | None = None, max_tokens: int = 384) -> dict:
    """
    Fast generation with lower token limit — for summaries, translations, classifications.
    Uses the configured provider with reduced token limits for speed.
    """
    provider = LLM_PROVIDER.lower()

    if provider == "groq":
        # Groq is already fast; use normal path with the model
        return generate(prompt, system_prompt)

    # Ollama path with reduced num_predict and num_ctx for speed
    payload: dict = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "keep_alive": "30m",
        "options": {
            "num_predict": max_tokens,
            "num_ctx": 2048,
            "temperature": 0.1,
            "top_p": 0.9,
            "num_thread": _NUM_THREADS,
        },
    }
    if system_prompt:
        payload["system"] = system_prompt

    logger.info("Ollama FAST request → model=%s, max_tokens=%d", OLLAMA_MODEL, max_tokens)

    try:
        client = _get_ollama_client()
        resp = client.post("/api/generate", json=payload)
        resp.raise_for_status()
        data = resp.json()
        text = data.get("response", "")
        logger.info("Ollama FAST response → %d chars", len(text))
        return {"text": text, "model": OLLAMA_MODEL, "done": data.get("done", True)}
    except Exception as exc:
        logger.warning("Fast generate failed, falling back to normal: %s", exc)
        return generate(prompt, system_prompt)
