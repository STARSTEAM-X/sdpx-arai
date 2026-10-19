"""Gmail API client (GAP-03) — ไม่ต่อ internet จริง ใช้ opener ปลอมแทน urllib.request.urlopen"""
import base64
import email
import io
import json
import urllib.error
from datetime import UTC, datetime
from email.header import decode_header, make_header

import pytest

from app.email_worker import render_email
from app.gmail_sender import GmailAuthError, GmailSender, GmailSendError, build_message


class FakeOpener:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.requests = []

    def __call__(self, request, timeout):
        self.requests.append(request)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return io.BytesIO(json.dumps(response).encode())


def http_error(code):
    return urllib.error.HTTPError("https://example.invalid", code, "x", {}, io.BytesIO(b'{"secret":"leak"}'))


def sent_message(request):
    raw = json.loads(request.data)["raw"]
    return email.message_from_bytes(base64.urlsafe_b64decode(raw))


def test_send_refreshes_token_once_and_reuses_it_until_near_expiry():
    clock = [0.0]
    opener = FakeOpener({"access_token": "a1", "expires_in": 3600}, {}, {},
                        {"access_token": "a2", "expires_in": 3600}, {})
    sender = GmailSender("cid", "csecret", "rtoken", opener=opener, clock=lambda: clock[0])
    message = build_message(to="s@example.com", subject="หัวข้อ", body="เนื้อหา")
    sender.send(message)
    sender.send(message)
    clock[0] = 3600 - 30  # เหลือไม่ถึง margin 60 วินาที → ขอใหม่
    sender.send(message)
    urls = [r.full_url for r in opener.requests]
    assert urls.count("https://oauth2.googleapis.com/token") == 2
    assert [r.get_header("Authorization") for r in opener.requests if "gmail" in r.full_url] == [
        "Bearer a1", "Bearer a1", "Bearer a2"]
    assert b"grant_type=refresh_token" in opener.requests[0].data


def test_thai_subject_and_body_survive_mime_round_trip():
    opener = FakeOpener({"access_token": "a", "expires_in": 3600}, {})
    GmailSender("c", "s", "r", opener=opener).send(
        build_message(to="s@example.com", subject="[PairEval] เปิดให้ประเมินแล้ว", body="ลิงก์ในระบบ",
                      sender="bot@gmail.com"))
    parsed = sent_message(opener.requests[1])
    assert str(make_header(decode_header(parsed["Subject"]))) == "[PairEval] เปิดให้ประเมินแล้ว"
    assert parsed["To"] == "s@example.com"
    assert "PairEval" in parsed["From"] and "bot@gmail.com" in parsed["From"]
    assert parsed.get_payload(decode=True).decode("utf-8").strip() == "ลิงก์ในระบบ"


def test_without_sender_from_is_left_for_gmail_to_fill():
    assert build_message(to="s@example.com", subject="x", body="y")["From"] is None


@pytest.mark.parametrize("code", [400, 401])
def test_revoked_refresh_token_is_auth_error_without_response_body(code):
    sender = GmailSender("c", "s", "r", opener=FakeOpener(http_error(code)))
    with pytest.raises(GmailAuthError) as caught:
        sender.send(build_message(to="a@example.com", subject="x", body="y"))
    assert "leak" not in str(caught.value)


def test_send_failure_is_per_message_error_and_401_forces_new_token():
    opener = FakeOpener({"access_token": "a1", "expires_in": 3600}, http_error(401),
                        {"access_token": "a2", "expires_in": 3600}, {})
    sender = GmailSender("c", "s", "r", opener=opener)
    message = build_message(to="a@example.com", subject="x", body="y")
    with pytest.raises(GmailSendError):
        sender.send(message)
    sender.send(message)
    assert opener.requests[-1].get_header("Authorization") == "Bearer a2"


def test_network_failure_is_send_error():
    sender = GmailSender("c", "s", "r", opener=FakeOpener(urllib.error.URLError("down")))
    with pytest.raises(GmailSendError):
        sender.send(build_message(to="a@example.com", subject="x", body="y"))


@pytest.mark.parametrize("kind", ["published", "regenerated", "due", "finalized", "assigned", "appeal",
                                  "auto_finalize"])
def test_every_kind_renders_a_direct_link_and_no_score(kind):
    event = {"kind": kind, "assignment_id": "a-1", "classroom_id": "c-1", "assignment_name": "Sprint 3",
             "classroom_name": "SDPX", "event_key": "k", "occurred_at": datetime(2026, 10, 20, tzinfo=UTC),
             "deadline": datetime(2026, 10, 22, tzinfo=UTC), "timezone": "Asia/Bangkok", "assigned_count": 4,
             "remaining": 1, "total": 4, "side": "GROUP", "new_count": 2,
             "auto_at": datetime(2026, 11, 5, tzinfo=UTC),
             # ค่าคะแนนที่หลุดมาใน event ต้องไม่โผล่ในอีเมล (FR-NOTIF-06)
             "score": "87.65"}
    message = render_email(event, to="s@example.com", web_base_url="https://web.example")
    body = message.get_content()
    assert "https://web.example/classrooms/c-1/assignments/a-1" in body
    assert "87.65" not in body and "87.65" not in str(message["Subject"])
    assert message["Subject"].startswith("[PairEval] ")
