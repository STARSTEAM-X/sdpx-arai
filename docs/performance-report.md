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
- Target staging: https://paireval-api.onrender.com; ระบุ commit แยกในผลแต่ละรอบ.
- รัน staging ด้วย GitHub-hosted ubuntu-latest; ไม่ได้บันทึกภูมิภาคของ runner.
- baseline.json เป็น staging รอบแรก 90fe6d9; รอบยืนยัน edba11d เก็บแยกใน runs/.
  ผล local เดิมเก็บใน runs/local-candidate-20261005.json.

## ผลและหลักฐาน

### Local candidate — 2026-10-05 01:24–01:26 Asia/Bangkok

รันบน Windows, Python 3.12.14, PostgreSQL 18 ที่ 127.0.0.1:55433,
API 127.0.0.1:8134, k6 2.3.0. Base commit c6dcab4 พร้อม working changes
ของ codex/ws06-07-source; ไม่จำกัด CPU/RAM ให้เท่า Render.
หลักฐาน: [local-candidate-20261005.json](../performance/runs/local-candidate-20261005.json). JSON เดิมเก็บใน
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
- คาด staging ช้ากว่า local: ยืนยันจาก journey ด้านล่าง; autosave p95 317.95 เทียบ 8.78 ms.
  สภาพเครื่องและเส้นทาง network ต่างกัน จึงไม่ใช่ผลก่อน/หลังการ optimize แอป.

### Staging journey ผ่าน CI — 2026-10-05 07:32:07–07:34:26 Asia/Bangkok

