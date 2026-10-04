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
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import assignments as assignments_api
from app.api import auth as auth_api
from app.api import classrooms
from app.api import comparisons as comparisons_api
from app.api import members as members_api
from app.api import roster as roster_api
from app.api import scoring as scoring_api
from app.api.errors import (
    domain_error_handler,
    http_error_handler,
    validation_error_handler,
)
from app.config import (
    APP_VERSION,
    CORS_ORIGINS,
    DEPLOYMENT_TIER,
    ENVIRONMENT,
    IS_PRODUCTION,
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(classrooms.router)
app.include_router(roster_api.router)
app.include_router(assignments_api.router)
app.include_router(members_api.router)
app.include_router(comparisons_api.router)
app.include_router(scoring_api.router)

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
        "status": "intentional-gate-proof-failure", "version": APP_VERSION,
        "environment": ENVIRONMENT, "deploymentTier": DEPLOYMENT_TIER,
    }
