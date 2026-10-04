import json
import logging
import re
import sys
from collections.abc import Mapping


_SENSITIVE_KEY_PARTS = ("email", "token", "password", "secret", "authorization")
_logger = logging.getLogger("paireval.structured")
_logger.setLevel(logging.INFO)
_logger.propagate = False

if not _logger.handlers:
    _handler = logging.StreamHandler(sys.stdout)
    _handler.setFormatter(logging.Formatter("%(message)s"))
    _logger.addHandler(_handler)


def _is_sensitive_key(key: str) -> bool:
    normalized = re.sub(r"[^a-z0-9]", "", key.casefold())
    return any(part in normalized for part in _SENSITIVE_KEY_PARTS)


def _redact(value: object) -> object:
    if isinstance(value, Mapping):
        return {
            str(key): _redact(item)
            for key, item in value.items()
            if not _is_sensitive_key(str(key))
        }
    if isinstance(value, (list, tuple)):
        return [_redact(item) for item in value]
    return value


def serialize_event(event: str, **fields: object) -> str:
    safe_fields = _redact(fields)
    return json.dumps(
        {"event": event, **safe_fields},
        ensure_ascii=False,
        separators=(",", ":"),
    )


def log_event(event: str, **fields: object) -> None:
    _logger.info(serialize_event(event, **fields))