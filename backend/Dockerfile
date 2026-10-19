# syntax=docker/dockerfile:1
#
# Backend (FastAPI) — multi-stage: deps → build → test → runtime
#
# ทุก stage อธิบายไว้ทีละบรรทัดตามข้อกำหนด WS-05
# build context คือ backend/ (ดู compose.yaml) จึงอ้าง path แบบไม่มี backend/ นำหน้า

# ---------------------------------------------------------------------------
# deps — ติดตั้งเฉพาะ production dependency ลง virtualenv ที่ยกไป stage อื่นได้ทั้งก้อน
# ---------------------------------------------------------------------------
# pin tag ไว้ที่ 3.12-slim: `latest` เปลี่ยนใต้เท้าเราได้ทุกเมื่อ ทำให้ build ที่เคยเขียว
# กลับมาแดงโดยที่ไม่มีใครแก้อะไรเลย · slim เล็กกว่า image เต็มราว 700MB
# และมี libc ครบพอสำหรับ psycopg[binary] (ต่างจาก alpine ที่ใช้ musl แล้ว wheel ไม่ตรง)
FROM python:3.12-slim AS deps

# ไม่เขียนไฟล์ .pyc ลง layer (ใช้ครั้งเดียวแล้วทิ้ง) และไม่ buffer stdout
# เพื่อให้ log ของ uvicorn โผล่ใน `docker logs` ทันที ไม่ค้างอยู่ใน buffer
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# copy เฉพาะ manifest ก่อน source — layer นี้ถูก cache ไว้และจะ rebuild ก็ต่อเมื่อ
# requirements.txt เปลี่ยนจริง แก้ code ธรรมดาจึงไม่ต้องลง dependency ใหม่ทุกครั้ง
COPY requirements.txt ./

# venv แยกที่ /opt/venv เพื่อให้ stage runtime `COPY --from=deps` มาได้ทั้งก้อน
# โดยไม่ต้องลาก pip cache หรือ build toolchain ตามไปด้วย
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# ---------------------------------------------------------------------------
# build — deps + dev dependency + source code · ใช้เป็น stage สำหรับ dev (hot reload)
# ---------------------------------------------------------------------------
FROM deps AS build

# requirements-dev.txt มี `-r requirements.txt` อยู่ข้างใน จึงลงทับของเดิมได้ปลอดภัย
COPY requirements-dev.txt ./
RUN /opt/venv/bin/pip install --no-cache-dir -r requirements-dev.txt

# ใส่ venv ไว้หน้าสุดของ PATH เพื่อให้เรียก `uvicorn` / `pytest` ตรง ๆ ได้
ENV PATH="/opt/venv/bin:$PATH"

# source เข้ามาหลังสุด: บรรทัดนี้คือ layer ที่ invalidate บ่อยที่สุด
# ถ้าวางไว้ก่อน pip install การแก้ code 1 บรรทัดจะทำให้ลง dependency ใหม่ทั้งหมด
COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ---------------------------------------------------------------------------
# test — stage ที่ compose.test.yaml ใช้รัน pytest ใน environment เดียวกับ CI
# ---------------------------------------------------------------------------
FROM build AS test

# ค่า default ของ config.py คือ production ซึ่งปิด endpoint /api/test/*
# ตอนรัน test ต้องไม่ใช่ production — ตั้งไว้ตรงนี้เพื่อให้ stage นี้ใช้ผิดที่ไม่ได้
ENV ENVIRONMENT=test

# -m "not integration" ถูกตั้งไว้แล้วใน pytest.ini · override ได้ที่ compose.test.yaml
CMD ["pytest"]

# ---------------------------------------------------------------------------
# runtime — image ที่เอาขึ้น production: prod dependency ล้วน ไม่มี source ของ test
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# non-root: ถ้า process ใน container ถูกยึด มันจะได้สิทธิ์ของ user คนนี้เท่านั้น
# ไม่ใช่ root ที่เขียนทับไฟล์ระบบใน container ได้ทุกไฟล์
# uid สูง ๆ ที่ไม่ชนกับ user บน host ลดผลกระทบเวลา mount volume ข้ามกัน
RUN useradd --create-home --uid 10001 appuser

WORKDIR /app

# --from=deps ไม่ใช่ --from=build: dev dependency (pytest, httpx2, coverage) ไม่มีที่ยืน
# ใน production image มันไม่ถูกใช้ แต่เพิ่มขนาดและเพิ่มพื้นที่ให้ช่องโหว่
COPY --from=deps /opt/venv /opt/venv

# copy เฉพาะสิ่งที่ runtime ต้องใช้จริง — ไม่เอา tests/ และไฟล์ config ของ dev
COPY --chown=appuser:appuser app ./app
COPY --chown=appuser:appuser migrations ./migrations

USER appuser

# EXPOSE เป็นเอกสารประกาศว่า image นี้ฟังพอร์ตไหน และให้ compose อ้างอิงได้
# มันไม่ได้เปิดพอร์ตออกมาที่ host — การ publish พอร์ตต้องใช้ -p หรือ ports: เท่านั้น
EXPOSE 8000

# HEALTHCHECK ตอบคำถามที่ต่างจาก "process ยังอยู่ไหม" — process อาจยังรันอยู่
# แต่ต่อ database ไม่ได้ หรือค้างจนไม่ตอบ request แล้ว การยิง /api/health จริง
# ทำให้ compose (depends_on: service_healthy) รอจนพร้อมรับ traffic ค่อยเริ่ม service ถัดไป
# ใช้ urllib จาก stdlib เพราะ image slim ไม่มี curl และไม่ควรลงเพิ่มแค่เพื่อ healthcheck
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2).status == 200 else 1)"

# migrate ก่อนแล้วค่อยยก uvicorn — ลำดับเดียวกับ startCommand บน Render (render.yaml)
# ถ้า migrate พัง container จะตายทันที ดีกว่าขึ้นแล้วพังตอนมี request จริง
CMD ["sh", "-c", "python -m app.migrate && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
