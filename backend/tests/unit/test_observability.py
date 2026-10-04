import json

from app.observability import serialize_event


def test_serialized_event_is_json_and_keeps_safe_fields() -> None:
    event = json.loads(
        serialize_event("http_request", requestId="req-123", duration_ms=12.5)
    )

    assert event == {
        "event": "http_request",
        "requestId": "req-123",
        "duration_ms": 12.5,
    }


def test_serialized_event_redacts_sensitive_nested_fields() -> None:
    event = json.loads(
        serialize_event(
            "test",
            accessToken="secret-token",
            user={"email": "private@example.com", "role": "student"},
            credentials=[{"password": "secret-password", "name": "test"}],
        )
    )

    serialized = json.dumps(event)
    assert "secret-token" not in serialized
    assert "private@example.com" not in serialized
    assert "secret-password" not in serialized
    assert event["user"] == {"role": "student"}
    assert event["credentials"] == [{"name": "test"}]