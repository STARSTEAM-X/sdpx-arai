# ADR-006: ส่งออกแบบ synchronous ต่อไป ยังไม่ทำ async job ตาม FR-API-05

## Status

Accepted — ทบทวนเมื่อเวลาส่งออกจริงเกิน 10 วินาที

## Date

2026-10-20

## Context

[PRD](../../Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md) §12 **FR-API-05 (S)**: export ที่ใช้เวลานาน
SHOULD เป็น async job แล้วส่งลิงก์ทางอีเมล

`POST /api/assignments/{id}/reports:export` สร้าง XLSX/CSV ใน request เดียว ([reports_export.py](../../backend/app/api/reports_export.py))
ระบบไม่มีคิวงาน และไม่มีโค้ดส่งอีเมลเลย (ไม่มี SMTP หรือบริการส่งอีเมลใน backend — `app/domain/email.py`
เป็นการ normalize อีเมลเท่านั้น) · ยังไม่ได้วัดเวลาส่งออกของห้อง 200 คน

## Decision

คง synchronous · จำกัดความถี่ส่งออก 5 ครั้งต่อนาทีต่อผู้ใช้ (FR-API-04, `app/rate_limit.py`) กันการยิงซ้ำหนัก ๆ

## Alternatives Considered

1. **Background task ของ FastAPI + ลิงก์ดาวน์โหลดชั่วคราว** — ต้องมีที่เก็บไฟล์และส่งอีเมลจริง
2. **คิวงานแยก (เช่น RQ + Redis)** — เพิ่ม service บน Render ซึ่ง free plan ไม่มี

## Consequences

- ถ้าห้องใหญ่ขึ้นจนส่งออกช้า ผู้ใช้จะรอใน request นั้น · ตัวชี้วัดคือ `duration_ms` ของ route นี้ใน log
