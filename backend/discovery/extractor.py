"""
Extract structured lawyer data from raw DuckDuckGo results.

Produces normalised profiles with:
  name, firm, location, website, snippet, phone_numbers,
  experience (years + raw), has_legal_title, domain metadata.
"""
from __future__ import annotations

import concurrent.futures
import logging
import re
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

# =========================================================================
# Regex patterns
# =========================================================================

# Legal titles
_TITLE_PATTERN = re.compile(
    r"\b(Adv\.?|Advocate|Lawyer|Attorney|Barrister|Sr\.?\s*Advocate|"
    r"Senior\s+Advocate|Justice|Hon['.]?ble)\b",
    re.IGNORECASE,
)

# Experience: "15 years", "2 decades", "since 2005"
_EXPERIENCE_PATTERNS = [
    re.compile(r"(\d{1,2})\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|practice|exp)?", re.I),
    re.compile(r"(\d)\+?\s*decades?\s*(?:of\s+)?(?:experience|practice)?", re.I),
    re.compile(r"(?:since|established|practicing\s+since)\s*(\d{4})", re.I),
    re.compile(r"(?:experience|practice)\s*(?:of\s+)?(\d{1,2})\+?\s*(?:years?|yrs?)", re.I),
]

# Firm / chamber
_FIRM_PATTERNS = [
    re.compile(r"([\w\s&,]{3,40}?)\s*(?:Law\s+Firm|Associates|Chambers|& Associates|Legal|LLP)", re.I),
    re.compile(r"(?:Partner|Founder|Managing)\s+(?:at|of)\s+([\w\s&,]{3,50})", re.I),
]

# Name extraction
_NAME_PATTERNS = [
    re.compile(r"(?:Adv\.?|Advocate|Lawyer|Attorney)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})", re.I),
    re.compile(r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?:\s*[-–|,])"),
]

# Indian phone numbers
_PHONE_PATTERNS = [
    re.compile(r"(?:\+91[\s.-]?)?(?:\(?0?\)?[\s.-]?)?([6-9]\d{4})[\s.-]?(\d{5})"),
    re.compile(r"\b([6-9]\d{9})\b"),
    re.compile(r"(?:\(?0\d{2,4}\)?[\s.-]?)(\d{6,8})"),
]

# Aggregator / directory domains
_AGGREGATOR_DOMAINS = {
    "justdial.com", "sulekha.com", "lawrato.com", "legalserviceindia.com",
    "vakilsearch.com", "mylawyer.in", "legalpedia.in", "indiafilings.com",
    "linkedin.com", "facebook.com", "twitter.com", "x.com",
    "youtube.com", "quora.com", "reddit.com", "wikipedia.org",
}


# =========================================================================
# Field extractors
# =========================================================================

def _extract_name(title: str, snippet: str) -> str:
    for pat in _NAME_PATTERNS:
        m = pat.search(title) or pat.search(snippet)
        if m:
            return m.group(1).strip()
    clean = re.split(r"\s*[-–|•·]\s*", title)[0].strip()
    clean = re.sub(r"\s*\(.*?\)\s*", "", clean)
    clean = re.sub(r"\s*-\s*$", "", clean).strip()
    return clean[:80] if clean else "Unknown"


def _extract_firm(title: str, snippet: str) -> str:
    combined = f"{title} {snippet}"
    for pat in _FIRM_PATTERNS:
        m = pat.search(combined)
        if m:
            firm = m.group(0).strip()
            firm = re.sub(r"\s+(?:is|are|was|has|the)\s*$", "", firm, flags=re.I)
            return firm[:100]
    return ""


def _extract_experience(text: str) -> dict[str, Any]:
    for pat in _EXPERIENCE_PATTERNS:
        m = pat.search(text)
        if m:
            val = m.group(1)
            if len(val) == 4 and val.startswith(("19", "20")):
                try:
                    years = 2026 - int(val)
                    return {"years": max(years, 0), "raw": m.group(0)}
                except ValueError:
                    pass
            elif val.isdigit():
                years = int(val)
                if "decade" in m.group(0).lower():
                    years *= 10
                return {"years": years, "raw": m.group(0)}
    return {}


