"""
Lawyer Discovery Engine — India
================================
Searches for lawyers via DuckDuckGo, extracts structured info,
scores each result for suitability, and returns a ranked list.

Architecture:
    search_lawyers()     → raw DDG results
    parse_results()      → structured list[dict]
    calculate_score()    → float (0–100)
    rank_lawyers()       → sorted list[dict]
    explain_why_selected → human-readable reasoning

No RAG, no document processing, no paid APIs.
"""

import re
import logging
from urllib.parse import urlparse
from ddgs import DDGS

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# 1.  SEARCH
# ═══════════════════════════════════════════════════════════════

def search_lawyers(
    practice_area: str,
    city: str,
    keywords: list[str] | None = None,
    max_results: int = 30,
) -> list[dict]:
    """
    Query DuckDuckGo for lawyers matching the criteria.

    Args:
        practice_area: e.g. "Criminal Law", "Property Law"
        city:          e.g. "Delhi", "Mumbai"
        keywords:      optional extra terms like ["bail", "cheque bounce"]
        max_results:   cap on raw results (≤ 100 per query)

    Returns:
        Raw DDG result dicts: [{title, href, body}, ...]
    """
    queries = _build_queries(practice_area, city, keywords)
    all_results: list[dict] = []
    seen_urls: set[str] = set()

    try:
        ddgs = DDGS()
        for q in queries:
            logger.info(f"DDG query: {q}")
            results = list(ddgs.text(q, max_results=min(max_results, 50)))
            for r in results:
                url = r.get("href", r.get("link", ""))
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    all_results.append(r)
            # Stop early if we have enough
            if len(all_results) >= max_results:
                break
    except Exception as exc:
        logger.exception(f"DuckDuckGo search failed: {exc}")
        return []

    logger.info(f"Search returned {len(all_results)} unique results")
    return all_results[:max_results]


def _build_queries(
    practice_area: str, city: str, keywords: list[str] | None
) -> list[str]:
    """Generate multiple search queries for broader coverage."""
    base = f"{practice_area} lawyer in {city}"
    queries = [
        base,
        f"best {base}",
        f"top rated {practice_area} advocate {city}",
        f"{practice_area} advocate {city} contact",  # More likely to have names
        f"advocate {practice_area} {city}",
        f"{practice_area} lawyer {city} phone number",  # Usually has lawyer names
    ]
    if keywords:
        kw_str = " ".join(keywords[:3])  # limit to 3 keywords
        queries.append(f"{base} {kw_str}")
    return queries


# ═══════════════════════════════════════════════════════════════
# 2.  PARSE
# ═══════════════════════════════════════════════════════════════

# Patterns to extract lawyer names from titles
_NAME_PATTERNS = [
    # "Adv. John Smith - Criminal Lawyer"
    re.compile(r"^(?:Adv(?:ocate)?\.?\s+)([A-Z][a-zA-Z\s\.]+?)(?:\s*[-–|,])", re.IGNORECASE),
    # "John Smith - Lawyer/Advocate/Attorney"
    re.compile(r"^([A-Z][a-zA-Z\s\.]+?)\s*[-–|]\s*(?:Lawyer|Advocate|Attorney|Legal)", re.IGNORECASE),
    # "John Smith - Law Firm/Office"
    re.compile(r"^([A-Z][a-zA-Z\s\.]+?)\s*[-–|]\s*(?:Law\s*(?:Firm|Office|Chamber))", re.IGNORECASE),
    # "John Smith, Advocate" or "John Smith, Lawyer"
    re.compile(r"^([A-Z][a-zA-Z\s\.]+?),\s*(?:Advocate|Lawyer|Attorney)", re.IGNORECASE),
    # "Advocate John Smith" (name after Advocate)
    re.compile(r"^Advocate\s+([A-Z][a-zA-Z\s\.]+?)(?:\s*[-–|,]|$)", re.IGNORECASE),
    # "Best Lawyer: John Smith" or similar
    re.compile(r"(?:Best|Top)\s+(?:Lawyer|Advocate)[:\s]+([A-Z][a-zA-Z\s\.]+?)(?:\s*[-–|,]|$)", re.IGNORECASE),
]

