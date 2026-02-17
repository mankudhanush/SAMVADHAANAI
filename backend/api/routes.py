"""
API routes — all endpoint definitions.

Every route delegates to a service module. No business logic here.
"""
import asyncio
import logging
from functools import partial

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from pydantic import BaseModel, Field

from backend.services.ingestion_service import ingest_document
from backend.services.qa_service import answer_question, clear_session
from backend.services.analysis_service import full_analysis
from backend.services.web_search_service import search as web_search
from backend.services.voice_service import transcribe_audio, transcribe_and_summarize
from backend.vectorstore.store import vector_store

# Discovery — new engine
from backend.discovery.lawyer_engine import discover as discover_lawyers_engine

# Simplifier (existing feature — keep)
from backend.rag.simplifier import simplify_document

# Translation
from backend.voice.translation_utils import translate, get_supported_languages

# Text-to-Speech
from backend.voice.tts_utils import text_to_speech

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class QuestionRequest(BaseModel):
    question: str
    session_id: str = Field(default="default")


class AnswerResponse(BaseModel):
    answer: str
    sources: list[dict]
    session_id: str


class UploadResponse(BaseModel):
    filename: str
    pages: int
    total_chars: int
    num_chunks: int
    total_vectors: int
    message: str


class StatusResponse(BaseModel):
    total_vectors: int
    documents: list[str]


class WebSearchRequest(BaseModel):
    query: str
    max_results: int = Field(default=5, ge=1, le=20)


class WebSearchResult(BaseModel):
    title: str
    url: str
    snippet: str


class WebSearchResponse(BaseModel):
    results: list[WebSearchResult]
    query: str


class VoiceResponse(BaseModel):
    transcript: str
    detected_language: str
    duration_sec: float
    summary: str = ""


class AnalysisResponse(BaseModel):
    risks: dict | list | None = None
    key_clauses: dict | list | None = None
    summary: dict | list | None = None
    classification: dict | list | None = None


class DiscoverRequest(BaseModel):
    practice_area: str = Field(..., description="e.g. Property Law, Criminal Law")
    case_type: str = Field(default="")
    keywords: list[str] = Field(default=[])
    urgency_level: str = Field(default="Medium")
    preferred_city: str = Field(..., description="e.g. Delhi, Mumbai")
    budget_level: str = Field(default="Mid")
    max_results: int = Field(default=10, ge=1, le=50)


class SimplifyRequest(BaseModel):
    target_language: str = Field(default="")
    document_name: str = Field(default="", description="Filename of the document to simplify (filters chunks)")


class TranslateRequest(BaseModel):
    text: str = Field(..., description="Text to translate")
    target_language: str = Field(..., description="Target language name e.g. hindi, telugu")


class TranslateResponse(BaseModel):
    translated_text: str
    target_language: str
    source_language: str = "english"


class TTSRequest(BaseModel):
    text: str = Field(..., description="Text to convert to speech")
    language: str = Field(..., description="Language name e.g. hindi, telugu")


class TTSResponse(BaseModel):
    audio_url: str
    language: str


class ErrorResponse(BaseModel):
    status: str = "error"
    message: str


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------
@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """Upload → OCR → clean → chunk → embed → store."""
    try:
        contents = await file.read()
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None, partial(ingest_document, contents, file.filename or "unknown")
        )
        return UploadResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Upload processing failed")
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})


# ---------------------------------------------------------------------------
# Query (RAG)
# ---------------------------------------------------------------------------
@router.post("/query", response_model=AnswerResponse)
async def ask_question(req: QuestionRequest):
    """Ask a question with hybrid retrieval + re-ranking."""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None, partial(answer_question, req.question.strip(), session_id=req.session_id)
        )
        return AnswerResponse(**result)
    except Exception as e:
        logger.exception("Query failed")
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})


# ---------------------------------------------------------------------------
# Analyze
# ---------------------------------------------------------------------------
@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_document():
    """Run comprehensive document analysis (risks, clauses, summary, classification)."""
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, full_analysis)
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return AnalysisResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})


