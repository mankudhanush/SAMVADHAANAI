"""
Lawyer Discovery Engine — orchestrator.

Pipeline:  generate_queries → search_lawyers → extract_structured_data
           → filter_by_city → calculate_score → rank_lawyers
           → explain_recommendation

If no strong city matches are found, automatically expands to nearby
metro cities (fallback logic).
"""
from __future__ import annotations

import logging
from typing import Any

from backend.discovery.search import search_lawyers, get_fallback_cities, generate_queries
from backend.discovery.extractor import extract_structured_data
from backend.discovery.scorer import (
    filter_by_city,
    rank_lawyers,
    explain_recommendation,
)

logger = logging.getLogger(__name__)

# Minimum number of city-matched results before triggering fallback
_MIN_CITY_RESULTS = 3


def _build_lawyer_record(lawyer: dict, case_meta: dict, rank: int) -> dict:
    """Shape a scored lawyer dict into the final API output format."""
    exp = lawyer.get("experience", {})
    return {
        "rank": rank,
        "name": lawyer["name"],
        "firm": lawyer.get("firm", ""),
        "city": lawyer.get("location", case_meta["preferred_city"]),
        "website": lawyer.get("website", ""),
        "snippet": lawyer.get("snippet", ""),
        "phone_numbers": lawyer.get("phone_numbers", []),
        "experience_years": exp.get("years"),
        "experience_raw": exp.get("raw", ""),
        "score": lawyer["total_score"],
        "scores": lawyer.get("scores", {}),
        "reason": explain_recommendation(lawyer, case_meta),
    }


def discover_lawyers(case_meta: dict[str, Any]) -> dict:
    """
    Full discovery pipeline.

    Args:
        case_meta: {
            "practice_area": str,        (required)
            "case_type": str,            (optional)
            "keywords": list[str],       (optional)
            "urgency_level": str,        (optional — High/Medium/Low)
            "preferred_city": str,       (required)
            "budget_level": str,         (optional — Low/Mid/High/Premium)
            "max_results": int,          (optional, default 10)
        }

    Returns:
        {
            "query_info": { … },
            "total_found": int,
            "top_recommendations": [ { name, city, website, score, reason, … } ],
            "other_matches": [ … ],
            "fallback_used": bool,
            "fallback_city": str | None,
        }
    """
    max_results = case_meta.pop("max_results", 10)
    preferred_city = case_meta["preferred_city"]

    logger.info(
        f"Discovery start: {case_meta['practice_area']!r} / "
        f"{case_meta.get('case_type','')!r} in {preferred_city!r}"
    )

    # ------------------------------------------------------------------
    # 1. Search
    # ------------------------------------------------------------------
    raw = search_lawyers(case_meta)

    # ------------------------------------------------------------------
    # 2. Extract structured data (+ parallel phone scrape)
    # ------------------------------------------------------------------
    profiles = extract_structured_data(raw, preferred_city=preferred_city)

    # ------------------------------------------------------------------
    # 3. Filter by city
    # ------------------------------------------------------------------
    city_matched, rest = filter_by_city(profiles, case_meta)

    fallback_used = False
    fallback_city: str | None = None

    # ------------------------------------------------------------------
    # 4. Fallback — expand to nearby metros if too few city matches
    # ------------------------------------------------------------------
    if len(city_matched) < _MIN_CITY_RESULTS:
        fallback_cities = get_fallback_cities(preferred_city)
        for fb_city in fallback_cities:
            logger.info(f"Fallback: expanding search to {fb_city!r}")
            fb_meta = {**case_meta, "preferred_city": fb_city}
            fb_raw = search_lawyers(fb_meta, max_results_per_query=15, delay=1.0)
            fb_profiles = extract_structured_data(fb_raw, preferred_city=fb_city)

            # Mark with actual location
            for p in fb_profiles:
                p["location"] = fb_city.title()

            city_matched.extend(fb_profiles)
            fallback_used = True
            fallback_city = fb_city.title()

            if len(city_matched) >= _MIN_CITY_RESULTS:
                break

    # ------------------------------------------------------------------
    # 5. Rank city-matched (top recommendations)
    # ------------------------------------------------------------------
    top_ranked = rank_lawyers(city_matched, case_meta, top_n=max_results)

    # ------------------------------------------------------------------
    # 6. Rank rest (other matches, capped)
    # ------------------------------------------------------------------
    other_ranked = rank_lawyers(rest, case_meta, top_n=max_results)

    # ------------------------------------------------------------------
    # 7. Build response
    # ------------------------------------------------------------------
    top_recs = [
        _build_lawyer_record(l, case_meta, i)
        for i, l in enumerate(top_ranked, 1)
    ]
    other_matches = [
        _build_lawyer_record(l, case_meta, i)
        for i, l in enumerate(other_ranked, 1)
    ]

    queries_used = generate_queries(case_meta)

    result = {
        "query_info": {
            "practice_area": case_meta["practice_area"],
            "case_type": case_meta.get("case_type", ""),
            "preferred_city": preferred_city,
            "keywords": case_meta.get("keywords", []),
            "urgency_level": case_meta.get("urgency_level", ""),
            "budget_level": case_meta.get("budget_level", ""),
            "queries_generated": len(queries_used),
        },
        "total_found": len(profiles),
        "top_recommendations": top_recs,
        "other_matches": other_matches,
        "fallback_used": fallback_used,
        "fallback_city": fallback_city,
    }

    logger.info(
        f"Discovery done: {len(top_recs)} top recs, "
        f"{len(other_matches)} other, fallback={fallback_used}"
    )
    return result
