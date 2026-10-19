import pytest
from fastapi import HTTPException
from starlette.requests import Request

import app.auth as auth


def request_with_token(token: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/me",
            "headers": [(b"authorization", f"Bearer {token}".encode())],
        }
    )


def test_session_ของ_domain_ที่อนุญาตใช้งานได้(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(auth, "ALLOWED_EMAIL_DOMAINS", ["kmitl.ac.th"])
    token, _ = auth.issue_session("student@kmitl.ac.th")

    assert auth.current_user_email(request_with_token(token)) == "student@kmitl.ac.th"


def test_session_เก่าของ_domain_อื่นถูกปฏิเสธทันที(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(auth, "ALLOWED_EMAIL_DOMAINS", ["kmitl.ac.th"])
    token, _ = auth.issue_session("someone@gmail.com")

    with pytest.raises(HTTPException) as exc:
        auth.current_user_email(request_with_token(token))

    assert exc.value.status_code == 403
    assert exc.value.detail["code"] == "DOMAIN_NOT_ALLOWED"
    assert "kmitl.ac.th" in exc.value.detail["message"]
