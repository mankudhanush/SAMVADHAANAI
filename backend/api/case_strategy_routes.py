"""
API routes for the AI Case Strategy Simulator.

This router is COMPLETELY ISOLATED from the main API routes.
It is mounted separately in main.py with its own prefix.
"""

import logging
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.case_strategy_service import simulate_case_strategy_async

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class CaseStrategyRequest(BaseModel):
    case_description: str = Field(
        ..., min_length=20, description="Detailed description of the legal case"
    )
    case_type: str = Field(
        ..., description="Type of case: civil, criminal, corporate, property, family, etc."
    )
    jurisdiction: Optional[str] = Field(
        None, description="Optional jurisdiction, e.g. 'Delhi High Court'"
    )
    mode: Literal["citizen", "law_student"] = Field(
        default="citizen",
        description="Intelligence mode: 'citizen' for plain language, 'law_student' for detailed legal analysis"
    )


class RiskFactor(BaseModel):
    factor: str
    impact: str


class RiskScore(BaseModel):
    level: str
    percentage: int
    factors: list[RiskFactor] = []


class TimelinePhase(BaseModel):
    phase: str
    duration: str
    description: str = ""


class ExpectedTimeline(BaseModel):
    estimate: str
    phases: list[TimelinePhase] = []


class ApplicableSection(BaseModel):
    section: str
    relevance: str = ""


class Counterargument(BaseModel):
    argument: str
    severity: str = "medium"


class CaseStrategyResponse(BaseModel):
    applicable_sections: list[ApplicableSection]
    counterarguments: list[Counterargument]
    risk_score: RiskScore
    expected_timeline: ExpectedTimeline
    strategy_summary: str


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/case-strategy", response_model=CaseStrategyResponse)
async def case_strategy(req: CaseStrategyRequest):
    """
    AI Case Strategy Simulator endpoint.
    90 x 11
    86 Hidden Terminals
    Found 6 major remaining bottlenecks:
    
    OCR still runs on every native-text page at 200 DPI — for legal PDFs (99% native text), this is completely wasted work. Should skip OCR entirely when native text is rich.
    Embedding runs on CPU only — even all-MiniLM-L6-v2 is 4-8x faster with convert_to_numpy=True + half-precision. We're leaving perf on the table.
    Simplifier map-reduce makes sequential LLM calls — can run map phases in parallel threads.
    embed_texts returns .tolist() — converting numpy→list for 1000+ vectors is slow. ChromaDB accepts numpy directly.
    BM25 sorted(enumerate(scores)) on entire corpus — for 1000+ chunks, should use numpy.argpartition.
    Chunker creates splitter per call — should be a singleton.
    Let me implement all of these:
    
    Now optimize BM25 with numpy argpartition and make the chunker use a singleton splitter:
    
    Summarized conversation history
    
    Now let me read the simplifier to apply the parallel map phase:
    
    Now apply the parallel map phase for the simplifier:
    
    Now replace the sequential map phase with parallel execution:
    
    Edited
    simplifier.py+13-6
    Now verify all modified files for errors:
    
    Checked retriever.py, chunker.py, simplifier.py, extractor.py, embedder.py, store.py, no problems found
    
    All 6 files clean. Now let me also add num_thread to the Ollama LLM calls to ensure all CPU cores are used:
    
    All files are error-free. Now restart the backend and frontend servers:
    
    Get-Process -Name "python","node","uvicorn" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1; Write-Output "Processes cleaned"
     Run pwsh command in background?
    Al

    Accepts a case description, type, optional jurisdiction, and intelligence mode.
    Returns structured strategic legal analysis.
    
    Mode options:
    - "citizen": Plain language explanations for ordinary users (default)
    - "law_student": Detailed legal analysis with doctrinal references
    """
    logger.info(
        "[CaseStrategy API] Request → type=%s, jurisdiction=%s, mode=%s",
        req.case_type,
        req.jurisdiction or "N/A",
        req.mode,
    )

    try:
        # Fully async — no thread executor needed
        result = await simulate_case_strategy_async(
            case_description=req.case_description,
            case_type=req.case_type,
            jurisdiction=req.jurisdiction,
            mode=req.mode,
        )
        return result

    except RuntimeError as exc:
        logger.error("[CaseStrategy API] Service error: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        logger.exception("[CaseStrategy API] Unexpected error")
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}")
