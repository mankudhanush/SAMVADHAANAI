"""
Suitability scoring, city filtering, ranking, and recommendation
explanation for lawyer profiles.

Scoring formula (total 100):
    Practice-area match   × 40
    Keyword match         × 25
    City match            × 20
    Experience score      × 15
"""
from __future__ import annotations

import math
import re
import logging
from typing import Any

logger = logging.getLogger(__name__)


# =========================================================================
# Individual scoring dimensions
# =========================================================================

def _score_practice_match(lawyer: dict, case_meta: dict) -> float:
    """0 – 1.0 : how well does the profile match the practice area?"""
    text = f"{lawyer['name']} {lawyer['firm']} {lawyer['snippet']}".lower()
    pa = case_meta["practice_area"].lower()
    ct = case_meta.get("case_type", "").lower()

    score = 0.0

    # Exact practice-area phrase
    if pa in text:
        score += 0.50

    # Individual words of practice area
    pa_words = pa.split()
    if pa_words:
        hits = sum(1 for w in pa_words if w in text)
        score += 0.20 * (hits / len(pa_words))

    # Case-type match
    if ct:
        ct_words = ct.split()
        if ct in text:
            score += 0.20
        elif ct_words:
            hits = sum(1 for w in ct_words if w in text)
            score += 0.10 * (hits / len(ct_words))

    # Legal-title bonus
    if lawyer.get("has_legal_title"):
        score += 0.10

    return min(score, 1.0)


def _score_keyword_match(lawyer: dict, case_meta: dict) -> float:
    """0 – 1.0 : keyword overlap between case keywords and profile."""
    keywords = case_meta.get("keywords", [])
    if not keywords:
        return 0.5  # neutral when no keywords provided

    text = f"{lawyer['name']} {lawyer['firm']} {lawyer['snippet']}".lower()
    hits = sum(1 for kw in keywords if kw.lower() in text)
    return hits / len(keywords)


def _score_city_match(lawyer: dict, case_meta: dict) -> float:
    """0 – 1.0 : city relevance (binary match with partial credit)."""
    text = f"{lawyer['snippet']} {lawyer['name']} {lawyer['firm']}".lower()
    city = case_meta["preferred_city"].lower()

    if city in text:
        return 1.0

    # Check for common abbreviations / nicknames
    _ALIASES: dict[str, list[str]] = {
        "delhi": ["new delhi", "ncr"],
        "bangalore": ["bengaluru"],
        "mumbai": ["bombay"],
        "chennai": ["madras"],
        "kolkata": ["calcutta"],
        "kochi": ["cochin"],
        "varanasi": ["banaras", "benaras"],
        "pune": ["poona"],
        "gurgaon": ["gurugram"],
    }
    for alias in _ALIASES.get(city, []):
        if alias in text:
            return 0.9

    return 0.0


def _score_experience(lawyer: dict) -> float:
    """0 – 1.0 : experience indicator strength."""
    exp = lawyer.get("experience", {})
    years = exp.get("years", 0)
    if years <= 0:
        # No experience data — check for seniority keywords
        snippet = lawyer.get("snippet", "").lower()
        seniority_terms = [
            "senior advocate", "senior counsel", "supreme court",
            "high court", "former judge", "specializ", "expert",
        ]
        for term in seniority_terms:
            if term in snippet:
                return 0.5
        return 0.0

    # Logarithmic: 5yr → 0.56, 10yr → 0.72, 20yr → 0.88, 30yr → 1.0
    return min(1.0, math.log2(years + 1) / math.log2(31))


# =========================================================================
# Composite score
# =========================================================================

_WEIGHTS = {
    "practice_match": 40,
    "keyword_match": 25,
    "city_match": 20,
    "experience": 15,
}


