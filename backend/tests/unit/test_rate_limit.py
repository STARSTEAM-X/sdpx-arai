"""FR-API-04 — 120 request/นาที/ผู้ใช้ · ส่งออก 5/นาที · 429 + Retry-After"""
import jwt
from fastapi.testclient import TestClient

from app import main
from app.config import SESSION_SECRET
from app.rate_limit import (
    SlidingWindowLimiter,
    client_key,
    is_exempt,
    is_export,
    retry_after_header,
)


def test_allows_up_to_limit_then_reports_wait():
    limiter = SlidingWindowLimiter(3, window=60)
    assert [limiter.hit("u", now=t) for t in (0, 1, 2)] == [None, None, None]
    assert limiter.hit("u", now=10) == 50  # ครั้งแรกหลุดหน้าต่างที่วินาที 60
    assert limiter.hit("other", now=10) is None  # นับแยกต่อผู้ใช้


def test_window_slides():
    limiter = SlidingWindowLimiter(2, window=60)
    limiter.hit("u", now=0)
    limiter.hit("u", now=30)
    assert limiter.hit("u", now=59) is not None
    assert limiter.hit("u", now=60.5) is None  # ครั้งที่ 0 พ้นหน้าต่างแล้ว


def test_retry_after_is_whole_seconds_at_least_one():
    assert retry_after_header(0.2) == "1"
    assert retry_after_header(41.1) == "42"


def test_key_uses_token_subject_even_if_expired_and_ip_otherwise():
    token = jwt.encode({"sub": "nok@kmitl.ac.th", "exp": 1}, SESSION_SECRET, algorithm="HS256")
    assert client_key(f"Bearer {token}", "1.2.3.4") == "user:nok@kmitl.ac.th"
    assert client_key("Bearer not-a-token", "1.2.3.4") == "ip:1.2.3.4"
    assert client_key(None, None) == "ip:unknown"


def test_export_paths_and_exemptions():
    assert is_export("/api/assignments/a1/reports:export")
    assert is_export("/api/assignments/a1/comparisons:export-identified")
    assert not is_export("/api/assignments/a1/scores")
    assert is_exempt("/api/health") and is_exempt("/api/test/session") and not is_exempt("/api/classrooms")


def test_middleware_answers_429_with_retry_after_and_error_envelope(monkeypatch):
    monkeypatch.setattr(main, "_general_limiter", SlidingWindowLimiter(2))
    monkeypatch.setattr(main, "_export_limiter", SlidingWindowLimiter(1))
    # คำขอที่ผ่านตัวจำกัดจะไปถึง route ที่ต้องใช้ DB (ไม่มีใน unit test) — สนใจแค่ว่าไม่ใช่ 429
    client = TestClient(main.app, raise_server_exceptions=False)
    token = jwt.encode({"sub": "limit@kmitl.ac.th", "exp": 9_999_999_999}, SESSION_SECRET, algorithm="HS256")
    headers = {"authorization": f"Bearer {token}"}
    first = client.get("/api/notifications", headers=headers)
    assert first.status_code != 429
    client.get("/api/notifications", headers=headers)
    blocked = client.get("/api/notifications", headers=headers)
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) >= 1
    assert blocked.json()["error"]["code"] == "RATE_LIMITED"
    assert blocked.headers["x-request-id"] == blocked.json()["error"]["requestId"]
    # health check ไม่ถูกนับ
    assert client.get("/api/health").status_code == 200


def test_export_has_its_own_lower_limit(monkeypatch):
    monkeypatch.setattr(main, "_general_limiter", SlidingWindowLimiter(100))
    monkeypatch.setattr(main, "_export_limiter", SlidingWindowLimiter(1))
    # คำขอที่ผ่านตัวจำกัดจะไปถึง route ที่ต้องใช้ DB (ไม่มีใน unit test) — สนใจแค่ว่าไม่ใช่ 429
    client = TestClient(main.app, raise_server_exceptions=False)
    token = jwt.encode({"sub": "export@kmitl.ac.th", "exp": 9_999_999_999}, SESSION_SECRET, algorithm="HS256")
    headers = {"authorization": f"Bearer {token}"}
    client.post("/api/assignments/x/reports:export", headers=headers, json={"reports": ["GROUP"]})
    second = client.post("/api/assignments/x/reports:export", headers=headers, json={"reports": ["GROUP"]})
    assert second.status_code == 429
    assert "ส่งออกได้ไม่เกิน" in second.json()["error"]["message"]
