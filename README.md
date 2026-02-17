# SamVadhaan AI — AI-Powered Legal Document Intelligence Platform

A production-grade, full-stack legal AI platform that combines **Retrieval-Augmented Generation (RAG)**, **OCR**, **hybrid search**, **constitutional intelligence**, **case strategy generation**, **lawyer discovery**, and **multilingual voice processing** — purpose-built for the Indian legal system.

## Key Features

- **Document Intelligence** — Upload PDFs/images → OCR → Chunk → Embed → Hybrid Retrieve → LLM Answer with citations
- **Plain Language Simplifier** — Converts complex legal documents into easy-to-understand summaries with clause-by-clause breakdown
- **Risk Scanner & Scoring** — Automated contract risk analysis with severity scoring
- **Constitutional Intelligence** — Maps documents to Indian Constitutional articles, fundamental rights, and landmark cases
- **Case Strategy Generator** — AI-generated legal strategy with strengths, weaknesses, and recommended approach
- **Lawyer Discovery Engine** — Finds relevant lawyers based on case type, location, and specialization
- **Multilingual Voice Pipeline** — Speech-to-text → Summarize → Translate (8 Indian languages) → Text-to-speech
- **Web Search Integration** — Supplements RAG answers with real-time web results when confidence is low
- **FIR Knowledge Base** — Pattern matching against FIR dataset for criminal law queries
- **Google OAuth** — Secure authentication

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Tailwind CSS + Vite + Framer Motion |
| **Backend** | FastAPI + Uvicorn (Python) |
| **LLM** | Fine-tuned model / Ollama (local inference) |
| **Embeddings** | Sentence Transformers (`all-MiniLM-L6-v2`) |
| **Re-ranking** | Cross-encoder (`ms-marco-MiniLM-L-6-v2`) |
| **Vector Store** | ChromaDB (persistent) |
| **Keyword Search** | BM25 (hybrid fusion with semantic search) |
| **OCR** | Tesseract OCR with image preprocessing |
| **Voice STT** | Faster Whisper |
| **Translation** | Deep Translator (8 Indian languages) |
| **TTS** | gTTS |
| **Auth** | Google OAuth 2.0 |

## Project Structure

```
legalwise/
├── backend/
│   ├── main.py                          # FastAPI entry point
│   ├── config.py                        # Central configuration & prompts
│   ├── api/
│   │   ├── auth_routes.py               # Google OAuth routes
│   │   ├── routes.py                    # Core API routes
│   │   ├── case_strategy_routes.py      # Case strategy endpoints
│   │   └── constitutional_intelligence_routes.py
│   ├── ocr/
│   │   └── extractor.py                # PDF/image OCR with preprocessing
│   ├── processing/
│   │   ├── cleaner.py                  # Text normalization
│   │   └── chunker.py                  # Recursive text splitting
│   ├── embeddings/
│   │   └── embedder.py                 # Sentence Transformers embedder
│   ├── vectorstore/
│   │   └── store.py                    # ChromaDB persistent store
│   ├── rag/
│   │   ├── chain.py                    # RAG query chain with memory
│   │   ├── retriever.py               # Hybrid retrieval (semantic + BM25 + RRF)
│   │   └── simplifier.py              # Legal document simplifier
│   ├── discovery/
│   │   ├── engine.py                   # Lawyer discovery engine
│   │   ├── search.py                   # Web search for lawyers
│   │   ├── extractor.py               # Lawyer info extraction
│   │   ├── scorer.py                   # Relevance scoring
│   │   └── lawyer_engine.py           # Orchestrator
│   ├── services/
│   │   ├── analysis_service.py         # Document analysis
│   │   ├── case_strategy_service.py    # Case strategy generation
│   │   ├── constitutional_intelligence_service.py
│   │   ├── fir_knowledge_service.py    # FIR pattern matching
│   │   ├── llm_service.py             # LLM abstraction layer
│   │   ├── voice_service.py           # Voice pipeline orchestration
│   │   ├── web_search_service.py      # Real-time web search
│   │   └── ...                         # Other services
│   └── voice/
│       ├── whisper_utils.py            # Speech-to-text (Faster Whisper)
│       ├── summarization_utils.py      # LLM summarization
│       ├── translation_utils.py        # Multi-language translation
│       └── tts_utils.py               # Text-to-speech (gTTS)
├── frontend/
│   ├── src/
│   │   ├── App.jsx                     # Main React app
│   │   ├── pages/                      # Dashboard, DocumentUpload, RiskScanner, etc.
│   │   ├── components/                 # Reusable UI components
│   │   ├── services/api.js            # API client
│   │   └── store/                      # Zustand state management
│   ├── package.json
│   └── vite.config.js
├── FIR_DATASET.csv                     # FIR knowledge base
├── requirements.txt
└── README.md
```

