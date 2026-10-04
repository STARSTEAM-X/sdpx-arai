# Performance Report — WS-07

## Hypotheses ก่อนวัด candidate นี้ (2026-10-05)

- ที่ 10 student VUs บนเครื่อง: autosave p95 ≤300 ms และ submission p95 ≤800 ms.
- `/scores` ซึ่งอ่านข้อมูลคะแนนหลายชุดจะช้ากว่า autosave; คาด local p95 <50 ms.
- Staging จะช้ากว่า local เพราะ network และทรัพยากรของ Render; ต้องวัดจริง.

## Setup

- Profile ตาม lab: student VUs 0→5→10→0 (30s/60s/30s); instructor 1 VU 2 นาที.
- Dataset: 60 บัญชีนักศึกษา, 15 กลุ่ม, 2 criteria, assignment ที่ publish แล้ว.
- Journey: เข้าห้อง → เปิดงาน/คู่ → autosave 3 คู่ → ส่งผล; instructor อ่านคะแนน/roster.
- Public staging คง `ENVIRONMENT=production`; `DEPLOYMENT_TIER=staging` ใช้ระบุเป้าหมาย.
- Fixture/session อยู่ใน `performance/.secrets/`; baseline JSON ไม่เก็บ token.
- วัด local เพื่อ debug ก่อน; baseline ของ staging จะบันทึกแยกพร้อม URL/commit/เวลา.

## ผลและหลักฐาน

### Local candidate — 2026-10-05 01:24–01:26 Asia/Bangkok

รันบน Windows, Python 3.12.14, PostgreSQL 18 ที่ 127.0.0.1:55433,
API 127.0.0.1:8134, k6 2.3.0. Base commit c6dcab4 พร้อม working changes
ของ codex/ws06-07-source; ไม่จำกัด CPU/RAM ให้เท่า Render.
หลักฐาน: [baseline.json](../performance/baseline.json). JSON เดิมเก็บใน
[original-local-baseline.json](../performance/runs/original-local-baseline.json).

| Metric | p50 (ms) | p95 (ms) | p99 (ms) | เกณฑ์ |
|---|---:|---:|---:|---|
| HTTP รวม | 5.56 | 9.92 | 16.70 | p95 <500 ms |
| autosave | 6.33 | 8.78 | 11.72 | PRD p95 ≤300 ms |
| submit | 8.80 | 15.66 | 17.93 | PRD p95 ≤800 ms |
| my-evaluations | 5.17 | 7.45 | 14.03 | p95 <400 ms |
| scores | 5.77 | 9.17 | 11.65 | p95 <500 ms |

347 HTTP requests, throughput 2.60 req/s, HTTP errors 0%, journey errors 0%,
checks 344/344 ผ่าน, 61 iterations ครบและไม่มี interrupted iteration.
Peak 10 student VUs + 1 instructor; ใช้เวลา 133.2s รวม graceful ramp-down.
ทุก threshold ผ่าน, process exit 0.

### Hypothesis เทียบผล

- autosave และ submit ผ่านเกณฑ์ที่คาดไว้บน local.
- คาด scores ช้ากว่า autosave: ผล p95 9.17 กับ 8.78 ms สนับสนุนเล็กน้อย,
  แต่ submit ช้ากว่าทั้งสองที่ 15.66 ms. ความต่างระดับนี้ยังไม่พิสูจน์คอขวด.
- คาด staging ช้ากว่า local: **ยังไม่มี staging journey baseline ของ candidate นี้**.
  CI เตรียมรันหลัง deploy-staging; ห้ามใช้ baseline local แทนผลนั้น.

### Staging smoke — 2026-10-05 หลัง deploy 7db9796

ยิงจากเครื่อง Windows ในไทยไป paireval-api.onrender.com (Singapore), 3 VUs/30s,
health เท่านั้น: 87 requests, 2.85 req/s, p50 46.45ms, p95 **64.22ms**,
max 103.51ms, errors 0%, checks ทุกข้อผ่าน, exit 0.
หลักฐาน [staging-smoke.json](../performance/staging-smoke.json).
API health และ web build-info ยืนยัน SHA ตรงกัน; /api/test/* ไม่เปิด.
Smoke profile นี้ไม่ใช่ journey ที่มี autosave/submit และไม่ใช้แทน NFR 200 users.
ตำแหน่ง runner ต่างจาก failure proof บน GitHub จึงไม่เปรียบเทียบ p95 สองรอบโดยตรง.

### หลักฐานจาก structured logs

| Route | duration_ms | requestId | บริบท |
|---|---:|---|---|
| /api/assignments/{assignment_id}:publish | 54.3 | ac279c9b-0668-408d-bcb6-140e55c213bd | เตรียม fixture; ไม่ใช่ steady workload |
| /api/comparisons/{pair_assignment_id} | 36.9 | eebe67b5-a9b5-405e-8492-c9b4c3df5706 | autosave ที่ช้าที่สุดใน log รอบนี้ |
| /api/assignments/{assignment_id}/submissions | 15.9 | 841252b2-98e0-40fa-8d35-db5c4ff798e3 | submit ระหว่าง load |

HTTP log และ business events มี event, requestId, duration_ms;
business duration คือเวลาจากรับ request ถึงจุด log ไม่ใช่เวลาของ SQL statement.
Route ใช้ pattern, ผู้ใช้ใช้ HMAC reference, formatter redact ข้อมูลอ่อนไหว.
Unit tests ตรวจ context และ redaction โดยใช้ข้อมูลสังเคราะห์.

### CI threshold failure proof

Branch ทดลอง codex/ws06-07-gate-proof ใช้ smoke บน staging health ด้วย
p95<0.0001ms, ได้ p95 730.24ms และ k6 exit 99 จริงใน
[run 37244411279](https://github.com/STARSTEAM-X/sdpx-arai/actions/runs/37244411279).
PR #19 ปิดโดยไม่ merge; candidate คงเกณฑ์ปกติ. นี่เป็น failure proof 5s
ไม่ใช่ baseline smoke 30s หรือ journey ของ staging candidate.

### ข้อเสนอ AI ที่รับและยังไม่รับ

| ข้อเสนอ | การตัดสินใจและหลักฐาน |
|---|---|
| วัดแยก endpoint และใช้ PRD thresholds | รับ; baseline แสดง submit ช้ากว่า scores จึงไม่เดาจากรูป code |
| เรียก /api/test/session บน public staging | ไม่รับ; ขัด AGENTS.md. ใช้ CLI fixture ที่ได้รับ staging credentials แทน |
| เพิ่ม index / เปลี่ยนเป็น bulk INSERT ทันที | ยังไม่รับ; log รวมไม่แยก pairing CPU กับ SQL I/O และ workload รอบนี้ยังไม่แสดง saturation |
| ลด test coverage เพื่อให้ CI เร็ว | ไม่รับ; Docker cache ลด setup และคง test ชุดเดิมทั้งหมด |

ก่อน WS-08 ให้วัด staging baseline จริง, ตรวจทรัพยากรและ slow SQL แบบอ่านอย่างเดียว,
แยกเวลา pairing/DB แล้วเปรียบเทียบด้วย dataset และ profile เดิมหลังเปลี่ยนทีละจุด.
NFR 200 users, page p95/p99, pairing/recompute SLA ยังไม่ได้วัดในรอบนี้.
การทดลองเดิมของ branch supitcha อยู่ใน [performance-history-ws07.md](performance-history-ws07.md);
ตัวเลขและข้อสรุปเดิมไม่ใช่ผล deploy ของ candidate นี้.