# Patterns to extract firm names
_FIRM_PATTERNS = [
    re.compile(r"[-–|]\s*(.+?(?:Law\s*(?:Firm|Office|Chamber|Associates)))", re.IGNORECASE),
    re.compile(r"[-–|]\s*(.+?(?:& Associates|Legal\s*Services|Advocates?))\s*$", re.IGNORECASE),
    re.compile(r"(.+?(?:LLP|Partners|& Co\.?))\s*$", re.IGNORECASE),
]

# Common words to filter out from names
_NAME_NOISE_WORDS = {
    "best", "top", "famous", "renowned", "leading", "trusted", "expert",
    "criminal", "property", "family", "civil", "corporate", "divorce",
    "lawyer", "advocate", "attorney", "legal", "law", "firm", "services",
    "delhi", "mumbai", "bangalore", "chennai", "kolkata", "hyderabad",
    "pune", "ahmedabad", "jaipur", "lucknow", "india", "indian",
}


def parse_results(
    raw_results: list[dict],
    city: str,
) -> list[dict]:
    """
    Extract structured lawyer records from raw DDG results.

    Returns:
        [{
            "name":     str,
            "firm":     str | None,
            "location": str,
            "website":  str,
            "domain":   str,
            "snippet":  str,
        }, ...]
    """
    lawyers: list[dict] = []

    for r in raw_results:
        title   = r.get("title", "").strip()
        url     = r.get("href", r.get("link", "")).strip()
        snippet = r.get("body", r.get("snippet", "")).strip()

        if not title or not url:
            continue

        # Skip non-lawyer results (aggregator junk, news, forums)
        if _is_noise(url, title, snippet):
            continue

        # Extract structured fields
        name = _extract_name(title)
        
        # If name extraction from title didn't work well, try snippet
        if not _is_valid_name(name) or name == title[:60]:
            name_from_snippet = _extract_name_from_snippet(snippet)
            if name_from_snippet and _is_valid_name(name_from_snippet):
                name = name_from_snippet
        
        firm = _extract_firm(title, snippet)
        domain = urlparse(url).netloc.lower().replace("www.", "")
        
        # Try to extract name from domain if still not good
        if not _is_valid_name(name):
            name_from_domain = _extract_name_from_domain(domain)
            if name_from_domain:
                name = name_from_domain

        lawyers.append({
            "name":     name,
            "firm":     firm,
            "location": city,
            "website":  url,
            "domain":   domain,
            "snippet":  snippet,
        })

    logger.info(f"Parsed {len(lawyers)} lawyer records from {len(raw_results)} raw results")
    return lawyers


def _extract_name_from_snippet(snippet: str) -> str | None:
    """Try to extract a lawyer name from the snippet text."""
    # Common patterns in snippets
    patterns = [
        # "Contact Adv. John Smith for..."
        re.compile(r"(?:Contact|Call|Consult)\s+(?:Adv(?:ocate)?\.?\s+)?([A-Z][a-zA-Z\s\.]+?)(?:\s+for|\s+at|\s*,)", re.IGNORECASE),
        # "John Smith is a criminal lawyer..."
        re.compile(r"^([A-Z][a-zA-Z\s\.]{2,30})\s+is\s+(?:a|an|the)\s+(?:\w+\s+)?(?:lawyer|advocate|attorney)", re.IGNORECASE),
        # "Advocate John Smith specializes..."
        re.compile(r"(?:Adv(?:ocate)?\.?\s+)([A-Z][a-zA-Z\s\.]+?)\s+(?:specializ|practic|handl|is)", re.IGNORECASE),
    ]
    
    for pat in patterns:
        m = pat.search(snippet)
        if m:
            name = m.group(1).strip()
            name = _clean_name(name)
            if _is_valid_name(name):
                return name
    return None


