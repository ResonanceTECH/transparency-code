"""Хранилище оригиналов профиля; проверка контейнера без извлечения фактов/OCR."""

import hashlib
import io
import json
import re
import uuid
import warnings
import zipfile
from pathlib import Path
from xml.etree import ElementTree

from PIL import Image
from pypdf import PdfReader

from app.core.config import get_settings

MIME_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".json": "application/json",
}
DOCUMENT_KINDS = {
    "diploma", "reserve_act", "order", "contract", "act", "letter", "other", "basis", "consent", "photo",
    "result",
}


def safe_name(filename: str | None) -> str:
    name = (filename or "document").replace("\\", "/").rsplit("/", 1)[-1].strip()
    name = re.sub(r"[\x00-\x1f\x7f]", "", name)
    if not name or len(name) > 300:
        raise ValueError("Укажите имя файла длиной до 300 символов")
    return name


def validate_file(data: bytes, name: str, kind: str) -> None:
    if kind not in DOCUMENT_KINDS:
        raise ValueError("Неизвестный вид документа")
    if not data:
        raise ValueError("Файл пуст")
    if len(data) > get_settings().max_upload_mb * 1024 * 1024:
        raise ValueError(f"Файл больше {get_settings().max_upload_mb} МБ")
    extension = Path(name).suffix.lower()
    if kind == "photo":
        allowed = {".png", ".jpg", ".jpeg"}
    elif kind == "consent":
        allowed = {".pdf", ".png", ".jpg", ".jpeg"}
    else:
        allowed = {".pdf", ".docx", ".xlsx", ".json"}
    if extension not in allowed:
        raise ValueError("Недопустимый формат для выбранного вида документа")
    try:
        if extension == ".pdf":
            if not re.match(rb"%PDF-\d\.\d", data[:12]) or b"%%EOF" not in data[-1024:]:
                raise ValueError("Некорректный контейнер PDF")
            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted or not 0 < len(reader.pages) <= 1000:
                raise ValueError("PDF не должен быть защищён паролем и должен содержать страницы")
        elif extension in {".png", ".jpg", ".jpeg"}:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(data)) as image:
                    expected = "PNG" if extension == ".png" else "JPEG"
                    if image.format != expected:
                        raise ValueError("Содержимое изображения не соответствует расширению")
                    if image.width * image.height > 40_000_000:
                        raise ValueError("Изображение слишком большое: не более 40 мегапикселей")
                    image.verify()
                with Image.open(io.BytesIO(data)) as image:
                    image.load()
        elif extension in {".docx", ".xlsx"}:
            required = "word/document.xml" if extension == ".docx" else "xl/workbook.xml"
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                entries = archive.infolist()
                if len(entries) > 2000 or sum(entry.file_size for entry in entries) > 50 * 1024 * 1024:
                    raise ValueError("Слишком большой распакованный контейнер документа")
                if not {"[Content_Types].xml", required}.issubset(archive.namelist()):
                    raise ValueError("В контейнере отсутствуют обязательные части документа")
                for entry in entries:
                    if entry.flag_bits & 1 or "vbaProject" in entry.filename:
                        raise ValueError("Защищённые контейнеры и макросы не поддерживаются")
                # Разбор только корневых XML; не извлекаем ни текст, ни факты.
                for part in ("[Content_Types].xml", required):
                    xml = archive.read(part)
                    if b"<!DOCTYPE" in xml.upper() or b"<!ENTITY" in xml.upper():
                        raise ValueError("Внешние сущности XML не разрешены")
                    ElementTree.fromstring(xml)
                if archive.testzip() is not None:
                    raise ValueError("Повреждённый ZIP-контейнер")
        else:
            json.loads(data.decode("utf-8-sig"))
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("Не удалось прочитать контейнер. Сохраните файл заново") from exc


def store_file(profile_id, data: bytes, name: str) -> tuple[str, str]:
    """У каждого вложения отдельный оригинал; одинаковые имена/байты не перезаписывают его."""
    digest = hashlib.sha256(data).hexdigest()
    key = f"profiles/{profile_id}/{uuid.uuid4().hex}-{digest}{Path(name).suffix.lower()}"
    target = Path(get_settings().upload_dir) / key
    target.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive create: этот путь никогда не заменяет прежние байты.
    with target.open("xb") as handle:
        handle.write(data)
    return key, digest


def stored_path(key: str) -> Path:
    root = Path(get_settings().upload_dir).resolve()
    target = (root / key).resolve()
    if not target.is_relative_to(root):
        raise ValueError("Недопустимый путь оригинала")
    return target


def original_available(key: str) -> bool:
    try:
        return stored_path(key).is_file()
    except (ValueError, OSError):
        return False
