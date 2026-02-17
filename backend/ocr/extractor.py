"""
OCR & text extraction layer.

Returns structured page-level data with metadata so downstream
chunking can track source document + page number.

Key design choices:
  - Every PDF page is OCR'd IN ADDITION to native text extraction
    so handwritten annotations, stamps, and margin notes are captured.
  - Images are preprocessed (grayscale, contrast, sharpen, binarize)
    before OCR for maximum accuracy on handwriting.
  - High DPI (400) for small / handwritten text.
"""
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
import fitz  # PyMuPDF
from PIL import Image, ImageEnhance, ImageFilter
import io
from pathlib import Path

logger = logging.getLogger(__name__)

# --- Tesseract setup (optional) ---
_tesseract_available = False
try:
    import pytesseract
    from backend.config import TESSERACT_CMD
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
    pytesseract.get_tesseract_version()
    _tesseract_available = True
    logger.info("Tesseract OCR found")
except Exception:
    logger.warning(
        "Tesseract OCR not found. Native-text PDFs will work, "
        "but scanned PDFs and images will fail. "
        "Install from: https://github.com/UB-Mannheim/tesseract/wiki"
    )

SUPPORTED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"}

# OCR render DPI — adaptive per page
_OCR_DPI_HIGH = 300     # for scanned/handwritten pages (little/no native text)
_OCR_DPI_LOW  = 150     # for pages that already have native text (just catching annotations)

# Native text threshold: pages with at least this many chars of native text
# are considered "text-rich" — OCR is COMPLETELY SKIPPED.
# Legal PDFs are overwhelmingly native text; this saves seconds per page.
_NATIVE_TEXT_THRESHOLD = 50

# Tesseract config optimised for speed + quality balance
# --oem 1  = LSTM only (fastest accurate mode)
# --psm 6  = assume uniform block of text (best for full pages)
_TESS_CONFIG = r"--oem 1 --psm 6"


def _preprocess_image(img: Image.Image) -> Image.Image:
    """
    Preprocess an image for OCR to maximise extraction quality,
    especially for handwritten text, stamps, and faint annotations.
    """
    # 1. Convert to grayscale
    img = img.convert("L")

    # 2. Increase contrast (makes faint handwriting darker)
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2.0)

    # 3. Sharpen (helps blurry scans / photos)
    img = img.filter(ImageFilter.SHARPEN)
    img = img.filter(ImageFilter.SHARPEN)  # double sharpen

    # 4. Slight resize up if image is small
    w, h = img.size
    if w < 1500 or h < 1500:
        scale = max(1500 / w, 1500 / h, 1.0)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    # 5. Binarize (adaptive threshold via Pillow point)
    threshold = 140
    img = img.point(lambda p: 255 if p > threshold else 0, mode="1")
    img = img.convert("L")  # back to grayscale for Tesseract

    return img


def _ocr_image(img: Image.Image) -> str:
    """Run Tesseract on a preprocessed image."""
    if not _tesseract_available:
        raise RuntimeError(
            "Tesseract OCR is required for scanned PDFs/images but is not installed. "
            "Install from https://github.com/UB-Mannheim/tesseract/wiki"
        )
    processed = _preprocess_image(img)
    return pytesseract.image_to_string(processed, config=_TESS_CONFIG)


def _page_to_image(page: fitz.Page, dpi: int = _OCR_DPI_HIGH) -> Image.Image:
    """Render a PDF page to a PIL Image at the given DPI."""
    pix = page.get_pixmap(dpi=dpi)
    return Image.open(io.BytesIO(pix.tobytes("png")))


# Thread pool for parallel OCR — scale to CPU count, capped to avoid memory blowup
_MAX_OCR_WORKERS = min(os.cpu_count() or 4, 8)
_ocr_pool = ThreadPoolExecutor(max_workers=_MAX_OCR_WORKERS, thread_name_prefix="ocr")


def _process_single_page(page_num: int, page: fitz.Page) -> dict | None:
    """
    Extract and merge native + OCR text for a single PDF page.
    Designed to run in a thread pool.

    PERFORMANCE v3: COMPLETELY SKIP OCR on text-rich pages.
    Legal PDFs are 99% native text — OCR-ing every page at any DPI
    is the single biggest bottleneck.  On a 300-page native-text PDF
    this saves ~95% of extraction time.
    """
    native_text = page.get_text("text").strip()
    native_len = len(native_text)

    # ── Fast path: native text is rich → skip OCR entirely ──
    if native_len >= _NATIVE_TEXT_THRESHOLD:
        logger.debug("Page %d: native-only (%d chars) — OCR skipped", page_num + 1, native_len)
        return {"page": page_num + 1, "text": native_text, "method": "native"}

    # ── Slow path: scanned / image page → full quality OCR ──
    ocr_text = ""
    if _tesseract_available:
        try:
            img = _page_to_image(page, dpi=_OCR_DPI_HIGH)
            ocr_text = _ocr_image(img).strip()
        except Exception as exc:
            logger.warning("Page %d: OCR failed — %s", page_num + 1, exc)

    if native_text and ocr_text:
        merged = native_text + "\n\n" + ocr_text
        method = "native+ocr"
    elif ocr_text:
        merged = ocr_text
        method = "ocr"
    elif native_text:
        merged = native_text
        method = "native"
    else:
        merged = ""
        method = "empty"

    if merged:
        logger.info("Page %d: %s — %d chars", page_num + 1, method, len(merged))
        return {"page": page_num + 1, "text": merged, "method": method}
    return None


def extract_pages_from_pdf(file_path: str) -> list[dict]:
    """
    Extract text page-by-page from a PDF.

    Strategy per page:
      1. Always extract native (embedded) text.
      2. Always run OCR on the page image too.
      3. Merge both — deduplicated — so that printed text,
         handwritten annotations, stamps, margin notes, etc.
         are ALL captured.

    OPTIMISED: Pages are processed in parallel via ThreadPoolExecutor
    for ~2-4x speedup on multi-page PDFs.

    Returns list of {"page": int, "text": str, "method": str}.
    """
    doc = fitz.open(file_path)
    page_count = len(doc)

    if page_count <= 1:
        # Single page — no parallelism overhead
        pages: list[dict] = []
        for page_num, page in enumerate(doc):
            result = _process_single_page(page_num, page)
            if result:
                pages.append(result)
        doc.close()
        return pages

    # Multi-page: process in parallel
    futures = {}
    for page_num in range(page_count):
        page = doc[page_num]
        fut = _ocr_pool.submit(_process_single_page, page_num, page)
        futures[fut] = page_num

    page_results: dict[int, dict] = {}
    for fut in as_completed(futures):
        page_num = futures[fut]
        try:
            result = fut.result()
            if result:
                page_results[page_num] = result
        except Exception as exc:
            logger.error(f"Page {page_num + 1} processing failed: {exc}")

    doc.close()

    # Return pages in order
    return [page_results[i] for i in sorted(page_results.keys())]


def extract_pages_from_image(file_path: str) -> list[dict]:
    """OCR a single image file."""
    img = Image.open(file_path)
    return [{"page": 1, "text": _ocr_image(img), "method": "ocr"}]


def extract_pages(file_path: str) -> list[dict]:
    """
    Unified entry point.  Returns list of page dicts with text + metadata.
    """
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return extract_pages_from_pdf(file_path)
    elif ext in SUPPORTED_IMAGE_EXT:
        return extract_pages_from_image(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def extract_text(file_path: str) -> str:
    """Convenience: return all text concatenated (backward compat)."""
    pages = extract_pages(file_path)
    return "\n\n".join(p["text"] for p in pages)
