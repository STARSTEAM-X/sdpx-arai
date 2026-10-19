"""unit test ของการตรวจ claims จาก Google — US-01 / FR-AUTH-01, FR-AUTH-02

ทดสอบ `validate_claims` ซึ่งเป็น pure function จึงครอบกรณีโจมตีได้ครบ
โดยไม่ต้องต่อเน็ตและไม่ต้องมี token จริง

**ขอบเขตที่ test ชุดนี้ไม่ครอบ:** การตรวจลายเซ็นกับ JWKS ของ Google
ซึ่งอยู่ใน `verify_id_token()` และต้องใช้เครือข่ายจริง
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.google_oidc import (
    CLOCK_SKEW_LEEWAY_SECONDS,
    EmailDomainNotAllowed,
    GoogleAuthError,
    validate_claims,
)

CLIENT_ID = "481187031480-84p52vogdsiu9rtn6lrhucaut9bggp57.apps.googleusercontent.com"
NOW = datetime(2026, 8, 23, 12, 0, tzinfo=UTC)


def make_claims(**overrides) -> dict:
    """claims ที่ถูกต้องทุกอย่าง — test แต่ละตัวพังเฉพาะ field ที่ตัวเองสนใจ"""
    defaults = {
        "aud": CLIENT_ID,
        "iss": "https://accounts.google.com",
        "exp": int((NOW + timedelta(hours=1)).timestamp()),
        "iat": int(NOW.timestamp()),
        "email": "Somchai.A@uni.ac.th",
        "email_verified": True,
        "sub": "1234567890",
        "name": "สมชาย เอ",
    }
    return {**defaults, **overrides}


class TestHappyPath:
    def test_claims_ที่ถูกต้องผ่าน(self):
        identity = validate_claims(make_claims(), client_id=CLIENT_ID, now=NOW)

        assert identity.google_sub == "1234567890"
        assert identity.email_raw == "Somchai.A@uni.ac.th"
        assert identity.display_name == "สมชาย เอ"

    def test_อีเมลถูก_normalize_ก่อนใช้เป็น_key(self):
        """ต้อง normalize ไม่งั้นคนเดียวกันที่พิมพ์อีเมลต่างแบบจะกลายเป็นคนละ user"""
        identity = validate_claims(
            make_claims(email="  SOMCHAI.A+course@UNI.AC.TH  "),
            client_id=CLIENT_ID,
            now=NOW,
        )

        assert identity.email_normalized == "somchai.a@uni.ac.th"

    def test_ไม่มี_name_ก็ผ่านได้(self):
        claims = make_claims()
        del claims["name"]

        identity = validate_claims(claims, client_id=CLIENT_ID, now=NOW)

        assert identity.display_name is None


class TestAudience:
    def test_token_ที่ออกให้แอปอื่นถูกปฏิเสธ(self):
        """กรณีอันตรายที่สุด — ถ้าไม่ตรวจ aud ใครก็เอา token จากแอปอื่นมาใช้กับเราได้"""
        with pytest.raises(GoogleAuthError):
            validate_claims(
                make_claims(aud="attacker-app.apps.googleusercontent.com"),
                client_id=CLIENT_ID,
                now=NOW,
            )

    def test_ไม่มี_aud_ถูกปฏิเสธ(self):
        claims = make_claims()
        del claims["aud"]

        with pytest.raises(GoogleAuthError):
            validate_claims(claims, client_id=CLIENT_ID, now=NOW)


class TestIssuer:
    @pytest.mark.parametrize(
        "issuer", ["accounts.google.com", "https://accounts.google.com"]
    )
    def test_issuer_ที่_Google_ใช้จริงผ่านทั้งสองแบบ(self, issuer: str):
        identity = validate_claims(
            make_claims(iss=issuer), client_id=CLIENT_ID, now=NOW
        )
        assert identity.google_sub

    @pytest.mark.parametrize(
        "issuer",
        [
            "https://accounts.google.com.evil.test",
            "https://evil.test/accounts.google.com",
            "accounts.google.co",
            "",
        ],
    )
    def test_issuer_ปลอมถูกปฏิเสธ(self, issuer: str):
        """รวมเคสที่ domain มีคำว่า accounts.google.com อยู่ข้างในแต่ไม่ใช่ของจริง"""
        with pytest.raises(GoogleAuthError):
            validate_claims(make_claims(iss=issuer), client_id=CLIENT_ID, now=NOW)


class TestExpiry:
    def test_token_หมดอายุเกิน_leeway_ถูกปฏิเสธ(self):
        long_expired = int((NOW - timedelta(seconds=CLOCK_SKEW_LEEWAY_SECONDS + 1)).timestamp())

        with pytest.raises(GoogleAuthError):
            validate_claims(make_claims(exp=long_expired), client_id=CLIENT_ID, now=NOW)

    def test_เพิ่งหมดอายุภายใน_leeway_ยังผ่าน(self):
        """ยอมรับโดยตั้งใจ — นาฬิกาสองเครื่องต่างกันไม่กี่วินาทีเป็นเรื่องปกติ
        ถ้าไม่เผื่อ ผู้ใช้จะเจออาการ login เดี๋ยวได้เดี๋ยวไม่ได้"""
        just_expired = int((NOW - timedelta(seconds=10)).timestamp())

        identity = validate_claims(
            make_claims(exp=just_expired), client_id=CLIENT_ID, now=NOW
        )
        assert identity.google_sub

    def test_ไม่มี_exp_ถูกปฏิเสธ(self):
        claims = make_claims()
        del claims["exp"]

        with pytest.raises(GoogleAuthError):
            validate_claims(claims, client_id=CLIENT_ID, now=NOW)


class TestClockSkew:
    """คุ้มครองบั๊กที่เจอจริงตอน login ครั้งแรก

    อาการ: "The token is not yet valid (iat)" แบบเดี๋ยวผ่านเดี๋ยวไม่ผ่าน
    สาเหตุ: นาฬิกาเครื่อง server ช้ากว่าของ Google ไม่กี่วินาที
    token ที่เพิ่งออกจึงดูเหมือน "ออกในอนาคต"
    """

    def test_iat_ล้ำหน้าเล็กน้อยยังผ่าน(self):
        skewed = int((NOW + timedelta(seconds=5)).timestamp())

        identity = validate_claims(
            make_claims(iat=skewed), client_id=CLIENT_ID, now=NOW
        )
        assert identity.google_sub

    def test_iat_ล้ำหน้าพอดีขอบ_leeway_ยังผ่าน(self):
        edge = int((NOW + timedelta(seconds=CLOCK_SKEW_LEEWAY_SECONDS)).timestamp())

        identity = validate_claims(make_claims(iat=edge), client_id=CLIENT_ID, now=NOW)
        assert identity.google_sub

    def test_iat_ล้ำหน้าเกิน_leeway_ถูกปฏิเสธ(self):
        """ล้ำหน้ามากเกินไปไม่ใช่ skew ปกติแล้ว — อาจเป็น token ปลอม"""
        far_future = int((NOW + timedelta(seconds=CLOCK_SKEW_LEEWAY_SECONDS + 60)).timestamp())

        with pytest.raises(GoogleAuthError):
            validate_claims(make_claims(iat=far_future), client_id=CLIENT_ID, now=NOW)

    def test_ไม่มี_iat_ก็ผ่านได้(self):
        """iat ไม่ใช่ claim บังคับของ OIDC — ไม่ควรปฏิเสธเพราะไม่มี"""
        claims = make_claims()
        claims.pop("iat", None)

        identity = validate_claims(claims, client_id=CLIENT_ID, now=NOW)
        assert identity.google_sub


class TestEmailVerified:
    def test_อีเมลที่ยังไม่ยืนยันถูกปฏิเสธ(self):
        """ถ้าไม่ตรวจข้อนี้ คนที่สมัคร Google ด้วยอีเมลคนอื่นจะสวมรอยได้"""
        with pytest.raises(GoogleAuthError):
            validate_claims(
                make_claims(email_verified=False), client_id=CLIENT_ID, now=NOW
            )

    def test_รับค่า_true_ที่เป็น_string_ด้วย(self):
        """บาง client library แปลง bool เป็น string ระหว่างทาง"""
        identity = validate_claims(
            make_claims(email_verified="true"), client_id=CLIENT_ID, now=NOW
        )
        assert identity.email_normalized

    def test_ไม่มี_email_verified_ถูกปฏิเสธ(self):
        claims = make_claims()
        del claims["email_verified"]

        with pytest.raises(GoogleAuthError):
            validate_claims(claims, client_id=CLIENT_ID, now=NOW)


class TestRequiredFields:
    @pytest.mark.parametrize("missing", ["email", "sub"])
    def test_ขาด_field_ที่จำเป็นถูกปฏิเสธ(self, missing: str):
        claims = make_claims()
        del claims[missing]

        with pytest.raises(GoogleAuthError):
            validate_claims(claims, client_id=CLIENT_ID, now=NOW)


class TestAllowedDomains:
    def test_domain_ที่อนุญาตผ่าน(self):
        identity = validate_claims(
            make_claims(), client_id=CLIENT_ID, allowed_domains=["uni.ac.th"], now=NOW
        )
        assert identity.email_normalized.endswith("@uni.ac.th")

    def test_domain_นอกรายการถูกปฏิเสธ(self):
        with pytest.raises(EmailDomainNotAllowed) as exc:
            validate_claims(
                make_claims(email="someone@gmail.com"),
                client_id=CLIENT_ID,
                allowed_domains=["uni.ac.th"],
                now=NOW,
            )

        assert exc.value.domain == "gmail.com"

    def test_รายการว่างแปลว่ารับทุก_domain(self):
        identity = validate_claims(
            make_claims(email="someone@gmail.com"),
            client_id=CLIENT_ID,
            allowed_domains=None,
            now=NOW,
        )
        assert identity.email_normalized == "someone@gmail.com"

    def test_เทียบ_domain_ไม่สนตัวพิมพ์เล็กใหญ่(self):
        identity = validate_claims(
            make_claims(), client_id=CLIENT_ID, allowed_domains=["UNI.AC.TH"], now=NOW
        )
        assert identity.email_normalized
