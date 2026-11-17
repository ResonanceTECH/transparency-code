"""Контракт documents-домена: upload/pipeline, PATCH факта, confirm-facts, download."""

import io
import json


def _json_file(payload: dict, name: str = "facts.json") -> tuple[str, bytes, str]:
    return name, json.dumps(payload).encode(), "application/json"


SYNTHETIC_FACTS = {
    "synthetic": True,
    "facts": [
        {
            "field": "sale_amount",
            "value": "1450000",
            "object_id": "car-1",
            "date": "2025-10-01",
            "unit": "RUB",
            "snippet": "Доход от продажи 1450000 руб.",
        },
        {"field": "income_declared", "value": "900000", "object_id": "car-1"},
    ],
}


async def _create_case(client) -> str:
    resp = await client.post(
        "/api/cases",
        json={
            "synthetic": True,
            "name": "Тест документов · вымышленное лицо",
            "department": "",
            "basis": "candidate",
            "year": 2025,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _upload(client, case_id: str, name: str, content: bytes, mime: str):
    return await client.post(
        f"/api/cases/{case_id}/documents",
        files={"file": (name, io.BytesIO(content), mime)},
    )


async def test_upload_json_extracts_facts(auth_client):
    case_id = await _create_case(auth_client)
    name, content, mime = _json_file(SYNTHETIC_FACTS)
    resp = await _upload(auth_client, case_id, name, content, mime)
    assert resp.status_code == 201, resp.text
    doc = resp.json()
    assert doc["status"] == "ready" and doc["name"] == name and doc["sha256"]

    detail = (await auth_client.get(f"/api/cases/{case_id}")).json()
    assert len(detail["facts"]) == 2
    fact = next(f for f in detail["facts"] if f["field"] == "sale_amount")
    assert fact["label"] == "Доход от продажи в справке"  # FIELD_LABELS
    assert fact["document_name"] == name
    assert fact["confirmed"] is False
    assert detail["documents"][0]["status"] == "ready"


async def test_upload_dedup_by_sha256(auth_client):
    case_id = await _create_case(auth_client)
    name, content, mime = _json_file(SYNTHETIC_FACTS)
    first = await _upload(auth_client, case_id, name, content, mime)
    second = await _upload(auth_client, case_id, name, content, mime)
    assert first.status_code == 201 and second.status_code == 200
    assert first.json()["id"] == second.json()["id"]


async def test_upload_rejects_bad_inputs(auth_client):
    case_id = await _create_case(auth_client)
    # Неподдерживаемое расширение → 415
    resp = await _upload(auth_client, case_id, "evil.exe", b"MZ", "application/octet-stream")
    assert resp.status_code == 415
    # Пустой файл → 422
    resp = await _upload(auth_client, case_id, "empty.json", b"", "application/json")
    assert resp.status_code == 422
    # Битый JSON → документ failed, не 5xx
    resp = await _upload(auth_client, case_id, "broken.json", b"{not json", "application/json")
    assert resp.status_code == 201
    assert resp.json()["status"] == "failed" and resp.json()["error"]


async def test_upload_non_synthetic_fails(auth_client):
    case_id = await _create_case(auth_client)
    payload = {"synthetic": False, "facts": [{"field": "x", "value": "1"}]}
    resp = await _upload(auth_client, case_id, "real.json", json.dumps(payload).encode(), "application/json")
    assert resp.status_code == 201
    assert resp.json()["status"] == "failed"


async def test_upload_to_foreign_case_404(auth_client, client, db_session):
    resp = await _upload(auth_client, str(__import__("uuid").uuid4()), "a.json", b"{}", "application/json")
    assert resp.status_code == 404


async def test_patch_and_confirm_facts(auth_client, db_session):
    case_id = await _create_case(auth_client)
    _, content, mime = _json_file(SYNTHETIC_FACTS)
    await _upload(auth_client, case_id, "facts.json", content, mime)
    detail = (await auth_client.get(f"/api/cases/{case_id}")).json()
    fact = detail["facts"][0]

    # PATCH: частичное обновление value + confirmed
    resp = await auth_client.patch(
        f"/api/facts/{fact['id']}",
        json={"value": "900000", "confirmed": True},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["value"] == "900000" and resp.json()["confirmed"] is True

    # confirm-facts: остаётся 1 неподтверждённый → confirmed=1
    resp = await auth_client.post(f"/api/cases/{case_id}/confirm-facts")
    assert resp.status_code == 200
    assert resp.json() == {"confirmed": 1}
    detail = (await auth_client.get(f"/api/cases/{case_id}")).json()
    assert all(f["confirmed"] for f in detail["facts"])
    # События: загружен + обработан + поле уточнено + поля подтверждены
    messages = [e["message"] for e in detail["events"]]
    assert any(m.startswith("Документ загружен:") for m in messages)
    assert any(m.startswith("Документ обработан:") for m in messages)
    assert any(m.startswith("Поле уточнено:") for m in messages)
    assert any(m.startswith("Поля подтверждены:") for m in messages)


async def test_patch_fact_validation_and_404(auth_client):
    case_id = await _create_case(auth_client)
    _, content, mime = _json_file(SYNTHETIC_FACTS)
    await _upload(auth_client, case_id, "facts.json", content, mime)
    detail = (await auth_client.get(f"/api/cases/{case_id}")).json()
    fid = detail["facts"][0]["id"]

    resp = await auth_client.patch(f"/api/facts/{fid}", json={"value": ""})
    assert resp.status_code == 422
    resp = await auth_client.patch(f"/api/facts/{fid}", json={"unit": "x" * 31})
    assert resp.status_code == 422
    import uuid as _uuid

    resp = await auth_client.patch(f"/api/facts/{_uuid.uuid4()}", json={"value": "1"})
    assert resp.status_code == 404


async def test_download_document(auth_client, tmp_path, monkeypatch):
    case_id = await _create_case(auth_client)
    name, content, mime = _json_file(SYNTHETIC_FACTS)
    resp = await _upload(auth_client, case_id, name, content, mime)
    doc = resp.json()

    dl = await auth_client.get(f"/api/cases/{case_id}/documents/{doc['id']}")
    assert dl.status_code == 200
    assert dl.content == content
    assert "attachment" in dl.headers.get("content-disposition", "")

    # Несуществующий doc → 404
    import uuid as _uuid

    resp = await auth_client.get(f"/api/cases/{case_id}/documents/{_uuid.uuid4()}")
    assert resp.status_code == 404


async def test_xlsx_and_marker_extraction(auth_client):
    """XLSX с RU-заголовками и PDF-маркерный формат (SPEC §7.4)."""
    from openpyxl import Workbook

    case_id = await _create_case(auth_client)
    wb = Workbook()
    ws = wb.active
    ws.append(["поле", "значение", "объект", "дата", "единица", "фрагмент"])
    ws.append(["sale_amount", "777000", "flat-1", "2025-05-05", "RUB", "Цена квартиры"])
    buf = io.BytesIO()
    wb.save(buf)
    resp = await _upload(auth_client, case_id, "data.xlsx", buf.getvalue(), "application/vnd.ms-excel")
    assert resp.status_code == 201 and resp.json()["status"] == "ready", resp.text

    # PDF с маркерной строкой — минимальный валидный PDF (xref считается)
    pdf_bytes = _make_pdf(
        "field=sale_amount; value=555; object_id=x; date=2025-01-01; unit=RUB"
    )
    resp = await _upload(auth_client, case_id, "doc.pdf", pdf_bytes, "application/pdf")
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "ready", resp.json()

    # DOCX с той же маркерной строкой
    import docx

    document = docx.Document()
    document.add_paragraph(
        "field=obligation_balance; value=300000; object_id=loan-1; unit=RUB"
    )
    buf = io.BytesIO()
    document.save(buf)
    resp = await _upload(auth_client, case_id, "doc.docx", buf.getvalue(),
                         "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "ready", resp.json()

    detail = (await auth_client.get(f"/api/cases/{case_id}")).json()
    by_object = {f["object_id"]: f["value"] for f in detail["facts"]}
    assert by_object["flat-1"] == "777000"
    assert by_object["x"] == "555"
    assert by_object["loan-1"] == "300000"


def _make_pdf(text: str) -> bytes:
    """Минимальный одностраничный PDF с текстом (для pypdf extract_text)."""
    stream = f"BT /F1 12 Tf 50 700 Td ({text}) Tj ET".encode()
    objects = [
        b"<</Type/Catalog/Pages 2 0 R>>",
        b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
        b"<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]"
        b"/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
        b"<</Length " + str(len(stream)).encode() + b">>\nstream\n" + stream + b"\nendstream",
        b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n".encode() + body + b"\nendobj\n")
    xref_pos = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n".encode())
    out.write(b"0000000000 65535 f \n")
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode())
    out.write(
        f"trailer\n<</Size {len(objects) + 1}/Root 1 0 R>>\n"
        f"startxref\n{xref_pos}\n%%EOF".encode()
    )
    return out.getvalue()
