"""PairEval API"""

import asyncio
import logging
import re
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import account as account_api
from app.api import appeals as appeals_api
from app.api import assignment_lifecycle as lifecycle_api
from app.api import assignments as assignments_api
from app.api import auth as auth_api
from app.api import classrooms
from app.api import comparisons as comparisons_api
from app.api import coverage as coverage_api
from app.api import enrollment as enrollment_api
from app.api import members as members_api
from app.api import notifications as notifications_api
from app.api import quality as quality_api
from app.api import reports_export as reports_export_api
from app.api import roster as roster_api
from app.api import scoring as scoring_api
from app.api.errors import (
    domain_error_handler,
    error_body,
    http_error_handler,
    validation_error_handler,
)
from app.config import (
    APP_VERSION,
    CORS_ORIGINS,
    DEPLOYMENT_TIER,
    ENVIRONMENT,
    EXPORT_RATE_LIMIT_PER_MINUTE,
    IS_PRODUCTION,
    RATE_LIMIT_PER_MINUTE,
)
from app.daily_scoring import daily_scoring_loop
from app.db import close_pool, open_pool
from app.domain.errors import DomainError
from app.observability import (
    configure_logging,
    log_event,
    request_id_var,
    request_start_var,
    user_ref,
)
from app.rate_limit import (
    SlidingWindowLimiter,
    client_key,
    is_exempt,
    is_export,
    retry_after_header,
)

# ตั้งก่อนสร้าง app — log ทุกบรรทัดหลังจากนี้ (รวมของ uvicorn) ออกเป็น JSON
configure_logging()
http_log = logging.getLogger("paireval.http")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    open_pool()
    scoring_task = asyncio.create_task(daily_scoring_loop())
    try:
        yield
    finally:
        scoring_task.cancel()
        with suppress(asyncio.CancelledError):
            await scoring_task
        close_pool()


app = FastAPI(
    title="PairEval API",
    version=APP_VERSION,
    description="ระบบประเมินผลนักศึกษาแบบ pairwise comparison",
    lifespan=lifespan,
)

_general_limiter = SlidingWindowLimiter(RATE_LIMIT_PER_MINUTE)
_export_limiter = SlidingWindowLimiter(EXPORT_RATE_LIMIT_PER_MINUTE)


@app.middleware("http")
async def rate_limit(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    """FR-API-04 — เกินเพดานตอบ 429 + Retry-After ในรูป ErrorEnvelope เดียวกับ error อื่น

    ประกาศก่อน CORS และ request_context โดยตั้งใจ: middleware ที่เพิ่มทีหลังอยู่ชั้นนอก
    ตัวนี้จึงอยู่ในสุด — 429 ได้ header CORS (หน้าเว็บอ่านได้) และมี requestId กับ log ครบ
    """
    path = request.url.path
    if request.method == "OPTIONS" or is_exempt(path):
        return await call_next(request)
    key = client_key(request.headers.get("authorization"), request.client.host if request.client else None)
    wait = _general_limiter.hit(key)
    message = "เรียกใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"
    if wait is None and is_export(path):
        wait = _export_limiter.hit(key)
        message = f"ส่งออกได้ไม่เกิน {EXPORT_RATE_LIMIT_PER_MINUTE} ครั้งต่อนาที กรุณารอสักครู่แล้วลองใหม่"
    if wait is not None:
        request.state.error_code = "RATE_LIMITED"
        return JSONResponse(
            status_code=429,
            content=error_body("RATE_LIMITED", message, getattr(request.state, "request_id", "")),
            headers={"Retry-After": retry_after_header(wait)},
        )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # หน้าเว็บอยู่คนละ origin — ต้องเปิดให้อ่านชื่อไฟล์จาก header ไม่งั้นไฟล์ส่งออกได้ชื่อสำรอง
    expose_headers=["Content-Disposition", "X-Session-Token"],
)