# ---------------------------------------------------------------------------
# Web Search
# ---------------------------------------------------------------------------
@router.post("/web-search", response_model=WebSearchResponse)
async def web_search_endpoint(req: WebSearchRequest):
    """Search the web using DuckDuckGo."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty.")
    try:
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            None, partial(web_search, req.query.strip(), max_results=req.max_results)
        )
        return WebSearchResponse(
            results=[WebSearchResult(**r) for r in results],
            query=req.query.strip(),
        )
    except Exception as e:
        logger.exception("Web search failed")
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})


# ---------------------------------------------------------------------------
# Voice
# ---------------------------------------------------------------------------
@router.post("/voice", response_model=VoiceResponse)
async def voice_endpoint(audio: UploadFile = File(...)):
    """Audio → Whisper → Transcript → Optional summarize → Return text."""
    try:
        contents = await audio.read()
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            partial(transcribe_and_summarize, contents, audio.filename or "audio.wav"),
        )
        return VoiceResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Voice processing failed")
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})


# ---------------------------------------------------------------------------
# Speech-to-Text (lightweight — for voice question input)
# ---------------------------------------------------------------------------
@router.post("/speech-to-text")
async def speech_to_text_endpoint(audio: UploadFile = File(...)):
    """Transcribe audio to text using Whisper. Supports Indian languages."""
    try:
        contents = await audio.read()
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            partial(transcribe_audio, contents, audio.filename or "recording.webm"),
        )
        return {
            "text": result["transcript"],
            "language": result["detected_language"],
            "duration_sec": result["duration_sec"],
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Speech-to-text failed")
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------
@router.get("/status", response_model=StatusResponse)
async def get_status():
    """Return vector store stats and document list."""
    return StatusResponse(
        total_vectors=vector_store.size,
        documents=vector_store.get_documents(),
    )


# ---------------------------------------------------------------------------
# Clear
# ---------------------------------------------------------------------------
@router.post("/clear")
async def clear_store():
    """Reset vector store and conversation memory."""
    vector_store.clear()
    clear_session("default")
    return {"message": "Vector store and sessions cleared."}


@router.post("/clear-session")
async def clear_chat_session(session_id: str = "default"):
    """Clear conversation history for a session."""
    clear_session(session_id)
    return {"message": f"Session '{session_id}' cleared."}


# ---------------------------------------------------------------------------
# Translate
# ---------------------------------------------------------------------------
@router.post("/translate", response_model=TranslateResponse)
async def translate_endpoint(req: TranslateRequest):
    """Translate text to an Indian language (Google → Groq → M2M100 cascade)."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    try:
        loop = asyncio.get_running_loop()
        translated = await loop.run_in_executor(
            None,
            partial(translate, req.text.strip(), req.target_language.strip()),
        )
        return TranslateResponse(
            translated_text=translated,
            target_language=req.target_language.strip().lower(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Translation failed")
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})


@router.get("/languages")
async def list_languages():
    """Return supported translation languages."""
    return {"languages": get_supported_languages()}


# ---------------------------------------------------------------------------
# Text-to-Speech
# ---------------------------------------------------------------------------
@router.post("/tts", response_model=TTSResponse)
async def tts_endpoint(req: TTSRequest):
    """Convert text to speech using gTTS. Returns URL to audio file."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    try:
        loop = asyncio.get_running_loop()
        audio_path = await loop.run_in_executor(
            None,
            partial(text_to_speech, req.text.strip(), req.language.strip()),
        )
        return TTSResponse(
            audio_url=f"/{audio_path}",
            language=req.language.strip().lower(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("TTS failed")
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})


# ---------------------------------------------------------------------------
# Discover Lawyers (existing feature — preserved)
# ---------------------------------------------------------------------------
@router.post("/discover-lawyers")
async def discover_lawyers_endpoint(req: DiscoverRequest):
    """Discover and rank lawyers using DuckDuckGo search."""
    if not req.practice_area.strip() or not req.preferred_city.strip():
        raise HTTPException(status_code=400, detail="practice_area and preferred_city required.")
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,
            partial(
                discover_lawyers_engine,
                practice_area=req.practice_area.strip(),
                city=req.preferred_city.strip(),
                keywords=[k.strip() for k in req.keywords if k.strip()],
                max_results=req.max_results,
                top_n=req.max_results,
            ),
        )
    except Exception as e:
        logger.exception("Lawyer discovery failed")
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})


# ---------------------------------------------------------------------------
# Simplify (existing feature — preserved)
# ---------------------------------------------------------------------------
@router.post("/simplify")
async def simplify_endpoint(req: SimplifyRequest = None):
    """Simplify the uploaded document into plain language."""
    try:
        doc_name = (req.document_name.strip() if req and req.document_name else "")
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, partial(simplify_document, doc_name))
        if result["chunk_count"] == 0:
            raise HTTPException(status_code=400, detail="No documents uploaded yet.")

        response = {
            "raw_text": result["raw_text"],
            "structured": result["structured"],
            "chunk_count": result["chunk_count"],
        }

        lang = ""
        if req and req.target_language:
            lang = req.target_language.strip().lower()

        if lang:
            from backend.voice.translation_utils import SUPPORTED_LANGUAGES, translate
            from backend.voice.tts_utils import text_to_speech

            if lang not in SUPPORTED_LANGUAGES:
                raise HTTPException(status_code=400, detail=f"Unsupported language: {lang}")

            # Build speakable text
            structured = result.get("structured")
            if structured:
                parts = [f"This is a {structured.get('document_type', 'Legal Document')}."]
                for item in structured.get("simplified_explanation", []):
                    if item.get("simple_english"):
                        parts.append(item["simple_english"])
                    if item.get("what_this_means_for_you"):
                        parts.append(f"This means: {item['what_this_means_for_you']}")
                    if item.get("be_careful_warning"):
                        parts.append(f"Warning: {item['be_careful_warning']}")
                overall = structured.get("overall_warnings", "")
                if overall:
                    parts.append(f"Overall warnings: {overall}")
                speak_text = " ".join(parts)
            else:
                speak_text = result["raw_text"][:2000]

            translated = await loop.run_in_executor(None, partial(translate, speak_text, lang))
            audio_path = await loop.run_in_executor(None, partial(text_to_speech, translated, lang))
            response["translated_text"] = translated
            response["audio_file"] = audio_path
            response["target_language"] = lang
        else:
            response["translated_text"] = ""
            response["audio_file"] = ""
            response["target_language"] = ""

        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Simplification failed")
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})
