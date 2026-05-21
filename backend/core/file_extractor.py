"""
JARVIS File Text Extractor
Extrae texto plano de archivos subidos al bucket para inyectar en el contexto del chat.
Soporta: PDF, TXT, MD, imágenes (placeholder para OCR futuro).
"""

import io
from typing import Optional

from backend.core.storage import download_bytes

MAX_CHARS_PER_FILE = 12_000  # ~3k tokens approx


def extract_text_from_file(object_key: str, filename_hint: Optional[str] = None) -> str:
    """Descarga un archivo del bucket y extrae su texto plano."""
    data = download_bytes(object_key)
    filename = filename_hint or object_key.split("/")[-1]
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    if ext == "pdf":
        return _extract_pdf(data, filename)
    elif ext in ("txt", "md", "markdown", "log", "csv", "json", "py", "js", "ts", "html", "css", "xml", "yaml", "yml"):
        return _extract_text(data, filename)
    elif ext in ("jpg", "jpeg", "png", "gif", "webp"):
        return _extract_image_placeholder(filename)
    else:
        # Try as plain text
        return _extract_text(data, filename)


def _extract_pdf(data: bytes, filename: str) -> str:
    """Extrae texto de PDF usando pypdf."""
    try:
        from pypdf import PdfReader
    except ImportError:
        return f"[Error: pypdf no instalado para leer {filename}]"

    try:
        reader = PdfReader(io.BytesIO(data))
        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        full_text = "\n\n".join(text_parts)
        if len(full_text) > MAX_CHARS_PER_FILE:
            full_text = full_text[:MAX_CHARS_PER_FILE] + f"\n\n[... Truncado. El archivo tiene {len(full_text)} caracteres, mostrando primeros {MAX_CHARS_PER_FILE}]"
        return full_text
    except Exception as e:
        return f"[Error al leer PDF {filename}: {e}]"


def _extract_text(data: bytes, filename: str) -> str:
    """Extrae texto de archivos de texto plano."""
    try:
        text = data.decode("utf-8", errors="replace")
        if len(text) > MAX_CHARS_PER_FILE:
            text = text[:MAX_CHARS_PER_FILE] + f"\n\n[... Truncado. El archivo tiene {len(text)} caracteres, mostrando primeros {MAX_CHARS_PER_FILE}]"
        return text
    except Exception as e:
        return f"[Error al leer archivo de texto {filename}: {e}]"


def _extract_image_placeholder(filename: str) -> str:
    """Placeholder para OCR de imágenes."""
    return f"[Archivo de imagen: {filename}. El procesamiento de imágenes (OCR) aún no está implementado. Preguntá sobre el contenido visual cuando esté disponible.]"


def build_file_context(file_keys: list[str], filenames: Optional[list[str]] = None) -> str:
    """Construye un bloque de contexto con el contenido de múltiples archivos adjuntos."""
    if not file_keys:
        return ""

    parts = ["=" * 60, "📎 CONTENIDO DE ARCHIVOS ADJUNTOS", "=" * 60]

    for i, key in enumerate(file_keys):
        filename = filenames[i] if filenames and i < len(filenames) else key.split("/")[-1]
        parts.append(f"\n📄 Archivo #{i + 1}: {filename}\n{'─' * 40}")
        parts.append(extract_text_from_file(key, filename))

    parts.append("\n" + "=" * 60)
    parts.append("📨 MENSAJE DEL USUARIO")
    parts.append("=" * 60)

    return "\n".join(parts)
