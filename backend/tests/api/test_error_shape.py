"""ทุก error ของ API ต้องมีรูปแบบเดียวกัน — FR-API-03

ที่มาของ test ชุดนี้: ตอน login จริงครั้งแรก หน้าเว็บขึ้นแค่ "เกิดข้อผิดพลาด (HTTP 401)"
แทนที่จะบอกเหตุผล เพราะ HTTPException ของ FastAPI คืน {"detail": ...}
ซึ่งไม่ตรงกับ ErrorEnvelope ที่ประกาศไว้ใน docs/openapi.yaml
frontend จึงอ่าน code กับ message ไม่ออกและต้องใช้ข้อความ fallback

test พวกนี้จะแดงทันทีถ้ามีใครเพิ่ม endpoint ที่คืน error รูปแบบอื่น
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

REQUIRED_KEYS = {"code", "message", "field", "requestId"}


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def assert_error_envelope(body: dict) -> dict:
    """ตรวจว่า response เป็น ErrorEnvelope ตามสัญญา แล้วคืน error object ออกมา"""
    assert "error" in body, f"ต้องมี key 'error' ที่ระดับบนสุด แต่ได้ {list(body)}"
    assert "detail" not in body, "ห้ามมี 'detail' หลุดออกมา — แปลว่าไม่ได้ผ่าน handler กลาง"

    err = body["error"]
    assert REQUIRED_KEYS <= err.keys(), f"ขาด key {REQUIRED_KEYS - err.keys()}"
    assert err["code"], "code ห้ามว่าง — เครื่องต้องใช้ค่านี้ตัดสินใจ"
    assert err["message"], "message ห้ามว่าง — คนต้องอ่านค่านี้"
    return err


class TestUnauthenticated:
    def test_ไม่แนบ_token_ได้_ErrorEnvelope(self, client: TestClient):
        res = client.get("/api/classrooms")

        assert res.status_code == 401
        err = assert_error_envelope(res.json())
        assert err["code"] == "UNAUTHENTICATED"

    def test_token_ผิดรูปแบบได้_ErrorEnvelope(self, client: TestClient):
        # ค่าใน HTTP header ต้องเป็น ASCII เท่านั้น จึงใช้ข้อความอังกฤษเป็นขยะแทน
        res = client.get("/api/classrooms", headers={"authorization": "Bearer garbage"})

        assert res.status_code == 401
        assert_error_envelope(res.json())

    def test_ไม่มีคำว่า_Bearer_ได้_ErrorEnvelope(self, client: TestClient):
        res = client.get("/api/classrooms", headers={"authorization": "Basic abc"})

        assert res.status_code == 401
        assert_error_envelope(res.json())


class TestNotFound:
    def test_path_ที่ไม่มีอยู่ได้_ErrorEnvelope(self, client: TestClient):
        """404 ที่ FastAPI สร้างเองก็ต้องผ่าน handler กลางเหมือนกัน"""
        res = client.get("/api/ไม่มีทางมี")

        assert res.status_code == 404
        err = assert_error_envelope(res.json())
        assert err["code"] == "NOT_FOUND"


class TestValidation:
    def test_body_ผิด_schema_ได้_ErrorEnvelope_พร้อมชื่อ_field(self, client: TestClient):
        res = client.post("/api/auth/session", json={})

        assert res.status_code == 422
        err = assert_error_envelope(res.json())
        assert err["code"] == "VALIDATION_FAILED"
        assert err["field"] == "idToken", "ต้องบอกได้ว่า field ไหนผิด"


class TestRequestId:
    def test_error_พก_requestId_ที่ตรงกับ_header(self, client: TestClient):
        res = client.get("/api/classrooms", headers={"x-request-id": "test-req-123"})

        err = assert_error_envelope(res.json())
        assert err["requestId"] == "test-req-123"
        assert res.headers["x-request-id"] == "test-req-123"

    def test_ไม่ส่ง_requestId_มาระบบสร้างให้เอง(self, client: TestClient):
        err = assert_error_envelope(client.get("/api/classrooms").json())

        assert err["requestId"] not in ("", "unknown")
