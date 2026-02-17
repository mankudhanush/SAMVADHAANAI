"""
Constitutional Intelligence Engine — ISOLATED service module.

This module is 100% self-contained. It does NOT import, modify, or depend on
any existing service (llm_service, analysis_service, qa_service, etc.).

It communicates with the configured LLM provider through its OWN private
helper, so that no existing call path can be affected.
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
# Persistent HTTP clients — isolated from all other modules
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
# Async LLM call — fully non-blocking, own client
# ---------------------------------------------------------------------------
async def _llm_generate(prompt: str, system_prompt: str) -> str:
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
                "num_predict": 2048,
                "num_ctx": 4096,
                "temperature": 0.1,
                "top_p": 0.9,
            },
        }
        logger.info("[ConstitutionalIntel] Ollama request → model=%s", OLLAMA_MODEL)
        try:
            resp = await client.post("/api/generate", json=payload)
            resp.raise_for_status()
            return resp.json().get("response", "")
        except httpx.TimeoutException:
            logger.error("[ConstitutionalIntel] Ollama timed out")
            raise RuntimeError("AI model timed out. Please try again.")
        except httpx.HTTPStatusError as exc:
            logger.error("[ConstitutionalIntel] Ollama HTTP %s", exc.response.status_code)
            raise RuntimeError(f"AI model error (HTTP {exc.response.status_code})")

    elif provider == "groq":
        if not GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not set")
        client = _get_groq_client()
        payload = {
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
            "stream": False,
        }
        try:
            resp = await client.post(
                "/openai/v1/chat/completions",
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except httpx.TimeoutException:
            logger.error("[ConstitutionalIntel] Groq timed out")
            raise RuntimeError("AI model timed out. Please try again.")
        except httpx.HTTPStatusError as exc:
            logger.error("[ConstitutionalIntel] Groq HTTP %s", exc.response.status_code)
            raise RuntimeError(f"AI model error (HTTP {exc.response.status_code})")
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider}")


# ---------------------------------------------------------------------------
# LRU response cache
# ---------------------------------------------------------------------------
_CACHE_MAX = 32
_response_cache: OrderedDict[str, dict] = OrderedDict()


def _cache_key(text: str) -> str:
    return hashlib.sha256(text.strip().lower()[:2000].encode()).hexdigest()


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
# System prompt — constitutional analysis specialist (mode-aware)
# ---------------------------------------------------------------------------

# Base JSON structure (shared)
_JSON_STRUCTURE = """{
  "relevant_articles": [{"article_number": "Article 21", "title": "Right to Life and Liberty", "relevance_explanation": "How this article applies to the document"}],
  "fundamental_rights_impact": [{"right": "Right to Equality (Article 14)", "impact_analysis": "How the document affects this right"}],
  "directive_principles_relevance": [{"principle": "Right to Work (Article 41)", "analysis": "How directive principles apply"}],
  "landmark_cases": [{"case_name": "Kesavananda Bharati v. State of Kerala (1973)", "constitutional_significance": "Why this case is relevant"}],
  "constitutional_risk_level": {"level": "Medium", "reasoning": "Explanation of constitutional risk"},
  "interpretation_summary": "One paragraph constitutional interpretation (under 100 words)"
}"""

# CITIZEN MODE — plain language constitutional analysis
CITIZEN_PROMPT = f"""You are SAMVIDHAAN AI — a friendly Constitutional Expert helping ordinary Indian citizens understand their constitutional rights.
CRITICAL: Return ONLY valid JSON. No markdown fences (```), no text before or after the JSON object.

Your role: Explain constitutional matters in SIMPLE, PLAIN LANGUAGE that any person can understand.

Analyze legal documents against the Indian Constitution and return this EXACT structure:
{_JSON_STRUCTURE}

CITIZEN MODE RULES:
1. Explain constitutional articles in everyday language anyone can understand
2. Describe rights impact in simple terms (e.g., "This affects your basic right to fair treatment")
3. When citing cases, briefly explain what the case decided in plain terms
4. Make constitutional risks relatable (e.g., "Low risk means this is generally safe")
5. Avoid complex legal jargon — use common words
6. Focus on practical implications for the ordinary citizen

MANDATORY FORMAT RULES:
1. ALWAYS include at least 1 item in relevant_articles and fundamental_rights_impact
2. constitutional_risk_level.level MUST be exactly one of: "Low", "Medium", "High", "Critical"
3. Cite real Article numbers but explain them simply
4. Only cite real Supreme Court judgments
5. Keep explanations short and accessible
6. Output ONLY the JSON object"""

# LAW STUDENT MODE — rigorous constitutional jurisprudence analysis
LAW_STUDENT_PROMPT = f"""You are SAMVIDHAAN AI — a Constitutional Law scholar providing rigorous jurisprudential analysis for law students preparing for judicial services, LL.M. dissertations, and constitutional moot courts.
CRITICAL: Return ONLY valid JSON. No markdown fences (```), no text before or after the JSON object.

