# Performance Report — WS-07

## Hypothesis (เขียนก่อนรัน load test ครั้งแรก — ห้ามแก้ย้อนหลัง)

อ่านจาก code ก่อนวัด (2026-10-04):

| # | Hypothesis | เหตุผลที่คิดแบบนั้น |
|---|---|---|
| H1 | `PUT /api/comparisons/{id}` (autosave) จะช้าที่สุด p95 > 300ms ที่ 10 VUs | เป็นทางเดียวที่ **เขียน** ลง DB และต้อง query 4 ครั้งต่อ request (หา pair → หา assignment → ตรวจสมาชิก → upsert) ใน transaction เดียว |
| H2 | `GET my-evaluations` ช้าอันดับสอง (~100–200ms) | JOIN pair_assignment กับ item ของทั้งงาน — ห้อง 60 คนมีคู่หลายร้อยแถว |
| H3 | `GET /api/me` กับ `GET /api/classrooms` เร็ว (< 50ms) | query เล็ก มี index ที่ email |
| H4 | connection pool (`max_size=10`) จะไม่เป็นคอขวดที่ 10 VUs | think time ทำให้ request พร้อมกันจริงน้อยกว่าจำนวน VU มาก |
| H5 | error rate = 0 | ไม่มีเหตุให้ล้มที่โหลดระดับนี้ |

## Setup

| | |
|---|---|
| Script | [`performance/load-test.js`](../performance/load-test.js) — scenario `students` (ramping 0→5→10 VUs: 30s / 1m / 30s) + `instructor` (1 VU ตลอด 2 นาที) |
| Journey ของนักศึกษา | `GET /api/me` → `GET /api/classrooms` → *อ่าน 1–2 วิ* → `GET .../assignments` → `GET .../my-evaluations` → *อ่าน 2–4 วิ* → `PUT /api/comparisons/{id}` × 3 คู่ โดย *ดูงาน 3–6 วิ* ก่อนเลือกแต่ละคู่ |
| Journey ของอาจารย์ | `GET .../scores` + `GET .../roster` ทุก 5 วินาที |
| ข้อมูล | ห้อง 60 คน 15 กลุ่ม · งาน 2 เกณฑ์ publish แล้ว = **240 คู่** (stress 120 คน = 960 คู่) — สร้างใน `setup()` ผ่าน API จริง |
| Thresholds | `http_req_failed<1%` · `http_req_duration p95<500ms` · `checks>99%` · `journey_errors<5%` · `autosave_latency p95<300ms` · ราย endpoint ด้วย tag `name` |
| เครื่องมือ | k6 v2.3.0 (Docker image `grafana/k6`) · วันที่ 2026-10-04 |

### ทำไม journey เต็มไม่ได้ยิงใส่ staging ของกลุ่ม (ข้อขัดแย้งกับเอกสาร lab)

lab ให้ยิง journey ใส่ **staging** แต่ staging ของกลุ่ม (`paireval-api.onrender.com`) คือเว็บที่ทุกคนใช้จริง
ตั้ง `ENVIRONMENT=production` → login ได้ทาง **Google OIDC อย่างเดียว** และ `/api/test/session` ถูกปิดสนิท
k6 จึงขอ session ของนักศึกษาไม่ได้ — และไม่ควรยิง load ใส่เว็บที่มีผู้ใช้จริงอยู่ดี

| ตัวเลข | ที่มา |
|---|---|
| smoke ใส่ staging จริงของกลุ่ม (`/api/health` ไม่ต้อง login) | วัดแล้ว (ด้านล่าง) · CI ยิงซ้ำทุก deploy ใน job `staging-smoke` |
| journey เต็ม — baseline + หาจุดแตก | backend image เดียวกันบนเครื่อง จำกัดทรัพยากรเท่า Render free (`--cpus 0.1 --memory 512m`) |
| journey เต็มใน CI | job `performance` ยก API + Postgres ใน runner แล้วยิงก่อน deploy |

**เตรียมไว้แล้วถ้ากลุ่มเพิ่ม staging แยก** (commit `26738ba`): ตั้ง `ENVIRONMENT=staging` + `TEST_SUPPORT_TOKEN`
→ `/api/test/*` เปิดเฉพาะ request ที่แนบ `X-Test-Support-Token` ตรงกัน (ไม่ตรง = 404) และ seed แบบ `reset: false` ไม่ลบข้อมูลเดิม
ทดสอบบนเครื่องแล้ว: ไม่มี token → setup fail พร้อมข้อความ (exit 107) · มี token → ผ่าน · token ไม่โผล่ใน log

