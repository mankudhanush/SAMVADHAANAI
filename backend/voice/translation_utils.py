"""
Fast translation for Indian languages using Google Translate via httpx.

Strategy: Direct HTTP call to Google Translate API (free, fast, accurate).
No third-party translation libraries needed — just httpx.

Falls back to Ollama LLM translation if Google fails.
"""
import logging
import re
import textwrap
import httpx

from backend.services.llm_service import generate

logger = logging.getLogger(__name__)

# Persistent HTTP client for Google Translate
_http_client: httpx.Client | None = None


def _get_client() -> httpx.Client:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.Client(
            timeout=httpx.Timeout(15.0, connect=5.0),
            limits=httpx.Limits(max_connections=4, max_keepalive_connections=2),
            follow_redirects=True,
        )
    return _http_client


# -----------------------------------------------------------------------
# Language mapping
# -----------------------------------------------------------------------
SUPPORTED_LANGUAGES: dict[str, str] = {
    "hindi":     "hi",
    "telugu":    "te",
    "tamil":     "ta",
    "kannada":   "kn",
    "malayalam": "ml",
    "bengali":   "bn",
    "marathi":   "mr",
    "gujarati":  "gu",
}

_LANG_FULL: dict[str, str] = {
    "hi": "Hindi", "te": "Telugu", "ta": "Tamil", "kn": "Kannada",
    "ml": "Malayalam", "bn": "Bengali", "mr": "Marathi", "gu": "Gujarati",
}

_GOOGLE_CHUNK = 4800


# -----------------------------------------------------------------------
# Public helpers
# -----------------------------------------------------------------------
def get_supported_languages() -> list[str]:
    return sorted(SUPPORTED_LANGUAGES.keys())


# -----------------------------------------------------------------------
# 1. Google Translate via direct HTTP (fast, no deps)
# -----------------------------------------------------------------------
def _translate_google_chunk(text: str, lang_code: str) -> str:
    """Translate a single chunk via Google Translate free API."""
    client = _get_client()
    url = "https://translate.googleapis.com/translate_a/single"
    params = {
        "client": "gtx",
        "sl": "en",
        "tl": lang_code,
        "dt": "t",
        "q": text,
    }
    resp = client.get(url, params=params)
    resp.raise_for_status()
    data = resp.json()
    # Response format: [[["translated text", "original text", ...], ...], ...]
    if data and data[0]:
        return "".join(part[0] for part in data[0] if part and part[0])
    return ""


def _translate_google(text: str, lang_code: str) -> str:
    """Translate using Google Translate, with chunking for long texts."""
    if len(text) <= _GOOGLE_CHUNK:
        return _translate_google_chunk(text, lang_code)

    chunks = _split_text(text, _GOOGLE_CHUNK)
    translated_parts = []
    for chunk in chunks:
        part = _translate_google_chunk(chunk, lang_code)
        translated_parts.append(part)
    return " ".join(translated_parts)


# -----------------------------------------------------------------------
# 2. Ollama LLM fallback (local, no internet needed)
# -----------------------------------------------------------------------
def _translate_ollama(text: str, lang_code: str) -> str:
    """Translate using local Ollama LLM as fallback."""
    lang_name = _LANG_FULL.get(lang_code, lang_code)
    prompt = (
        f"Translate to {lang_name}. Output ONLY the translated text in "
        f"{lang_name} script. No explanation.\n\n{text[:3000]}"
    )
    result = generate(prompt, system_prompt=f"You are a translator. Output only {lang_name} text.")
    return result["text"].strip()


# -----------------------------------------------------------------------
# Text splitter
# -----------------------------------------------------------------------
def _split_text(text: str, max_chars: int) -> list[str]:
    """Split text into chunks respecting sentence boundaries."""
    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    current = ""
    sentences = re.split(r'(?<=[.!?])\s+|\n+', text)

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if len(current) + len(sentence) + 1 <= max_chars:
            current = f"{current} {sentence}".strip() if current else sentence
        else:
            if current:
                chunks.append(current)
            if len(sentence) > max_chars:
                for part in textwrap.wrap(sentence, max_chars):
                    chunks.append(part)
                current = ""
            else:
                current = sentence

    if current:
        chunks.append(current)
    return chunks


# -----------------------------------------------------------------------
# Main translate function
# -----------------------------------------------------------------------
def translate(text: str, target_language: str) -> str:
    """
    Translate English text to target Indian language.

    Uses Google Translate (free API via httpx) → Ollama LLM fallback.
    """
    lang_key = target_language.strip().lower()
    lang_code = SUPPORTED_LANGUAGES.get(lang_key)
    if lang_code is None:
        supported = ", ".join(get_supported_languages())
        raise ValueError(f"Unsupported language: '{target_language}'. Supported: {supported}")

    if not text.strip():
        return ""

    # Strategy 1: Google Translate (fastest)
    try:
        logger.info(f"Translating to {lang_key} via Google Translate (httpx)...")
        result = _translate_google(text.strip(), lang_code)
        if result and result.strip():
            logger.info(f"Google Translate succeeded ({len(result)} chars)")
            return result.strip()
    except Exception as e:
        logger.warning(f"Google Translate failed: {e}")

    # Strategy 2: Ollama LLM (local fallback)
    try:
        logger.info(f"Translating to {lang_key} via Ollama LLM...")
        result = _translate_ollama(text.strip(), lang_code)
        if result and result.strip():
            logger.info(f"Ollama translation succeeded ({len(result)} chars)")
            return result.strip()
    except Exception as e:
        logger.warning(f"Ollama translation failed: {e}")

    raise RuntimeError(
        f"All translation engines failed for '{target_language}'. "
        "Check internet connection."
    )
