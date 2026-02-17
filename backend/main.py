"""
FastAPI application — thin entry point for LegalWise.

App creation, CORS middleware, and router mounting only.
All route handlers live in backend.api.routes.
"""
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.api.routes import router as api_router
from backend.api.case_strategy_routes import router as case_strategy_router
from backend.api.constitutional_intelligence_routes import router as constitutional_router
from backend.api.auth_routes import router as auth_router

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="LegalWise RAG", version="3.0.0")

# ---------------------------------------------------------------------------
# CORS — allow React dev server only (not wildcard)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Static files (generated audio, etc.)
# ---------------------------------------------------------------------------
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "audio").mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# ---------------------------------------------------------------------------
# Mount API routers
# ---------------------------------------------------------------------------
app.include_router(auth_router)           # Google OAuth authentication
app.include_router(api_router)
app.include_router(case_strategy_router)  # isolated AI Case Strategy Simulator
app.include_router(constitutional_router)  # isolated Constitutional Intelligence Engine


@app.on_event("shutdown")
async def _shutdown():
    """Close persistent httpx clients on server shutdown."""
    import backend.services.llm_service as _llm
    import backend.services.case_strategy_service as _cs
    import backend.services.constitutional_intelligence_service as _ci

    for mod, attr in [
        (_llm, "_ollama_client"), (_llm, "_groq_client"),
        (_cs, "_ollama_client"), (_cs, "_groq_client"),
        (_ci, "_ollama_client"),
    ]:
        client = getattr(mod, attr, None)
        if client is not None and not getattr(client, "is_closed", True):
            try:
                if hasattr(client, "aclose"):
                    await client.aclose()
                else:
                    client.close()
            except Exception:
                pass
    logger.info("Shutdown: HTTP clients closed")


logger.info("LegalWise API v3.0.0 ready")
