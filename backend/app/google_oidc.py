"""ตรวจสอบ id_token ที่ได้จาก Google (US-01 / FR-AUTH-01)

แบ่งเป็นสองชั้นโดยตั้งใจ:

- `validate_claims()` เป็น **pure function** — รับ claims ที่ decode แล้วเข้ามา
  จึงเขียน unit test ครอบทุกกรณีโจมตีได้โดยไม่ต้องต่อเน็ต
- `verify_id_token()` ทำงานกับเครือข่ายจริง (ดึง JWKS มาตรวจลายเซ็น)
  ส่วนนี้ทดสอบด้วย unit test ไม่ได้ ต้องพึ่ง manual test หรือ contract test

การแยกแบบนี้ทำให้ตรรกะที่ผิดแล้วอันตรายที่สุด (ยอมรับ token ที่ไม่ควรยอมรับ)
อยู่ในส่วนที่ทดสอบได้
"""

from dataclasses import dataclass
from datetime import UTC, datetime

import jwt
from jwt import PyJWKClient

from app.domain.email import normalize_email

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"

# Google ออก token ด้วย issuer สองรูปแบบนี้เท่านั้น
GOOGLE_ISSUERS = frozenset({"accounts.google.com", "https://accounts.google.com"})


class GoogleAuthError(Exception):
    """id_token ใช้ไม่ได้ — ชั้น API แปลงเป็น 401"""

    code = "INVALID_ID_TOKEN"


class JwksUnavailable(Exception):
    """ดึงกุญแจสาธารณะจาก Google ไม่ได้ — ปัญหาฝั่งเรา ชั้น API แปลงเป็น 503

    แยกจาก GoogleAuthError โดยตั้งใจ เพราะการตอบ 401 ตอนที่ระบบเราเองมีปัญหา
    จะทำให้ผู้ใช้เข้าใจผิดว่าบัญชีตัวเองมีปัญหา แล้วไปลอง login ซ้ำ ๆ โดยเปล่าประโยชน์
    """

    code = "IDP_UNAVAILABLE"


class EmailDomainNotAllowed(Exception):
    """อีเมลอยู่นอก domain ที่อนุญาต — ชั้น API แปลงเป็น 403 (FR-AUTH-02)"""

    code = "DOMAIN_NOT_ALLOWED"

    def __init__(self, domain: str, allowed: list[str]):
        super().__init__(domain)
        self.domain = domain
        self.allowed = allowed


@dataclass(frozen=True)
class GoogleIdentity:
    google_sub: str
    email_raw: str
    email_normalized: str
    display_name: str | None


def validate_claims(
    claims: dict,
    *,
    client_id: str,
    allowed_domains: list[str] | None = None,
    now: datetime | None = None,
) -> GoogleIdentity:
    """ตรวจ claims ของ id_token ว่าใช้ได้จริงไหม

    ตรวจ 5 อย่าง เรียงตามความอันตรายถ้าพลาด:
    1. `aud` ตรงกับ client id ของเรา — ไม่งั้นรับ token ที่ออกให้แอปอื่นได้
    2. `iss` เป็นของ Google
    3. `exp` ยังไม่หมดอายุ
    4. `email_verified` เป็นจริง — ไม่งั้นใครก็อ้างอีเมลคนอื่นได้
    5. domain ของอีเมลอยู่ในรายการที่อนุญาต (ถ้ากำหนดไว้)
    """
    now = now or datetime.now(UTC)

    aud = claims.get("aud")
    if aud != client_id:
        raise GoogleAuthError("token นี้ไม่ได้ออกให้แอปนี้")

    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise GoogleAuthError("issuer ไม่ใช่ Google")

    exp = claims.get("exp")
    if exp is None or datetime.fromtimestamp(int(exp), UTC) <= now:
        raise GoogleAuthError("token หมดอายุแล้ว")

    # Google ส่ง email_verified มาเป็น bool แต่บาง client library แปลงเป็น string
    verified = claims.get("email_verified")
    if verified not in (True, "true"):
        raise GoogleAuthError("อีเมลนี้ยังไม่ได้ยืนยันกับ Google")

    email_raw = claims.get("email")
    sub = claims.get("sub")
    if not email_raw or not sub:
        raise GoogleAuthError("token ไม่มี email หรือ sub")

    email_normalized = normalize_email(str(email_raw))
    domain = email_normalized.rpartition("@")[2]

    if allowed_domains and domain not in {d.strip().lower() for d in allowed_domains}:
        raise EmailDomainNotAllowed(domain, allowed_domains)

    return GoogleIdentity(
        google_sub=str(sub),
        email_raw=str(email_raw),
        email_normalized=email_normalized,
        display_name=claims.get("name"),
    )


# สร้างครั้งเดียวแล้วใช้ซ้ำ — client ตัวนี้ cache key ของ Google ไว้ให้เอง
# ถ้าสร้างใหม่ทุก request จะยิงไป Google ทุกครั้งที่มีคน login
#
# timeout สำคัญมาก: ถ้าไม่ตั้ง การดึง JWKS จะรอไม่มีกำหนดเมื่อ Google ช้าหรือเข้าไม่ถึง
# ทำให้ worker ค้างและ login ทั้งระบบหยุดไปด้วย
# (เจอจริงตอนทดสอบ — คำสั่งค้างจนหมดเวลา 300 วินาที)
JWKS_TIMEOUT_SECONDS = 5

_jwk_client = PyJWKClient(
    GOOGLE_JWKS_URL, cache_keys=True, timeout=JWKS_TIMEOUT_SECONDS
)


def verify_id_token(
    id_token: str, *, client_id: str, allowed_domains: list[str] | None = None
) -> GoogleIdentity:
    """ตรวจลายเซ็นของ id_token กับกุญแจสาธารณะของ Google แล้วตรวจ claims ต่อ

    ต้องตรวจลายเซ็นก่อนเสมอ — การอ่าน claims จาก token ที่ยังไม่ตรวจลายเซ็น
    เท่ากับเชื่อข้อมูลที่ใครก็ปลอมได้
    """
    try:
        signing_key = _jwk_client.get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=list(GOOGLE_ISSUERS),
        )
    except jwt.PyJWTError as exc:
        raise GoogleAuthError(f"ตรวจสอบ id_token ไม่ผ่าน: {exc}") from exc
    except OSError as exc:
        # ดึง JWKS ไม่ได้ (เน็ตล่ม / timeout) — เป็นปัญหาฝั่งเรา ไม่ใช่ token ของผู้ใช้ผิด
        # แยกชนิด error ออกมาเพื่อให้ชั้น API ตอบ 503 ไม่ใช่ 401
        raise JwksUnavailable(f"ติดต่อ Google เพื่อดึงกุญแจไม่สำเร็จ: {exc}") from exc

    # ตรวจซ้ำด้วย validate_claims เพื่อให้กฎที่ PyJWT ไม่ได้ตรวจ (email_verified, domain)
    # ผ่านทางเดียวกันกับที่ unit test ครอบไว้
    return validate_claims(claims, client_id=client_id, allowed_domains=allowed_domains)