## Results

### staging จริง — smoke (`/api/health`, 3 VUs, 30 วินาที)

| p50 | p95 | http_req_failed | throughput | exit code |
|---|---|---|---|---|
| 59.8ms | **92.8ms** | 0.00% | 2.78 req/s | 0 |
| ทดสอบ gate: `P95_MS=1` | p95 = 90.9ms | | | **99** ✅ |

เกือบทั้งหมดของ 60ms คือ network round trip ไทย → Render singapore (handler ใช้ CPU ~1ms)

### journey เต็ม — baseline ตาม profile ของ lab (`performance/baseline.json`)

เครื่อง dev ไม่จำกัด CPU · 10 VUs · 406 requests · **ทุก threshold ผ่าน · exit 0**

| Endpoint (tag) | p50 | p95 | error rate |
|---|---|---|---|
| `GET /api/me` (`me`) | 2.8ms | 4.5ms | 0% |
| `GET /api/classrooms` (`classrooms`) | 2.4ms | 3.5ms | 0% |
| `GET .../my-evaluations` (`my_evaluations`) | 3.9ms | 6.1ms | 0% |
| `PUT /api/comparisons/{id}` (`save_comparison`) | 4.6ms | 6.4ms | 0% |
| `GET .../scores` (`scores`) | 4.9ms | 7.5ms | 0% |
| **รวม** | 3.8ms | **6.1ms** | **0%** · 3.11 req/s |

### หาจุดแตก — เพิ่ม VU และจำกัด CPU ให้เท่า Render free (ไฟล์ใน `performance/runs/`)

| Run | VUs | req/s | p50 | p95 | autosave p95 | failed | thresholds |
|---|---|---|---|---|---|---|---|
| ไม่จำกัด CPU | 100 | 23.6 | 3.7ms | 6.3ms | 6.9ms | 0% | ✅ |
| ไม่จำกัด CPU | 300 | 68.4 | 4.0ms | 10.4ms | 12.2ms | 0% | ✅ |
| 0.1 CPU + healthcheck ของ compose | 10 | 3.0 | 5.2ms | **196.6ms** | 188.8ms | 0% | ✅ (เฉียด) |
| 0.1 CPU + healthcheck ของ compose | 30 | 7.3 | 5.2ms | **364.6ms** | **423.8ms** | 0% | ❌ exit 99 |
| 0.1 CPU ไม่มี healthcheck | 10 | 3.0 | 3.8ms | 10.2ms | 6.2ms | 0% | ✅ |
| 0.1 CPU ไม่มี healthcheck | 30 | 7.5 | 3.5ms | 16.7ms | 7.7ms | 0% | ✅ |
| 0.1 CPU ไม่มี healthcheck | 60 | 14.4 | 3.9ms | 99.4ms | 138.5ms | 0% | ✅ |
| 0.1 CPU ไม่มี healthcheck | 120 | 21.4 | **722ms** | **2,339ms** | **2,557ms** | **0.42%** | ❌ exit 99 |

## Hypothesis vs Actual

| # | Hypothesis | ผลจริง | ถูก/ผิด |
|---|---|---|---|
| H1 | autosave ช้าที่สุด p95 > 300ms ที่ 10 VUs | ช้าที่สุดจริงแทบทุก run แต่ p95 = **6.4ms** ที่ 10 VUs (เกิน 300ms ต่อเมื่อ 0.1 CPU + 30 VUs) | **ลำดับถูก ขนาดผิด ~50 เท่า** |
| H2 | my-evaluations ~100–200ms | p95 6.1ms | **ผิด** |
| H3 | me / classrooms < 50ms | 4.5ms / 3.5ms | ถูก |
| H4 | pool ไม่ใช่คอขวดที่ 10 VUs | ถูกที่ 10 VUs · ที่ 120 VUs ยังแยกไม่ได้ (ดู AI Analysis) | ถูก (ในขอบเขตที่ตั้งไว้) |
| H5 | error = 0 | 0% ถึง 60 VUs · **120 VUs มี connection reset 12 ครั้ง** ที่ไม่มีใน log ของ app เลย | ถูกที่โหลดปกติ · มีของที่ไม่ได้คาดไว้ที่โหลดสูง |

