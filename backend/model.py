"""
model.py — Model Configuration & Management for SamVadhaan AI

Centralises all model definitions, loading, and health checks.
Supports:
  1. Fine-tuned custom models served via Ollama
  2. Open-source Ollama models (Llama, Mistral, etc.)

Usage:
    from backend.model import ModelManager

    manager = ModelManager()
    manager.health_check()
    response = manager.generate("Summarise this clause...")
"""

import logging
import os
import httpx
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Model Definitions
# ---------------------------------------------------------------------------
@dataclass
class ModelConfig:
    """Configuration for a single model."""

    name: str
    provider: str = "ollama"  # "ollama" or "custom"
    base_url: str = "http://localhost:11434"
    context_window: int = 8192
    max_tokens: int = 2048
    temperature: float = 0.1
    top_p: float = 0.9
    repeat_penalty: float = 1.1
    description: str = ""
    tags: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Pre-defined Model Profiles
# ---------------------------------------------------------------------------
AVAILABLE_MODELS: dict[str, ModelConfig] = {
    # Fine-tuned model (primary — recommended)
    "fine-tuned": ModelConfig(
        name=os.getenv("FINETUNED_MODEL", "samvadhaan-legal:latest"),
        provider="ollama",
        base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        context_window=8192,
        max_tokens=2048,
        temperature=0.1,
        description="Fine-tuned legal model optimised for Indian law",
        tags=["legal", "fine-tuned", "indian-law"],
    ),
    # Ollama open-source models
    "llama3.2:3b": ModelConfig(
        name="llama3.2:3b",
        provider="ollama",
        base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        context_window=8192,
        max_tokens=2048,
        temperature=0.1,
        description="Meta Llama 3.2 3B — fast, lightweight",
        tags=["general", "fast"],
    ),
    "llama3.1:8b": ModelConfig(
        name="llama3.1:8b",
        provider="ollama",
        base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        context_window=8192,
        max_tokens=2048,
        temperature=0.1,
        description="Meta Llama 3.1 8B — balanced quality & speed",
        tags=["general", "balanced"],
    ),
    "mistral": ModelConfig(
        name="mistral",
        provider="ollama",
        base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        context_window=8192,
        max_tokens=2048,
        temperature=0.1,
        description="Mistral 7B — strong reasoning",
        tags=["general", "reasoning"],
    ),
}

# Active model key (env override or default)
_ACTIVE_MODEL_KEY = os.getenv("ACTIVE_MODEL", os.getenv("OLLAMA_MODEL", "llama3.2:3b"))


# ---------------------------------------------------------------------------
# Embedding & Re-ranker Model Configs
# ---------------------------------------------------------------------------
@dataclass
class EmbeddingConfig:
    """Embedding model configuration."""

    model_name: str = "all-MiniLM-L6-v2"
    dimension: int = 384
    max_seq_length: int = 256
    description: str = "Sentence Transformers — fast, lightweight embeddings"


@dataclass
class RerankerConfig:
    """Cross-encoder re-ranker configuration."""

    model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    max_length: int = 512
    description: str = "MS MARCO cross-encoder for passage re-ranking"


EMBEDDING = EmbeddingConfig()
RERANKER = RerankerConfig()