def _extract_name_from_domain(domain: str) -> str | None:
    """Try to extract a lawyer name from the domain name."""
    # Remove TLD and common words
    parts = domain.split(".")
    if len(parts) < 2:
        return None
    
    main_part = parts[0]
    # Check if it looks like a name (e.g., "johnsmithlaw", "advocatejohn")
    main_part = re.sub(r"(law|legal|advocate|lawyer|attorney|chambers?)$", "", main_part, flags=re.IGNORECASE)
    main_part = re.sub(r"^(adv|advocate)", "", main_part, flags=re.IGNORECASE)
    
    if len(main_part) > 4:
        # Try to split camelCase or convert to title case
        if main_part[0].isupper():
            # Already has some capitalization, might be name
            spaced = re.sub(r'([a-z])([A-Z])', r'\1 \2', main_part)
            if _is_valid_name(spaced) or len(spaced.split()) >= 2:
                return spaced.title()
    return None


def _extract_name(title: str) -> str:
    """Try to extract a lawyer name from the result title."""
    # First, try the regex patterns
    for pat in _NAME_PATTERNS:
        m = pat.search(title)
        if m:
            name = m.group(1).strip()
            name = _clean_name(name)
            if _is_valid_name(name):
                return name
    
    # Fallback: use text before first separator
    for sep in [" - ", " | ", " – ", " : ", ", "]:
        if sep in title:
            candidate = title.split(sep)[0].strip()
            candidate = _clean_name(candidate)
            if _is_valid_name(candidate):
                return candidate
    
    # Last resort: clean the whole title
    cleaned = _clean_name(title)
    if _is_valid_name(cleaned):
        return cleaned[:60]
    
    return title[:60]


def _clean_name(name: str) -> str:
    """Clean up a potential name string."""
    # Remove common prefixes
    prefixes = ["adv.", "advocate", "dr.", "mr.", "ms.", "mrs.", "shri", "smt."]
    lower = name.lower()
    for prefix in prefixes:
        if lower.startswith(prefix):
            name = name[len(prefix):].strip()
            lower = name.lower()
    
    # Remove noise words at the start
    words = name.split()
    while words and words[0].lower() in _NAME_NOISE_WORDS:
        words.pop(0)
    
    # Remove noise words at the end
    while words and words[-1].lower() in _NAME_NOISE_WORDS:
        words.pop()
    
    return " ".join(words).strip()


def _is_valid_name(name: str) -> bool:
    """Check if string looks like a valid person name."""
    if not name or len(name) < 3 or len(name) > 60:
        return False
    
    # Should have at least some letters
    if not any(c.isalpha() for c in name):
        return False
    
    # Should start with a capital letter (after cleaning)
    words = name.split()
    if not words:
        return False
    
    # Check first word starts with capital
    first_word = words[0]
    if first_word and first_word[0].islower():
        return False
    
    # Shouldn't be all noise words
    non_noise_words = [w for w in words if w.lower() not in _NAME_NOISE_WORDS]
    if len(non_noise_words) == 0:
        return False
    
    # Should have 1-5 words typically
    if len(words) > 6:
        return False
    
    return True


def _extract_firm(title: str, snippet: str) -> str | None:
    """Try to extract a law firm name from the title or snippet."""
    combined = f"{title} | {snippet}"
    for pat in _FIRM_PATTERNS:
        m = pat.search(combined)
        if m:
            firm = m.group(1).strip()
            if 3 < len(firm) < 80:
                return firm
    return None


# Domains that are aggregators / directories (not actual law firms)
_NOISE_DOMAINS = {
    "youtube.com", "facebook.com", "twitter.com", "instagram.com",
    "linkedin.com", "wikipedia.org", "quora.com", "reddit.com",
    "justdial.com", "sulekha.com", "indiamart.com", "glassdoor.com",
    "ambitionbox.com", "naukri.com",
}

