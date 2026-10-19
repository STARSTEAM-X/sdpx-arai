# ADR-005: NFR-OBS-02 alert ในแอป · NFR-AVAIL-01/02 ติดข้อจำกัดของ Render free

## Status

- **NFR-OBS-02 — Accepted** (2026-10-20) ทำในแอปแล้ว
- **NFR-AVAIL-01/02 — ยังไม่ผ่าน** ต้องใช้บริการแบบเสียเงินหรือที่เก็บ backup ภายนอก ซึ่งต้องให้เจ้าของบัญชีตัดสินใจ
- **อัปเดต 2026-10-20 (GAP-08/10)** — มี backup รายวันแบบเข้ารหัส + สคริปต์ซ้อมกู้ (RPO 24 ชม.) · เพิ่มเป้า p95 ของหน้า Evaluation · webhook รองรับ Discord · ขั้นตอนที่เจ้าของบัญชีต้องทำ: [backup-restore.md](../backup-restore.md)

## Date

2026-10-20

## Context

[PRD](../../Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md) §13:

- **NFR-AVAIL-01** uptime 99.5% ต่อเดือน · 99.9% ใน 48 ชม. ก่อน deadline
- **NFR-AVAIL-02** RPO ≤ 15 นาที · RTO ≤ 4 ชม. · ทดสอบ restore ภาคเรียนละครั้ง
- **NFR-OBS-02** alert เมื่อ error rate > 1% ต่อเนื่อง 5 นาที หรือ p95 latency เกินเป้า 2 เท่า

ทั้ง staging และ production ใช้ `plan: free` ของ Render ([render.yaml](../../render.yaml)):
web service หลับเมื่อไม่มีคนใช้ (cold start หลายสิบวินาที) และ Postgres free ไม่มี point-in-time recovery

## Decision

### NFR-OBS-02 — ตรวจในแอป ([app/alerting.py](../../backend/app/alerting.py))

- middleware ใน `app/main.py` ส่งทุก request เข้า `AlertMonitor` (นับในหน่วยความจำ — instance เดียว เหมือน rate limit)
- `alert_loop` ตรวจทุกนาที ดูเฉพาะ 5 นาทีเต็มล่าสุด:
  - **error rate** — ทุกนาทีในหน้าต่างมี request และสัดส่วน 5xx **เกิน** 1% (นาทีเดียวที่พุ่ง หรือนาทีที่ไม่มี request ไม่นับว่าต่อเนื่อง · 4xx ไม่นับ)
  - **p95** — เทียบเป้าราย endpoint จาก NFR-PERF-02 (`PUT /api/comparisons/{id}` 300 ms) และ NFR-PERF-03
    (`POST …/submissions` 800 ms) · เกิน 2 เท่าเมื่อมีตัวอย่าง ≥ 20 ครั้ง ·
    NFR-PERF-01 เป็นเวลาโหลดหน้าในเบราว์เซอร์ วัดเต็มฝั่ง server ไม่ได้ จึงเฝ้า API หลักของหน้า (`GET …/my-evaluations`)
    ด้วยงบครึ่งหนึ่งของหน้า = 1,000 ms (alert ที่ 2,000 ms = API ตัวเดียวกินงบทั้งหน้าแล้ว)
- แจ้งครั้งเดียวตอนเริ่มผิดปกติ (`firing`) และตอนกลับปกติ (`resolved`) เป็น log event `alert` ระดับ ERROR / WARNING
  และ POST JSON ไปที่ `ALERT_WEBHOOK_URL` ถ้าตั้งไว้ (Slack / Discord / Better Stack incoming webhook) — ส่งไม่ออกไม่ทำให้ loop ตาย
- unit test: `tests/unit/test_alerting.py` (เกิน/เท่ากับเกณฑ์ · spike นาทีเดียว · นาทีที่ไม่มี traffic · ตัวอย่างน้อย · หลุดหน้าต่าง · webhook พัง)

### NFR-AVAIL-01/02 — ยังไม่ผ่าน

| ข้อ | สิ่งที่ขาด | สิ่งที่ต้องมี (ต้องใช้บัญชี/งบของเจ้าของ) |
|---|---|---|
| NFR-AVAIL-01 | free plan หลับ · ไม่มี SLA | Render paid instance (ไม่หลับ) อย่างน้อยช่วง 48 ชม. ก่อน deadline |
| NFR-AVAIL-02 | ไม่มี PITR · backup วันละครั้ง (RPO 24 ชม.) · ซ้อมกู้บนเครื่องแล้ว ยังไม่ซ้อมกับข้อมูล production | Postgres paid (PITR) หรือ `pg_dump` ทุก 15 นาทีไปที่เก็บภายนอกที่เข้ารหัส + ซ้อม restore ภาคเรียนละครั้ง |

## Consequences

- ถ้าไม่ตั้ง `ALERT_WEBHOOK_URL` (Render Dashboard — `sync: false` ในทั้งสอง blueprint) alert ยังอยู่ใน log แต่ไม่มีใครถูกเรียก
- **ข้อจำกัด single-instance:** นับต่อ instance และหายเมื่อ process restart (รวมถึงตอน free plan หลับ) — ถ้าขยายเป็นหลาย instance ต้องย้ายไปนับที่ log drain
- ใช้เป็นเดโมและงานวิชาได้ · ไม่ควรใช้ตัดเกรดจริงจนกว่า NFR-AVAIL-01/02 จะผ่าน
