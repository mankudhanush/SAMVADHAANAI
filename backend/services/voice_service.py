"""
Voice service — wraps the Whisper pipeline with optional summarization.

Audio → Whisper → Transcript → Optional summarize → Return text

Separate from document endpoints.
"""
import uuid
import logging
from pathlib import Path

from backend.config import UPLOAD_DIR
from backend.voice.whisper_utils import transcribe
from backend.services.llm_service import generate

logger = logging.getLogger(__name__)

ALLOWED_AUDIO_EXT = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm"}


def transcribe_audio(audio_bytes: bytes, filename: str) -> dict:
    """
    Transcribe an audio file using Whisper.

    Args:
        audio_bytes: Raw audio file content.
        filename:    Original filename.

    Returns:
        {
            "transcript": str,
            "detected_language": str,
            "duration_sec": float,
        }
    """
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_AUDIO_EXT:
        raise ValueError(
            f"Unsupported audio format '{ext}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_AUDIO_EXT))}"
        )

    temp_name = f"{uuid.uuid4().hex}{ext}"
    temp_path = UPLOAD_DIR / temp_name

    try:
        temp_path.write_bytes(audio_bytes)
        logger.info(f"Voice upload saved: {filename} ({len(audio_bytes)} bytes)")

        logger.info("Transcribing audio with Whisper...")
        result = transcribe(str(temp_path))

        transcript = result["text"]
        logger.info(
            f"Transcription complete: {len(transcript)} chars, "
            f"lang={result['language']}, duration={result['duration_sec']}s"
        )

        return {
            "transcript": transcript,
            "detected_language": result["language"],
            "duration_sec": result["duration_sec"],
        }

    finally:
        if temp_path.exists():
            temp_path.unlink()


def transcribe_and_summarize(audio_bytes: bytes, filename: str) -> dict:
    """
    Transcribe audio and optionally summarize the transcript.

    Returns:
        {
            "transcript": str,
            "detected_language": str,
            "duration_sec": float,
            "summary": str,
        }
    """
    result = transcribe_audio(audio_bytes, filename)
    transcript = result["transcript"]

    if not transcript.strip():
        result["summary"] = ""
        return result

    # Summarize the transcript
    logger.info("Summarizing transcript via LLM...")
    summary_result = generate(
        prompt=f"Summarize the following transcript concisely:\n\n{transcript}",
        system_prompt="You are a concise summarizer. Provide a brief summary.",
    )
    result["summary"] = summary_result["text"]
    logger.info(f"Summary: {len(result['summary'])} chars")

    return result
