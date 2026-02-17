"""
Speech-to-Text using OpenAI Whisper — runs fully locally.

Uses the `faster-whisper` backend (CTranslate2) for efficiency.
Auto-detects GPU/CPU.  Model is loaded once and cached.
"""
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_model = None
_MODEL_SIZE = "base"  # Options: tiny, base, small, medium, large-v3


def _get_model():
    """Lazy-load and cache the Whisper model."""
    global _model
    if _model is not None:
        return _model

    from faster_whisper import WhisperModel

    # Auto-detect best device
    try:
        import torch
        if torch.cuda.is_available():
            device, compute = "cuda", "float16"
        else:
            device, compute = "cpu", "int8"
    except ImportError:
        device, compute = "cpu", "int8"

    logger.info(f"Loading Whisper '{_MODEL_SIZE}' on {device} ({compute}) ...")
    _model = WhisperModel(_MODEL_SIZE, device=device, compute_type=compute)
    logger.info("Whisper model loaded")
    return _model


def transcribe(audio_path: str) -> dict:
    """
    Transcribe an audio file to text.

    Parameters
    ----------
    audio_path : str
        Path to .wav / .mp3 / .m4a / .ogg etc.

    Returns
    -------
    dict  with keys:
        text             – full transcript
        language         – detected language code (e.g. "en")
        language_prob    – confidence of language detection
        duration_sec     – audio duration in seconds
    """
    if not Path(audio_path).exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    model = _get_model()
    # beam_size=1 (greedy) is ~2-3x faster than beam_size=5 with
    # minimal quality loss for conversational / dictation audio.
    segments, info = model.transcribe(audio_path, beam_size=1)

    # Materialise segments (generator)
    text_parts = [seg.text.strip() for seg in segments]
    full_text = " ".join(text_parts)

    return {
        "text": full_text,
        "language": info.language,
        "language_prob": round(info.language_probability, 3),
        "duration_sec": round(info.duration, 2),
    }
