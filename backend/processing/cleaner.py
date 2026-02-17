"""
Text cleaning utilities.
Removes OCR artefacts while preserving semantic content.
"""
import re
import unicodedata


def normalize_unicode(text: str) -> str:
    """Normalize to NFC form and strip non-printable chars."""
    text = unicodedata.normalize("NFC", text)
    text = "".join(
        ch for ch in text
        if unicodedata.category(ch)[0] != "C" or ch in "\n\t\r"
    )
    return text


def fix_whitespace(text: str) -> str:
    """Collapse runs of whitespace; trim blank lines."""
    text = text.replace("\t", " ")
    text = re.sub(r"[^\S\n]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(lines).strip()


def remove_broken_chars(text: str) -> str:
    """Remove only the Unicode replacement char — keep everything else.
    
    Earlier version stripped |\\}{~^` which can appear in legitimate
    OCR output (tables, handwriting artefacts).  Now we only strip
    the actual replacement character to preserve maximum content.
    """
    text = text.replace("\ufffd", "")
    return text


def fix_hyphenation(text: str) -> str:
    """Re-join words broken across lines by OCR/PDF extraction."""
    return re.sub(r"(\w)-\n(\w)", r"\1\2", text)


def normalize_quotes_and_dashes(text: str) -> str:
    """Normalize smart quotes and long dashes to ASCII equivalents."""
    text = re.sub(r"[\u2018\u2019\u201A\u201B]", "'", text)
    text = re.sub(r"[\u201C\u201D\u201E\u201F]", '"', text)
    text = re.sub(r"[\u2013\u2014\u2015]", "-", text)
    text = re.sub(r"\u2026", "...", text)
    return text


def clean_text(text: str) -> str:
    """
    Full cleaning pipeline.
    Order: unicode → dehyphenate → normalize quotes → remove broken → whitespace.
    """
    text = normalize_unicode(text)
    text = fix_hyphenation(text)
    text = normalize_quotes_and_dashes(text)
    text = remove_broken_chars(text)
    text = fix_whitespace(text)
    return text
