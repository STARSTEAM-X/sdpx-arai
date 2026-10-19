# อีเมลแจ้งเตือน (GAP-03)

ส่ง notification ในเว็บ (PRD §7.9 FR-NOTIF-01..06) ออกเป็นอีเมลด้วย ผ่าน **Gmail API** ของบัญชี Gmail ที่ทีมดูแล

## ทำไมใช้ Gmail API

- Render แผนฟรีบล็อก SMTP ขาออก (25/465/587) — ต้องส่งผ่าน HTTPS
- ไม่มีโดเมนของตัวเอง (`onrender.com` ยืนยันโดเมนไม่ได้) — Resend/MailerSend ใช้ไม่ได้
- ฟรี ส่งจาก Gmail ตรง จึงไม่ติดปัญหา DMARC แบบบริการที่ "ยืมชื่อ" `@gmail.com` ไปส่ง
- เพดานบัญชี Gmail ส่วนตัวราว 500 ฉบับ/วัน — worker ตั้ง `EMAIL_DAILY_CAP=400` เผื่อไว้

## ทำงานอย่างไร

| ส่วน | ไฟล์ |
|---|---|
| worker ทุก 5 นาที (เริ่มใน lifespan เฉพาะเมื่อตั้ง `GMAIL_*` ครบ) | `backend/app/email_worker.py` |
| เรียก Gmail API ด้วย refresh token (stdlib ล้วน) | `backend/app/gmail_sender.py` |
| กันส่งซ้ำ + เวลาเริ่มส่ง | `backend/migrations/024_email_delivery.sql` |
| ออก refresh token บนเครื่อง | `scripts/gmail/get_refresh_token.py` |

- ต้นทางคือ `PgNotificationRepository.list_for_user` ตัวเดียวกับกระดิ่งในเว็บ ข้อความและลิงก์จึงตรงกัน และไม่มีคะแนนของใครในเนื้อความ (FR-NOTIF-06)
- ส่งครั้งเดียวต่อ `(user, event_key)` — claim ใน `email_delivery` ก่อนส่ง
- **ไม่ส่งย้อนหลัง**: ส่งเฉพาะ event หลังเวลาที่ worker เริ่มครั้งแรก (`email_worker_state`) และไม่เก่ากว่า 3 วัน
- ส่งพลาด (Gmail ตอบ 5xx / network) → ลองใหม่รอบถัดไป สูงสุด 3 ครั้ง
- refresh token ใช้ไม่ได้ → หยุดรอบนั้น log `email_auth_failed` ระดับ ERROR และลองใหม่ทุก 5 นาที
- ผู้รับ: สมาชิก `ACTIVE` ของห้อง `ACTIVE` · ถอนรายวิชา / ห้องเก็บถาวร / ผู้ใช้ DISABLED ไม่ได้รับ

## ตั้งค่า (ทำครั้งเดียว)

Google Cloud project `paireval-mail` เปิด Gmail API และตั้ง OAuth consent screen (External, scope `gmail.send`) ไว้แล้ว

1. **Audience → Publish app** — ถ้าค้างที่ Testing refresh token จะหมดอายุใน 7 วัน
   หน้าขออนุญาตจะขึ้นว่า "unverified app" ซึ่งไม่เป็นไร เพราะผู้ที่กดอนุญาตมีแค่เจ้าของบัญชีที่ใช้ส่ง
2. **Clients → Create client → Application type: Desktop app** แล้วดาวน์โหลด JSON
   เก็บเป็น `backend/.secrets/gmail-client.json` (โฟลเดอร์นี้อยู่ใน `.gitignore`)
3. รันบนเครื่อง แล้วล็อกอินด้วยบัญชี Gmail ที่จะใช้ส่ง:

   ```bash
   python scripts/gmail/get_refresh_token.py backend/.secrets/gmail-client.json
   ```

   สคริปต์เขียน `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` ลง `backend/.secrets/gmail.env` โดยไม่พิมพ์ค่าออกจอ
4. ใส่ 3 ค่านั้น (และ `EMAIL_FROM` = address ของบัญชีนั้น ถ้าต้องการให้ผู้รับเห็นชื่อ PairEval) ใน
   Render → `paireval-api` (production) → Environment แล้ว deploy
5. ดู log ว่ามี `email_sent` และไม่มี `email_auth_failed`

staging ตั้งใจไม่ใส่ค่าเหล่านี้ จะได้ไม่ส่งอีเมลหา roster ทดสอบ

## ออก token ใหม่

refresh token ใช้ไม่ได้เมื่อเปลี่ยนรหัสผ่านบัญชี, ถอนสิทธิ์แอปที่ myaccount.google.com/permissions หรือไม่ได้ใช้ 6 เดือน
อาการคือ log `email_auth_failed` — รันขั้นตอนที่ 3–4 ซ้ำ

## ยังไม่ทำ

- ผู้ใช้เลือกปิดรับอีเมลเองไม่ได้ (PRD ไม่ได้กำหนด) — ตอนนี้ปิดได้ทั้งระบบด้วยการลบ `GMAIL_*`
- อีเมลเป็น plain text ภาษาไทยอย่างเดียว
