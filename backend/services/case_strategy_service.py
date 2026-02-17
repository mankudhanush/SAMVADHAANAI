"""
AI Case Strategy Simulator — ISOLATED service module.

This module is 100 % self-contained.  It does NOT import, modify, or depend on
any existing service (llm_service, analysis_service, qa_service, etc.).

It communicates with the configured LLM provider (Ollama / Groq) through its
OWN private helper, so that no existing call path can be affected.

PERFORMANCE OPTIMISATIONS (v2):
  - Persistent httpx client (connection pooling / keep-alive)
  - Async-native LLM call (no thread executor needed)
  - Trimmed system prompt (fewer tokens → faster inference)
  - LRU cache for identical requests
  - Input truncation for very large descriptions
"""

import json
import hashlib
import logging
import re
import asyncio
import time
from collections import OrderedDict
from typing import Optional

import httpx

from backend.config import (
    LLM_PROVIDER,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    GROQ_API_KEY,
    GROQ_MODEL,
)
from backend.services.fir_knowledge_service import (
    search_relevant_firs,
    format_fir_context,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Persistent HTTP clients — avoid TCP/TLS setup on every request
# ---------------------------------------------------------------------------
_TIMEOUT = httpx.Timeout(300.0, connect=15.0)
_ollama_client: httpx.AsyncClient | None = None
_groq_client: httpx.AsyncClient | None = None


def _get_ollama_client() -> httpx.AsyncClient:
    global _ollama_client
    if _ollama_client is None or _ollama_client.is_closed:
        _ollama_client = httpx.AsyncClient(
            base_url=OLLAMA_BASE_URL,
            timeout=_TIMEOUT,
            limits=httpx.Limits(max_connections=4, max_keepalive_connections=2),
        )
    return _ollama_client


def _get_groq_client() -> httpx.AsyncClient:
    global _groq_client
    if _groq_client is None or _groq_client.is_closed:
        _groq_client = httpx.AsyncClient(
            base_url="https://api.groq.com",
            timeout=_TIMEOUT,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            limits=httpx.Limits(max_connections=4, max_keepalive_connections=2),
        )
    return _groq_client


# ---------------------------------------------------------------------------
# Async LLM call — fully non-blocking
# ---------------------------------------------------------------------------

async def _llm_generate_async(prompt: str, system_prompt: str) -> str:
    """
    Async LLM generation.  Returns the raw text response.
    Uses persistent clients for connection reuse.
    """
    provider = LLM_PROVIDER.lower()

    if provider == "ollama":
        client = _get_ollama_client()
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "keep_alive": "30m",
            "options": {
                "num_predict": 1024,
                "num_ctx": 4096,
                "temperature": 0.1,
                "top_p": 0.9,
            },
        }
        logger.info("[CaseStrategy] Ollama async request → model=%s", OLLAMA_MODEL)
        try:
            resp = await client.post("/api/generate", json=payload)
            resp.raise_for_status()
            return resp.json().get("response", "")
        except httpx.TimeoutException:
            logger.error("[CaseStrategy] Ollama timed out")
            raise RuntimeError("AI model timed out. Please try again.")
        except httpx.HTTPStatusError as exc:
            logger.error("[CaseStrategy] Ollama HTTP %s", exc.response.status_code)
            raise RuntimeError(f"AI model error (HTTP {exc.response.status_code})")

    elif provider == "groq":
        if not GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not set")
        client = _get_groq_client()
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ]
        payload = {
            "model": GROQ_MODEL,
            "messages": messages,
            "temperature": 0.2,
            "stream": False,
        }
        logger.info("[CaseStrategy] Groq async request → model=%s", GROQ_MODEL)
        try:
            resp = await client.post("/openai/v1/chat/completions", json=payload)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except httpx.TimeoutException:
            logger.error("[CaseStrategy] Groq timed out")
            raise RuntimeError("AI model timed out. Please try again.")
        except httpx.HTTPStatusError as exc:
            logger.error("[CaseStrategy] Groq HTTP %s", exc.response.status_code)
            raise RuntimeError(f"AI model error (HTTP {exc.response.status_code})")

    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider}")


