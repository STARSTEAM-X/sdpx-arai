"""FR-AUTH-04 — ต่ออายุ session ให้เงียบ ๆ เมื่อเหลืออายุไม่ถึง 2 ชม."""
from datetime import UTC, datetime, timedelta

import jwt
from starlette.requests import Request

from app.auth import current_user_email
from app.config import SESSION_SECRET


def _request(hours_left: float) -> Request:
    token = jwt.encode({"sub": "nok@kmitl.ac.th", "exp": datetime.now(UTC) + timedelta(hours=hours_left)},
                       SESSION_SECRET, algorithm="HS256")
    return Request({"type": "http", "headers": [(b"authorization", f"Bearer {token}".encode())]})


def test_near_expiry_issues_fresh_token_for_same_user():
    request = _request(1)
    assert current_user_email(request) == "nok@kmitl.ac.th"
    renewed = jwt.decode(request.state.refreshed_token, SESSION_SECRET, algorithms=["HS256"])
    assert renewed["sub"] == "nok@kmitl.ac.th"
    assert datetime.fromtimestamp(renewed["exp"], UTC) - datetime.now(UTC) > timedelta(hours=11)


def test_fresh_token_is_not_reissued():
    request = _request(10)
    current_user_email(request)
    assert not hasattr(request.state, "refreshed_token")
