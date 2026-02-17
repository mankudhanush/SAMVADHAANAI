"""
QA service — wraps the RAG chain for question answering.

Keeps query logic cleanly separated from route handlers.
"""
import logging
from backend.rag.chain import query_rag, clear_session as _clear_session

logger = logging.getLogger(__name__)


def answer_question(question: str, session_id: str = "default") -> dict:
    """
    Answer a question using the RAG pipeline.

    Flow:
        Embed question → Retrieve top chunks → Construct context →
        Pass context + question to LLM → Return answer.

    Args:
        question:   The user's question.
        session_id: Conversation session ID for follow-up context.

    Returns:
        {"answer": str, "sources": list[dict], "session_id": str}
    """
    logger.info(f"QA request: question='{question[:80]}...', session={session_id}")
    result = query_rag(question, session_id=session_id)
    logger.info(
        f"QA response: {len(result.get('answer', ''))} chars, "
        f"{len(result.get('sources', []))} sources"
    )
    return result


def clear_session(session_id: str = "default"):
    """Clear conversation history for a session."""
    _clear_session(session_id)
    logger.info(f"Session '{session_id}' cleared")
