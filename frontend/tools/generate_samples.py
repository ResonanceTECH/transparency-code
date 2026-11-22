"""Generate synthetic frontend sample data and real PDF files.

No third-party dependencies. Run from anywhere:
    python tools/generate_samples.py
"""

import hashlib
import json
import textwrap
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parent
TARGETS = [FRONTEND / "public" / "samples"]

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
    ("Согласие_ПДн_учебный.pdf", "Учебный пример подписанного согласия на обработку ПДн"),
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
    content_lines = ["BT /F1 12 Tf 48 790 Td (RESONANCE - SYNTHETIC DESIGN SAMPLE) Tj", "/F1 10 Tf"]
    for line in [title, *lines]:
        for part in textwrap.wrap(ascii_text(line), width=85):
            content_lines.append(f"0 -20 Td ({pdf_escape(part)}) Tj")
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


def make_data(manifest):
    # Этот JSON импортируется интерфейсом: формы и печать не имеют второй копии демо-данных.
    lookup = {item["name"]: item for item in manifest}
    sections = ["Программа «Время героев»", "Акт о включении в резерв", "Довольствие и надбавки",
                "Единовременная выплата · при наличии", "Выплата за родственника", "Выплата члену семьи",
                "Материальная помощь", "Жилищная мера", "Дополнительная деятельность"]
    ids = ["diploma", "reserve", "order", "one-time", "insurance", "family", "aid", "housing", "activity"]
    attachments = [dict(id="sample-" + id_, name=name, url="/samples/" + name,
                        size=lookup[name]["size"], format="pdf", section=section, kind="basis", origin="sample")
                   for (name, _), id_, section in zip(DOCS[:9], ids, sections)]
    profile = {
        "candidate": {
            "fullName": "Ковалёв Алексей Сергеевич", "birthYear": "1987",
            "workplace": "Учебный центр «Регион»", "workStatus": "Находится в запасе",
            "phone": "+7 (000) 000-01-47", "email": "kovalev@reservist.example",
            "reportingPeriod": "2023–2026", "region": "Липецкая область", "flow": "Первый поток",
            "programYear": "2024", "regionalProgram": "Герои Липецкой земли", "regionalProgramYear": "2025",
            "appointmentAuthority": "ОИВ субъекта Российской Федерации", "organizer": "Учебный центр «Резерв»",
            "diplomaDetails": "ДП-2024-0147 от 20.12.2024", "reserveActDetails": "№ 147-Р от 14.09.2025",
            "diplomaDocumentId": "sample-diploma", "reserveActDocumentId": "sample-reserve",
        },
        "servicePeriods": [
            dict(id="service-military", kind="Военная служба", category="Старший офицерский состав",
                 organization="Учебное ведомство", start="2023-06-01", end="2025-08-31"),
            dict(id="service-work", kind="Иное", category="Не применяется",
                 organization="Учебный центр «Регион»", start="2025-09-01", end=""),
        ],
        "relativeAnswer": "Да",
        "kinship": dict(fullName="Ковалёв Сергей Петрович", degree="Родитель", status="Участвовал", receivedPayments="Да"),
        "familyRecipients": [dict(id="recipient-spouse", fullName="Ковалёва Мария Андреевна", relation="Супруга", year="1989")],
        "categoryAnswers": {str(i): "Нет" if i in (5, 9) else "Планируется" if i == 8 else "Да" for i in range(10)},
        "supportLevels": {"Федеральный": "Нет", "Региональный": "Да", "Муниципальный": "Нет"},
        "personalInsuranceAnswer": "Нет",
        "records": {
            "0": [dict(id="payment-allowance", title="Денежное довольствие", amount="1 200 000",
                       basis="Приказ о назначении на должность", periodFrom="2023-06-01", periodTo="2025-08-31",
                       payer="Учебное ведомство", recipient="Ковалёв Алексей Сергеевич", documentId="sample-order")],
            "1": [dict(id="payment-extra", title="Дополнительная выплата по назначению Н-42", amount="150 000",
                       basis="Учебный приказ о назначении · приложение № 2", periodFrom="2023-06-01", periodTo="2025-08-31",
                       payer="Учебное ведомство", recipient="Ковалёв Алексей Сергеевич", assignmentId="Н-42", documentId="sample-order")],
            "2": [dict(id="payment-onetime", title="Единовременная выплата по назначению Н-42", eventKind="Завершение периода службы",
                       eventDate="2025-08-31", recipientKind="Сам резервист", recipient="Ковалёв Алексей Сергеевич",
                       amount="150 000", payer="Учебное ведомство", basis="Учебный акт № 42 · редакция от 01.06.2025",
                       periodFrom="2023-06-01", periodTo="2025-08-31", paymentDate="2025-09-18", assignmentId="Н-42", documentId="sample-one-time")],
            "3": [dict(id="payment-support", level="Региональный", authority="Учебный региональный орган",
                       title="Региональная мера поддержки участника", code="РМ-17", paymentDate="2025-04-11",
                       recipient="Ковалёв Алексей Сергеевич", amount="120 000", basis="Учебное решение № РМ-17", documentId="")],
            "4": [dict(id="payment-insurance", title="Компенсация по решению органа", recipientKind="Резервист за родственника",
                       recipient="Ковалёв Алексей Сергеевич", basisType="За личное участие", basis="Решение № К-24 от 24.04.2025",
                       paymentDate="2025-04-30", periodFrom="2025-04-01", periodTo="2025-04-30", amount="320 000", documentId="sample-insurance")],
            "5": [],
            "6": [dict(id="payment-family", title="Выплата супруге за резервиста", recipientId="recipient-spouse",
                       amount="120 000", basis="Учебное решение о выплате члену семьи", paymentDate="2025-05-12", documentId="sample-family")],
            "7": [dict(id="payment-aid", title="Помощь для учебной и экспертной деятельности", form="Натуральная",
                       organization="Учебный фонд «Поддержка»", recipient="Ковалёв Алексей Сергеевич",
                       description="Ноутбук для учебной деятельности", basis="Учебное письмо фонда № Ф-12", documentId="sample-aid")],
            "8": [dict(id="payment-housing", expectedYear="", title="В очереди · получение планируется",
                       basis="Учебное решение № Ж-09 от 31.10.2026", housingKind="Субсидия", decisionDate="2024-10-02",
                       acquisitionDate="2024-11-12", documentId="sample-housing")],
            "9": [],
        },
        "activityAnswer": "Да",
        "activities": [dict(id="activity-teaching", organization="Учебный университет", kind="Преподавание",
                            engagement="Гражданско-правовой договор", periodFrom="2025-04-01", periodTo="2025-06-30",
                            basis="Договор № П-18/25 от 24.03.2025", documentId="sample-activity")],
        "attachments": attachments, "consentDocumentId": "", "photo": None,
    }
    return dict(synthetic=True, design_mockup=True, profile_id="РВ-2026-0147", profile=profile)


def main():
    for target in TARGETS:
        target.mkdir(parents=True, exist_ok=True)
        manifest = []
        for name, title in DOCS:
            payload = make_pdf(title, [
                f"File: {name}",
                "All persons, sums and documents are fictional.",
                "Not an official authority document. No OCR was used.",
                *( ["Demo signature: SYNTHETIC ONLY. Not an actual consent or signature.",
                    "For a real submission use the operator's approved consent form."] if "Согласие" in name else [] ),
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
            json.dumps(make_data(manifest), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Generated {len(DOCS)} PDFs + 2 JSON files in {target}")


if __name__ == "__main__":
    main()