Your role: Provide RIGOROUS CONSTITUTIONAL ANALYSIS assuming the reader understands foundational constitutional law. Do NOT simplify — analyze with scholarly depth.

Analyze legal documents against the Indian Constitution and return this EXACT structure:
{_JSON_STRUCTURE}

CONSTITUTIONAL ANALYSIS FRAMEWORK (MANDATORY):

1. FUNDAMENTAL RIGHTS DOCTRINE:
   - Distinguish between horizontal application (Vishaka) and vertical application of fundamental rights
   - Analyze positive rights vs negative rights framework (Francis Coralie Mullin, Olga Tellis)
   - Apply the reasonableness and arbitrariness tests under Article 14 (E.P. Royappa, Maneka Gandhi)
   - Discuss the interrelationship doctrine — Articles 14, 19, 21 as a trinity (Maneka Gandhi principle)
   - Evaluate direct vs indirect infringement of fundamental rights

2. PROPORTIONALITY ANALYSIS:
   - Apply the four-pronged K.S. Puttaswamy test: (i) legitimate state aim, (ii) rational nexus, (iii) necessity/least restrictive means, (iv) proportionality stricto sensu (balancing)
   - Reference Modern Dental College, Anuradha Bhasin for proportionality framework
   - Distinguish between manifest arbitrariness (Shayara Bano) and mere unreasonableness

3. BASIC STRUCTURE DOCTRINE:
   - Identify if the document/provision threatens constitutional identity (Kesavananda Bharati)
   - Analyze through Minerva Mills, I.R. Coelho lens if statutory provisions are involved
   - Discuss implied limitations on fundamental rights

4. INTERPRETIVE METHODOLOGY:
   - Apply purposive interpretation (Naz Foundation, Navtej Singh Johar) vs literal interpretation
   - Reference constitutional morality doctrine (Navtej Singh Johar, Sabarimala)
   - Discuss transformative constitutionalism and living constitution approach
   - Consider harmonious construction where multiple provisions apply

5. PRECEDENTIAL ANALYSIS:
   - Extract and apply ratio decidendi (not mere obiter dicta) from landmark judgments
   - Trace doctrinal evolution: A.K. Gopalan → Maneka Gandhi (procedure established by law → due process)
   - Reference relevant Constitution Bench decisions with bench strength
   - Distinguish or follow precedent with proper legal reasoning

6. DIRECTIVE PRINCIPLES INTERPLAY:
   - Analyze Part III and Part IV harmony (Minerva Mills: both are conscience of the Constitution)
   - Discuss non-justiciability yet interpretive value of DPSPs
   - Reference Unnikrishnan, Mohini Jain for reading DPSPs into fundamental rights

MANDATORY FORMAT RULES:
1. ALWAYS include at least 1 item in relevant_articles and fundamental_rights_impact
2. constitutional_risk_level.level MUST be exactly one of: "Low", "Medium", "High", "Critical"
3. Cite Articles with precision: Article 19(1)(a), Article 21 r/w Article 14, Article 32/226
4. Only cite real Supreme Court judgments with year: Kesavananda Bharati (1973), Maneka Gandhi (1978), K.S. Puttaswamy (2017/2019), etc.
5. Provide analytical explanations with doctrinal grounding — avoid oversimplification
6. Output ONLY the JSON object"""

# Default prompt
SYSTEM_PROMPT = CITIZEN_PROMPT

def _get_system_prompt(mode: str = "citizen") -> str:
    """Get the appropriate system prompt based on mode."""
    if mode == "law_student":
        return LAW_STUDENT_PROMPT
    return CITIZEN_PROMPT


# ---------------------------------------------------------------------------
# Build user prompt
# ---------------------------------------------------------------------------
def _build_prompt(document_text: str, fir_context: str = "") -> str:
    truncated = document_text[:5000]
    
    prompt_parts = ["""Analyze the following legal document for constitutional implications under the Indian Constitution.