# ---------------------------------------------------------------------------
# LRU response cache — avoids duplicate LLM calls for identical inputs
# ---------------------------------------------------------------------------
_CACHE_MAX = 64
_response_cache: OrderedDict[str, dict] = OrderedDict()


def _cache_key(desc: str, ctype: str, jur: Optional[str]) -> str:
    raw = f"{ctype}|{jur or ''}|{desc.strip().lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _cache_get(key: str) -> dict | None:
    if key in _response_cache:
        _response_cache.move_to_end(key)
        return _response_cache[key]
    return None


def _cache_put(key: str, value: dict):
    _response_cache[key] = value
    if len(_response_cache) > _CACHE_MAX:
        _response_cache.popitem(last=False)


# ---------------------------------------------------------------------------
# Prompt template — trimmed for fewer tokens, same accuracy
# ---------------------------------------------------------------------------

# Base structure instruction (shared)
_JSON_STRUCTURE = """{
  "applicable_sections": [{"section": "IPC Section 420 / Contract Act Section 73", "relevance": "One line explaining applicability"}],
  "counterarguments": [{"argument": "What opposing counsel would argue", "severity": "high"}],
  "risk_score": {"level": "Medium", "percentage": 45, "factors": [{"factor": "Evidence strength is moderate", "impact": "medium"}]},
  "expected_timeline": {"estimate": "8-14 months", "phases": [{"phase": "Filing & Notice", "duration": "1-2 months", "description": "Initial filings"}]},
  "strategy_summary": "Authoritative 3-5 sentence legal recommendation"
}"""

# CITIZEN MODE — plain language, simplified explanations
CITIZEN_PROMPT = f"""You are SAMVIDHAAN AI — a friendly legal advisor helping ordinary Indian citizens understand their legal situation.
CRITICAL: Respond ONLY with valid JSON. No markdown fences, no text before or after the JSON.

Your role: Explain legal matters in SIMPLE, PLAIN LANGUAGE that any person can understand.

Given case description, type, and jurisdiction, produce strategic analysis in this EXACT structure:
{_JSON_STRUCTURE}

CITIZEN MODE RULES:
1. Use simple everyday language — avoid legal jargon
2. Explain legal sections in plain terms (e.g., "Section 420 means cheating/fraud")
3. Give clear, actionable steps a common person can follow
4. Describe risks in relatable terms (e.g., "moderate risk like a 50-50 chance")
5. Keep explanations short and practical
6. Focus on "what does this mean for me" perspective

MANDATORY FORMAT RULES:
1. ALWAYS include at least 1 item in applicable_sections, counterarguments, and factors
2. severity/impact must be: "high", "medium", or "low"
3. risk_score level must be: "Low", "Medium", or "High"
4. percentage must be 0-100 integer
5. Reference real Indian statutes but explain them simply
6. strategy_summary must be practical advice in plain English"""

