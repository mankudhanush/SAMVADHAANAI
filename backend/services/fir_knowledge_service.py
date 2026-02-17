"""
FIR Knowledge Retrieval Service — ISOLATED module.

This service provides semantic search over the FIR_DATASET.csv to ground
LLM responses with real legal data, reducing hallucinations.

100% self-contained:
- Loads CSV once on first access
- Creates embeddings using the existing embedder (CPU)
- Stores in a dedicated ChromaDB collection (separate from doc store)
- Provides async search function

PERFORMANCE:
- Embeddings are precomputed and stored persistently
- ChromaDB persists to disk — no re-embedding on restart
- Uses connection reuse, batch operations
- Fully async-compatible (sync internals, async wrapper)
"""

import csv
import logging
import os
import hashlib
from pathlib import Path
from typing import Optional

import chromadb
from chromadb.config import Settings

from backend.config import CHROMA_DIR
from backend.embeddings.embedder import embed_texts, embed_query

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
_FIR_CSV_PATH = Path(__file__).resolve().parent.parent.parent / "FIR_DATASET.csv"
_FIR_COLLECTION_NAME = "fir_knowledge_base"
_TOP_K_DEFAULT = 4  # Return top 4 most relevant FIR records

# ---------------------------------------------------------------------------
# Module-level state (singleton pattern)
# ---------------------------------------------------------------------------
_chroma_client = None  # type: Optional[chromadb.PersistentClient]
_fir_collection = None  # type: Optional[chromadb.Collection]
_initialized: bool = False
_dataset_hash: Optional[str] = None


