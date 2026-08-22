"""test แรกของ project — ยืนยันว่า health endpoint ทำงานตามสัญญา

/api/health ไม่ใช่ endpoint ธรรมดา มันถูกใช้เป็นด่านตรวจใน 3 ที่:
Render healthCheckPath, HEALTHCHECK ของ Docker (WS-05) และตรวจ staging ก่อนยิง load (WS-07)
ถ้ารูปแบบ response เปลี่ยนโดยไม่ตั้งใจ ทั้งสามที่จะพังเงียบ ๆ
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ตอบ_200():
    assert client.get("/api/health").status_code == 200


def test_health_มี_status_ok():
    assert client.get("/api/health").json()["status"] == "ok"


def test_health_มี_version_เสมอ():
    """version ใช้ระบุว่า commit ไหนกำลังรันอยู่ — ขาดไม่ได้เพราะใช้วัด commit-to-live"""
    body = client.get("/api/health").json()
    assert "version" in body
    assert body["version"] != ""