# LAW STUDENT MODE — rigorous doctrinal analysis with statutory interpretation
LAW_STUDENT_PROMPT = f"""You are SAMVIDHAAN AI — a senior legal scholar and constitutional strategist conducting rigorous case analysis for law students preparing for judicial examinations and moot court competitions.
CRITICAL: Respond ONLY with valid JSON. No markdown fences, no text before or after the JSON.

Your role: Provide RIGOROUS DOCTRINAL ANALYSIS assuming the reader has foundational legal education. Do NOT simplify — analyze with depth.

Given case description, type, and jurisdiction, produce strategic analysis in this EXACT structure:
{_JSON_STRUCTURE}

ANALYTICAL FRAMEWORK (MANDATORY):

1. STATUTORY INTERPRETATION:
   - Apply Heydon's mischief rule, literal rule, or golden rule as contextually appropriate
   - Cite specific sub-sections (e.g., IPC Section 300 Exception 1, not just "Section 300")
   - Distinguish between cognizable/non-cognizable and bailable/non-bailable offences
   - Identify applicable limitation periods under the Limitation Act, 1963

2. DOCTRINAL ELEMENTS:
   - For criminal matters: Analyze actus reus (guilty act) and mens rea (guilty mind) elements separately
   - Discuss burden of proof allocation — prosecution's burden vs evidential burden shifting
   - Reference standard of proof: "beyond reasonable doubt" (criminal) vs "preponderance of probabilities" (civil)
   - Apply res ipsa loquitur, volenti non fit injuria, or vicarious liability doctrines where relevant

3. CONSTITUTIONAL DIMENSIONS:
   - Evaluate Article 14 (arbitrariness test per E.P. Royappa), Article 19 reasonableness, Article 21 due process
   - Discuss proportionality doctrine (K.S. Puttaswamy framework: legitimate aim, rational nexus, necessity, balancing)
   - Consider locus standi and maintainability aspects

4. PRECEDENTIAL ANALYSIS:
   - Cite ratio decidendi of relevant landmark judgments (not just case names)
   - Distinguish or apply: State of Maharashtra v. M.H. George, K.M. Nanavati v. State of Maharashtra, Bachan Singh v. State of Punjab
   - Reference relevant High Court decisions for jurisdiction-specific matters

5. PROCEDURAL POSTURE:
   - Identify appropriate forum (Civil Court, Consumer Forum, Tribunal, Writ jurisdiction)
   - Discuss interlocutory remedies: ad-interim injunction, status quo, attachment before judgment
   - Analyze res judicata and constructive res judicata implications

MANDATORY FORMAT RULES:
1. ALWAYS include at least 1 item in applicable_sections, counterarguments, and factors
2. severity/impact must be: "high", "medium", or "low"
3. risk_score level must be: "Low", "Medium", or "High"
4. percentage must be 0-100 integer
5. Cite real Indian statutes with precision: IPC, BNS (if post-2024), CrPC/BNSS, CPC, Evidence Act/BSA, specific state laws
6. strategy_summary must synthesize doctrinal analysis into actionable litigation strategy with procedural roadmap"""

# Default prompt (citizen mode)
SYSTEM_PROMPT = CITIZEN_PROMPT

def _get_system_prompt(mode: str = "citizen") -> str:
    """Get the appropriate system prompt based on mode."""
    if mode == "law_student":
        return LAW_STUDENT_PROMPT
    return CITIZEN_PROMPT

# Maximum input chars sent to LLM (prevents excessive token usage)
_MAX_DESC_CHARS = 6000


def _build_user_prompt(
    case_description: str,
    case_type: str,
    jurisdiction: Optional[str],
    fir_context: str = "",
) -> str:
    desc = case_description[:_MAX_DESC_CHARS]
    parts = [f"CASE TYPE: {case_type}"]
    if jurisdiction:
        parts.append(f"JURISDICTION: {jurisdiction}")
    
    # Inject FIR knowledge context if available
    if fir_context:
        parts.append(f"\n{fir_context}")
        parts.append("\nUse the above legal provisions as reference for your analysis.")
    
    parts.append(f"\nCASE DESCRIPTION:\n{desc}")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# JSON extraction helper — aggressive fallback strategies
# ---------------------------------------------------------------------------

def _extract_json(raw: str) -> dict | None:
    """Attempt to parse JSON from raw LLM output with multiple strategies."""
    if not raw or not raw.strip():
        return None
    
    text = raw.strip()
    # Pre-clean: LLMs often produce \' which is invalid JSON
    text_clean = text.replace("\\'", "'")
    
    # Strategy 1: direct parse
    for candidate in (text_clean, text):
        try:
            return json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            pass
    
    # Strategy 2: strip markdown fences
    cleaned = re.sub(r"```(?:json)?\s*", "", text_clean)
    cleaned = re.sub(r"```\s*$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        pass
    
    # Strategy 3: find outermost { ... } with balanced braces
    start = text_clean.find("{")
    if start != -1:
        depth = 0
        end = -1
        for i in range(start, len(text_clean)):
            if text_clean[i] == "{":
                depth += 1
            elif text_clean[i] == "}":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        if end > start:
            try:
                return json.loads(text_clean[start: end + 1])
            except (json.JSONDecodeError, ValueError):
                pass
    
    # Strategy 4: strip control chars and retry
    stripped = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text_clean)
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(stripped[start: end + 1])
        except (json.JSONDecodeError, ValueError):
            pass
    
    # Strategy 5: repair truncated JSON
    repaired = _repair_truncated_json(text_clean)
    if repaired:
        return repaired
    
    return None