@app.middleware("http")
async def request_context(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """ให้ทุก request มี id ของตัวเอง แล้วออก log JSON หนึ่งบรรทัดเมื่อจบ (WS-07)

    requestId ถูกส่งกลับใน header และใน ErrorEnvelope — ผู้ใช้แจ้งเลขนี้มา
    ก็หาบรรทัด log ของ request นั้นเจอทันที (correlation ID)
    """
    request_id = _accept_request_id(request.headers.get("x-request-id"))
    request.state.request_id = request_id
    token = request_id_var.set(request_id)
    start = time.perf_counter()
    start_token = request_start_var.set(start)
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers["x-request-id"] = request_id
        # FR-AUTH-04 — current_user_email ออก token ใหม่ให้เมื่อใกล้หมดอายุ หน้าเว็บเก็บทับของเดิม
        refreshed = getattr(request.state, "refreshed_token", None)
        if refreshed:
            response.headers["X-Session-Token"] = refreshed
        # FR-SEC-01 — API ส่งแต่ JSON/ไฟล์ส่งออก ไม่มีหน้าเว็บ จึงห้าม sniff และห้ามฝังใน frame
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        if IS_PRODUCTION:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response
    finally:
        # route pattern (/api/classrooms/{classroom_id}) ไม่ใช่ path จริง — path มี id ปน
        # ทำให้รวมสถิติราย endpoint ไม่ได้ และเป็นข้อมูลที่ไม่จำเป็นต้องอยู่ใน log
        route = request.scope.get("route")
        log_event(
            http_log,
            "http_request",
            level=logging.WARNING if status_code >= 500 else logging.INFO,
            method=request.method,
            route=getattr(route, "path", "unmatched"),
            statusCode=status_code,
            duration_ms=round((time.perf_counter() - start) * 1000, 1),
            user=user_ref(getattr(request.state, "user_email", None)),
            errorCode=getattr(request.state, "error_code", None),
        )
        request_id_var.reset(token)
        request_start_var.reset(start_token)


_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")


def _accept_request_id(incoming: str | None) -> str:
    """ใช้ id ที่ client/load balancer ส่งมาถ้ารูปแบบปลอดภัย ไม่งั้นสร้างใหม่

    ค่านี้มาจากภายนอกและถูกเขียนลง log ตรง ๆ — ถ้ารับทุกอย่าง คนส่ง header
    ยาวเป็นเมกะไบต์หรือมีอักขระขึ้นบรรทัดใหม่มาปลอม log บรรทัดอื่นได้ (log injection)
    """
    if incoming and _REQUEST_ID.fullmatch(incoming):
        return incoming
    return str(uuid.uuid4())


# error ทุกชนิดต้องออกมาในรูป ErrorEnvelope เดียวกัน ไม่งั้น client อ่านไม่ออก
# แล้วต้องแสดงข้อความ fallback ที่ไม่บอกอะไร (FR-API-03)
app.add_exception_handler(DomainError, domain_error_handler)
app.add_exception_handler(StarletteHTTPException, http_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)

app.include_router(auth_api.router)
app.include_router(account_api.router)
app.include_router(classrooms.router)
app.include_router(roster_api.router)
app.include_router(assignments_api.router)
app.include_router(members_api.router)
app.include_router(comparisons_api.router)
app.include_router(scoring_api.router)
app.include_router(notifications_api.router)
app.include_router(appeals_api.router)
app.include_router(lifecycle_api.router)
app.include_router(enrollment_api.router)
app.include_router(quality_api.router)
app.include_router(coverage_api.router)
app.include_router(reports_export_api.router)

# ---------------------------------------------------------------------------
# endpoint สำหรับ test จะถูกลงทะเบียนก็ต่อเมื่อไม่ใช่ production เท่านั้น
#
# เลือกวิธี "ไม่ include เลย" แทนการ include แล้วค่อยเช็คข้างใน
# เพราะแบบนี้ route ไม่มีอยู่จริงใน production — ไม่ใช่แค่ตอบ 404
# (ยังมี guard ซ้ำในทุก handler เป็นชั้นที่สองอยู่ดี)
# ---------------------------------------------------------------------------
if not IS_PRODUCTION:
    from app.api import test_support

    app.include_router(test_support.router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    """บอกว่า service พร้อมรับ traffic และตอนนี้รัน commit ไหนอยู่

    ใช้ 3 ที่:
    - หน้า landing เรียกมาแสดงสถานะ (WS-01)
    - HEALTHCHECK ของ Docker (WS-05)
    - ด่านตรวจว่า staging พร้อมก่อนยิง load test (WS-07)
    """
    return {
        "status": "ok", "version": APP_VERSION,
        "environment": ENVIRONMENT, "deploymentTier": DEPLOYMENT_TIER,
    }