# ---------------------------------------------------------------------------
# Model Manager
# ---------------------------------------------------------------------------
class ModelManager:
    """
    Manages model selection, health checks, and inference calls.

    Provides a clean interface for the rest of the application to
    interact with any configured model without worrying about the
    underlying provider details.
    """

    def __init__(self, model_key: Optional[str] = None):
        key = model_key or _ACTIVE_MODEL_KEY

        # Resolve: if key matches a profile use it, else treat as Ollama model name
        if key in AVAILABLE_MODELS:
            self.config = AVAILABLE_MODELS[key]
        else:
            self.config = ModelConfig(
                name=key,
                provider="ollama",
                base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
                description=f"Ollama model: {key}",
            )

        self._client: Optional[httpx.Client] = None
        logger.info(
            "ModelManager initialised → model=%s, provider=%s, url=%s",
            self.config.name,
            self.config.provider,
            self.config.base_url,
        )

    # -- HTTP client (lazy, persistent) ------------------------------------

    def _get_client(self) -> httpx.Client:
        if self._client is None or self._client.is_closed:
            self._client = httpx.Client(
                base_url=self.config.base_url,
                timeout=httpx.Timeout(300.0, connect=15.0),
                limits=httpx.Limits(
                    max_connections=6, max_keepalive_connections=3
                ),
            )
        return self._client

    # -- Health check -------------------------------------------------------

    def health_check(self) -> dict:
        """
        Check if the model is loaded and the provider is reachable.

        Returns:
            {"status": "ok"|"error", "model": str, "details": str}
        """
        try:
            client = self._get_client()
            # Ollama tags endpoint lists available models
            resp = client.get("/api/tags")
            resp.raise_for_status()
            models = resp.json().get("models", [])
            model_names = [m.get("name", "") for m in models]

            # Check if our model is available (partial match)
            found = any(self.config.name in n for n in model_names)

            if found:
                return {
                    "status": "ok",
                    "model": self.config.name,
                    "details": f"Model available. {len(models)} models loaded.",
                }
            else:
                return {
                    "status": "warning",
                    "model": self.config.name,
                    "details": (
                        f"Model '{self.config.name}' not found. "
                        f"Available: {', '.join(model_names[:5])}"
                    ),
                }
        except Exception as exc:
            return {
                "status": "error",
                "model": self.config.name,
                "details": f"Cannot reach provider: {exc}",
            }

    # -- Inference ----------------------------------------------------------

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> dict:
        """
        Generate a response from the active model.

        Args:
            prompt:        User/query prompt.
            system_prompt: Optional system-level instruction.
            max_tokens:    Override max generation tokens.
            temperature:   Override sampling temperature.

        Returns:
            {"text": str, "model": str, "done": bool}
        """
        num_threads = os.cpu_count() or 4
        payload: dict = {
            "model": self.config.name,
            "prompt": prompt,
            "stream": False,
            "keep_alive": "30m",
            "options": {
                "num_predict": max_tokens or self.config.max_tokens,
                "num_ctx": self.config.context_window,
                "temperature": temperature or self.config.temperature,
                "top_p": self.config.top_p,
                "repeat_penalty": self.config.repeat_penalty,
                "num_thread": num_threads,
            },
        }
        if system_prompt:
            payload["system"] = system_prompt

        logger.info(
            "Model.generate → model=%s, prompt_len=%d",
            self.config.name,
            len(prompt),
        )

        try:
            client = self._get_client()
            resp = client.post("/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            text = data.get("response", "")
            logger.info("Model response → %d chars", len(text))
            return {
                "text": text,
                "model": self.config.name,
                "done": data.get("done", True),
            }
        except httpx.TimeoutException:
            logger.error("Model request timed out (300s)")
            raise RuntimeError(f"Model '{self.config.name}' timed out")
        except httpx.HTTPStatusError as exc:
            logger.error("Model HTTP error: %s", exc.response.status_code)
            raise RuntimeError(
                f"Model HTTP error: {exc.response.status_code}"
            )
        except Exception as exc:
            logger.exception("Model call failed")
            raise RuntimeError(f"Model call failed: {exc}")

    def generate_fast(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 384,
    ) -> dict:
        """
        Fast generation with reduced context — for summaries, classifications.
        """
        return self.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            temperature=0.1,
        )

    # -- Info ---------------------------------------------------------------

    def info(self) -> dict:
        """Return current model configuration as a dict."""
        return {
            "model_name": self.config.name,
            "provider": self.config.provider,
            "base_url": self.config.base_url,
            "context_window": self.config.context_window,
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
            "description": self.config.description,
            "tags": self.config.tags,
            "embedding_model": EMBEDDING.model_name,
            "reranker_model": RERANKER.model_name,
        }

    def close(self):
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            self._client.close()

    def __repr__(self) -> str:
        return (
            f"ModelManager(model={self.config.name!r}, "
            f"provider={self.config.provider!r})"
        )


# ---------------------------------------------------------------------------
# Module-level convenience — singleton instance
# ---------------------------------------------------------------------------
_default_manager: Optional[ModelManager] = None


def get_model_manager() -> ModelManager:
    """Get or create the default ModelManager singleton."""
    global _default_manager
    if _default_manager is None:
        _default_manager = ModelManager()
    return _default_manager


def list_available_models() -> list[dict]:
    """List all pre-defined model profiles."""
    return [
        {
            "key": key,
            "name": cfg.name,
            "provider": cfg.provider,
            "description": cfg.description,
            "tags": cfg.tags,
        }
        for key, cfg in AVAILABLE_MODELS.items()
    ]
