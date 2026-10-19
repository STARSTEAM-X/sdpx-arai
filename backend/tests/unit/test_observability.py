"""structured logging (WS-07) — log ต้องเป็น JSON ที่เครื่องอ่านได้ และต้องไม่มีข้อมูลส่วนบุคคล

กฎที่ test ชุดนี้ป้องกัน:
- ทุกบรรทัดเป็น JSON หนึ่ง object มี `event` และ `requestId` เสมอ
- email / token / password / authorization ไม่หลุดออกไปไม่ว่าจะมาในรูป field หรือปนอยู่ในข้อความ
"""

import json
import logging

import pytest

from app.observability import (
    REDACTED,
    JsonFormatter,
    log_event,
    redact,
    request_id_var,
    user_ref,
)

SAMPLE_JWT = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJzdWIiOiJzdHUxQGttaXRsLmFjLnRoIn0."
    "Zm9vYmFyYmF6cXV4"
)


class TestRedact:
    @pytest.mark.parametrize(
        "key",
        ["password", "token", "accessToken", "idToken", "authorization", "email", "session_secret", "Cookie"],
    )
    def test_key_อ่อนไหวถูกแทนทั้งค่า(self, key: str):
        assert redact({key: "anything"}) == {key: REDACTED}

    def test_email_ที่ปนอยู่ในข้อความถูกลบ(self):
        out = redact({"message": "ไม่พบผู้ใช้ stu1@kmitl.ac.th ในห้องนี้"})

        assert "stu1@kmitl.ac.th" not in out["message"]
        assert "ไม่พบผู้ใช้" in out["message"]

    def test_jwt_ที่ปนอยู่ในข้อความถูกลบ(self):
        out = redact({"note": f"token ที่ได้คือ {SAMPLE_JWT}"})

        assert SAMPLE_JWT not in out["note"]

    def test_bearer_header_ที่ปนอยู่ในข้อความถูกลบ(self):
        out = redact({"note": "Authorization: Bearer abc.def-123"})

        assert "abc.def-123" not in out["note"]

    def test_ลงไปถึง_dict_และ_list_ซ้อน(self):
        out = redact({"users": [{"email": "a@b.co", "role": "OWNER"}]})

        assert out == {"users": [{"email": REDACTED, "role": "OWNER"}]}

    def test_ค่าที่ไม่ใช่ข้อความไม่ถูกแตะ(self):
        assert redact({"duration_ms": 12.5, "statusCode": 200, "ok": True}) == {
            "duration_ms": 12.5,
            "statusCode": 200,
            "ok": True,
        }


class TestUserRef:
    def test_ไม่มีอีเมลอยู่ในค่า_แต่คนเดียวกันได้ค่าเดิม(self):
        ref = user_ref("stu1@kmitl.ac.th")

        assert "@" not in ref and "stu1" not in ref
        assert ref == user_ref("stu1@kmitl.ac.th")
        assert ref != user_ref("stu2@kmitl.ac.th")

    def test_ไม่มีผู้ใช้ได้_None(self):
        assert user_ref(None) is None


def _format(record_factory) -> dict:
    formatter = JsonFormatter()
    return json.loads(formatter.format(record_factory()))


class TestJsonFormatter:
    def _record(self, msg: str, *args, extra: dict | None = None) -> logging.LogRecord:
        logger = logging.getLogger("paireval.test")
        record = logger.makeRecord("paireval.test", logging.INFO, __file__, 1, msg, args, None)
        for key, value in (extra or {}).items():
            setattr(record, key, value)
        return record

    def test_log_ธรรมดากลายเป็น_JSON_ที่มี_event_และ_requestId(self):
        token = request_id_var.set("req-123")
        try:
            line = _format(lambda: self._record("ดึง JWKS ไม่ได้: %s", "timeout"))
        finally:
            request_id_var.reset(token)

        assert line["event"] == "log"
        assert line["requestId"] == "req-123"
        assert line["level"] == "info"
        assert line["message"] == "ดึง JWKS ไม่ได้: timeout"
        assert "ts" in line

    def test_นอก_request_ได้_requestId_เป็น_None(self):
        line = _format(lambda: self._record("startup"))

        assert line["requestId"] is None

    def test_email_ใน_argument_ของ_log_ธรรมดาถูกลบ(self):
        line = _format(lambda: self._record("ปฏิเสธ %s", "stu1@kmitl.ac.th"))

        assert "stu1@kmitl.ac.th" not in json.dumps(line, ensure_ascii=False)

    def test_field_ของ_business_event_ถูก_redact(self):
        line = _format(
            lambda: self._record(
                "comparison_saved",
                extra={"event_name": "comparison_saved", "fields": {"email": "x@y.z", "choice": 3}},
            )
        )

        assert line["event"] == "comparison_saved"
        assert line["choice"] == 3
        assert line["email"] == REDACTED


class TestLogEvent:
    def test_ส่ง_event_ผ่าน_logger_จริงแล้วได้_JSON_ครบ(self):
        logger = logging.getLogger("paireval.test.event")
        captured: list[str] = []

        class Capture(logging.Handler):
            def emit(self, record: logging.LogRecord) -> None:
                captured.append(JsonFormatter().format(record))

        handler = Capture()
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        try:
            log_event(logger, "assignment_published", assignmentId="a-1", pairsCreated=42)
        finally:
            logger.removeHandler(handler)

        line = json.loads(captured[0])
        assert line["event"] == "assignment_published"
        assert line["assignmentId"] == "a-1"
        assert line["pairsCreated"] == 42