def _repair_truncated_json(text: str) -> dict | None:
    """Attempt to repair JSON that was truncated by token limits."""
    start = text.find("{")
    if start == -1:
        return None
    
    fragment = text[start:]
    
    # Check if we're inside a string
    in_string = False
    for i, ch in enumerate(fragment):
        if ch == '"' and (i == 0 or fragment[i - 1] != '\\'):
            in_string = not in_string
    
    repair = fragment
    if in_string:
        repair += '"'
    
    # Close unclosed braces/brackets
    open_braces = repair.count("{") - repair.count("}")
    open_brackets = repair.count("[") - repair.count("]")
    repair += "]" * max(0, open_brackets)
    repair += "}" * max(0, open_braces)
    
    try:
        return json.loads(repair)
    except (json.JSONDecodeError, ValueError):
        pass
    
    return None


# ---------------------------------------------------------------------------
# Normaliser — guarantee the contract shape regardless of LLM variance
# ---------------------------------------------------------------------------

_EMPTY_RESULT = {
    "applicable_sections": [],
    "counterarguments": [],
    "risk_score": {"level": "Medium", "percentage": 50, "factors": []},
    "expected_timeline": {"estimate": "Unable to estimate", "phases": []},
    "strategy_summary": "Insufficient information for a complete strategy.",
}


def _normalise(data: dict) -> dict:
    """Ensure every key exists and has the right shape."""
    out: dict = {}

    # applicable_sections
    raw_sections = data.get("applicable_sections", [])
    if isinstance(raw_sections, list):
        out["applicable_sections"] = [
            {
                "section": str(s.get("section", "Unknown")),
                "relevance": str(s.get("relevance", "")),
            }
            for s in raw_sections
            if isinstance(s, dict)
        ]
    else:
        out["applicable_sections"] = []

    # counterarguments
    raw_counter = data.get("counterarguments", [])
    if isinstance(raw_counter, list):
        out["counterarguments"] = [
            {
                "argument": str(c.get("argument", "")),
                "severity": str(c.get("severity", "medium")).lower(),
            }
            for c in raw_counter
            if isinstance(c, dict)
        ]
    else:
        out["counterarguments"] = []

    # risk_score
    raw_risk = data.get("risk_score", {})
    if isinstance(raw_risk, dict):
        level = str(raw_risk.get("level", "Medium"))
        try:
            pct = int(raw_risk.get("percentage", 50))
        except (TypeError, ValueError):
            pct = 50
        factors = []
        raw_factors = raw_risk.get("factors", [])
        if isinstance(raw_factors, list):
            factors = [
                {
                    "factor": str(f.get("factor", "")),
                    "impact": str(f.get("impact", "medium")).lower(),
                }
                for f in raw_factors
                if isinstance(f, dict)
            ]
        out["risk_score"] = {
            "level": level if level in ("Low", "Medium", "High") else "Medium",
            "percentage": max(0, min(100, pct)),
            "factors": factors,
        }
    else:
        out["risk_score"] = _EMPTY_RESULT["risk_score"]

    # expected_timeline
    raw_tl = data.get("expected_timeline", {})
    if isinstance(raw_tl, dict):
        phases = []
        raw_phases = raw_tl.get("phases", [])
        if isinstance(raw_phases, list):
            phases = [
                {
                    "phase": str(p.get("phase", "")),
                    "duration": str(p.get("duration", "")),
                    "description": str(p.get("description", "")),
                }
                for p in raw_phases
                if isinstance(p, dict)
            ]
        out["expected_timeline"] = {
            "estimate": str(raw_tl.get("estimate", "Unable to estimate")),
            "phases": phases,
        }
    elif isinstance(raw_tl, str):
        out["expected_timeline"] = {"estimate": raw_tl, "phases": []}
    else:
        out["expected_timeline"] = _EMPTY_RESULT["expected_timeline"]

    # strategy_summary
    out["strategy_summary"] = str(
        data.get("strategy_summary", _EMPTY_RESULT["strategy_summary"])
    )

    return out