**เรียนรู้อะไรจากการเดาผิด:** เดาว่าเวลาหมดไปกับ **query** (H1, H2) เพราะนับแค่จำนวน SQL ต่อ request
แต่ query ทั้งหมดเป็น index lookup บนตารางไม่กี่ร้อยแถว ใช้เวลาระดับมิลลิวินาที
สิ่งที่กำหนด p95 จริงคือ **CPU ที่ process ได้รับ** — และสิ่งที่กิน CPU มากที่สุดตอนว่างไม่ใช่ app เลย แต่คือ healthcheck ที่เราเขียนเอง

## Threshold ที่ไม่ผ่าน

| Run | Threshold ที่แดง | สาเหตุ (หลักฐานอยู่ในหัวข้อถัดไป) |
|---|---|---|
| 0.1 CPU + healthcheck · 30 VUs | `autosave_latency p95<300` (423.8ms) · `{name:me}` (359.2ms) · `{name:save_comparison}` (423.8ms) | CPU ถูก throttle — งบราว 43% หายไปกับ healthcheck ก่อนมี traffic |
| 0.1 CPU · 120 VUs | ทุก threshold เรื่อง latency (p95 2.0–2.6s) | CPU ไม่พอ: ถูก throttle 854 จาก ~1,340 รอบ (~64%) |
| ทุก run | `http_req_failed`, `journey_errors`, `checks` | **ผ่าน** (120 VUs: 0.42% / 0.62% / 99.56% ยังอยู่ในเกณฑ์) |

## Bottleneck ที่พบ

### 1. CPU ของ API — และราว 43% ของมันหายไปกับ healthcheck ก่อนมี request แรก

หลักฐาน:

- **latency จับกลุ่มที่ 100 / 200 / 300ms พอดี** (capped-10: classrooms p95 100.3ms, my_evaluations 199.0ms, scores 199.2ms)
  ตรงกับคาบ 100ms ของ CFS quota ใน Linux — request ที่เจอ quota หมดต้องรอรอบถัดไปทั้งรอบ
- p50 แทบไม่ขยับ (3.8 → 5.2ms) แต่ p95 กระโดด 6 → 197ms — ไม่ใช่ query ช้าลง แต่บาง request ถูกแช่
- `cpu.stat` ของ container ระหว่าง run 10 VUs: ถูก throttle 629 ครั้ง รวม 68 วินาที
- **CPU ตอนว่าง 30 วินาที (ไม่มี traffic):** cgroup ทั้งหมด **1,316ms** แต่ process ของ uvicorn ใช้เอง **40ms**
  ส่วนต่าง ~1,276ms คือ healthcheck ของ `compose.test.yaml` ที่สั่ง `python -c "urllib..."` **ทุก 3 วินาที**
  (ยก Python interpreter ใหม่ทุกครั้ง ~128ms CPU) = **~43% ของงบ 0.1 CPU**
- ยืนยันด้วยการถอดออก: image เดียวกัน `--no-healthcheck` เหลือ **48ms / 30 วินาที** และ p95 ที่ 10 VUs ลดจาก **196.6 → 10.2ms**
- ต้นทุนจริงต่อ request หลังถอด healthcheck: `/api/health` ~1.2ms CPU · `/api/me` ~2ms CPU
  → 0.1 CPU รองรับได้ราว 50 req/s ในทางทฤษฎี วัดจริงเริ่มแตกระหว่าง 14–21 req/s เพราะโหลดมาเป็นก้อน ไม่เรียบ

ขอบเขตของข้อสรุป: healthcheck ที่กินงบเป็นของ **test harness** (interval 3s) ส่วน `HEALTHCHECK` ใน `backend/Dockerfile`
ใช้วิธีเดียวกันที่ interval 10s (~13% ของ 0.1 CPU) · **บน Render ไม่โดน** เพราะ Render ตรวจ `healthCheckPath` จากภายนอกด้วย HTTP

### 2. connection reset ที่ 120 VUs — มองไม่เห็นจาก log ของ app

- 12 request แดงด้วย `read: connection reset by peer` **ทุกตัวเป็น `PUT /api/comparisons`**
- ไม่มีบรรทัด `http_request` ของ request เหล่านั้นใน log ของ API เลย (นับ statusCode ≥ 400 ได้ 0) → พังก่อนถึง app
- `PUT` เป็น request เดียวที่ตามหลัง think time 3–6 วินาที และ uvicorn 0.52.4 ปิด keep-alive ที่ว่าง **5 วินาที** (`timeout_keep_alive=5`)
  → client ส่งบน connection ที่ server กำลังปิดพอดี (keep-alive race) · CPU ที่ตึงทำให้ช่วงเวลาที่ชนกันกว้างขึ้น

