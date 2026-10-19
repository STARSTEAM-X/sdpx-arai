"""ด่านของ /api/test/* (WS-07) — staging เปิดได้เฉพาะคนที่ถือ token เท่านั้น

staging อยู่บน internet เหมือน production แต่ k6 ต้องขอ session ของนักศึกษาได้
จึงเปิด endpoint ชุดนี้บน staging โดยต้องแนบ X-Test-Support-Token ที่ตรงกับค่าใน env
ตอบ 404 เมื่อไม่ผ่าน (ไม่ใช่ 401/403) — คนนอกต้องแยกไม่ออกว่ามี endpoint นี้อยู่จริง
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import test_support
from app.api.test_support import allow_test_support

TOKEN = "t" * 40


class TestDecision:
    def test_production_ปิดเสมอแม้ส่ง_token_ถูก(self):
        assert not allow_test_support("production", configured=TOKEN, presented=TOKEN)

    @pytest.mark.parametrize("env", ["development", "test"])
    def test_เครื่อง_dev_และ_CI_ไม่ต้องใช้_token(self, env: str):
        assert allow_test_support(env, configured="", presented=None)

    def test_staging_token_ตรงกันผ่าน(self):
        assert allow_test_support("staging", configured=TOKEN, presented=TOKEN)

    @pytest.mark.parametrize("presented", [None, "", "wrong", TOKEN + "x"])
    def test_staging_token_ผิดหรือไม่ส่งไม่ผ่าน(self, presented: str | None):
        assert not allow_test_support("staging", configured=TOKEN, presented=presented)

    def test_staging_ที่ไม่ได้ตั้ง_token_ปิดเสมอ(self):
        """ลืมตั้งค่า = ปิด ไม่ใช่เปิด — ไม่งั้น token ว่างจะเทียบกับ header ว่างแล้วผ่าน"""
        assert not allow_test_support("staging", configured="", presented="")

    def test_staging_token_สั้นกว่า_32_ตัวถือว่าไม่ได้ตั้ง(self):
        assert not allow_test_support("staging", configured="short", presented="short")

    def test_environment_ที่ไม่รู้จักปิดไว้ก่อน(self):
        assert not allow_test_support("prod", configured=TOKEN, presented=TOKEN)


@pytest.fixture
def staging_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(test_support, "ENVIRONMENT", "staging")
    monkeypatch.setattr(test_support, "TEST_SUPPORT_TOKEN", TOKEN)
    app = FastAPI()
    app.include_router(test_support.router)
    return TestClient(app)


class TestRouterGuard:
    def test_staging_ไม่แนบ_token_ได้_404(self, staging_client: TestClient):
        res = staging_client.post("/api/test/session", json={"email": "a@uni.ac.th"})

        assert res.status_code == 404

    def test_staging_แนบ_token_ผิดได้_404(self, staging_client: TestClient):
        res = staging_client.post(
            "/api/test/cleanup", headers={"X-Test-Support-Token": "wrong"}
        )

        assert res.status_code == 404

    def test_staging_แนบ_token_ถูกผ่านด่านไปถึง_validation(self, staging_client: TestClient):
        """body ผิดรูปได้ 422 = ผ่านด่าน token แล้ว (ไม่ต้องมี database ก็พิสูจน์ได้)"""
        res = staging_client.post(
            "/api/test/session",
            headers={"X-Test-Support-Token": TOKEN},
            json={"email": "not-an-email"},
        )

        assert res.status_code == 422
