"""session ของผู้ใช้

แยกออกจากวิธี login โดยตั้งใจ — ไม่ว่าจะมาจาก Google OIDC จริง
หรือจาก test-session endpoint ก็ได้ session token หน้าตาเดียวกัน
ทำให้ทุก endpoint ที่เหลือไม่ต้องรู้ว่าผู้ใช้ login มาทางไหน
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request

from app.config import ALLOWED_EMAIL_DOMAINS, SESSION_SECRET, SESSION_TTL_HOURS

_ALGORITHM = "HS256"


def issue_session(email_normalized: str) -> tuple[str, datetime]:
    """ออก session token ให้ผู้ใช้ที่ยืนยันตัวตนแล้ว"""
    expires_at = datetime.now(UTC) + timedelta(hours=SESSION_TTL_HOURS)
    token = jwt.encode(
        {"sub": email_normalized, "exp": expires_at},
        SESSION_SECRET,
        algorithm=_ALGORITHM,
    )
    return token, expires_at


def _read_bearer(request: Request) -> str:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "ต้องแนบ bearer token"},
        )
    return token


def current_user_email(request: Request) -> str:
    """ดึงอีเมลของผู้ใช้จาก session token

    ทุก endpoint ที่ต้องใช้สิทธิ์ต้องผ่านตัวนี้ — ไม่ให้ route ไหนอ่าน header เอง
    เพราะการตรวจสิทธิ์ที่กระจัดกระจายคือจุดที่ลืมได้ง่ายที่สุด (AR-02)
    """
    token = _read_bearer(request)
    try:
        payload = jwt.decode(token, SESSION_SECRET, algorithms=[_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail={"code": "SESSION_EXPIRED", "message": "session หมดอายุแล้ว"},
        ) from None
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "token ไม่ถูกต้อง"},
        ) from None

    email = str(payload["sub"]).strip().lower()
    domain = email.rpartition("@")[2]
    allowed = {item.strip().lower() for item in ALLOWED_EMAIL_DOMAINS if item.strip()}
    if allowed and domain not in allowed:
        # ตรวจทุก request ไม่ใช่เฉพาะตอน login เพื่อให้ session เก่าของ domain อื่น
        # ใช้งานต่อไม่ได้หลังเปิด policy นี้
        raise HTTPException(
            status_code=403,
            detail={
                "code": "DOMAIN_NOT_ALLOWED",
                "message": (
                    f"อีเมล domain '{domain}' ใช้เข้าระบบไม่ได้ "
                    f"· domain ที่อนุญาต: {', '.join(sorted(allowed))}"
                ),
            },
        )

    return email


CurrentUser = Annotated[str, Depends(current_user_email)]