### 3. publish ช้าตามจำนวนคู่แบบเส้นตรง (ไม่อยู่ใน journey หลัก แต่ช้าที่สุดที่วัดได้)

จาก `duration_ms` ใน log ที่ 0.1 CPU: **240 คู่ = 389–507ms · 960 คู่ = 1,484ms** (~1.5ms ต่อคู่)
`save_pairs` INSERT ทีละแถว — รายละเอียดใน [`docs/ai-review.md`](ai-review.md) ข้อ 2

## p95 แปลว่าอะไรกับผู้ใช้

- **autosave p95 6–8ms** (ปกติ) — นักศึกษาไม่รู้สึกเลย ป้าย "บันทึกแล้ว" ขึ้นทันทีหลัง debounce 2 วินาทีของหน้าเว็บ
- **autosave p95 138ms** (0.1 CPU, 60 คนพร้อมกัน) — ยังต่ำกว่า ~200ms ที่คนเริ่มรู้สึกว่าหน่วง
- **autosave p95 2.6s** (0.1 CPU, 120 คน) — 1 ใน 20 ครั้งที่เลือกคำตอบ ต้องรอ ~4.6 วินาที (debounce 2s + 2.6s) กว่าจะขึ้นว่าบันทึกแล้ว
  ช่วงก่อน deadline คือช่วงที่ทุกคนกดพร้อมกัน — นักศึกษาจะกดซ้ำหรือปิดหน้าไปก่อนบันทึกเสร็จ

## AI Analysis

ป้อนข้อมูลจริงให้ AI (Claude Code ใน session นี้): k6 summary ของทุก run ที่ 0.1 CPU, `cpu.stat`,
log JSON ของ request ที่ช้าที่สุด, error ของ k6 และ code ของ `save_comparison` / `db.py` / `daily_scoring.py`
แล้วถามตาม prompt ของ lab ("Where is the time going? top 3 causes ranked by evidence + การวัดที่ยืนยัน/หักล้าง")

- **AI เสนอสาเหตุ:**
  1. CPU quota throttling — latency เป็นขั้นบันได 100ms + nr_throttled
  2. `daily_scoring_loop` กิน CPU ตอนว่าง (รันทุก 60 วิ, query ทุก assignment)
  3. connection pool `max_size=10` หมดที่ 120 VUs ทำให้ request รอ connection
  4. keep-alive race (timeout 5s ของ uvicorn vs think time 3–6s) สำหรับ connection reset
- **เรารับ:** ข้อ 1 (หลักฐาน: ขั้นบันได 100ms, p50 ไม่ขยับ, nr_throttled และถอด healthcheck แล้ว p95 ลด 19 เท่า)
  · ข้อ 4 (หลักฐาน: reset เกิดกับ PUT ที่ตามหลัง sleep ≥ 3s เท่านั้น และไม่มี log ฝั่ง app)
- **เราไม่รับ:** ข้อ 2 — วัดแล้ว process uvicorn ใช้ CPU ตอนว่างแค่ 40ms/30s ซึ่งรวม loop นี้แล้ว
  ตัวที่กินจริงคือ healthcheck ซึ่ง **AI ไม่รู้ว่ามันรันอยู่ใน cgroup เดียวกับ app** จนกว่าจะแยก CPU ราย process ให้ดู
- **ยังตัดสินไม่ได้:** ข้อ 3 — ที่ 120 VUs server-side p95 ของ route ที่ใช้ DB อยู่ที่ 1.5–2.0s แต่ยังไม่มีตัวเลขของ pool
  และไม่มี request ไป `/api/health` (ซึ่งไม่แตะ DB) ในช่วง run นั้นให้เทียบ
- **context ที่ AI ไม่รู้เกี่ยวกับระบบเรา:** Render ตรวจ health จากภายนอก (ไม่ได้ spawn process ใน container)
  และอาจจัด CPU แบบ burst — ข้อสรุปเรื่องตัวเลขของ staging จึงต้องยืนยันบน staging จริงก่อนลงมือแก้
- **การวัดที่จะทำเพิ่มเพื่อยืนยัน:**
  - ข้อ 3: log `pool.get_stats()` (`requests_waiting`, `requests_wait_ms`) ทุก 10 วินาทีระหว่าง run 120 VUs
  - ข้อ 4: ตั้ง `--timeout-keep-alive 75` แล้วรัน 120 VUs ซ้ำ — ถ้า reset หายเป็น 0 แปลว่าใช่

