"""แปลง error ของชั้น domain เป็น HTTP response

ชั้น domain ไม่รู้จัก HTTP เลย — การ map อยู่ที่นี่ที่เดียว
ทำให้ status code ที่ระบบตอบสอดคล้องกันทุก endpoint และตรงกับ docs/openapi.yaml
"""

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.domain.errors import (
    ConflictError,
    DomainError,
    ForbiddenError,
    NotFoundError,
    RosterImportError,
    ValidationError,
)

# code เริ่มต้นสำหรับ HTTPException ที่ยกขึ้นมาโดยไม่ได้ระบุ code เอง
# เช่น 404 ที่ FastAPI สร้างให้เองเมื่อไม่มี route ตรงกับ path
_DEFAULT_CODE_BY_STATUS = {
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "ALREADY_EXISTS",
    429: "RATE_LIMITED",
    503: "SERVICE_UNAVAILABLE",
}

# ชนิดของ error → status code · ตรงกับที่ประกาศไว้ใน docs/openapi.yaml
_STATUS_BY_TYPE: list[tuple[type[DomainError], int]] = [
    (NotFoundError, 404),
    (ForbiddenError, 403),
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


async def http_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """แปลง HTTPException ให้อยู่ในรูป ErrorEnvelope เหมือนกับ error อื่น ๆ

    FastAPI คืน HTTPException เป็น {"detail": ...} ซึ่ง**ไม่ตรง**กับ ErrorEnvelope
    ที่ประกาศไว้ใน docs/openapi.yaml — ผลคือ client อ่าน code กับ message ไม่ออก
    แล้วต้องแสดงข้อความ fallback แบบ "เกิดข้อผิดพลาด (HTTP 401)" ซึ่งไม่ช่วยใครเลย

    handler นี้ทำให้ทุก error ของระบบมีรูปแบบเดียวกันจริงตาม FR-API-03
    """
    assert isinstance(exc, StarletteHTTPException)
    request_id = getattr(request.state, "request_id", "unknown")

    detail = exc.detail
    if isinstance(detail, dict):
        code = str(detail.get("code", "HTTP_ERROR"))
        message = str(detail.get("message", ""))
        field = detail.get("field")
    else:
        code = _DEFAULT_CODE_BY_STATUS.get(exc.status_code, "HTTP_ERROR")
        message = str(detail)
        field = None

    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(code, message, request_id, field=field),
        headers=getattr(exc, "headers", None),
    )


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """แปลง error ของ pydantic ให้เป็น ErrorEnvelope พร้อมชี้ field ที่ผิด"""
    assert isinstance(exc, RequestValidationError)
    request_id = getattr(request.state, "request_id", "unknown")

    first = exc.errors()[0] if exc.errors() else {}
    # loc มีหน้าตาเช่น ("body", "name") — เอาชิ้นสุดท้ายที่เป็นชื่อ field
    loc = [str(p) for p in first.get("loc", []) if p not in ("body", "query", "path")]
    field = loc[-1] if loc else None

    body = error_body(
        "VALIDATION_FAILED",
        str(first.get("msg", "ข้อมูลที่ส่งมาไม่ถูกต้อง")),
        request_id,
        field=field,
    )
    body["error"]["details"] = [
        {"row": 0, "reason": f"{'.'.join(str(p) for p in e.get('loc', []))}: {e.get('msg')}"}
        for e in exc.errors()
    ]
    return JSONResponse(status_code=422, content=body)


async def domain_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, DomainError)
    request_id = getattr(request.state, "request_id", "unknown")

    body = error_body(exc.code, exc.message, request_id, field=exc.field)

    # RosterImportError พก error รายแถวมาด้วย — ต้องส่งให้ครบทุกแถว (R2)
    if isinstance(exc, RosterImportError) and exc.rows:
        body["error"]["details"] = [{"row": r.row, "reason": r.reason} for r in exc.rows]

    return JSONResponse(status_code=_status_for(exc), content=body)
