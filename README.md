# LegalWise RAG — Minimal Pipeline Test

End-to-end RAG pipeline: **Upload → OCR → Clean → Chunk → Embed → FAISS → LLM → Answer**

## Project Structure

```
legalwise/
├── backend/
│   ├── main.py                 # FastAPI app (entry point)
│   ├── config.py               # All configuration in one place
│   ├── ocr/
│   │   └── extractor.py        # PDF text extraction + Tesseract OCR
│   ├── processing/
│   │   ├── cleaner.py          # Text normalization & cleaning
│   │   └── chunker.py          # Recursive text splitting
│   ├── embeddings/
│   │   └── embedder.py         # Sentence Transformers (all-MiniLM-L6-v2)
│   ├── vectorstore/
│   │   └── store.py            # FAISS in-memory vector store
│   ├── rag/
│   │   └── chain.py            # RAG query chain (retrieve + LLM)
│   └── uploads/                # Temp file storage (auto-created)
├── frontend/
│   └── index.html              # Single-page test UI
├── requirements.txt
└── README.md
```

## Prerequisites

| Dependency | Install |
|---|---|
| **Python 3.11+** | https://python.org |
| **Tesseract OCR** | Windows: [installer](https://github.com/UB-Mannheim/tesseract/wiki) — add to PATH |
| **Ollama** (for local LLM) | https://ollama.com |

## Quick Start

### 1. Create virtual environment

```bash
cd legalwise
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Install & start the LLM

**Option A — Ollama (local, default):**

```bash
# Install Ollama from https://ollama.com, then:
ollama pull mistral
ollama serve                 # keep running in background
```

**Option B — Groq cloud API (free tier, no GPU needed):**

```bash
# Sign up at https://console.groq.com, get an API key, then:
set GROQ_API_KEY=gsk_your_key_here
set LLM_PROVIDER=groq
```

### 4. Run the server

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Open the UI

Navigate to **http://localhost:8000** in your browser.

## Usage

1. **Upload** a PDF or image file using the upload button.
2. Wait for processing (OCR → clean → chunk → embed — may take a few seconds).
3. **Ask a question** in the text input and click Submit.
4. The answer and source chunks are displayed below.

## Configuration

All settings are in `backend/config.py` and can be overridden via environment variables:

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `ollama` | `ollama` or `groq` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_MODEL` | `mistral` | Model name in Ollama |
| `GROQ_API_KEY` | _(empty)_ | API key for Groq |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Model on Groq |
| `TESSERACT_CMD` | `tesseract` | Path to Tesseract binary |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Serve frontend UI |
| `POST` | `/api/upload` | Upload & process a document |
| `POST` | `/api/query` | Ask a question (JSON body: `{"question": "..."}`) |
| `GET` | `/api/status` | Vector store stats |
| `POST` | `/api/clear` | Reset vector store |