def _extract_phones(text: str) -> list[str]:
    phones: list[str] = []
    seen: set[str] = set()
    for pat in _PHONE_PATTERNS:
        for m in pat.finditer(text):
            raw = re.sub(r"[\s.()-]", "", m.group(0))
            if raw.startswith("+91"):
                raw = raw[3:]
            if raw.startswith("91") and len(raw) == 12:
                raw = raw[2:]
            if raw.startswith("0") and len(raw) == 11:
                raw = raw[1:]
            if len(raw) == 10 and raw[0] in "6789" and raw not in seen:
                phones.append(f"+91 {raw[:5]} {raw[5:]}")
                seen.add(raw)
    return phones[:3]


def _scrape_contact_from_url(url: str, timeout: float = 5.0) -> dict[str, Any]:
    """Fetch webpage and extract phone numbers + extra experience text."""
    out: dict[str, Any] = {"phones": [], "experience": {}}
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True, verify=False) as client:
            resp = client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code != 200:
                return out

            html = resp.text

            # --- phones ---
            tel_matches = re.findall(r'href=["\']tel:([^"\']+)["\']', html)
            phones_tel = []
            for t in tel_matches:
                phones_tel.extend(_extract_phones(re.sub(r"[\s.()-]", "", t)))
            visible = re.sub(r"<[^>]+>", " ", html)
            phones_body = _extract_phones(visible)
            seen: set[str] = set()
            for p in phones_tel + phones_body:
                if p not in seen:
                    seen.add(p)
                    out["phones"].append(p)
            out["phones"] = out["phones"][:3]

            # --- experience from page body (if not already found) ---
            if not out["experience"]:
                out["experience"] = _extract_experience(visible)
    except Exception as exc:
        logger.debug(f"Scrape failed {url}: {exc}")
    return out


def _classify_domain(url: str) -> dict[str, Any]:
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower().lstrip("www.")
    except Exception:
        return {"domain": "", "is_aggregator": True, "tld_quality": 0}

    is_agg = any(agg in domain for agg in _AGGREGATOR_DOMAINS)
    tld_quality = 1
    if domain.endswith(".gov.in"):
        tld_quality = 5
    elif domain.endswith((".org", ".org.in", ".edu", ".ac.in")):
        tld_quality = 4
    elif domain.endswith((".in", ".co.in")):
        tld_quality = 3
    elif domain.endswith(".com"):
        tld_quality = 2

    return {"domain": domain, "is_aggregator": is_agg, "tld_quality": tld_quality}


# =========================================================================
# Main extraction entry point
# =========================================================================

def extract_structured_data(
    raw_results: list[dict],
    preferred_city: str,
) -> list[dict]:
    """
    Convert raw DDG results into structured lawyer profiles and enrich
    via parallel web scraping for phone numbers.

    Returns list of dicts, each with keys:
        name, firm, location, website, snippet, phone_numbers,
        experience, has_legal_title, domain_info, source_query
    """
    lawyers: list[dict] = []

    for r in raw_results:
        title = r.get("title", "")
        snippet = r.get("body", "")
        url = r.get("href", "")
        if not title or not url:
            continue

        combined = f"{title} {snippet}"
        domain_info = _classify_domain(url)

        profile: dict[str, Any] = {
            "name": _extract_name(title, snippet),
            "firm": _extract_firm(title, snippet),
            "location": preferred_city,
            "website": url,
            "snippet": snippet[:500],
            "phone_numbers": _extract_phones(combined),
            "experience": _extract_experience(combined),
            "has_legal_title": bool(_TITLE_PATTERN.search(combined)),
            "domain_info": domain_info,
            "source_query": r.get("_query", ""),
        }
        lawyers.append(profile)

    # --- Parallel scrape for phones + experience enrichment (top 30 non-agg) ---
    to_scrape = [
        (i, l["website"]) for i, l in enumerate(lawyers)
        if not l["phone_numbers"] and not l["domain_info"].get("is_aggregator")
    ][:30]

    if to_scrape:
        logger.info(f"Scraping {len(to_scrape)} websites for contact info …")
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            futures = {
                pool.submit(_scrape_contact_from_url, url): idx
                for idx, url in to_scrape
            }
            for future in concurrent.futures.as_completed(futures):
                idx = futures[future]
                try:
                    scraped = future.result()
                    if scraped["phones"]:
                        lawyers[idx]["phone_numbers"] = scraped["phones"]
                    if not lawyers[idx]["experience"] and scraped["experience"]:
                        lawyers[idx]["experience"] = scraped["experience"]
                except Exception:
                    pass

    logger.info(f"Extracted {len(lawyers)} structured profiles from {len(raw_results)} raw results")
    return lawyers