def _compute_file_hash(filepath: Path) -> str:
    """Compute SHA256 hash of file for change detection."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()[:16]  # Short hash is enough


def _get_collection() -> chromadb.Collection:
    """Get or create the FIR knowledge collection."""
    global _chroma_client, _fir_collection
    
    if _fir_collection is not None:
        return _fir_collection
    
    _chroma_client = chromadb.PersistentClient(
        path=str(CHROMA_DIR),
        settings=Settings(anonymized_telemetry=False),
    )
    _fir_collection = _chroma_client.get_or_create_collection(
        name=_FIR_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    return _fir_collection


def _load_csv_records() -> list[dict]:
    """Load FIR records from CSV."""
    records = []
    
    if not _FIR_CSV_PATH.exists():
        logger.warning(f"[FIRKnowledge] CSV not found: {_FIR_CSV_PATH}")
        return records
    
    with open(_FIR_CSV_PATH, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Build composite text for embedding (searchable content)
            offense = row.get("Offense", "").strip()
            description = row.get("Description", "").strip()
            punishment = row.get("Punishment", "").strip()
            
            # Skip empty rows
            if not offense and not description:
                continue
            
            # Combine for semantic search
            search_text = f"{offense}. {description[:500]}"  # Truncate description
            
            records.append({
                "offense": offense,
                "description": description[:1000],  # Store truncated
                "punishment": punishment,
                "cognizable": row.get("Cognizable", "").strip(),
                "bailable": row.get("Bailable", "").strip(),
                "court": row.get("Court", "").strip(),
                "search_text": search_text,
            })
    
    logger.info(f"[FIRKnowledge] Loaded {len(records)} records from CSV")
    return records


def _initialize_knowledge_base():
    """Load CSV and populate ChromaDB if needed."""
    global _initialized, _dataset_hash
    
    if _initialized:
        return
    
    collection = _get_collection()
    current_count = collection.count()
    
    # Check if we need to rebuild (CSV changed or empty collection)
    if _FIR_CSV_PATH.exists():
        new_hash = _compute_file_hash(_FIR_CSV_PATH)
    else:
        logger.warning("[FIRKnowledge] FIR_DATASET.csv not found, skipping initialization")
        _initialized = True
        return
    
    # Get stored hash from collection metadata
    try:
        meta = collection.metadata or {}
        stored_hash = meta.get("dataset_hash", "")
    except Exception:
        stored_hash = ""
    
    if current_count > 0 and stored_hash == new_hash:
        logger.info(f"[FIRKnowledge] Using cached embeddings ({current_count} vectors)")
        _initialized = True
        _dataset_hash = new_hash
        return
    
    # Need to rebuild: delete old data and re-embed
    logger.info("[FIRKnowledge] Rebuilding FIR knowledge base...")
    
    # Clear existing data
    if current_count > 0:
        try:
            # Get all IDs and delete
            all_ids = collection.get()["ids"]
            if all_ids:
                collection.delete(ids=all_ids)
            logger.info(f"[FIRKnowledge] Cleared {current_count} old vectors")
        except Exception as e:
            logger.warning(f"[FIRKnowledge] Could not clear old data: {e}")
    
    # Load fresh records
    records = _load_csv_records()
    if not records:
        _initialized = True
        return
    
    # Prepare batch data
    texts = [r["search_text"] for r in records]
    metadatas = [
        {
            "offense": r["offense"][:200],  # ChromaDB metadata limits
            "punishment": r["punishment"][:200],
            "cognizable": r["cognizable"],
            "bailable": r["bailable"],
            "court": r["court"][:100],
        }
        for r in records
    ]
    ids = [f"fir_{i}" for i in range(len(records))]
    
    # Generate embeddings in batches (CPU)
    logger.info(f"[FIRKnowledge] Generating embeddings for {len(texts)} records...")
    embeddings = embed_texts(texts)
    logger.info("[FIRKnowledge] Embeddings generated")
    
    # Insert in batches (ChromaDB limit is ~5000)
    batch_size = 4000
    for i in range(0, len(texts), batch_size):
        end = min(i + batch_size, len(texts))
        collection.add(
            ids=ids[i:end],
            embeddings=embeddings[i:end],
            documents=texts[i:end],
            metadatas=metadatas[i:end],
        )
        logger.info(f"[FIRKnowledge] Indexed batch {i}-{end}")
    
    # Update collection with dataset hash (for future change detection)
    # Note: ChromaDB doesn't allow updating collection metadata directly,
    # so we store the hash in a special document
    try:
        collection.upsert(
            ids=["__meta_hash__"],
            embeddings=[[0.0] * 384],  # Dummy embedding (model dimension)
            documents=["__METADATA__"],
            metadatas=[{"dataset_hash": new_hash, "is_meta": "true"}],
        )
    except Exception as e:
        logger.warning(f"[FIRKnowledge] Could not store hash: {e}")
    
    _dataset_hash = new_hash
    _initialized = True
    logger.info(f"[FIRKnowledge] Knowledge base ready: {collection.count()} vectors")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def search_relevant_firs(query: str, top_k: int = _TOP_K_DEFAULT) -> list[dict]:
    """
    Search for FIR records semantically similar to the query.
    
    Args:
        query: User input text (case description, document text, etc.)
        top_k: Number of results to return (default: 4)
    
    Returns:
        List of dicts with keys: offense, punishment, cognizable, bailable, court, score
    """
    # Ensure knowledge base is initialized
    _initialize_knowledge_base()
    
    collection = _get_collection()
    if collection.count() <= 1:  # Only metadata document
        return []
    
    # Generate query embedding
    q_emb = embed_query(query[:2000])  # Truncate very long queries
    
    # Search
    results = collection.query(
        query_embeddings=[q_emb],
        n_results=min(top_k + 1, collection.count()),  # +1 to exclude metadata
        include=["metadatas", "distances", "documents"],
    )
    
    # Parse results
    output = []
    for i, (doc, meta, dist) in enumerate(zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    )):
        # Skip metadata document
        if meta.get("is_meta") == "true":
            continue
        
        # Convert distance to similarity score (cosine: smaller = more similar)
        score = max(0.0, 1.0 - dist)  # Cosine distance to similarity
        
        output.append({
            "offense": meta.get("offense", ""),
            "punishment": meta.get("punishment", ""),
            "cognizable": meta.get("cognizable", ""),
            "bailable": meta.get("bailable", ""),
            "court": meta.get("court", ""),
            "score": round(score, 3),
        })
        
        if len(output) >= top_k:
            break
    
    logger.info(f"[FIRKnowledge] Found {len(output)} relevant FIR records (query: {query[:50]}...)")
    return output


async def search_relevant_firs_async(query: str, top_k: int = _TOP_K_DEFAULT) -> list[dict]:
    """
    Async wrapper for FIR search.
    The underlying operations are fast enough that we don't need a thread pool.
    """
    return search_relevant_firs(query, top_k)


def format_fir_context(firs: list[dict], max_chars: int = 1500) -> str:
    """
    Format FIR search results into a context string for LLM prompt injection.
    
    Args:
        firs: List of FIR records from search_relevant_firs()
        max_chars: Maximum length of formatted context
    
    Returns:
        Formatted string ready for prompt injection
    """
    if not firs:
        return ""
    
    lines = ["RELEVANT LEGAL PROVISIONS FROM FIR DATABASE:"]
    
    for i, fir in enumerate(firs, 1):
        entry = f"\n{i}. {fir['offense']}"
        if fir['punishment']:
            entry += f"\n   Punishment: {fir['punishment']}"
        if fir['cognizable']:
            entry += f" | Cognizable: {fir['cognizable']}"
        if fir['bailable']:
            entry += f" | Bailable: {fir['bailable']}"
        if fir['court']:
            entry += f" | Court: {fir['court']}"
        
        # Check if adding this entry would exceed limit
        if len("\n".join(lines)) + len(entry) > max_chars:
            break
        
        lines.append(entry)
    
    lines.append("\n---")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Initialization on import (deferred to first use)
# ---------------------------------------------------------------------------
# We don't initialize immediately to avoid slowing down server startup.
# The knowledge base will be initialized on first search call.
