"""request log (WS-07) — ทุก request ต้องออก log JSON หนึ่งบรรทัดที่ใช้สืบย้อนได้

ตรวจผ่าน app จริงด้วย TestClient (ไม่ยก lifespan จึงไม่ต้องมี database)
"""

import json
import logging
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.observability import JsonFormatter


@pytest.fixture
def http_log() -> Iterator[list[dict]]:
    """เก็บ log ของ paireval.http ที่ผ่าน JsonFormatter จริง — เห็นสิ่งเดียวกับที่ไปถึง stdout"""
    lines: list[dict] = []

    class Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            lines.append(json.loads(JsonFormatter().format(record)))

    logger = logging.getLogger("paireval.http")
    handler = Capture()
    logger.addHandler(handler)
    try:
        yield lines
    finally:
        logger.removeHandler(handler)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _requests(lines: list[dict]) -> list[dict]:
    return [line for line in lines if line["event"] == "http_request"]


def test_request_ปกติได้_log_ครบทุก_field(client: TestClient, http_log: list[dict]):
    res = client.get("/api/health")

    [line] = _requests(http_log)
    assert line["method"] == "GET"
    assert line["route"] == "/api/health"
    assert line["statusCode"] == 200
    assert isinstance(line["duration_ms"], (int, float))
    assert line["requestId"] == res.headers["x-request-id"]


def test_ใช้_route_pattern_ไม่ใช่_path_ที่มี_id(client: TestClient, http_log: list[dict]):
    """path จริงมี id ของห้องเรียนปน — รวมสถิติไม่ได้และเป็นข้อมูลที่ไม่ควรอยู่ใน log"""
    client.get("/api/classrooms/7b0c1d2e-0000-4000-8000-000000000001/roster")

    [line] = _requests(http_log)
    assert line["route"] == "/api/classrooms/{classroom_id}/roster"
    assert "7b0c1d2e" not in json.dumps(line)


def test_ใช้_request_id_ที่_client_ส่งมาต่อ(client: TestClient, http_log: list[dict]):
    """correlation id ข้าม service — frontend หรือ load balancer ส่งมาแล้วต้องใช้ตัวเดิม"""
    res = client.get("/api/health", headers={"x-request-id": "trace-abc-123"})

    assert res.headers["x-request-id"] == "trace-abc-123"
    assert _requests(http_log)[0]["requestId"] == "trace-abc-123"


# ค่าใน header ต้องเป็น ASCII (http client ไม่ยอมส่งอย่างอื่น) — ใช้อักขระที่ ASCII มีแต่ไม่ควรอยู่ใน id
@pytest.mark.parametrize("bad", ["x" * 200, '{"event":"fake"}', "a b"])
def test_request_id_ที่ผิดรูปไม่ถูกใช้_กัน_log_injection(client: TestClient, http_log: list[dict], bad: str):
    res = client.get("/api/health", headers={"x-request-id": bad})

    assert res.headers["x-request-id"] != bad
    assert _requests(http_log)[0]["requestId"] == res.headers["x-request-id"]


def test_error_envelope_กับ_log_ใช้_request_id_เดียวกัน(client: TestClient, http_log: list[dict]):
    """ผู้ใช้แจ้ง requestId จากหน้าจอ error มา → ต้องหาบรรทัดนั้นใน log เจอ"""
    res = client.get("/api/classrooms")

    assert res.status_code == 401
    assert res.json()["error"]["requestId"] == _requests(http_log)[0]["requestId"]


def test_request_ที่_error_มี_code_ใน_log(client: TestClient, http_log: list[dict]):
    """นับ error ตามชนิดจาก log ได้โดยไม่ต้อง parse ข้อความภาษาไทย"""
    client.get("/api/classrooms")

    [line] = _requests(http_log)
    assert line["statusCode"] == 401
    assert line["errorCode"] == "UNAUTHENTICATED"


def test_token_ใน_header_ไม่หลุดเข้า_log(client: TestClient, http_log: list[dict]):
    secret = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4QHkuY28ifQ.c2lnbmF0dXJl"
    client.get("/api/classrooms", headers={"authorization": f"Bearer {secret}"})

    dumped = json.dumps(http_log, ensure_ascii=False)
    assert secret not in dumped
    assert "x@y.co" not in dumped