def _is_noise(url: str, title: str, snippet: str) -> bool:
    """Filter out irrelevant results."""
    domain = urlparse(url).netloc.lower()
    for noise in _NOISE_DOMAINS:
        if noise in domain:
            return True
    # Skip if title is too generic
    lower_title = title.lower()
    if any(w in lower_title for w in ["top 10", "top 20", "list of", "directory"]):
        return True
    return False


# ═══════════════════════════════════════════════════════════════
# 3.  SCORE
# ═══════════════════════════════════════════════════════════════

# Weights (sum to 1.0)
_W_KEYWORD   = 0.30
_W_LOCATION  = 0.25
_W_EXPERIENCE = 0.25
_W_CREDIBILITY = 0.20

# Experience indicator words with their weights
_EXPERIENCE_SIGNALS = {
    "senior":      3, "years of experience": 4, "20+ years": 5,
    "10+ years":   4, "15+ years": 5, "experienced": 3,
    "speciali":    3, "expert":     3, "high court":  4,
    "supreme court": 5, "district court": 2, "tribunal": 2,
    "bar council": 3, "former judge": 5, "notable": 2,
    "awarded":     2, "recognized":  2, "published": 2,
}

# High-credibility TLDs / patterns
_CREDIBLE_TLDS = {".gov.in", ".nic.in", ".org", ".edu"}
_CREDIBLE_PATTERNS = {"lawfirm", "advocate", "legal", "law", "attorney", "chambers"}


def calculate_score(
    lawyer: dict,
    practice_area: str,
    city: str,
    keywords: list[str] | None = None,
) -> float:
    """
    Suitability score 0–100 composed of:
        - Keyword match strength   (30%)
        - Location relevance       (25%)
        - Experience indicators    (25%)
        - Website credibility      (20%)
    """
    text = f"{lawyer['name']} {lawyer.get('firm', '')} {lawyer['snippet']}".lower()

    # ── Keyword match (0–100) ──
    kw_score = 0.0
    search_terms = [practice_area.lower()]
    if keywords:
        search_terms.extend(k.lower() for k in keywords)

    matches = sum(1 for t in search_terms if t in text)
    kw_score = min((matches / max(len(search_terms), 1)) * 100, 100)

    # Bonus for exact phrase match
    if practice_area.lower() in text:
        kw_score = min(kw_score + 15, 100)

    # ── Location relevance (0–100) ──
    loc_score = 0.0
    city_lower = city.lower()
    if city_lower in text:
        loc_score = 80
    if city_lower in lawyer.get("domain", ""):
        loc_score = min(loc_score + 20, 100)
    if city_lower in lawyer.get("name", "").lower():
        loc_score = min(loc_score + 10, 100)

    # ── Experience indicators (0–100) ──
    exp_score = 0.0
    exp_hits = 0
    for signal, weight in _EXPERIENCE_SIGNALS.items():
        if signal in text:
            exp_hits += weight
    exp_score = min(exp_hits * 8, 100)  # cap at 100

    # ── Website credibility (0–100) ──
    cred_score = 50  # baseline
    domain = lawyer.get("domain", "")

    # Boost for credible TLDs
    for tld in _CREDIBLE_TLDS:
        if domain.endswith(tld):
            cred_score += 25
            break

    # Boost for domain containing legal terms
    for pat in _CREDIBLE_PATTERNS:
        if pat in domain:
            cred_score += 15
            break

    # Penalize free hosting / generic sites
    if any(g in domain for g in ["blogspot", "wordpress.com", "wix.com", "weebly"]):
        cred_score -= 20

    # Boost for having own domain (not a directory listing)
    domain_parts = domain.split(".")
    if len(domain_parts) <= 3:  # likely own domain
        cred_score += 10

    cred_score = max(0, min(cred_score, 100))

    # ── Weighted total ──
    total = (
        kw_score   * _W_KEYWORD
        + loc_score  * _W_LOCATION
        + exp_score  * _W_EXPERIENCE
        + cred_score * _W_CREDIBILITY
    )
    return round(total, 2)