Identify:
1. Relevant Constitutional Articles (with Article numbers)
2. Impact on Fundamental Rights (Part III)
3. Relevant Directive Principles (Part IV)
4. Landmark Supreme Court constitutional bench judgments
5. Constitutional risk level
6. Constitutional interpretation summary"""]
    
    # Inject FIR knowledge context if available
    if fir_context:
        prompt_parts.append(f"\n{fir_context}")
        prompt_parts.append("\nUse the above legal provisions/sections as reference when analyzing.")
    
    prompt_parts.append(f"\nDOCUMENT TEXT:\n{truncated}")
    return "\n".join(prompt_parts)


# ---------------------------------------------------------------------------
# JSON extraction — aggressive fallback strategies
# ---------------------------------------------------------------------------
def _extract_json(text: str) -> dict | None:
    # Pre-clean: LLMs often produce \' which is invalid JSON (valid JS though)
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

    # Strategy 3: find outermost { ... } — match balanced braces
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

    # Strategy 5: repair truncated JSON (LLM ran out of tokens)
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

    # Check if we're inside a string (odd number of unescaped quotes)
    in_string = False
    for i, ch in enumerate(fragment):
        if ch == '"' and (i == 0 or fragment[i - 1] != '\\'):
            in_string = not in_string

    # Close the string if we're inside one
    repair = fragment
    if in_string:
        repair += '"'

    # Count unclosed braces and brackets after potential string close
    open_braces = repair.count("{") - repair.count("}")
    open_brackets = repair.count("[") - repair.count("]")

    # Close brackets then braces
    repair += "]" * max(0, open_brackets)
    repair += "}" * max(0, open_braces)

    try:
        return json.loads(repair)
    except (json.JSONDecodeError, ValueError):
        pass

    return None# ---------------------------------------------------------------------------
# Default response structure
# ---------------------------------------------------------------------------
_DEFAULT_RESPONSE = {
    "relevant_articles": [],
    "fundamental_rights_impact": [],
    "directive_principles_relevance": [],
    "landmark_cases": [],
    "constitutional_risk_level": {"level": "Unknown", "reasoning": "Analysis could not be completed"},
    "interpretation_summary": "",
}


def _normalize_response(parsed: dict) -> dict:
    """Ensure all required keys exist in the response, handling key aliases and malformed data."""
    result = {}

    # Key aliases — LLMs sometimes use variant names
    _ALIASES = {
        "landmark_cases": [
            "landmark_cases",
            "landmark_supremeCourt_cases",
            "landmark_supreme_court_cases",
            "supreme_court_cases",
        ],
        "fundamental_rights_impact": [
            "fundamental_rights_impact",
            "fundamental_rights",
            "rights_impact",
        ],
        "directive_principles_relevance": [
            "directive_principles_relevance",
            "directive_principles",
        ],
    }

    # Helper to get value checking aliases
    def get_with_aliases(key: str) -> any:
        if key in parsed:
            return parsed[key]
        aliases = _ALIASES.get(key, [])
        for alias in aliases:
            if alias in parsed:
                return parsed[alias]
        return None

    # Normalize relevant_articles
    raw_articles = get_with_aliases("relevant_articles") or []
    if isinstance(raw_articles, list):
        result["relevant_articles"] = [
            {
                "article_number": str(a.get("article_number", a.get("article", "Unknown"))),
                "title": str(a.get("title", "")),
                "relevance_explanation": str(a.get("relevance_explanation", a.get("explanation", a.get("relevance", "")))),
            }
            for a in raw_articles if isinstance(a, dict)
        ]
    else:
        result["relevant_articles"] = []

    # Normalize fundamental_rights_impact
    raw_rights = get_with_aliases("fundamental_rights_impact") or []
    if isinstance(raw_rights, list):
        result["fundamental_rights_impact"] = [
            {
                "right": str(r.get("right", r.get("name", "Unknown"))),
                "impact_analysis": str(r.get("impact_analysis", r.get("impact", r.get("analysis", "")))),
            }
            for r in raw_rights if isinstance(r, dict)
        ]
    else:
        result["fundamental_rights_impact"] = []

    # Normalize directive_principles_relevance
    raw_principles = get_with_aliases("directive_principles_relevance") or []
    if isinstance(raw_principles, list):
        result["directive_principles_relevance"] = [
            {
                "principle": str(p.get("principle", p.get("name", "Unknown"))),
                "analysis": str(p.get("analysis", p.get("relevance", ""))),
            }
            for p in raw_principles if isinstance(p, dict)
        ]
    else:
        result["directive_principles_relevance"] = []

    # Normalize landmark_cases
    raw_cases = get_with_aliases("landmark_cases") or []
    if isinstance(raw_cases, list):
        result["landmark_cases"] = [
            {
                "case_name": str(c.get("case_name", c.get("name", c.get("case", "Unknown")))),
                "constitutional_significance": str(c.get("constitutional_significance", c.get("significance", c.get("relevance", "")))),
            }
            for c in raw_cases if isinstance(c, dict)
        ]
    else:
        result["landmark_cases"] = []

    # Normalize constitutional_risk_level — LLM may return string instead of object
    risk_level = parsed.get("constitutional_risk_level", parsed.get("risk_level", {}))
    if isinstance(risk_level, str):
        # Convert string like "Medium" to {"level": "Medium", "reasoning": ""}
        result["constitutional_risk_level"] = {
            "level": risk_level.strip() if risk_level.strip() in ["Low", "Medium", "High", "Critical"] else "Medium",
            "reasoning": ""
        }
    elif isinstance(risk_level, dict):
        level = str(risk_level.get("level", "Medium"))
        result["constitutional_risk_level"] = {
            "level": level if level in ["Low", "Medium", "High", "Critical"] else "Medium",
            "reasoning": str(risk_level.get("reasoning", risk_level.get("reason", "")))
        }
    else:
        result["constitutional_risk_level"] = {
            "level": "Medium",
            "reasoning": "Risk level could not be determined from the analysis"
        }

    # Normalize interpretation_summary
    summary = parsed.get("interpretation_summary", parsed.get("summary", ""))
    result["interpretation_summary"] = str(summary) if summary else "Constitutional analysis completed. Review the identified articles and rights impacts above."

    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
async def analyze_constitutional_intelligence(document_text: str, mode: str = "citizen") -> dict:
    """
    Analyze a legal document for constitutional implications.

    Args:
        document_text: The legal document text to analyze
        mode: "citizen" (plain language) or "law_student" (detailed legal analysis)

    Returns structured constitutional mapping.
    """
    if not document_text or not document_text.strip():
        raise ValueError("Document text cannot be empty")

    # Validate mode
    if mode not in ("citizen", "law_student"):
        mode = "citizen"

    # Check cache (include mode in cache key)
    key = _cache_key(document_text) + f"_{mode}"
    cached = _cache_get(key)
    if cached:
        logger.info("[ConstitutionalIntel] Cache hit (mode=%s)", mode)
        return cached

    # Retrieve relevant FIR records for grounding (run in executor — sync I/O)
    try:
        loop = asyncio.get_running_loop()
        fir_results = await loop.run_in_executor(
            None, lambda: search_relevant_firs(document_text[:1000], top_k=4)
        )
        fir_context = format_fir_context(fir_results, max_chars=1200)
        if fir_results:
            logger.info("[ConstitutionalIntel] Injected %d FIR records into prompt", len(fir_results))
    except Exception as e:
        logger.warning("[ConstitutionalIntel] FIR retrieval failed: %s", e)
        fir_context = ""

    # Build and send prompt
    prompt = _build_prompt(document_text.strip(), fir_context)
    system_prompt = _get_system_prompt(mode)
    start = time.time()

    logger.info("[ConstitutionalIntel] Analyzing (mode=%s)", mode)

    try:
        raw = await _llm_generate(prompt, system_prompt)
        elapsed = time.time() - start
        logger.info(f"[ConstitutionalIntel] LLM responded in {elapsed:.1f}s ({len(raw)} chars)")
    except Exception as exc:
        logger.exception("[ConstitutionalIntel] LLM call failed")
        raise RuntimeError(f"Constitutional analysis failed: {exc}")

    # Parse response
    parsed = _extract_json(raw)
    if parsed:
        result = _normalize_response(parsed)
        logger.info("[ConstitutionalIntel] JSON parsed successfully, keys: %s", list(parsed.keys()))
    else:
        logger.warning("[ConstitutionalIntel] JSON parse failed. First 300 chars: %s", repr(raw[:300]))
        logger.warning("[ConstitutionalIntel] Last 200 chars: %s", repr(raw[-200:]))
        # Build a meaningful fallback response
        result = {
            "relevant_articles": [],
            "fundamental_rights_impact": [],
            "directive_principles_relevance": [],
            "landmark_cases": [],
            "constitutional_risk_level": {
                "level": "Medium",
                "reasoning": "Analysis parsing incomplete - review summary below"
            },
            "interpretation_summary": (
                f"Constitutional analysis completed. {raw[:2000]}" if raw.strip()
                else "The AI could not complete the constitutional analysis. Please try again with a clearer document."
            ),
        }

    # Cache and return
    _cache_put(key, result)
    return result