## Prerequisites

| Dependency | Install |
|---|---|
| **Python 3.11+** | https://python.org |
| **Node.js 18+** | https://nodejs.org |
| **Tesseract OCR** | Windows: [installer](https://github.com/UB-Mannheim/tesseract/wiki) — add to PATH |
| **Ollama** (for local LLM) | https://ollama.com |

## Quick Start

### 1. Clone & setup backend

```bash
git clone https://github.com/mankudhanush/SAMVADHAANAI.git
cd SAMVADHAANAI
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

### 2. Setup frontend

```bash
cd frontend
npm install
cd ..
```

### 3. Configure LLM

**Option A — Fine-tuned Model (recommended):**

Use your own fine-tuned model served locally via Ollama or any OpenAI-compatible API endpoint. Update `backend/config.py` with your model name and endpoint.

**Option B — Ollama (local open-source models):**

```bash
# Install Ollama from https://ollama.com, then:
ollama pull llama3.2:3b       # or any model of your choice
ollama serve                  # keep running in background
```

### 4. Set environment variables

```bash
# Required for Google OAuth
set GOOGLE_CLIENT_ID=your_client_id
set GOOGLE_CLIENT_SECRET=your_client_secret

# Optional — update in backend/config.py
set OLLAMA_MODEL=llama3.2:3b
set OLLAMA_BASE_URL=http://localhost:11434
```

### 5. Run the server

```bash
uvicorn backend.main:app --reload --reload-dir backend --host 0.0.0.0 --port 8000
```

### 6. Run the frontend (separate terminal)

```bash
cd frontend
npm run dev
```

### 7. Open the app

- **Frontend:** http://localhost:5173
- **API docs:** http://localhost:8000/docs

## Configuration

All settings are in `backend/config.py` and can be overridden via environment variables:

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | LLM API endpoint |
| `OLLAMA_MODEL` | `llama3.2:3b` | Model name |
| `CHUNK_SIZE` | `800` | Text chunk size (characters) |
| `CHUNK_OVERLAP` | `150` | Chunk overlap |
| `RETRIEVAL_TOP_K` | `15` | Top chunks retrieved |
| `RERANK_TOP_K` | `5` | Chunks after re-ranking |
| `BM25_WEIGHT` | `0.3` | BM25 weight in hybrid fusion |
| `SEMANTIC_WEIGHT` | `0.7` | Semantic weight in hybrid fusion |
| `TESSERACT_CMD` | `tesseract` | Path to Tesseract binary |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/api/upload` | Upload & process a document |
| `POST` | `/api/query` | Ask a question (RAG pipeline) |
| `GET` | `/api/status` | Vector store stats |
| `POST` | `/api/clear` | Reset vector store |
| `POST` | `/api/clear-session` | Clear conversation memory |
| `POST` | `/api/discover-lawyers` | Find relevant lawyers |
| `POST` | `/api/simplify` | Simplify legal document |
| `POST` | `/api/simplify/speak` | Simplify + TTS audio |
| `GET` | `/api/voice/languages` | List supported languages |
| `POST` | `/api/voice/process` | Voice pipeline (STT → Summarize → Translate → TTS) |

## Supported Languages (Voice)

Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati

## Team

**MANKU DHANUSH** — Full-stack development & AI/ML pipeline

## License

This project is proprietary. All rights reserved.
