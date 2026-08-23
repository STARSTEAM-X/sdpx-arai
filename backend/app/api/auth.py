"""endpoint การเข้าสู่ระบบ — US-01

Flow ที่ใช้: client ทำ OIDC กับ Google เองแล้วส่ง id_token มาที่นี่
ฝั่ง server ตรวจลายเซ็นกับกุญแจสาธารณะของ Google แล้วออก session ของระบบเราเอง

**ไม่ต้องใช้ client secret** เพราะเป็น public client flow —
ความปลอดภัยมาจากการตรวจลายเซ็นและ `aud` ไม่ใช่จากการเก็บ secret
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.auth import CurrentUser, issue_session
from app.config import ALLOWED_EMAIL_DOMAINS, GOOGLE_CLIENT_ID
from app.db import transaction
from app.google_oidc import (
    EmailDomainNotAllowed,
    GoogleAuthError,
    JwksUnavailable,
    verify_id_token,
)
from app.repositories.pg_user_repo import PgUserRepository

router = APIRouter(prefix="/api", tags=["auth"])

log = logging.getLogger("paireval.auth")


class SessionRequest(BaseModel):
    idToken: str


@router.post("/auth/session")
def create_session(body: SessionRequest) -> dict:
    if not GOOGLE_CLIENT_ID:
        # ตอบให้ชัดว่าเป็นปัญหาการตั้งค่าฝั่ง server ไม่ใช่ token ของผู้ใช้ผิด
        raise HTTPException(
            status_code=503,
            detail={
                "code": "OIDC_NOT_CONFIGURED",
                "message": "ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID บน server",
            },
        )

    try:
        identity = verify_id_token(
            body.idToken,
            client_id=GOOGLE_CLIENT_ID,
            allowed_domains=ALLOWED_EMAIL_DOMAINS or None,
        )
    except JwksUnavailable as exc:
        log.error("ดึง JWKS จาก Google ไม่ได้: %s", exc)
        raise HTTPException(
            status_code=503,
            detail={
                "code": exc.code,
                "message": "ตอนนี้ติดต่อ Google ไม่ได้ กรุณาลองใหม่อีกครั้ง",
            },
        ) from exc
    except EmailDomainNotAllowed as exc:
        raise HTTPException(
            status_code=403,
            detail={
                "code": exc.code,
                "message": (
                    f"อีเมล domain '{exc.domain}' ใช้เข้าระบบไม่ได้ "
                    f"· domain ที่อนุญาต: {', '.join(exc.allowed)}"
                ),
            },
        ) from exc
    except GoogleAuthError as exc:
        # log ฝั่ง server ด้วย เพราะข้อความที่ส่งกลับไปหา client ตั้งใจให้กว้าง ๆ
        # ไม่บอกละเอียดว่าตรวจตกข้อไหน (กันคนเดา) แต่คนดูแลระบบต้องเห็นเหตุผลจริง
        #
        # claims ที่ decode แบบไม่ตรวจลายเซ็นใช้ debug ได้แต่ **ห้ามเชื่อ**
        # เพราะใครก็ปลอมได้ — พิมพ์ไว้เพื่อดูว่า aud/iss ที่ส่งมาหน้าตาเป็นอย่างไรเท่านั้น
        try:
            import jwt as _jwt

            unsafe = _jwt.decode(body.idToken, options={"verify_signature": False})
            hint = {
                "aud": unsafe.get("aud"),
                "iss": unsafe.get("iss"),
                "exp": unsafe.get("exp"),
                "email_verified": unsafe.get("email_verified"),
            }
        except Exception:  # noqa: BLE001 - debug path ห้ามทำให้ response พังซ้ำ
            hint = {"note": "decode payload ไม่ได้เลย - token อาจไม่ใช่ JWT"}

        log.warning(
            "auth/session ปฏิเสธ id_token: %s | คาดหวัง aud=%s | ได้ %s",
            exc,
            GOOGLE_CLIENT_ID,
            hint,
        )
        raise HTTPException(
            status_code=401, detail={"code": exc.code, "message": str(exc)}
        ) from exc

    with transaction() as conn:
        user = PgUserRepository(conn).upsert_from_google(identity)

    if user.status == "DISABLED":
        raise HTTPException(
            status_code=403,
            detail={"code": "USER_DISABLED", "message": "บัญชีนี้ถูกระงับการใช้งาน"},
        )

    token, expires_at = issue_session(user.email_normalized)
    return {
        "accessToken": token,
        "expiresAt": expires_at.isoformat(),
        "user": {
            "userId": user.id,
            "email": user.email_normalized,
            "displayName": user.display_name,
            "status": user.status,
        },
    }


@router.get("/me")
def me(user_email: CurrentUser) -> dict:
    with transaction() as conn:
        repo = PgUserRepository(conn)
        user = repo.get_by_email(user_email)
        if user is None:
            raise HTTPException(
                status_code=401,
                detail={"code": "UNAUTHENTICATED", "message": "ไม่พบผู้ใช้ของ session นี้"},
            )
        classrooms = repo.roles_by_classroom(user.id)

    return {
        "userId": user.id,
        "email": user.email_normalized,
        "displayName": user.display_name,
        "status": user.status,
        "classrooms": classrooms,
    }
