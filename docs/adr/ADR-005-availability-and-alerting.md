# ADR-005: ยอมรับความเสี่ยง NFR-AVAIL-01/02 และ NFR-OBS-02 บน Render free

## Status

Proposed — ยอมรับชั่วคราวสำหรับงานวิชา ต้องทบทวนถ้าใช้กับรายวิชาจริง

## Date

2026-10-20

## Context

[PRD](../../Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md) §13:

- **NFR-AVAIL-01** uptime 99.5% ต่อเดือน · 99.9% ใน 48 ชม. ก่อน deadline
- **NFR-AVAIL-02** RPO ≤ 15 นาที · RTO ≤ 4 ชม. · ทดสอบ restore ภาคเรียนละครั้ง
- **NFR-OBS-02** alert เมื่อ error rate > 1% ต่อเนื่อง 5 นาที หรือ p95 เกินเป้า 2 เท่า

ทั้ง staging และ production ใช้ `plan: free` ของ Render ([render.yaml](../../render.yaml)):
web service หลับเมื่อไม่มีคนใช้ (cold start หลายสิบวินาที) และ Postgres free ไม่มี point-in-time recovery
ระบบมี log JSON ต่อ request (requestId, route, statusCode, duration_ms — `app/main.py`) แต่ไม่มีตัวรับ log และไม่มี alert

## Decision

ไม่อ้างว่าผ่าน — บันทึกว่า **ยังไม่ผ่าน** และสิ่งที่ต้องทำถ้าจะผ่าน:

| ข้อ | สิ่งที่ขาด | ทางเลือกที่ต้องใช้ |
|---|---|---|
| NFR-AVAIL-01 | free plan หลับ · ไม่มี SLA | Render paid instance (ไม่หลับ) อย่างน้อยช่วงก่อน deadline |
| NFR-AVAIL-02 | ไม่มี PITR · ยังไม่เคยทดสอบ restore | Postgres paid (PITR) หรือ `pg_dump` ทุก 15 นาทีไปที่เก็บภายนอก + ซ้อม restore |
| NFR-OBS-02 | ไม่มีที่รวม log / ตัวคำนวณ error rate | ส่ง log JSON ไป log drain (เช่น Better Stack / Grafana Cloud) แล้วตั้ง alert จาก `statusCode` และ `duration_ms` |

## Consequences

- ใช้เป็นเดโมและงานวิชาได้ · ไม่ควรใช้ตัดเกรดจริงจนกว่าจะปิด 3 ข้อด้านบน
- log ต่อ request มีฟิลด์ครบสำหรับคำนวณทั้งสองเงื่อนไขของ NFR-OBS-02 อยู่แล้ว ไม่ต้องแก้แอป
