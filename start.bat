@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================================================
REM  PairEval - start.bat
REM
REM  ยกทุกอย่างที่ต้องใช้ตอน dev ขึ้นให้ครบด้วยการดับเบิลคลิกครั้งเดียว
REM    1) Postgres ใน Docker
REM    2) migration
REM    3) backend (FastAPI)   -> เปิดหน้าต่างใหม่
REM    4) frontend (Vite)     -> เปิดหน้าต่างใหม่
REM
REM  ปิดระบบ: ปิดหน้าต่างของ backend และ frontend
REM           ถ้าจะหยุด database ด้วยให้รัน  docker compose down
REM
REM  ไฟล์นี้ใช้สำหรับ "เครื่องตัวเอง" เท่านั้น
REM  WS-05 จะแทนที่ด้วย docker compose up ที่ยกทั้งระบบในคำสั่งเดียว
REM ============================================================================

cd /d "%~dp0"

set "BACKEND_PORT=8123"
set "FRONTEND_PORT=5173"
set "PY=backend\.venv\Scripts\python.exe"

echo.
echo ============================================================
echo   PairEval - เริ่มระบบสำหรับ development
echo ============================================================
echo.

REM ---------------------------------------------------------------- 1. Docker
echo [1/5] ตรวจ Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [X] Docker ไม่ทำงาน
    echo       เปิด Docker Desktop ให้ขึ้นสถานะ running แล้วรันไฟล์นี้ใหม่
    echo.
    pause
    exit /b 1
)
echo       Docker พร้อม

REM ------------------------------------------------------------ 2. PostgreSQL
echo [2/5] ยก PostgreSQL...
docker compose up -d db >nul 2>&1
if errorlevel 1 (
    echo   [X] ยก database ไม่สำเร็จ - ลองรัน  docker compose up db  เพื่อดู error เต็ม
    pause
    exit /b 1
)

REM รอจน healthcheck ผ่าน - ถ้าไม่รอ migration จะพังเพราะ Postgres ยังรับ connection ไม่ได้
set "DB_READY="
for /l %%i in (1,1,30) do (
    if not defined DB_READY (
        for /f "tokens=*" %%s in ('docker inspect --format="{{.State.Health.Status}}" paireval-db 2^>nul') do (
            if "%%s"=="healthy" set "DB_READY=1"
        )
        if not defined DB_READY (
            REM ใช้ ping หน่วงเวลาแทน timeout เพราะ timeout อ่าน stdin
            REM ถ้าถูกเรียกจากที่ที่ stdin ไม่ใช่ console มันจะตายทันทีแล้ววนลูปรวดโดยไม่ได้รอจริง
            ping -n 3 127.0.0.1 >nul
        )
    )
)
if not defined DB_READY (
    echo   [X] database ไม่พร้อมภายใน 60 วินาที
    echo       ดู log ด้วย  docker compose logs db
    pause
    exit /b 1
)
echo       PostgreSQL พร้อม ^(localhost:5433^)

REM -------------------------------------------------------- 3. Backend deps
echo [3/5] ตรวจ dependency ฝั่ง backend...
if not exist "%PY%" (
    echo       ยังไม่มี venv - กำลังสร้าง...
    python -m venv backend\.venv
    if errorlevel 1 (
        echo   [X] สร้าง venv ไม่สำเร็จ - ตรวจว่า python อยู่ใน PATH หรือยัง
        pause
        exit /b 1
    )
    "%PY%" -m pip install --upgrade pip >nul
    "%PY%" -m pip install -r backend\requirements-dev.txt
    if errorlevel 1 (
        echo   [X] ติดตั้ง dependency ไม่สำเร็จ
        pause
        exit /b 1
    )
)
echo       backend พร้อม

REM Frontend deps
if not exist "frontend\node_modules" (
    echo       ยังไม่มี node_modules ฝั่ง frontend - กำลังติดตั้ง...
    call npm ci --prefix frontend
    if errorlevel 1 (
        echo   [X] npm ci ไม่สำเร็จ
        pause
        exit /b 1
    )
)

REM --------------------------------------------------------- 4. Migration
echo [4/5] รัน migration...
pushd backend
set "PYTHONIOENCODING=utf-8"
".venv\Scripts\python.exe" -m app.migrate
if errorlevel 1 (
    popd
    echo   [X] migration ไม่สำเร็จ
    pause
    exit /b 1
)
popd

REM ------------------------------------------------------------ 5. Servers
echo [5/5] เปิด backend และ frontend...

REM ENVIRONMENT=development เปิด endpoint สำหรับ test (seed / cleanup / session)
REM ตั้งใจให้เปิดเฉพาะบนเครื่องตัวเอง - ห้ามใช้ค่านี้บน service ที่เข้าถึงได้จาก internet
REM
REM ใช้ /D กำหนด working directory ของหน้าต่างใหม่ แทนการใส่ cd /d ไว้ในคำสั่ง
REM เพราะการมี double quote ซ้อนกันจะทำให้ cmd ตัด string ผิดตำแหน่ง
start "PairEval API" /D "%~dp0backend" cmd /k "set ENVIRONMENT=development&& set CORS_ORIGINS=http://localhost:%FRONTEND_PORT%&& .venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port %BACKEND_PORT%"

start "PairEval Web" /D "%~dp0frontend" cmd /k "npm run dev"

echo.
echo ============================================================
echo   เปิดเรียบร้อย
echo.
echo     เว็บ      http://localhost:%FRONTEND_PORT%
echo     API       http://localhost:%BACKEND_PORT%/api/health
echo     API docs  http://localhost:%BACKEND_PORT%/docs
echo.
echo   ENVIRONMENT=development
echo   -^> endpoint /api/test/seed ^| cleanup ^| session เปิดอยู่
echo      ใช้ได้เฉพาะบนเครื่องตัวเองเท่านั้น
echo.
echo   ปิดระบบ: ปิดหน้าต่าง PairEval API และ PairEval Web
echo            หยุด database: docker compose down
echo ============================================================
echo.

REM รอสักครู่แล้วเปิดเบราว์เซอร์ให้
ping -n 5 127.0.0.1 >nul
start "" "http://localhost:%FRONTEND_PORT%"

endlocal