## สิ่งที่จะแก้ (ยังไม่แก้ในวันนี้)

| # | แนวทาง | คาดว่าจะได้ | วิธียืนยันว่าดีขึ้นจริง |
|---|---|---|---|
| 1 | healthcheck ไม่ spawn Python ถี่ ๆ: `start_interval` ถี่เฉพาะช่วงบูต แล้ว interval ปกติ 30s | CPU ตอนว่าง 1,316 → ~50ms/30s · p95 ที่ 0.1 CPU 10 VUs **196.6 → ~10ms** (วัดแล้วตอนถอดออก) | รัน `capped-10` ซ้ำด้วย healthcheck ใหม่ |
| 2 | uvicorn `--timeout-keep-alive 75` (มากกว่า idle ของ client และ proxy) | connection reset ที่ 120 VUs **12 → 0** | รัน `capped-nohc-120` ซ้ำ นับ `Request Failed` |
| 3 | `save_pairs` ใช้ `executemany`/`COPY` | publish 960 คู่ **1,484 → < 300ms** ที่ 0.1 CPU | `duration_ms` ของ route publish ใน log |
| 4 | เพิ่ม metric ของ connection pool ก่อนตัดสินใจขยาย `max_size` | ได้ข้อมูลตัดสินข้อ 3 ของ AI | log `pool_stats` |

## CI performance gate

job `performance` ใน `.github/workflows/ci.yml` (หลัง `e2e` ก่อน deploy) ยก API + Postgres ใน runner
แล้วรัน `load-test.js` ด้วย profile สั้น (15s/30s/15s) threshold ชุดเดียวกับ baseline · หลัง deploy มี `staging-smoke` ยิง staging จริง

| ทดสอบ (จำลอง job บนเครื่องด้วยขั้นตอนเดียวกัน) | ผล |
|---|---|
| profile ของ CI · threshold ปกติ | 251 requests · p95 7.0ms · **exit 0** · k6 ใช้ 76 วินาที |
| แก้ threshold ให้เข้มเกินจริง `AUTOSAVE_P95_MS=1` | `✗ 'p(95)<1' p(95)=6.54ms` · **exit 99** → job แดง |

ยังไม่ได้เห็นบน GitHub Actions จริง — รอ push + เปิด PR (ดู `docs/cicd.md`)

## Structured logging ที่ใช้เก็บหลักฐานในรายงานนี้

ทุกบรรทัดเป็น JSON (`backend/app/observability.py`) ตัวอย่างจาก run จริง:

```json
{"ts": "2026-10-04T13:29:19.370+00:00", "level": "info", "logger": "paireval.http", "event": "http_request",
 "requestId": "3bd35eca-cc18-4f29-a730-b92fc313fe82", "method": "PUT", "route": "/api/comparisons/{pair_assignment_id}",
 "statusCode": 200, "duration_ms": 6.6, "user": "u_cab448c57f4a", "errorCode": null}
```

- `route` เป็น pattern ไม่ใช่ path จริง · `user` เป็น HMAC ของอีเมล (ตามรอยคนเดิมได้ ย้อนเป็นอีเมลไม่ได้)
- business event: `session_created`, `auth_rejected`, `roster_imported`, `assignment_published`, `comparison_saved`, `evaluations_submitted`, `scores_finalized`
- **ตรวจ log ทั้งหมดของ run แรก 20,082 บรรทัด:** 14,068 `http_request` · 5,615 `comparison_saved` · 366 `session_created`
  · **บรรทัดที่มีอีเมล / JWT / `Bearer` = 0** · บรรทัดที่ไม่ใช่ JSON = 12 (ข้อความของ `app.migrate` ตอนบูต ไม่ใช่ request)
- **ตรวจ log ของ API ระหว่าง E2E ทั้งชุด (118 tests ผ่านหมด)** ซึ่งวิ่งผ่านทาง error ด้วย (403/404/422, roster ผิด, deadline เลย):
  3,487 บรรทัด JSON · ครบทุก business event รวม `evaluations_submitted` 265 และ `scores_finalized` 6 · **อีเมล / JWT / `Bearer` = 0**

ดู log บนเครื่อง:

```bash
docker compose logs --no-log-prefix api | grep '"comparison_saved"' | tail -1 | jq .
```
