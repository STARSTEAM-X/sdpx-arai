# Performance Report - WS-07

รายงานนี้เป็นแบบบันทึกผล ห้ามแทนช่องว่างด้วยตัวเลขที่ยังไม่ได้วัดกับ staging

## Setup

- Target API: [STAGING_API_URL]
- Load profile: 0 -> 5 -> 10 -> 0 VUs, รวม 2 นาที
- วันที่ทดสอบ: [วันที่และเวลา]
- Commit: [SHA]
- Test identity: [ชื่อบัญชีทดสอบ ห้ามใส่ token หรือ email]

## Gate thresholds

- Overall request latency: p95 < 500 ms
- Failed HTTP requests: < 1%
- Journey check errors: < 5%
- Assignment-list latency: p95 < 500 ms

## Hypothesis vs Actual

| Hypothesis | ผลจริง | ถูก/ผิดและเหตุผล |
|---|---|---|
| ระบุ endpoint ที่คาดว่าจะช้าที่สุดและ p95 | รอผล k6 | รอผลวัด |

## Results

| Journey step | p50 | p95 | Error rate | requests/s |
|---|---:|---:|---:|---:|
| GET /api/classrooms | - | - | - | - |
| GET /api/classrooms/{id}/assignments | - | - | - | - |

## Thresholds and bottleneck

- Threshold ที่ไม่ผ่าน: [ระบุจากผลจริง หรือ "ไม่มี"]
- Bottleneck และหลักฐาน: [ระบุ endpoint, ตัวเลข และ log/requestId ที่ตรวจ โดยห้ามใส่ PII]
- สิ่งที่จะแก้และวิธียืนยัน: [ระบุแผน ยังไม่แก้ใน WS-07]

## AI analysis

- หลักฐานที่ป้อนให้ AI: [summary k6 และ log ที่ redact แล้ว]
- ข้อเสนอที่รับ: [ข้อเสนอ + หลักฐาน]
- ข้อเสนอที่ไม่รับ: [ข้อเสนอ + context ที่ AI ไม่มี]
- การวัดที่จะทำต่อ: [ระบุ]
