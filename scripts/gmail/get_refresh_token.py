"""ออก Gmail refresh token สำหรับ worker ส่งอีเมล (GAP-03) — รันบนเครื่องตัวเองครั้งเดียว

    python scripts/gmail/get_refresh_token.py backend/.secrets/gmail-client.json

1. อ่าน OAuth client แบบ Desktop app ที่ดาวน์โหลดจาก Google Cloud Console
2. เปิดเบราว์เซอร์ให้ล็อกอินบัญชี Gmail ที่จะใช้ส่ง และกดอนุญาต scope gmail.send
3. รับ code ทาง http://127.0.0.1:<port> แล้วแลกเป็น refresh token
4. เขียน GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN ลง backend/.secrets/gmail.env

ไม่พิมพ์ค่าลับออกหน้าจอ · คัดลอกจากไฟล์ไปใส่ Environment ของ Render เอง แล้วลบไฟล์ทิ้งได้
ใช้ stdlib ล้วน ไม่ต้องติดตั้งอะไรเพิ่ม
"""

import base64
import hashlib
import http.server
import json
import pathlib
import secrets
import sys
import urllib.parse
import urllib.request
import webbrowser

SCOPE = "https://www.googleapis.com/auth/gmail.send"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
OUTPUT = pathlib.Path(__file__).resolve().parents[2] / "backend" / ".secrets" / "gmail.env"


def main() -> int:
    # console ของ Windows เป็น cp1252 โดย default — พิมพ์ภาษาไทยไม่ได้ (เหตุผลเดียวกับ app/migrate.py)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    client = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    installed = client.get("installed")
    if not installed:
        print("ไฟล์นี้ไม่ใช่ OAuth client แบบ Desktop app — สร้างใหม่โดยเลือก Application type = Desktop app")
        return 1

    state = secrets.token_urlsafe(16)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    received: dict[str, str] = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            query = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(self.path).query))
            if "code" in query or "error" in query:
                received.update(query)
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write("เสร็จแล้ว ปิดหน้านี้แล้วกลับไปที่ terminal ได้เลย".encode())

        def log_message(self, *_args) -> None:
            pass  # ไม่ log query string ซึ่งมี authorization code

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    redirect_uri = f"http://127.0.0.1:{server.server_port}"
    url = AUTH_URL + "?" + urllib.parse.urlencode({
        "client_id": installed["client_id"], "redirect_uri": redirect_uri, "response_type": "code",
        "scope": SCOPE, "access_type": "offline", "prompt": "consent", "state": state,
        "code_challenge": challenge, "code_challenge_method": "S256",
    })
    print("เปิดเบราว์เซอร์ให้ล็อกอินบัญชี Gmail ที่จะใช้ส่งอีเมล ถ้าไม่เปิดเอง ให้คัดลอกลิงก์นี้ไปเปิด:\n")
    print(url + "\n")
    webbrowser.open(url)
    while not received:
        server.handle_request()
    server.server_close()

    if received.get("state") != state:
        print("state ไม่ตรง — ยกเลิกเพื่อความปลอดภัย ลองรันใหม่")
        return 1
    if "error" in received:
        print(f"Google ตอบ error: {received['error']}")
        return 1

    form = urllib.parse.urlencode({
        "client_id": installed["client_id"], "client_secret": installed["client_secret"],
        "code": received["code"], "code_verifier": verifier, "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }).encode()
    with urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=form), timeout=15) as response:
        token = json.loads(response.read())
    if "refresh_token" not in token:
        print("ไม่ได้ refresh token — เพิกถอนสิทธิ์แอปที่ myaccount.google.com/permissions แล้วรันใหม่")
        return 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        f"GMAIL_CLIENT_ID={installed['client_id']}\n"
        f"GMAIL_CLIENT_SECRET={installed['client_secret']}\n"
        f"GMAIL_REFRESH_TOKEN={token['refresh_token']}\n",
        encoding="utf-8",
    )
    print(f"บันทึกแล้วที่ {OUTPUT}")
    print("คัดลอก 3 บรรทัดนี้ไปใส่ Environment ของ paireval-api บน Render (ไฟล์นี้ไม่ถูก commit)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
