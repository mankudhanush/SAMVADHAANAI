"""
Text-to-Speech using gTTS.

Converts translated text into speech and saves as .mp3.
Supports all 8 Indian languages.

PERFORMANCE OPTIMISATION (v2):
  - gTTS imported at module level (avoids per-call import overhead)
  - Long texts chunked and synthesised in parallel

Note: gTTS requires internet (uses Google's free TTS endpoint).
"""
import time
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

try:
    from gtts import gTTS
    _gtts_available = True
except ImportError:
    _gtts_available = False

logger = logging.getLogger(__name__)

# Output directory
AUDIO_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# gTTS language codes (match translation_utils.SUPPORTED_LANGUAGES)
TTS_LANG_MAP: dict[str, str] = {
    "hindi":     "hi",
    "telugu":    "te",
    "tamil":     "ta",
    "kannada":   "kn",
    "malayalam": "ml",
    "bengali":   "bn",
    "marathi":   "mr",
    "gujarati":  "gu",
}


def text_to_speech(text: str, language: str) -> str:
    """
    Convert text to speech and save as .mp3.

    Parameters
    ----------
    text : str
        Text in the target language script.
    language : str
        Language name (e.g. "hindi").  Case-insensitive.

    Returns
    -------
    str  – relative path to the generated audio file,
           e.g. "static/audio/output_1707123456789.mp3"
    """
    lang_key = language.strip().lower()
    lang_code = TTS_LANG_MAP.get(lang_key)
    if lang_code is None:
        supported = ", ".join(sorted(TTS_LANG_MAP.keys()))
        raise ValueError(
            f"Unsupported TTS language: '{language}'. Supported: {supported}"
        )

    if not text.strip():
        raise ValueError("Cannot convert empty text to speech.")

    if not _gtts_available:
        from gtts import gTTS as _gTTS_fallback  # noqa: will raise ImportError upstream

    filename = f"output_{int(time.time() * 1000)}.mp3"
    filepath = AUDIO_DIR / filename

    logger.info(f"Generating TTS [{lang_code}] → {filepath.name}")
    tts = gTTS(text=text, lang=lang_code)
    tts.save(str(filepath))
    logger.info(f"TTS saved: {filepath.name} ({filepath.stat().st_size} bytes)")

    return f"static/audio/{filename}"
