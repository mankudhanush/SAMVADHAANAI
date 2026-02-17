"""
Configuration for the LegalWise RAG pipeline.
"""
import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "backend" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR = BASE_DIR / "backend" / "chroma_db"
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------
CHUNK_SIZE = 800
CHUNK_OVERLAP = 150

# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------
RETRIEVAL_TOP_K = 15          # first-pass retrieval
RERANK_TOP_K = 5              # final chunks to LLM
BM25_WEIGHT = 0.3             # weight for keyword hits in hybrid fusion
SEMANTIC_WEIGHT = 0.7         # weight for dense vector hits

# ---------------------------------------------------------------------------
# Re-ranker  (cross-encoder)
# ---------------------------------------------------------------------------
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

# ---------------------------------------------------------------------------
# LLM
# ---------------------------------------------------------------------------
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# ---------------------------------------------------------------------------
# Tesseract OCR
# ---------------------------------------------------------------------------
TESSERACT_CMD = os.getenv(
    "TESSERACT_CMD",
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
)

# ---------------------------------------------------------------------------
# Conversation
# ---------------------------------------------------------------------------
MAX_HISTORY_TURNS = 5         # max Q/A pairs kept per session

# ---------------------------------------------------------------------------
# Web search confidence threshold
# ---------------------------------------------------------------------------
WEB_SEARCH_CONFIDENCE_THRESHOLD = 0.6

# ---------------------------------------------------------------------------
# RAG Prompt
# ---------------------------------------------------------------------------
RAG_SYSTEM_PROMPT = """You are LegalWise — a senior Indian legal analyst.

RULES:
- Answer ONLY from the provided context. Never use outside knowledge.
- Cite sources as [Source N].
- If not in context, say: "Not explicitly mentioned in the document."
- Quote exact text for legal/numerical details.
- Be precise and evidence-based.

RESPONSE DEPTH — match to question type:

PINPOINT (single fact/date/name/yes-no): 1-5 line direct answer with source citation.

FOCUSED (specific topic/clause/allegation): Structured bullet points, 5-15 lines, cite sources.

BROAD/ANALYTICAL (full analysis/summary/risks): Provide:
1) Document Type  2) Key Parties  3) Important Dates  4) Legal Sections
5) Critical Facts  6) Legal Interpretation  7) Risks/Weaknesses
8) Direct Answer  9) Supporting Evidence

CONTRACT RISK (contract/agreement + risks/fairness/red flags):
1) Document Type  2) Parties  3) Overall Risk Score: X/100
4) Fairness Assessment  5) Risky Clauses (quote text, risk level, consequence)
6) Penalty Analysis  7) Missing Elements  8) Plain Language Warning

For risky clauses check: unilateral rights, indemnity imbalance, unlimited liability,
vague wording, auto-renewal traps, jurisdiction disadvantage, non-compete,
high penalties, waiver of rights, unfavorable arbitration.

CONTEXT:
{context}
"""

# ---------------------------------------------------------------------------
# Legal Simplifier Prompt
# ---------------------------------------------------------------------------
LEGAL_SIMPLIFIER_PROMPT = """You are a plain-language legal educator for Indian citizens.

TASK: Simplify legal content so an average person can understand. Provide actionable insights.

RULES: Do not change legal meaning. Do not hallucinate. If unclear, say "Not clearly stated."

Return valid JSON (no markdown fences):
{{
  "document_type": "<FIR/Legal Notice/Court Order/Agreement/Contract/Other>",
  "plain_english_summary": "<2-3 sentence summary of what this document is about and its main purpose>",
  "key_obligations": [
    "<obligation 1 - what you are required to do>",
    "<obligation 2>",
    "<obligation 3>"
  ],
  "what_you_must_do_next": [
    "<action step 1 - immediate action required>",
    "<action step 2>",
    "<action step 3>"
  ],
  "deadlines_extracted": [
    {{"deadline": "<date or time period>", "description": "<what must be done by this deadline>"}},
    {{"deadline": "<date or time period>", "description": "<description>"}}
  ],
  "simplified_explanation": [
    {{
      "original_clause": "<quote important clause>",
      "simple_english": "<plain explanation>",
      "real_life_meaning": "<everyday meaning>",
      "what_this_means_for_you": "<rights, risks>",
      "be_careful_warning": "<warning or empty string>"
    }}
  ],
  "overall_warnings": "<summary of major warnings, risks, or things to be careful about>",
  "key_legal_terms": [
    {{
      "term": "<legal term>",
      "simple_meaning": "<plain English>",
      "real_life_meaning": "<everyday meaning>"
    }}
  ]
}}

IMPORTANT:
- plain_english_summary: Give a clear 2-3 sentence overview
- key_obligations: List 3-5 main things the person must do or comply with
- what_you_must_do_next: List 2-4 immediate action steps (e.g., "Respond within 15 days", "Consult a lawyer", "Gather evidence")
- deadlines_extracted: Extract ALL dates, time periods, or deadlines mentioned (e.g., "30 days", "within 7 days", specific dates)
- If no deadlines exist, return empty array []
- Be specific and actionable

DOCUMENT TEXT:
{context}
"""
