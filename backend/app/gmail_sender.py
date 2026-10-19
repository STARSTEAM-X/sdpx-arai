"""ส่งอีเมลผ่าน Gmail API ด้วย OAuth refresh token (GAP-03)

ใช้ HTTPS ล้วน (port 443) เพราะ Render แผนฟรีบล็อก SMTP ขาออก 25/465/587
ใช้ urllib ของ stdlib แบบเดียวกับ alerting.py — สอง endpoint ไม่คุ้มเพิ่ม google-api-python-client

refresh token ได้จาก scripts/gmail/get_refresh_token.py · scope เดียวคือ gmail.send
"""

import base64
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr

TOKEN_URL = "https://oauth2.googleapis.com/token"
SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
TIMEOUT_SECONDS = 10
# ขอ token ใหม่ก่อนหมดอายุจริง เผื่อเวลาที่ใช้ส่ง
REFRESH_MARGIN_SECONDS = 60


class GmailAuthError(Exception):
    """refresh token ใช้ไม่ได้ (ถูกถอนสิทธิ์/หมดอายุ) — ส่งต่อไม่ได้จนกว่าจะออก token ใหม่"""


class GmailSendError(Exception):
    """ส่งฉบับนี้ไม่สำเร็จ — ฉบับอื่นยังลองต่อได้"""


def build_message(*, to: str, subject: str, body: str, sender: str = "") -> EmailMessage:
    message = EmailMessage()
    # ไม่มี sender = ไม่ใส่ From ให้ Gmail ใส่บัญชีที่ออก token เอง · มีก็ต้องเป็น address ของบัญชีนั้น
    # (Gmail เขียนทับ address อื่นอยู่แล้ว) เพียงแต่ได้ชื่อ PairEval แสดงในกล่องจดหมาย
    if sender:
        message["From"] = formataddr(("PairEval", sender))
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body, charset="utf-8")
    return message


class GmailSender:
    def __init__(self, client_id: str, client_secret: str, refresh_token: str,
                 opener=urllib.request.urlopen, clock=time.monotonic) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._refresh_token = refresh_token
        self._open = opener
        self._clock = clock
        self._access_token = ""
        self._expires_at = 0.0

    def _token(self) -> str:
        if self._access_token and self._clock() < self._expires_at - REFRESH_MARGIN_SECONDS:
            return self._access_token
        form = urllib.parse.urlencode({
            "client_id": self._client_id, "client_secret": self._client_secret,
            "refresh_token": self._refresh_token, "grant_type": "refresh_token",
        }).encode()
        request = urllib.request.Request(TOKEN_URL, data=form,
                                         headers={"Content-Type": "application/x-www-form-urlencoded"})
        try:
            with self._open(request, timeout=TIMEOUT_SECONDS) as response:
                payload = json.loads(response.read())
        except urllib.error.HTTPError as exc:
            # 400/401 = invalid_grant / invalid_client · ไม่ใส่ response body ใน error เผื่อมีข้อมูลบัญชี
            if exc.code in (400, 401):
                raise GmailAuthError(f"token endpoint ตอบ {exc.code}") from None
            raise GmailSendError(f"token endpoint ตอบ {exc.code}") from None
        except (urllib.error.URLError, TimeoutError) as exc:
            raise GmailSendError(f"ต่อ token endpoint ไม่ได้: {type(exc).__name__}") from None
        self._access_token = payload["access_token"]
        self._expires_at = self._clock() + float(payload.get("expires_in", 3600))
        return self._access_token

    def send(self, message: EmailMessage) -> None:
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
        request = urllib.request.Request(
            SEND_URL, data=json.dumps({"raw": raw}).encode(),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {self._token()}"},
        )
        try:
            with self._open(request, timeout=TIMEOUT_SECONDS):
                pass
        except urllib.error.HTTPError as exc:
            if exc.code == 401:
                # access token ถูกถอนกลางทาง — ทิ้งไว้ให้รอบหน้าขอใหม่
                self._access_token = ""
            raise GmailSendError(f"Gmail API ตอบ {exc.code}") from None
        except (urllib.error.URLError, TimeoutError) as exc:
            raise GmailSendError(f"ต่อ Gmail API ไม่ได้: {type(exc).__name__}") from None