def calculate_score(lawyer: dict, case_meta: dict) -> dict:
    """
    Compute the weighted suitability score (0-100) and annotate the
    lawyer dict with ``scores`` and ``total_score``.
    """
    raw = {
        "practice_match": _score_practice_match(lawyer, case_meta),
        "keyword_match": _score_keyword_match(lawyer, case_meta),
        "city_match": _score_city_match(lawyer, case_meta),
        "experience": _score_experience(lawyer),
    }

    total = sum(raw[k] * _WEIGHTS[k] for k in _WEIGHTS)

    lawyer["scores"] = {
        k: round(raw[k] * _WEIGHTS[k], 2) for k in _WEIGHTS
    }
    lawyer["total_score"] = round(total, 2)
    return lawyer


# =========================================================================
# Filtering
# =========================================================================

def filter_by_city(
    lawyers: list[dict],
    case_meta: dict,
    min_city_score: float = 0.0,
) -> tuple[list[dict], list[dict]]:
    """
    Partition lawyers into city-matched and non-matched.

    Returns:
        (city_matched, rest)
    """
    city = case_meta["preferred_city"].lower()
    matched: list[dict] = []
    rest: list[dict] = []

    _ALIASES: dict[str, list[str]] = {
        "delhi": ["new delhi", "ncr"],
        "bangalore": ["bengaluru"],
        "mumbai": ["bombay"],
        "chennai": ["madras"],
        "kolkata": ["calcutta"],
        "kochi": ["cochin"],
        "gurgaon": ["gurugram"],
    }
    check_terms = [city] + _ALIASES.get(city, [])

    for lawyer in lawyers:
        text = f"{lawyer['snippet']} {lawyer['name']} {lawyer['firm']}".lower()
        if any(t in text for t in check_terms):
            matched.append(lawyer)
        else:
            rest.append(lawyer)

    return matched, rest


# =========================================================================
# Ranking
# =========================================================================

def rank_lawyers(
    lawyers: list[dict],
    case_meta: dict,
    top_n: int | None = None,
) -> list[dict]:
    """Score and sort lawyers descending by total_score."""
    scored = [calculate_score(l, case_meta) for l in lawyers]
    scored.sort(key=lambda x: x["total_score"], reverse=True)
    if top_n:
        scored = scored[:top_n]
    return scored


# =========================================================================
# Explanation generator
# =========================================================================

def explain_recommendation(lawyer: dict, case_meta: dict) -> str:
    """
    Generate a human-readable recommendation reason string.

    Example:
        "Recommended because this lawyer specializes in Property Law,
         mentions civil disputes, and is located in Delhi with 12+ years
         experience."
    """
    parts: list[str] = []
    scores = lawyer.get("scores", {})
    pa = case_meta["practice_area"]
    city = case_meta["preferred_city"]
    ct = case_meta.get("case_type", "")
    keywords = case_meta.get("keywords", [])
    exp = lawyer.get("experience", {})

    # Practice match
    if scores.get("practice_match", 0) >= 20:
        parts.append(f"specializes in {pa}")
    elif scores.get("practice_match", 0) >= 10:
        parts.append(f"has relevant {pa} background")

    # Keyword signal
    matched_kw = [kw for kw in keywords
                  if kw.lower() in lawyer.get("snippet", "").lower()]
    if matched_kw:
        parts.append(f"mentions {', '.join(matched_kw[:3])}")

    # Case-type
    if ct and ct.lower() in lawyer.get("snippet", "").lower():
        parts.append(f"handles {ct} cases")

    # City
    if scores.get("city_match", 0) >= 15:
        parts.append(f"is located in {city}")

    # Experience
    years = exp.get("years")
    if years and years > 0:
        parts.append(f"has {years}+ years experience")
    elif scores.get("experience", 0) >= 5:
        parts.append("shows seniority indicators")

    # Firm
    if lawyer.get("firm"):
        parts.append(f"associated with {lawyer['firm']}")

    if not parts:
        return f"Matched for {pa} in {city}."

    return "Recommended because this lawyer " + ", ".join(parts) + "."