# ═══════════════════════════════════════════════════════════════
# 4.  RANK
# ═══════════════════════════════════════════════════════════════

def rank_lawyers(
    lawyers: list[dict],
    practice_area: str,
    city: str,
    keywords: list[str] | None = None,
    top_n: int = 10,
) -> list[dict]:
    """
    Score every lawyer and return the top_n sorted by suitability.

    Each returned dict gains:
        "score":       float (0–100)
        "rank":        int   (1-based)
        "explanation": str   (human-readable reasoning)
    """
    for lawyer in lawyers:
        lawyer["score"] = calculate_score(lawyer, practice_area, city, keywords)

    # Stable sort descending by score
    ranked = sorted(lawyers, key=lambda l: l["score"], reverse=True)

    # Assign rank + explanation
    for i, lawyer in enumerate(ranked[:top_n]):
        lawyer["rank"] = i + 1
        lawyer["explanation"] = explain_why_selected(
            lawyer, practice_area, city, keywords
        )

    return ranked[:top_n]


# ═══════════════════════════════════════════════════════════════
# 5.  EXPLAIN
# ═══════════════════════════════════════════════════════════════

def explain_why_selected(
    lawyer: dict,
    practice_area: str,
    city: str,
    keywords: list[str] | None = None,
) -> str:
    """Generate a human-readable explanation of why this lawyer was ranked."""
    text = f"{lawyer['name']} {lawyer.get('firm', '')} {lawyer['snippet']}".lower()
    reasons: list[str] = []

    # Practice area match
    if practice_area.lower() in text:
        reasons.append(f"Profile mentions {practice_area}")

    # Location match
    if city.lower() in text:
        reasons.append(f"Located in or serves {city}")

    # Keywords
    if keywords:
        matched = [k for k in keywords if k.lower() in text]
        if matched:
            reasons.append(f"Matches keywords: {', '.join(matched)}")

    # Experience signals
    found_signals = [s for s in _EXPERIENCE_SIGNALS if s in text]
    if found_signals:
        reasons.append(f"Experience indicators: {', '.join(found_signals[:3])}")

    # Firm association
    if lawyer.get("firm"):
        reasons.append(f"Associated with {lawyer['firm']}")

    # Domain credibility
    domain = lawyer.get("domain", "")
    if any(p in domain for p in _CREDIBLE_PATTERNS):
        reasons.append("Has a professional legal domain")

    if not reasons:
        reasons.append("General search result match")

    return "; ".join(reasons) + f". Score: {lawyer.get('score', 0)}/100"


# ═══════════════════════════════════════════════════════════════
# 6.  PUBLIC ENTRYPOINT
# ═══════════════════════════════════════════════════════════════

def discover(
    practice_area: str,
    city: str,
    keywords: list[str] | None = None,
    max_results: int = 30,
    top_n: int = 10,
) -> dict:
    """
    End-to-end discovery pipeline.

    Args:
        practice_area: "Criminal Law", "Property Law", etc.
        city:          "Delhi", "Mumbai", etc.
        keywords:      optional extra search terms
        max_results:   how many raw results to fetch
        top_n:         how many ranked lawyers to return

    Returns:
        {
            "query":   {"practice_area", "city", "keywords"},
            "total_found": int,
            "lawyers": [ ranked lawyer dicts ],
        }
    """
    # Step 1: Search
    raw = search_lawyers(practice_area, city, keywords, max_results)

    # Step 2: Parse
    parsed = parse_results(raw, city)

    # Step 3 + 4: Score & Rank
    ranked = rank_lawyers(parsed, practice_area, city, keywords, top_n)

    return {
        "query": {
            "practice_area": practice_area,
            "city": city,
            "keywords": keywords or [],
        },
        "total_found": len(parsed),
        "lawyers": ranked,
    }
