"""
API routes for the Constitutional Intelligence Engine.

This router is COMPLETELY ISOLATED from the main API routes and
case strategy routes. It is mounted separately in main.py.
"""

import logging
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.constitutional_intelligence_service import (
    analyze_constitutional_intelligence,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class ConstitutionalIntelligenceRequest(BaseModel):
    document_text: str = Field(
        ..., min_length=20,
        description="Legal document text to analyze for constitutional implications",
    )
    mode: Literal["citizen", "law_student"] = Field(
        default="citizen",
        description="Intelligence mode: 'citizen' for plain language, 'law_student' for detailed legal analysis"
    )


class ArticleMapping(BaseModel):
    article_number: str = ""
    title: str = ""
    relevance_explanation: str = ""


class RightsImpact(BaseModel):
    right: str = ""
    impact_analysis: str = ""


class DirectivePrinciple(BaseModel):
    principle: str = ""
    analysis: str = ""


class LandmarkCase(BaseModel):
    case_name: str = ""
    constitutional_significance: str = ""


class ConstitutionalRiskLevel(BaseModel):
    level: str = ""
    reasoning: str = ""


class ConstitutionalIntelligenceResponse(BaseModel):
    relevant_articles: list[ArticleMapping] = []
    fundamental_rights_impact: list[RightsImpact] = []
    directive_principles_relevance: list[DirectivePrinciple] = []
    landmark_cases: list[LandmarkCase] = []
    constitutional_risk_level: ConstitutionalRiskLevel = ConstitutionalRiskLevel()
    interpretation_summary: str = ""


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------
@router.post(
    "/constitutional-intelligence",
    response_model=ConstitutionalIntelligenceResponse,
    summary="Analyze document for constitutional implications",
    tags=["Constitutional Intelligence"],
)
async def constitutional_intelligence_endpoint(req: ConstitutionalIntelligenceRequest):
    """
    Accepts legal document text and returns structured constitutional mapping:
    - Relevant Articles of the Indian Constitution
    - Impact on Fundamental Rights
    - Relevant Directive Principles
    - Landmark Supreme Court Case References
    - Constitutional Risk Level
    - Constitutional Interpretation Summary

    Mode options:
    - "citizen": Plain language explanations for ordinary users (default)
    - "law_student": Detailed constitutional analysis with doctrinal references
    """
    if not req.document_text.strip():
        raise HTTPException(status_code=400, detail="Document text cannot be empty.")

    logger.info("[ConstitutionalIntel API] Request → mode=%s", req.mode)

    try:
        result = await analyze_constitutional_intelligence(req.document_text.strip(), mode=req.mode)
        return ConstitutionalIntelligenceResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Constitutional intelligence analysis failed")
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": str(e)},
        )
