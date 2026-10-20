"""POST /api/auth/session — token ที่ตรวจไม่ผ่านต้องไม่เผยรายละเอียดภายในให้ client (WS-08 SEC-03)

ที่มา: ทดสอบปุ่ม Google แบบ redirect บนเครื่อง (2026-10-20) หน้าเว็บแสดง
'ตรวจสอบ id_token ไม่ผ่าน: Unable to find a signing key that matches: "None"'
ซึ่งเป็นข้อความของ PyJWT — บอกผู้โจมตีว่าตรวจตกขั้นไหนและใช้ไลบรารีอะไร
ขัดกับเจตนาใน app/api/auth.py ที่ตั้งใจตอบกว้าง ๆ และเก็บเหตุผลจริงไว้ใน log ฝั่ง server
"""

import logging

import pytest
from fastapi.testclient import TestClient

from app.api import auth as auth_api
from app.google_oidc import GoogleAuthError
from app.main import app

INTERNAL_DETAILS = [
    'ตรวจสอบ id_token ไม่ผ่าน: Unable to find a signing key that matches: "None"',
    "token นี้ไม่ได้ออกให้แอปนี้",
    "อีเมลนี้ยังไม่ได้ยืนยันกับ Google",
]


@pytest.fixture
def client(monkeypatch) -> TestClient:
    monkeypatch.setattr(auth_api, "GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    return TestClient(app)


@pytest.mark.parametrize("detail", INTERNAL_DETAILS)
def test_token_ที่ตรวจไม่ผ่านตอบ_401_ด้วยข้อความกลาง_ไม่เผยเหตุผลภายใน(client, monkeypatch, detail):
    def reject(*_args, **_kwargs):
        raise GoogleAuthError(detail)

    monkeypatch.setattr(auth_api, "verify_id_token", reject)

    res = client.post("/api/auth/session", json={"idToken": "header.payload.signature"})

    assert res.status_code == 401
    error = res.json()["error"]
    assert error["code"] == "INVALID_ID_TOKEN"
    assert detail not in error["message"]
    assert "id_token" not in error["message"]
    assert error["message"] == "ยืนยันบัญชี Google ไม่สำเร็จ กรุณาลองเข้าสู่ระบบอีกครั้ง"


def test_เหตุผลจริงยังอยู่ใน_log_ฝั่ง_server_ให้คนดูแลระบบตามได้(client, monkeypatch, caplog):
    detail = INTERNAL_DETAILS[0]

    def reject(*_args, **_kwargs):
        raise GoogleAuthError(detail)

    monkeypatch.setattr(auth_api, "verify_id_token", reject)

    with caplog.at_level(logging.WARNING, logger="paireval.auth"):
        client.post("/api/auth/session", json={"idToken": "header.payload.signature"})

    rejected = [r for r in caplog.records if getattr(r, "event", None) == "auth_rejected"
                or "auth_rejected" in r.getMessage()]
    assert rejected, "ต้องมี log event auth_rejected"
    assert any(detail in str(vars(r)) for r in rejected)
