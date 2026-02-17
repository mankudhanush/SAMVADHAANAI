"""
Document-aware chunking with metadata.

Each chunk carries: document name, page number, chunk index.

PERFORMANCE v3: Singleton splitter instance (avoids re-creation per call).
"""
from langchain_text_splitters import RecursiveCharacterTextSplitter
from backend.config import CHUNK_SIZE, CHUNK_OVERLAP
from backend.processing.cleaner import clean_text

# Singleton splitter — thread-safe, stateless, reusable
_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    length_function=len,
    separators=["\n\n", "\n", ". ", "; ", ", ", " ", ""],
)


def chunk_document(
    pages: list[dict],
    document_name: str,
) -> list[dict]:
    """
    Split page-level text into overlapping chunks with full metadata.
    """
    all_chunks: list[dict] = []
    global_idx = 0

    for page_info in pages:
        cleaned = clean_text(page_info["text"])
        if not cleaned.strip():
            continue

        page_chunks = _splitter.split_text(cleaned)
        for chunk_text_str in page_chunks:
            all_chunks.append({
                "text": chunk_text_str,
                "metadata": {
                    "document": document_name,
                    "page": page_info["page"],
                    "chunk_index": global_idx,
                    "extraction_method": page_info.get("method", "unknown"),
                },
            })
            global_idx += 1

    return all_chunks


def chunk_text(text: str) -> list[str]:
    """Backward-compatible: split plain text into chunk strings."""
    return _splitter.split_text(text)
