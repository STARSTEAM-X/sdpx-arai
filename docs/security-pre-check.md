# Security Pre-Check — WS-08

ตรวจเมื่อ 2026-10-18 · PairEval · branch `codex/ws08-quality-security` จาก `develop`.
สถานะ: แก้ช่องโหว่ code 3 ข้อ (SEC-01..03) และ dependency 2 รายการแล้ว;
**CodeQL scan `main` แล้ว 2026-10-20** — ดู [ผล CodeQL บน default branch](#ผล-codeql-บน-default-branch--2026-10-20).
ไม่ทดสอบโจมตี staging ไม่อ่าน `.env`/`performance/.secrets` และไม่บันทึก secret values.

## GitHub Security Features

| Feature | สถานะที่ยืนยัน | จำนวน alert / ข้อจำกัด |
|---|---|---|
| Dependency graph | เปิด; Settings checkbox On | main ไม่มี dependency manifests; SBOM ยังไม่พบ ไม่ใช้ 404 เป็นหลักฐานว่าปิด |
| Dependabot alerts | เปิด; API vulnerability-alerts สำเร็จ | GET alerts `[]`, หน้า UI Open 0 / Closed 0; ไม่ใช้แทน local audit ของ develop |
| Dependabot security updates | เปิด; API `enabled:true, paused:false` | เปิดอัตโนมัติ PR สำหรับ alert ที่มี patch; ไม่ได้เปิด version updates เพิ่ม |
| Secret scanning | เปิด | GET alerts 0 records; ไม่ใช่ข้อพิสูจน์ว่าไม่มี secret ทุกประเภท |
| Push protection | เปิด | API และ Settings ยืนยัน |
| Code scanning (CodeQL Default setup) | ตั้งค่าแล้ว; 2026-10-18 `languages:[]` | 2026-10-18 ยังไม่ scan (API 404 “no analysis found”) · **2026-10-20 scan `main` แล้ว 3 ภาษา, open 3 warning ที่คัดกรองเป็น false positive** |

ก่อนทำ WS-08 พบ Dependabot alerts/security updates ปิด และ CodeQL ยัง not-configured;
เปิดแล้วตรวจ GET/UI ซ้ำ. Secret scanning และ push protection เปิดอยู่ก่อนแล้ว.
ไม่เปลี่ยน default branch, ไม่ merge เข้า production เพื่อสร้างผล scan.

`main` มีเพียง `.gitattributes` ตรวจด้วย `git ls-tree --name-only origin/main`.
CodeQL Default setup จะเริ่มเมื่อมี supported application source บน default branch.
จึงต้องรอเส้นทาง release ที่ทีมอนุมัติ หรือทบทวน advanced setup บน develop แยกต่างหาก;
ห้ามอ้าง “0 CodeQL findings” ก่อนมี analysis.

หลักฐานภาพหน้าจอจริง:

- [Security overview](screenshots/ws08-github-security-overview-20261018.png)
- [Dependency graph และ Dependabot On](screenshots/ws08-dependency-security-settings-20261018.png)
- [Dependabot Open 0](screenshots/ws08-dependabot-alerts-20261018.png)
- [CodeQL ยังไม่มีภาษาบน default branch](screenshots/ws08-codeql-no-default-branch-languages-20261018.png)

## ผล CodeQL บน default branch — 2026-10-20

ข้อจำกัดเดิม (main มีแค่ `.gitattributes`) หมดไปเมื่อ release PR #22 และ
[PR #24](https://github.com/STARSTEAM-X/sdpx-arai/pull/24) merge app source เข้า `main` ตามเส้นทางที่ทีมอนุมัติ.
CodeQL Default setup จึง scan ได้จริง — ตรวจด้วย
`gh api "repos/STARSTEAM-X/sdpx-arai/code-scanning/analyses?ref=refs/heads/main"`:

| ภาษา | commit | rules | results |
|---|---|---:|---:|
| Python | `f343fde` (merge PR #24) | 43 | 2 |
| JavaScript/TypeScript | `f343fde` | 87 | 1 |
| GitHub Actions | `f343fde` | 17 | 0 |

Alert ที่เปิดอยู่ 3 ข้อ (severity warning ทั้งหมด) คัดกรองแล้วเป็น false positive —
บันทึกเหตุผลไว้ที่นี่ ส่วนการกด dismiss บน GitHub ให้ทีมตัดสินเอง:

| Rule | ตำแหน่ง | เหตุผลที่ไม่ใช่ช่องโหว่ |
|---|---|---|
| `py/overly-large-range` | `backend/app/domain/xlsx.py:13` | regex กรองอักขระควบคุมที่ XML 1.0 ไม่อนุญาต (`\x00-\x08`, `\x0b`, `\x0c`, `\x0e-\x1f`) ช่วงกว้างตามตั้งใจ ไม่ได้ใช้ตรวจสิทธิ์ |
| `py/incomplete-url-substring-sanitization` | `backend/tests/unit/test_member_service.py:52` | test ตรวจว่าข้อความ error มีชื่อ domain ไม่ใช่การตัดสินความปลอดภัยของ URL |

## Alerts / findings ที่พบ

Severity ของ code findings เป็นการประเมินตามเงื่อนไข; dependency severity มาจาก advisory.

| ID | ประเภท / Severity | ไฟล์หรือ package | ตัดสินใจและหลักฐาน |
|---|---|---|---|
| SEC-01 | CSV formula injection / Medium | `backend/app/api/scoring.py` | แก้ export boundary; red tests ก่อนแก้และ green หลังแก้ ไม่อ้างว่าเปิดสูตรโจมตีเครื่องผู้ใช้จริง |
| SEC-02 | Known production signing fallback / High หากตั้งค่าผิด | `backend/app/config.py` | production ปฏิเสธ fallback ทั้งกรณีไม่ได้ตั้งและตั้งค่าเดิมแบบ explicit; ไม่อ้างว่า staging ใช้ key นี้ |
| DEP-01 | Vulnerable dependency / High | `source-map-js` 1.2.1 ใน frontend lock | อัปเดต existing transitive dev dependency เป็น 1.2.2; [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q); อาจ DoS เมื่อประมวลผล source map ที่สร้างมาโจมตี ไม่ใช่หลักฐาน exploit ในเว็บที่ deploy |
| DEP-02 | Vulnerable dependency / สูงสุด Critical | PyJWT 2.13.0 ใน backend | อัปเดต requirement เป็น `pyjwt[crypto]~=2.15.0`, ติดตั้งจริง 2.15.1; OSV พบ 14 GHSA และ PYSEC aliases (รวม 28 records ไม่ใช่ 28 ช่องโหว่อิสระ) |

PyJWT advisories มีทั้ง key-format confusion และ pre-verification/JWKS DoS.
แอปใช้ HS256 ที่กำหนด algorithm และ key ฝั่ง server ตายตัว กับ Google JWKS แยกกัน
จึงไม่สรุปว่าทุก advisory exploit ได้ใน PairEval. ยังคงอัปเดต library เพื่อลบ affected version;
auth/session/OIDC tests และ E2E เดิมผ่านหลังเปลี่ยน.
ตัวอย่าง [Critical key confusion](https://github.com/advisories/GHSA-ffc3-869f-jxw9),
[pre-verification recursion DoS](https://github.com/advisories/GHSA-42vr-xj54-vc7v).

ผล audit สุดท้าย:

- npm root: 0 advisories; npm frontend: 0 advisories, exit 0 ทั้งสองคำสั่ง.
- OSV querybatch ของ 42 distributions ใน venv: **ไม่พบ advisory ของเวอร์ชันที่ติดตั้ง**.
- ระหว่างตรวจพบ pip 25.0.1 ใน venv เก่ามี advisories จึงอัปเดตเครื่องมือที่มีอยู่แล้วเป็น 26.2.1;
  เป็น local tooling update ไม่เพิ่ม runtime dependency ใน repo.
- `python -m pip check`: No broken requirements found.
- [ข้อมูล package versions และ advisory metadata](security-dependency-audit-20261018.json)
  มีเฉพาะชื่อ/เวอร์ชันสาธารณะ ไม่ใส่ credential.

## Secret ใน Git history

[ผลตรวจ metadata](security-history-audit-20261018.json): 93 reachable commits,
699 named text blobs, พบเฉพาะ `backend/.env.example` และ `frontend/.env.example` ในกลุ่ม env paths.
ไม่พบ `.env` จริงที่ tracked, provider-token pattern หรือ private-key marker ในขอบเขตที่ scan.

ตรวจ static credential literals และ DB URLs ใน process ภายในเครื่อง แล้วส่งออกเฉพาะ
blob/path/line/type/classification. ไม่ใช้ `git log -p | grep ...` ที่อาจพ่น secret เข้า AI context.
39 candidates เป็น development/test defaults, local DB examples หรือ teaching/test contexts;
ไม่พบ candidate ที่ยังไม่จัดประเภทหรือ credential ใช้งานจริงที่ยืนยันได้ จึงไม่มี key ที่ระบุให้ revoke
จากการตรวจรอบนี้. Development signing fallback เป็น code risk SEC-02 ไม่ใช่ข้อพิสูจน์ว่า key live หลุด.

ข้อจำกัด: เป็น heuristic ของ reachable named text blobs ขนาดไม่เกิน 2 MB;
ข้าม binary และไม่เปิดเนื้อหา non-example env/secrets paths. ไม่ครอบคลุม deleted remote refs,
credential ที่ไม่มี pattern หรือข้อมูลนอก repo. GitHub alerts 0 ไม่ลบข้อจำกัดเหล่านี้.

## OWASP Top 10 ที่เกี่ยวกับโครงการมากที่สุด 3 เรื่อง

1. **Broken Access Control** — ผู้สอน/TA/นักศึกษามีสิทธิ์ต่างกันในแต่ละห้อง;
   ตรวจ capability, ownership และ pair evaluator ก่อนแก้ข้อมูล; คนนอกได้ 404.
2. **Injection** — SQL ใช้ bound parameters และ CSV ต้อง escape ที่ output boundary
   เพราะ criterion/display name ไม่ได้ผ่าน roster import ทุกเส้นทาง.
3. **Security Misconfiguration** — public staging ต้องใช้ production guard, ห้าม test endpoints,
   ต้องมี signing key ของตัวเองและระบุ CORS origins; ตรวจเฉพาะความยาว key ยังไม่พอ.

## Checklist ที่ตรวจจริง

| ตรวจ | ผลและหลักฐาน |
|---|---|
| SQL ไม่ต่อ input เป็น query | ตรวจ repositories และค้น `execute(f`, `.format(`, SQL composition แล้วไม่พบ input interpolation; static migrations แยกจาก user input; integration ผ่าน |
| Endpoint ตรวจมากกว่า login | ClassroomAccess/capability, assignment/member loaders, pair ownership; unit access/comparison tests และ E2E cross-classroom/student/CO_TEACHER/OWNER ผ่าน |
| Response ไม่เผย credential | response models และ contract ไม่มี password_hash; export ปกติใช้ pseudonym ส่วน identified export จำกัด OWNER พร้อม reason/audit; E2E ผ่าน |
| Error ไม่เผย stack/DSN | FastAPI debug ไม่เปิด; domain/HTTP/validation error handlers และ error-envelope tests ผ่าน; ไม่อ้างว่า fuzz ทุก unhandled exception แล้ว |
| Test endpoints ปิดใน public environments | production subprocess สำหรับ tier staging/production ได้ `[404,404,404]` สำหรับ seed/cleanup/session; assertion เดิมคงอยู่ |
| Log ไม่มี email/JWT ดิบ | E2E API logs 3,595 บรรทัด: service JSON 3,583 + migration CLI 12; raw email/JWT 0; redaction/context unit tests ผ่าน |
| FE XSS / secret ใน bundle | React rendering ไม่พบ dangerouslySetInnerHTML/eval ใน source ที่ค้น; token ใน localStorage เป็น trade-off ที่ยังบันทึกไว้ ไม่อ้างว่าปิด XSS ทุกแบบ; ไม่เพิ่ม VITE secret |
| High/Critical dependency alerts | affected source-map-js/PyJWT อัปเดตแล้ว local audit ไม่พบ advisory; GitHub main ยังไม่สะท้อน code ของ develop |
| Git history | ไม่มี live credential ที่ยืนยันได้ในขอบเขต scan; ดูข้อจำกัดด้านบน |

[ผลตรวจ runtime logs แบบ aggregate ไม่มี raw values](security-runtime-log-check-20261018.json).
12 บรรทัดที่ไม่ใช่ JSON เป็น output ของ migration CLI ก่อน start API ตามรูปแบบใน `app/migrate.py`.

## Fixed in WS-08

| ปัญหา | ไฟล์ / วิธีแก้ | Test / verification ที่คุ้มครอง |
|---|---|---|
| SEC-01 | escape text ทุกคอลัมน์ที่ผู้ใช้ควบคุมก่อนเขียน CSV | `test_csv_export_security.py`: 8 dangerous strings + 4 ordinary strings; คง numeric choice; E2E export เดิมผ่าน |
| SEC-02 | production fail startup เมื่อใช้ known development key | `test_session_config_security.py`: 5 cases; deployment safety ตรวจทั้ง staging/production guard; auth/session tests ผ่าน |
| DEP-01 | lockfile source-map-js 1.2.2 | installed version ยืนยัน, npm ci และ npm audit; frontend 21 tests, build/typecheck ผ่าน |
| DEP-02 | PyJWT ~=2.15.0 (ติดตั้ง 2.15.1) | OIDC/session tests ใน backend 428 tests, full E2E 118 tests และ OSV affected-version check |
| SEC-03 (2026-10-20) | `backend/app/api/auth.py`: token ที่ตรวจไม่ผ่านตอบ 401 ด้วยข้อความกลาง เดิมส่ง `str(exc)` เช่น `Unable to find a signing key that matches` ของ PyJWT กลับไปหา client (information exposure) เหตุผลจริงยังอยู่ใน log event `auth_rejected` | `test_auth_session_errors.py`: 3 แดงก่อนแก้ → 4 เขียว; backend unit 727 ผ่าน |

Code regression ก่อนแก้ **10 failed/7 passed**, หลังแก้ **17 passed**.
ดู [หลักฐานและเหตุผลที่ปรับ production test fixture](ws08-security-findings.md).

## งานที่ยังไม่ยืนยัน

- ~~CodeQL first analysis~~ — scan แล้วบน `main` 2026-10-20 (ดูหัวข้อผล CodeQL ด้านบน).
- Concurrent publish และ seed bigint overflow ยังเป็นรายการต้องพิสูจน์แยกจาก behavior-preserving refactor.
- Autosave/submit coordination ที่ review พบยังเป็น follow-up; [refactoring plan](refactoring-plan.md).
- ไม่อ้าง NFR 200 users, ผล performance optimization หรือการส่ง LMS จากงานรอบนี้.