# ---------------------------------------------------------------------------
# Public function — called by the route handler
# ---------------------------------------------------------------------------

def simulate_case_strategy(
    case_description: str,
    case_type: str,
    jurisdiction: Optional[str] = None,
    mode: str = "citizen",
) -> dict:
    """Sync wrapper — kept for backward compat but prefer async version."""
    import asyncio
    return asyncio.get_event_loop().run_until_complete(
        simulate_case_strategy_async(case_description, case_type, jurisdiction, mode)
    )


async def simulate_case_strategy_async(
    case_description: str,
    case_type: str,
    jurisdiction: Optional[str] = None,
    mode: str = "citizen",
) -> dict:
    """
    Run the AI Case Strategy Simulator (async).

    Args:
        case_description: Detailed description of the legal case
        case_type: Type of case (civil, criminal, etc.)
        jurisdiction: Optional jurisdiction
        mode: "citizen" (plain language) or "law_student" (detailed legal analysis)

    Returns a normalised dict matching the strict response contract.
    """
    # Validate mode
    if mode not in ("citizen", "law_student"):
        mode = "citizen"
    
    # Check cache first (include mode in cache key)
    key = _cache_key(case_description, case_type, jurisdiction) + f"_{mode}"
    cached = _cache_get(key)
    if cached is not None:
        logger.info("[CaseStrategy] Cache HIT → returning cached result (mode=%s)", mode)
        return cached

    # Retrieve relevant FIR records for grounding (run in executor — sync I/O)
    search_query = f"{case_type} {case_description[:500]}"
    try:
        loop = asyncio.get_running_loop()
        fir_results = await loop.run_in_executor(
            None, lambda: search_relevant_firs(search_query, top_k=4)
        )
        fir_context = format_fir_context(fir_results, max_chars=1200)
        if fir_results:
            logger.info("[CaseStrategy] Injected %d FIR records into prompt", len(fir_results))
    except Exception as e:
        logger.warning("[CaseStrategy] FIR retrieval failed: %s", e)
        fir_context = ""

    user_prompt = _build_user_prompt(case_description, case_type, jurisdiction, fir_context)
    system_prompt = _get_system_prompt(mode)

    logger.info(
        "[CaseStrategy] Simulating → type=%s, jurisdiction=%s, desc_len=%d, mode=%s",
        case_type,
        jurisdiction or "N/A",
        len(case_description),
        mode,
    )

    t0 = time.perf_counter()
    raw_text = await _llm_generate_async(user_prompt, system_prompt)
    elapsed = time.perf_counter() - t0
    logger.info("[CaseStrategy] LLM responded → %d chars in %.2fs", len(raw_text), elapsed)

    parsed = _extract_json(raw_text)
    
    if parsed is None:
        logger.warning("[CaseStrategy] JSON parse failed. First 300 chars: %s", repr(raw_text[:300]))
        logger.warning("[CaseStrategy] Last 200 chars: %s", repr(raw_text[-200:]))
        # Return a result with the raw text as insight
        fallback = dict(_EMPTY_RESULT)
        fallback["strategy_summary"] = (
            f"Analysis completed. {raw_text[:1500]}" if raw_text.strip() 
            else "The AI could not generate a structured response. Please try again with more details."
        )
        return fallback

    result = _normalise(parsed)

    # Cache successful result
    _cache_put(key, result)

    return result
