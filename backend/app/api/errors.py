"""แปลง error ของชั้น domain เป็น HTTP response

ชั้น domain ไม่รู้จัก HTTP เลย — การ map อยู่ที่นี่ที่เดียว
ทำให้ status code ที่ระบบตอบสอดคล้องกันทุก endpoint และตรงกับ docs/openapi.yaml
"""

from fastapi import Request
from fastapi.responses import JSONResponse

from app.domain.errors import ConflictError, DomainError, RosterImportError, ValidationError

# ชนิดของ error → status code · ตรงกับที่ประกาศไว้ใน docs/openapi.yaml
_STATUS_BY_TYPE: list[tuple[type[DomainError], int]] = [
    (ConflictError, 409),
    (RosterImportError, 422),
    (ValidationError, 422),
]


def _status_for(exc: DomainError) -> int:
    for exc_type, status in _STATUS_BY_TYPE:
        if isinstance(exc, exc_type):
            return status
    return 400


def error_body(code: str, message: str, request_id: str, *, field: str | None = None) -> dict:
    """รูปแบบ error เดียวกันทั้งระบบ (FR-API-03)"""
    return {
        "error": {
            "code": code,
            "message": message,
            "field": field,
            "requestId": request_id,
        }
    }


async def domain_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, DomainError)
    request_id = getattr(request.state, "request_id", "unknown")

    body = error_body(exc.code, exc.message, request_id, field=exc.field)

    # RosterImportError พก error รายแถวมาด้วย — ต้องส่งให้ครบทุกแถว (R2)
    if isinstance(exc, RosterImportError) and exc.rows:
        body["error"]["details"] = [{"row": r.row, "reason": r.reason} for r in exc.rows]

    return JSONResponse(status_code=_status_for(exc), content=body)
