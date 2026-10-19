# WS-08 — ช่องโหว่ที่ยืนยันและแก้แล้ว

ตรวจ source และรันทดสอบในเครื่องเมื่อ 2026-10-18 โดยไม่อ่านค่าใน `.env`,
ไม่ส่ง request โจมตี staging และไม่เพิ่ม dependency.
ผลนี้ยืนยันพฤติกรรมของ code; ไม่ได้อ้างว่า deployment ปัจจุบันถูกโจมตีหรือใช้ค่า default.

| ข้อ | ปัญหาและเงื่อนไข | ผลกระทบ | การแก้ |
|---|---|---|---|
| SEC-01 · Medium · Injection | `_rows_to_csv` เขียน criterion, item labels และ evaluator ลง CSV โดยตรง; การ escape ตอน roster import ไม่ครอบคลุม text จากทุกเส้นทาง เช่นชื่อเกณฑ์หรือ Google display name | ผู้รับ export เปิดไฟล์ด้วย spreadsheet แล้ว text ที่ขึ้นต้นด้วย `=`, `+`, `-`, `@` หรือ control character อาจถูกตีความเป็นสูตร | Escape text ที่ขอบเขต export ทั้งแบบซ่อนตัวตนและแบบเปิดตัวตน โดยเติม apostrophe; คงชนิดตัวเลขของ choice และข้อความปกติ |
| SEC-02 · High เมื่อ production ตั้งค่าผิด · Security Misconfiguration / Cryptographic Failures | `SESSION_SECRET` ที่หายไปทำให้ production ใช้ development fallback ที่อยู่ใน source; ตรวจความยาวอย่างเดียวไม่ช่วยเมื่อทุกคนรู้ key; การตั้ง fallback เดิมแบบ explicit ก็ผ่าน | ผู้ที่รู้ public fallback สามารถเซ็น session ของอีเมลอื่นได้เมื่อ deployment ใช้ key นี้ | production ต้องหยุด startup หากใช้ development fallback; development/test ยังใช้ค่าเดิมได้ และ key สั้นกว่า 32 bytes ยังถูกปฏิเสธ |

## หลักฐานก่อนและหลังแก้

เพิ่ม regression tests ก่อนแก้ code:

- `backend/tests/unit/test_csv_export_security.py`: 8 กรณี text อันตรายแดง,
  4 กรณีข้อความปกติผ่าน. ใช้สูตรทดสอบที่ไม่ติดต่อเครือข่าย เช่น `=1+1`.
  ตรวจ criterion/item_a/item_b/shown_left/evaluator ครบ และ choice ยังคงเป็นตัวเลข.
- `backend/tests/unit/test_session_config_security.py`: production ที่ไม่มี key
  และ production ที่ตั้ง development key แบบ explicit ไม่ยอมหยุด จึงแดง 2 กรณี.
  production ที่มี key ใหม่ และ fallback ของ development/test ผ่าน 3 กรณี.
  การทดสอบ config ปิด dotenv loader และใช้ข้อมูลสังเคราะห์.

ก่อนแก้: **10 failed, 7 passed** (1.44s). หลังแก้ชุดใหม่:
**17 passed** (1.00s).

ตรวจร่วมกับ session, anonymity และ deployment safety:

```powershell
cd backend
$env:ENVIRONMENT = 'test'
./.venv/Scripts/python.exe -m pytest tests/unit/test_csv_export_security.py tests/unit/test_session_config_security.py tests/unit/test_deployment_safety.py tests/unit/test_auth_session.py tests/unit/test_anonymity.py --tb=short
./.venv/Scripts/python.exe -m ruff check app/config.py app/api/scoring.py tests/unit/test_csv_export_security.py tests/unit/test_session_config_security.py tests/unit/test_deployment_safety.py
```

ผล: **26 passed in 4.33s**, Ruff **All checks passed**.
คำสั่ง pytest รอบสุดท้ายรันนอก filesystem sandbox เพราะการเปิด Python subprocess
ใน deployment safety test ค้างใน sandbox; ไม่เปลี่ยน timeout หรือ assertion ของ test.

## การเปลี่ยน existing test ที่มีเหตุผลจาก requirement

`backend/tests/unit/test_deployment_safety.py` เดิมเปิด production subprocess
โดยไม่ระบุ `SESSION_SECRET`. เมื่อ requirement เปลี่ยนให้ production ปฏิเสธ
development key จึงเพิ่ม random key สำหรับทดสอบด้วย stdlib `secrets`.
ยังตรวจ environment/tier และ HTTP 404 ของ `/api/test/seed`, `/cleanup`, `/session`
เหมือนเดิมทุก assertion. การแก้ fixture นี้อยู่ใน security fix
แยกจากการ refactor publish ที่ต้องคงพฤติกรรมเดิม.

## ขอบเขตที่ยังไม่ยืนยัน

- ไม่ได้ตรวจค่า key จริงบน Render และไม่พบหลักฐานว่าค่า fallback ถูกใช้บน staging.
- ตรวจความปลอดภัยของเซลล์จาก CSV ที่ export จริงผ่าน serializer;
  ไม่ได้เปิด spreadsheet ทุกโปรแกรมหรือทุกเวอร์ชันเพื่อรันสูตร.
- security review ทั้งระบบและผล dependency audit อยู่ใน `docs/security-pre-check.md`.
