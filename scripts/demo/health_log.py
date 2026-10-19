"""Emit one real application request log without starting a database or scheduler."""

import io
import json
import logging
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

# ปิดการอ่าน .env สำหรับเดโมนี้; ไม่ต้องใช้ credential หรือเปิด test endpoint.
os.environ["PYTHON_DOTENV_DISABLED"] = "1"
os.environ["ENVIRONMENT"] = "production"
os.environ["DEPLOYMENT_TIER"] = "local"
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from app.main import app  # noqa: E402

capture = io.StringIO()
root = logging.getLogger()
for handler in root.handlers:
    handler.setStream(capture)

# ไม่ใช้ context manager เพื่อไม่เรียก lifespan ที่เปิด DB และ daily scheduler.
client = TestClient(app)
try:
    response = client.get("/api/health", headers={"x-request-id": "ws07-demo-health"})
finally:
    client.close()

if response.status_code != 200 or response.json().get("status") != "ok":
    raise SystemExit("Health demo failed")

events = [json.loads(line) for line in capture.getvalue().splitlines()]
request = next(
    event for event in events
    if event.get("event") == "http_request" and event.get("route") == "/api/health"
)
if request["requestId"] != response.headers.get("x-request-id"):
    raise SystemExit("Request correlation failed")
if not isinstance(request["duration_ms"], (int, float)):
    raise SystemExit("Request duration missing")

print(json.dumps(request, ensure_ascii=False))
