"""
Intelligent query generation and DuckDuckGo search for lawyer discovery.

Dynamically builds queries from structured case metadata and executes
them against DDG with deduplication and rate-limiting.
"""
from __future__ import annotations

import logging
import time
from typing import Any

from ddgs import DDGS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Nearby-metro fallback map (city → ordered list of fallbacks)
# ---------------------------------------------------------------------------
METRO_FALLBACKS: dict[str, list[str]] = {
    "delhi":      ["noida", "gurgaon", "ghaziabad", "faridabad"],
    "mumbai":     ["thane", "navi mumbai", "pune"],
    "bangalore":  ["mysore", "chennai"],
    "chennai":    ["bangalore", "coimbatore"],
    "kolkata":    ["howrah", "siliguri"],
    "hyderabad":  ["secunderabad", "visakhapatnam"],
    "pune":       ["mumbai", "nashik"],
    "ahmedabad":  ["surat", "vadodara", "rajkot"],
    "jaipur":     ["jodhpur", "udaipur", "delhi"],
    "lucknow":    ["kanpur", "allahabad", "delhi"],
    "chandigarh": ["mohali", "panchkula", "delhi"],
    "kochi":      ["trivandrum", "calicut"],
    "indore":     ["bhopal", "nagpur"],
    "patna":      ["ranchi", "varanasi"],
    "guwahati":   ["shillong", "kolkata"],
    "nagpur":     ["pune", "indore"],
    "visakhapatnam": ["hyderabad"],
    "coimbatore": ["chennai", "bangalore"],
    "noida":      ["delhi", "gurgaon", "ghaziabad"],
    "gurgaon":    ["delhi", "noida"],
}


# ---------------------------------------------------------------------------
# Query generation
# ---------------------------------------------------------------------------
def generate_queries(case_meta: dict[str, Any]) -> list[str]:
    """
    Dynamically build search queries from structured case metadata.

    Args:
        case_meta: {
            "practice_area": str,
            "case_type": str,
            "keywords": list[str],
            "urgency_level": str,        # High / Medium / Low
            "preferred_city": str,
            "budget_level": str,         # Low / Mid / High / Premium
        }

    Returns:
        Ordered list of query strings (most specific first).
    """
    pa = case_meta["practice_area"]
    ct = case_meta.get("case_type", "")
    city = case_meta["preferred_city"]
    keywords = case_meta.get("keywords", [])
    urgency = case_meta.get("urgency_level", "").lower()
    budget = case_meta.get("budget_level", "").lower()

    queries: list[str] = []

    # --- Core queries (always generated) ---
    queries.append(f"{pa} lawyer in {city} India")
    queries.append(f"{pa} advocate in {city}")

    # --- Case-type specific ---
    if ct:
        queries.append(f"{ct} advocate {city}")
        queries.append(f"{ct} lawyer {city} India")

    # --- Keyword-enriched (top keywords) ---
    if keywords:
        top_kw = " ".join(keywords[:3])
        queries.append(f"{top_kw} legal expert {city}")
        queries.append(f"{pa} {top_kw} lawyer {city}")

    # --- Urgency / budget signals ---
    if urgency == "high":
        queries.append(f"top {pa} lawyer {city} immediate consultation")
    if budget in ("high", "premium"):
        queries.append(f"best senior {pa} advocate {city}")
    elif budget == "low":
        queries.append(f"affordable {pa} lawyer {city}")

    # --- Broad catch-all ---
    queries.append(f"best {pa} attorney {city} India")
    queries.append(f"{pa} law firm {city}")

    # Deduplicate preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for q in queries:
        q_lower = q.lower()
        if q_lower not in seen:
            seen.add(q_lower)
            unique.append(q)

    return unique


# ---------------------------------------------------------------------------
# Search execution
# ---------------------------------------------------------------------------
def search_lawyers(
    case_meta: dict[str, Any],
    max_results_per_query: int = 25,
    delay: float = 1.5,
) -> list[dict]:
    """
    Execute generated queries against DuckDuckGo.

    Returns:
        List of raw DDG result dicts, deduplicated by URL,
        each augmented with ``_query`` (originating query string).
    """
    queries = generate_queries(case_meta)
    seen_urls: set[str] = set()
    all_results: list[dict] = []

    ddgs = DDGS()
    for query in queries:
        try:
            logger.info(f"DDG search: {query!r}")
            results = list(ddgs.text(
                query,
                region="in-en",
                max_results=max_results_per_query,
            ))
            for r in results:
                url = r.get("href", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    r["_query"] = query
                    all_results.append(r)

            logger.info(f"  → {len(results)} hits ({len(all_results)} unique total)")
        except Exception as exc:
            logger.warning(f"DDG query failed: {query!r} — {exc}")

        time.sleep(delay)

    logger.info(f"Search complete: {len(all_results)} unique results from {len(queries)} queries")
    return all_results


def get_fallback_cities(city: str) -> list[str]:
    """Return nearby metro cities for fallback expansion."""
    return METRO_FALLBACKS.get(city.lower(), [])
