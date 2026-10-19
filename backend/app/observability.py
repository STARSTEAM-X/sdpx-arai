"""structured logging ของ backend (WS-07)

ทุกบรรทัดที่ออก stdout เป็น JSON หนึ่ง object — ค้นและรวมสถิติได้ด้วยเครื่อง
(`jq`, log explorer ของ Render) แทนการไล่อ่านข้อความด้วยตา

ใช้ stdlib `logging` ล้วน ไม่เพิ่ม structlog — สิ่งที่ต้องการมีแค่ formatter กับ contextvar
และ log จาก library อื่น (uvicorn, psycopg) ก็ผ่าน formatter ตัวเดียวกันโดยไม่ต้องตั้งอะไรเพิ่ม

กฎความเป็นส่วนตัว (ทดสอบใน tests/unit/test_observability.py):
- ห้ามมี email, token, password, header authorization ใน log ไม่ว่าจะเป็น field หรือปนในข้อความ
- อ้างถึงผู้ใช้ด้วย `user_ref()` — hash ที่ตามรอยคนเดิมข้าม request ได้ แต่ย้อนกลับเป็นอีเมลไม่ได้
"""

import hashlib
import hmac
import json
import logging
import os
import re
import sys
from contextvars import ContextVar
from datetime import UTC, datetime
from time import perf_counter
from typing import Any

from app.config import SESSION_SECRET

REDACTED = "[REDACTED]"

# requestId ของ request ที่กำลังทำงานอยู่ — contextvar แยกค่าตาม task ของ asyncio
# และถูก copy เข้า thread ที่ FastAPI ใช้รัน handler แบบ sync ให้เอง
# log ที่ออกจากที่ไหนก็ได้ระหว่าง request จึงมี requestId ติดมาโดยไม่ต้องส่งต่อเป็น parameter
request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
request_start_var: ContextVar[float | None] = ContextVar("request_start", default=None)

# ชื่อ key ที่ค่าทั้งก้อนถือเป็นความลับ (เทียบแบบไม่สนตัวพิมพ์ และ "มีคำนี้อยู่ในชื่อ")
_SENSITIVE_KEY = re.compile(r"password|passwd|secret|token|authorization|cookie|email|api[_-]?key", re.I)

# pattern ที่หลุดมาในข้อความได้ — เช่น exception message ที่มีอีเมลของผู้ใช้
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_JWT = re.compile(r"eyJ[\w-]+\.[\w-]+\.[\w-]+")
_BEARER = re.compile(r"(?i)\bbearer\s+\S+")


def _scrub(text: str) -> str:
    text = _JWT.sub(REDACTED, text)
    text = _BEARER.sub(f"Bearer {REDACTED}", text)
    return _EMAIL.sub(REDACTED, text)


def redact(value: Any) -> Any:
    """คืนสำเนาที่ลบข้อมูลอ่อนไหวออกแล้ว — ไม่แก้ object ต้นฉบับ"""
    if isinstance(value, dict):
        return {
            k: REDACTED if _SENSITIVE_KEY.search(str(k)) else redact(v) for k, v in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [redact(v) for v in value]
    if isinstance(value, str):
        return _scrub(value)
    return value


def user_ref(email: str | None) -> str | None:
    """ตัวแทนผู้ใช้ใน log — ตามรอยคนเดิมได้ แต่ไม่มีอีเมลอยู่ในค่า

    ใช้ HMAC กับ SESSION_SECRET ไม่ใช่ sha256 เปล่า ๆ เพราะอีเมลนักศึกษาเดาได้
    (รหัสนักศึกษา@kmitl.ac.th) ใครได้ log ไปก็ hash ทุกรหัสแล้วเทียบกลับได้ทันที
    """
    if not email:
        return None
    digest = hmac.new(SESSION_SECRET.encode(), email.encode(), hashlib.sha256).hexdigest()
    return f"u_{digest[:12]}"


class JsonFormatter(logging.Formatter):
    """แปลง LogRecord เป็น JSON หนึ่งบรรทัด

    - log ธรรมดา (`log.warning("...%s", x)`) → event = "log" + message
    - business event (`log_event(...)`) → event = ชื่อ event + field ที่ส่งมา
    ทั้งสองแบบผ่าน redact() ก่อนออกเสมอ
    """

    def format(self, record: logging.LogRecord) -> str:
        started = request_start_var.get()
        line: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "event": getattr(record, "event_name", "log"),
            "requestId": request_id_var.get(),
            # business event วัดเวลาตั้งแต่รับ request จนถึงจุดที่บันทึก event
            "duration_ms": round((perf_counter() - started) * 1000, 1) if started else None,
        }
        fields = getattr(record, "fields", None)
        if fields:
            line.update(fields)
        else:
            line["message"] = record.getMessage()
        if record.exc_info:
            # stack trace จำเป็นตอน debug แต่ข้อความของ exception อาจมีอีเมลผู้ใช้ปน
            # จึงผ่าน redact() พร้อมทั้งบรรทัดด้านล่างเหมือน field อื่น
            line["exception"] = self.formatException(record.exc_info)
        return json.dumps(redact(line), ensure_ascii=False, default=str)


def log_event(logger: logging.Logger, event: str, level: int = logging.INFO, **fields: Any) -> None:
    """บันทึก business event — ชื่อ event เป็น snake_case คงที่ ใช้ค้นและนับได้

    ใช้ `code` ของ error แทนข้อความ เพราะข้อความเปลี่ยนได้ (แปลภาษา แก้คำ) แต่ code ไม่เปลี่ยน
    """
    logger.log(level, event, extra={"event_name": event, "fields": fields})


def configure_logging() -> None:
    """ให้ทุก logger (ของเราและของ library) ออกผ่าน JsonFormatter ไปที่ stdout

    เรียกตอน import app.main — uvicorn ตั้ง logging ของตัวเองก่อน import app
    การตั้งทับตรงนี้จึงชนะเสมอ ไม่ว่าจะรันผ่าน uvicorn CLI, Docker หรือ Render
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())

    for name in ("uvicorn", "uvicorn.error"):
        lg = logging.getLogger(name)
        lg.handlers = []
        lg.propagate = True

    # access log ของ uvicorn เป็นข้อความธรรมดา มี path ที่มี id ปนและ IP ของผู้ใช้
    # middleware ของเราออก log ที่ดีกว่าแทนแล้ว (route pattern + duration_ms + requestId)
    access = logging.getLogger("uvicorn.access")
    access.handlers = []
    access.propagate = False
    access.disabled = True
