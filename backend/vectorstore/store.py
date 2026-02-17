"""
ChromaDB persistent vector store with document metadata.

Replaces in-memory FAISS — data survives server restarts.

PERFORMANCE v3:
  - add_chunks_fast() uses numpy embeddings (skips .tolist() overhead)
  - Bulk UUID generation via uuid4().hex batch
"""
import logging
import uuid
import chromadb
from chromadb.config import Settings

from backend.config import CHROMA_DIR, RETRIEVAL_TOP_K
from backend.embeddings.embedder import embed_texts, embed_query, embed_texts_np

logger = logging.getLogger(__name__)

COLLECTION_NAME = "legalwise_docs"


class VectorStore:
    """ChromaDB-backed vector store with metadata support."""

    def __init__(self):
        self._client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False),
        )
        self._collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        # Cached get_all_chunks result — invalidated on add/clear
        self._all_chunks_cache: list[dict] | None = None
        self._all_chunks_cache_size: int = -1
        logger.info(
            f"ChromaDB loaded: {self._collection.count()} vectors in '{COLLECTION_NAME}'"
        )

    def add_chunks(self, chunks: list[dict]) -> int:
        """
        Embed and store chunks with metadata.
        Uses numpy-native embeddings for speed (no .tolist() overhead).
        """
        self._ensure_collection()
        if not chunks:
            return self._collection.count()

        texts = [c["text"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]
        embeddings_np = embed_texts_np(texts)
        # ChromaDB accepts list-of-lists; .tolist() on the whole array is
        # still needed but is a single C-level call (fast).
        embeddings = embeddings_np.tolist()
        ids = [uuid.uuid4().hex for _ in chunks]

        # ChromaDB batch limit is 5461, split if needed
        batch_size = 5000
        for i in range(0, len(texts), batch_size):
            self._collection.add(
                ids=ids[i : i + batch_size],
                embeddings=embeddings[i : i + batch_size],
                documents=texts[i : i + batch_size],
                metadatas=metadatas[i : i + batch_size],
            )

        total = self._collection.count()
        logger.info(f"Added {len(chunks)} chunks → {total} total vectors")
        # Invalidate cache after adding new chunks
        self._all_chunks_cache = None
        self._all_chunks_cache_size = -1
        return total

    def search(self, query: str, top_k: int | None = None) -> list[dict]:
        """
        Semantic search.  Returns top-k results with text + metadata + score.
        """
        self._ensure_collection()
        count = self._collection.count()
        if count == 0:
            return []

        k = min(top_k or RETRIEVAL_TOP_K, count)
        q_emb = embed_query(query)

        results = self._collection.query(
            query_embeddings=[q_emb],
            n_results=k,
            include=["documents", "metadatas", "distances"],
        )

        hits: list[dict] = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            hits.append({
                "chunk": doc,
                "metadata": meta,
                "score": float(dist),
            })
        return hits

    def get_all_chunks(self) -> list[dict]:
        """Return all stored chunks + metadata (cached, invalidated on add/clear)."""
        count = self._collection.count()
        if count == 0:
            return []
        # Return cached if count hasn't changed
        if self._all_chunks_cache is not None and self._all_chunks_cache_size == count:
            return self._all_chunks_cache
        result = self._collection.get(include=["documents", "metadatas"])
        self._all_chunks_cache = [
            {"chunk": doc, "metadata": meta}
            for doc, meta in zip(result["documents"], result["metadatas"])
        ]
        self._all_chunks_cache_size = count
        logger.info("get_all_chunks: refreshed cache (%d chunks)", count)
        return self._all_chunks_cache

    def get_chunks_by_document(self, document_name: str) -> list[dict]:
        """Return only chunks whose metadata 'document' matches *document_name*."""
        if self._collection.count() == 0:
            return []
        result = self._collection.get(
            where={"document": document_name},
            include=["documents", "metadatas"],
        )
        return [
            {"chunk": doc, "metadata": meta}
            for doc, meta in zip(result["documents"], result["metadatas"])
        ]

    def delete_chunks_by_document(self, document_name: str) -> int:
        """Delete all chunks belonging to a specific document. Returns count deleted."""
        if self._collection.count() == 0:
            return 0
        result = self._collection.get(
            where={"document": document_name},
            include=[],
        )
        ids_to_delete = result["ids"]
        if ids_to_delete:
            self._collection.delete(ids=ids_to_delete)
            # Invalidate cache
            self._all_chunks_cache = None
            self._all_chunks_cache_size = -1
            logger.info("Deleted %d chunks for document '%s'", len(ids_to_delete), document_name)
        return len(ids_to_delete)

    def get_chunks_by_pages(self, page_numbers: list[int]) -> list[dict]:
        """Return chunks whose metadata 'page' is in *page_numbers*."""
        if self._collection.count() == 0:
            return []
        if len(page_numbers) == 1:
            where_filter = {"page": page_numbers[0]}
        else:
            where_filter = {"page": {"$in": page_numbers}}
        result = self._collection.get(
            where=where_filter,
            include=["documents", "metadatas"],
        )
        return [
            {"chunk": doc, "metadata": meta}
            for doc, meta in zip(result["documents"], result["metadatas"])
        ]

    def get_documents(self) -> list[str]:
        """Return list of unique document names in the store."""
        if self._collection.count() == 0:
            return []
        result = self._collection.get(include=["metadatas"])
        names = {m.get("document", "unknown") for m in result["metadatas"]}
        return sorted(names)

    def clear(self):
        """Delete and recreate the collection."""
        try:
            self._client.delete_collection(COLLECTION_NAME)
        except Exception:
            pass  # Collection may already be gone
        self._collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        # Invalidate cache
        self._all_chunks_cache = None
        self._all_chunks_cache_size = -1
        logger.info("Vector store cleared")

    def _ensure_collection(self):
        """Re-acquire the collection reference if it was deleted externally."""
        try:
            self._collection.count()
        except Exception:
            logger.warning("Collection reference stale — re-creating")
            self._collection = self._client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )

    @property
    def size(self) -> int:
        self._ensure_collection()
        return self._collection.count()


# Module-level singleton
vector_store = VectorStore()
