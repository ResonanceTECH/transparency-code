"""Generate synthetic frontend sample data and real PDF files.

No third-party dependencies. Run from anywhere:
    python tools/generate_samples.py
"""

import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parent
HAKATHON = FRONTEND.parent.parent
TARGETS = [FRONTEND / "public" / "samples"]
EXPORT = HAKATHON / "front" / "public" / "samples"
if EXPORT.parent.exists():
    TARGETS.append(EXPORT)

DOCS = [
    ("Диплом_переподготовка.pdf", "Диплом о профессиональной переподготовке"),
    ("Акт_включение_в_резерв.pdf", "Акт о включении в федеральный кадровый резерв"),
    ("Приказ_назначение.pdf", "Приказ о назначении на должность"),
    ("Приказ_единовременная.pdf", "Основание единовременной выплаты"),
    ("Решение_компенсация.pdf", "Решение о компенсации в связи с родственником"),
    ("Решение_члену_семьи.pdf", "Решение о выплате супруге за резервиста"),
    ("Письмо_фонда.pdf", "Письмо фонда о натуральной помощи"),
    ("Решение_жилищная_очередь.pdf", "Решение о постановке в жилищную очередь"),
    ("Договор_преподавание.pdf", "Договор на преподавательскую деятельность"),
    ("Решение_региональная_поддержка_демо.pdf", "Решение о региональной поддержке"),
    ("Подтверждающий_документ_результата.pdf", "Подтверждающее основание результата рассмотрения"),
]

CYRILLIC = {
    "А": "A", "Б": "B", "В": "V", "Г": "G", "Д": "D", "Е": "E", "Ё": "E", "Ж": "Zh", "З": "Z",
    "И": "I", "Й": "Y", "К": "K", "Л": "L", "М": "M", "Н": "N", "О": "O", "П": "P", "Р": "R",
    "С": "S", "Т": "T", "У": "U", "Ф": "F", "Х": "Kh", "Ц": "Ts", "Ч": "Ch", "Ш": "Sh", "Щ": "Sch",
    "Ъ": "", "Ы": "Y", "Ь": "", "Э": "E", "Ю": "Yu", "Я": "Ya",
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z",
    "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
    "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def ascii_text(value: str) -> str:
    value = "".join(CYRILLIC.get(char, char) for char in value)
    return "".join(char if 32 <= ord(char) < 127 else "?" for char in value)


def pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def make_pdf(title: str, lines: list[str]) -> bytes:
    title_ascii = ascii_text(title)
    content_lines = [f"BT /F1 18 Tf 72 760 Td ({pdf_escape(title_ascii)}) Tj"]
    content_lines.append("/F1 11 Tf")
    y = 730
    for line in ["RESONANCE - SYNTHETIC DESIGN SAMPLE", *lines]:
        content_lines.append(f"0 -22 Td ({pdf_escape(ascii_text(line))}) Tj")
    content_lines.append("ET")
    stream = "\n".join(content_lines)

    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(stream.encode('ascii'))} >>\nstream\n{stream}\nendstream",
    ]

    body = "%PDF-1.4\n"
    offsets: list[int] = []
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(body.encode("ascii")))
        body += f"{index} 0 obj\n{obj}\nendobj\n"
    xref = len(body.encode("ascii"))
    body += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    for offset in offsets:
        body += f"{offset:010d} 00000 n \n"
    body += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF"
    return body.encode("ascii")


def make_data():
    return {
        "synthetic": True,
        "design_mockup": True,
        "profile": {
            "id": "РВ-2026-0147",
            "person": {
                "full_name": "Ковалёв Алексей Сергеевич",
                "birth_year": 1987,
                "phone": "+7 (000) 000-01-47",
                "email": "kovalev@reservist.example",
                "region": "Липецкая область",
            },
            "program": {
                "name": "Герои Липецкой земли",
                "year": 2025,
                "flow": "Первый поток",
                "program_year": 2024,
            },
            "service_periods": [
                {"kind": "Военная служба", "category": "Старший офицерский состав", "from": "2023-06-01", "to": "2025-08-31"},
                {"kind": "Иное место работы", "organization": "Учебный центр «Регион»", "from": "2025-09-01", "to": None},
            ],
            "kinship": {
                "has_relative": True,
                "relative": "Ковалёв Сергей Петрович",
                "degree": "Родитель",
                "status": "Участвовал",
            },
            "payments": [
                {"category": "Денежное довольствие", "amount": "1 200 000", "basis": "Приказ о назначении", "period": "2023-06-01/2025-08-31"},
                {"category": "Надбавки", "amount": "150 000", "basis": "Назначение Н-42", "period": "2025"},
                {"category": "Единовременная выплата", "amount": "150 000", "basis": "Назначение Н-42", "payment_date": "2025-09-18"},
                {"category": "Компенсация за родственника", "amount": "320 000", "basis": "Решение № К-24", "period": "2025-04"},
                {"category": "Выплата супруге", "amount": "120 000", "recipient": "Ковалёва Мария Андреевна"},
            ],
            "signals": [
                {"code": "РО-01", "title": "Основание выплаты за родственника уточнено"},
                {"code": "ДУ-01", "title": "Возможный повторный учёт Н-42"},
                {"code": "ДЕ-01", "title": "Период преподавания пересекается со службой"},
            ],
        }
    }


def main():
    for target in TARGETS:
        target.mkdir(parents=True, exist_ok=True)
        manifest = []
        for name, title in DOCS:
            payload = make_pdf(title, [
                f"File: {name}",
                "All persons, sums and documents are fictional.",
                "Not an official authority document. No OCR was used.",
            ])
            (target / name).write_bytes(payload)
            manifest.append({
                "name": name,
                "title": title,
                "size": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
            })
        (target / "documents.json").write_text(
            json.dumps({"synthetic": True, "documents": manifest}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        (target / "profile.json").write_text(
            json.dumps(make_data(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Generated {len(DOCS)} PDFs + 2 JSON files in {target}")


if __name__ == "__main__":
    main()
