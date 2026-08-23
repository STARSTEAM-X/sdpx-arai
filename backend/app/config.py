"""config ทั้งหมดของ backend อ่านจาก environment variable ที่เดียว

ตั้งใจใช้ os.getenv ตรง ๆ ไม่ใช้ library เพิ่ม เพราะจำนวนค่ายังน้อย
ถ้า config โตจนคุมยาก ค่อยย้ายไป pydantic-settings แล้วบันทึกเป็น ADR (WS-08)
"""

import os


def _split_csv(raw: str) -> list[str]:
    """แปลง "a, b ,c" เป็น ["a", "b", "c"] และตัดค่าว่างทิ้ง"""
    return [item.strip() for item in raw.split(",") if item.strip()]


# origin ที่อนุญาตให้เรียก API ได้ — ระบุเป็นรายตัว ไม่ใช้ "*"
# เพราะ "*" ใช้ร่วมกับ credentials ไม่ได้ และเปิดกว้างเกินจำเป็น
CORS_ORIGINS: list[str] = _split_csv(os.getenv("CORS_ORIGINS", "http://localhost:5173"))

# Render ใส่ RENDER_GIT_COMMIT ให้อัตโนมัติ — ใช้เป็น version เพื่อดูว่า commit ไหนขึ้นอยู่
# ค่านี้คือสิ่งที่ทำให้วัด commit-to-live time ได้แม่นยำ ไม่ต้องเดาจากข้อความบนหน้าเว็บ
APP_VERSION: str = os.getenv("RENDER_GIT_COMMIT", "dev")[:7]

# ---------------------------------------------------------------------------
# ตัวควบคุมความปลอดภัยที่สำคัญที่สุดในไฟล์นี้
#
# endpoint สำหรับ test (seed / cleanup / test-session) จะเปิดก็ต่อเมื่อค่านี้
# **ไม่ใช่** "production" เท่านั้น — ค่า default เป็น production โดยตั้งใจ
# เพื่อให้การลืมตั้ง env กลายเป็นการ "ปิด" ไม่ใช่ "เปิด"
# ---------------------------------------------------------------------------
ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production").strip().lower()

IS_PRODUCTION: bool = ENVIRONMENT == "production"

DATABASE_URL: str = os.getenv(
    "DATABASE_URL", "postgresql://paireval:devpassword@localhost:5433/paireval"
)

# ใช้เซ็นและตรวจ session token
#
# HS256 ต้องการ key อย่างน้อย 32 bytes ตาม RFC 7518 §3.2 — สั้นกว่านั้นเดาได้ง่ายขึ้นมาก
# PyJWT เตือนเป็น InsecureKeyLengthWarning แต่ warning ที่ไม่มีใครอ่านคือ warning ที่ไร้ผล
# จึงบังคับตรวจตรงนี้แทน
MIN_SESSION_SECRET_BYTES = 32

SESSION_SECRET: str = os.getenv(
    "SESSION_SECRET", "dev-only-secret-not-for-production-use-32b"
)

if len(SESSION_SECRET.encode()) < MIN_SESSION_SECRET_BYTES:
    raise RuntimeError(
        f"SESSION_SECRET สั้นเกินไป ({len(SESSION_SECRET.encode())} bytes) "
        f"ต้องยาวอย่างน้อย {MIN_SESSION_SECRET_BYTES} bytes ตาม RFC 7518 §3.2 · "
        "สร้างค่าใหม่ด้วย: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
    )

SESSION_TTL_HOURS: int = int(os.getenv("SESSION_TTL_HOURS", "12"))  # FR-AUTH-04

# OAuth Client ID ของ Google — เป็นค่าสาธารณะ ไม่ใช่ secret
# มันฝังอยู่ในทุกหน้าที่ใช้ Google Sign-In อยู่แล้ว
# ขอบเขตความปลอดภัยคือรายการ Authorized JavaScript origins ที่ตั้งใน Google Cloud Console
# ไม่ใช่ความลับของตัว ID
GOOGLE_CLIENT_ID: str = os.getenv(
    "GOOGLE_CLIENT_ID",
    "481187031480-84p52vogdsiu9rtn6lrhucaut9bggp57.apps.googleusercontent.com",
)

# domain อีเมลที่ยอมให้เข้าระบบ — ว่าง = รับทุก domain (FR-AUTH-02)
#
# PRD กำหนดให้ตั้งค่านี้ "ต่อ classroom" แต่ตอน login ระบบยังไม่รู้ว่าผู้ใช้จะเข้า classroom ไหน
# จึงทำเป็นด่านระดับระบบไว้ก่อน ส่วนการบังคับต่อ classroom จะไปอยู่ที่ชั้นตรวจสมาชิก
# เมื่อทำ US-03 (roster) เสร็จ
ALLOWED_EMAIL_DOMAINS: list[str] = _split_csv(os.getenv("ALLOWED_EMAIL_DOMAINS", ""))
