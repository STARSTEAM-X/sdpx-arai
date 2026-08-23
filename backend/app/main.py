"""PairEval API"""

import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth as auth_api
from app.api import classrooms
from app.api.errors import domain_error_handler
from app.config import APP_VERSION, CORS_ORIGINS, ENVIRONMENT, IS_PRODUCTION
from app.db import close_pool, open_pool
from app.domain.errors import DomainError


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    open_pool()
    yield
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
async def attach_request_id(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """ให้ทุก request มี id ของตัวเอง

    ใช้ตามรอย error ใน log และส่งกลับไปใน error response เพื่อให้ผู้ใช้แจ้งปัญหาได้ตรงจุด
    จะต่อยอดเป็น structured logging เต็มรูปแบบใน WS-07
    """
    request.state.request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    response = await call_next(request)
    response.headers["x-request-id"] = request.state.request_id
    return response


app.add_exception_handler(DomainError, domain_error_handler)

app.include_router(auth_api.router)
app.include_router(classrooms.router)

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
    return {"status": "ok", "version": APP_VERSION, "environment": ENVIRONMENT}