[Run 37247458310](https://github.com/STARSTEAM-X/sdpx-arai/actions/runs/37247458310)
รันหลัง deploy-staging ยืนยัน SHA ของ API/เว็บตรงกันแล้ว. หลักฐาน
[baseline.json](../performance/baseline.json) เก็บ metrics/root_group จากผลรอบนี้
หลังนำ setup_data ออก; ไม่แก้ตัวเลขหรือ thresholds.

พบว่า k6 summary-export แนบ setup_data ซึ่งมี session ของบัญชีจำลองไปใน artifact.
ลบ artifact 11320210252 แล้ว และเจ้าของยืนยันเปลี่ยน SESSION_SECRET ทั้ง Render/GitHub
เมื่อ 07:58–08:00. สั่ง deploy API ใหม่เพื่อรับค่าที่บันทึกไว้; การทดสอบหลัง deploy
จะตรวจว่าค่าของทั้งสองระบบตรงกันโดยไม่อ่านค่า secret.
แก้ setup ให้คืนเฉพาะ classroomId/assignmentId/runId และเพิ่มตัวกรองก่อน upload:
อนุญาตเฉพาะ metrics/root_group, หยุด upload หากพบข้อมูลส่วนตัวในสองส่วนนี้.
ผลเก่าบน working tree ผ่านตัวกรองเดียวกัน; ไม่เปลี่ยนประวัติ Git หรือผลวัด.
ดู provenance สำหรับ checksum ของไฟล์ก่อนและหลังนำ setup_data ออก.

| Metric | p50 (ms) | p95 (ms) | p99 (ms) | ผลตามเกณฑ์ |
|---|---:|---:|---:|---|
| HTTP รวม | 262.93 | 337.99 | 693.43 | ผ่าน p95 <500 |
| autosave | 264.33 | **317.95** | 461.72 | **ไม่ผ่าน PRD p95 ≤300** |
| submit | 282.00 | 393.44 | 476.25 | ผ่าน PRD p95 ≤800 |
| my-evaluations | 266.83 | 385.74 | 656.81 | ผ่าน p95 <400 |
| scores | 259.81 | 299.84 | 339.54 | ผ่าน p95 <500 |

335 requests, 2.41 req/s, HTTP/journey errors 0%, checks 332/332 ผ่าน.
58 iterations ครบ, 0 interrupted, peak 10 student VUs + 1 instructor,
138.8s รวม graceful ramp-down. p95 autosave เกิน 17.95ms (5.98%);
ทั้ง autosave_latency และ save_comparison threshold ล้มเหลว จึง exit **99**.
Pipeline โดยรวม **แดง** แม้ test gates และ deploy ผ่าน; ไม่ใช่พร้อมปล่อย production.
ใน JSON summary-export ของ k6 นี้ threshold boolean **true หมายถึงล้มเหลว**.

Smoke จาก CI: 72 requests, errors 0%, p50 239.80ms, p95 468.84ms, max 741.29ms,
ผ่านเกณฑ์ p95<500; checks 212/216 โดย 4 ข้อที่ไม่ผ่านคือราย request ช้ากว่า 500ms.
หลักฐาน [staging-smoke.json](../performance/staging-smoke.json).

### รอบยืนยันหลังแก้ความปลอดภัย — edba11d, 2026-10-05

[Run 37250469594](https://github.com/STARSTEAM-X/sdpx-arai/actions/runs/37250469594)
ผ่านทั้ง pipeline: 7 test/lint gates, deploy-staging และ performance.
API/เว็บยืนยัน commit edba11daa41bf30d1d9a29b84992773c334a9ef4;
ENVIRONMENT=production, DEPLOYMENT_TIER=staging, public OpenAPI ไม่มี /api/test/*.
CLI publish assignment และ journey authentication ผ่านหลังเปลี่ยน signing key
ยืนยันว่า PERF_SESSION_SECRET ของ GitHub ใช้งานกับ staging API ได้.

| Metric | p50 (ms) | p95 (ms) | p99 (ms) | ผล |
|---|---:|---:|---:|---|
| HTTP รวม | 248.47 | 340.15 | 736.03 | ผ่าน p95 <500 |
| autosave | 248.93 | **270.40** | 687.83 | ผ่าน p95 ≤300 |
| submit | 269.11 | **351.71** | 615.24 | ผ่าน p95 ≤800 |

319 requests, 2.32 req/s, HTTP/journey errors 0%, ทุก threshold ผ่าน, exit 0.
Smoke 73 requests, errors 0%, p95 257.39ms. หลักฐาน:
[journey](../performance/runs/staging-baseline-edba11d.json),
[smoke](../performance/runs/staging-smoke-edba11d.json),
[provenance](../performance/runs/staging-provenance-edba11d.json).
ดาวน์โหลด artifact 11320399704 หลังตัวกรองผ่านแล้ว; ตรวจซ้ำทั้งสองไฟล์มีเพียง
metrics/root_group และไม่พบ session/email/credential patterns. Cleanup fixture ผ่าน.

รอบนี้แก้การส่งออกผลและบันทึกหลักฐาน ไม่ได้ optimize handler หรือปรับ thresholds.
จึงไม่อ้างว่าความต่างจาก 317.95ms เป็นผลของ optimization.
ทั้งสองรอบแสดงความแปรผันของสภาพแวดล้อม; รอบที่ผ่านครั้งเดียวไม่ยืนยัน NFR 200 users
หรือความเสถียรทุกช่วงเวลา. คงผลแดงและแผนวัดเพิ่มด้านล่างไว้.

### Bottleneck และ AI analysis จาก staging รอบแรก

ตรวจ [request log aggregate](../performance/runs/staging-log-summary-90fe6d9.json)
450 events และ [comparison_saved aggregate](../performance/runs/staging-business-log-summary-90fe6d9.json)
108 events: JSON parse ผ่านทุกบรรทัด, มี event/requestId/duration_ms ครบ,
ไม่พบ email, JWT, Bearer token หรือ DB URL ตาม patterns ที่ตรวจ. ไม่เก็บ raw logs/ผู้ใช้ใน repo.

| เส้นทางใน API | จำนวน | p50 (ms) | p95 (ms) | max (ms) |
|---|---:|---:|---:|---:|
| health | 114 | 0.80 | 2.47 | 4.90 |
| autosave | 108 | 9.80 | 57.76 | 218.50 |
| submit | 36 | 21.55 | 104.98 | 243.90 |

[Render resource metrics](../performance/runs/staging-resource-90fe6d9.json), resolution 30s:
ช่วง journey CPU max 0.0179 จาก limit 0.15 cpu (11.94%); memory max 94.37MiB
จาก limit 512MiB (18.43%). จุดแรกช่วง setup/publish CPU 0.1117 cpu;
ยังมี limit series ของ instance เก่า/ใหม่ซ้อนกัน จึงไม่แปลงจุดนั้นเป็น utilization ของ instance เดียว.
sampling นี้ไม่เห็น steady CPU/memory saturation แต่ไม่ตัด transient spikes ระหว่างจุดวัด.

| สาเหตุที่ AI จัดอันดับ | การตัดสินใจจากหลักฐาน | วัดเพิ่มเพื่อยืนยัน |
|---|---|---|
| 1. Network/Render edge และเวลารอก่อนถึง handler | รับเป็นสาเหตุที่มีหลักฐานมากที่สุด: client health median 239.80ms แต่ API median 0.80ms; client HTTP waiting p95 337.74ms ใกล้ duration 337.99ms ขณะที่ TLS/connect p95 0 | เก็บ client timings คู่กับ requestId และเทียบ runner ใกล้ Singapore ด้วย profile เดิม |
| 2. DB/transaction หรือ queue ใน autosave tail | เป็น hypothesis: handler p95 57.76ms/max 218.50ms; ยังไม่แยก pool wait, SQL, commit และ Python | เพิ่ม timings เฉพาะแต่ละช่วงใน WS-08; DB ยังไม่มี pg_stat_statements จึงไม่มี slow-SQL proof |
| 3. Warmup/ทรัพยากร Free ที่มี burst | ยังไม่ยืนยัน: setup CPU สูงกว่าช่วง journey แต่ sampling 30s หยาบ | เทียบ cold/warm runs โดยคง dataset/VUs/runner และเก็บ metrics ที่ละเอียดขึ้น |

ไม่ลบ network time ออกจากเกณฑ์ PRD และไม่ลบผลแดงออกจาก baseline.
แอปมี connection pool min=1/max=10 อยู่แล้ว จึงไม่รับข้อเสนอเพิ่ม pool หรือ dependency
โดยยังไม่มีหลักฐานว่ารอ pool. ไม่รับข้อสรุปว่า CPU ตันจากผลชุดนี้.
ค่าของ client/API เป็นคนละ series; ห้ามลบ p95 สองชุดแล้วเรียกผลต่างว่า network p95.
ตาม Source WS-07 หัวข้อ “สิ่งที่จะแก้ (ยังไม่แก้ในวันนี้)” เก็บแผนสำหรับ WS-08
และยังไม่ refactor handler เพื่อทำให้ baseline นี้เขียว.

### Staging smoke — 2026-10-05 หลัง deploy 7db9796

ยิงจากเครื่อง Windows ในไทยไป paireval-api.onrender.com (Singapore), 3 VUs/30s,
health เท่านั้น: 87 requests, 2.85 req/s, p50 46.45ms, p95 **64.22ms**,
max 103.51ms, errors 0%, checks ทุกข้อผ่าน, exit 0.
หลักฐาน [staging-smoke-thailand-20261005.json](../performance/runs/staging-smoke-thailand-20261005.json).
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

ก่อนแก้ใน WS-08 ให้จับคู่ client/server request timings, แยกเวลา pairing/DB/pool
แล้วเปรียบเทียบด้วย dataset และ profile เดิมหลังเปลี่ยนทีละจุด.
NFR 200 users, page p95/p99, pairing/recompute SLA ยังไม่ได้วัดในรอบนี้.
การทดลองเดิมของ branch supitcha อยู่ใน [performance-history-ws07.md](performance-history-ws07.md);
ตัวเลขและข้อสรุปเดิมไม่ใช่ผล deploy ของ candidate นี้.
