# Backup, restore และ alert — สิ่งที่เจ้าของบัญชีตั้งเอง

GAP-08 (NFR-AVAIL-02) และ GAP-10 (NFR-OBS-02) · โค้ดและ workflow อยู่ใน repo แล้ว
ส่วนที่เหลือคือค่า secret ที่ **ต้องกรอกเองใน Dashboard** (ห้ามส่งค่าเข้า AI tool และห้าม commit)

## 1. Backup database รายวัน

ไฟล์: [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml)

| ขั้น | ทำที่ไหน |
|---|---|
| 1. คัดลอก **External Database URL** ของ `paireval-db-20261005` | Render → Databases → Connections |
| 2. สร้าง secret `BACKUP_DATABASE_URL` = ค่าจากข้อ 1 | GitHub → Settings → Secrets and variables → Actions |
| 3. สร้าง secret `BACKUP_PASSPHRASE` = รหัสผ่านยาว ๆ (เช่น `python -c "import secrets; print(secrets.token_urlsafe(32))"`) และเก็บสำเนาไว้ที่อื่น | GitHub (ที่เดียวกัน) + ที่เก็บรหัสผ่านของทีม |
| 4. สั่งรันครั้งแรก: Actions → Database backup → Run workflow | GitHub |
| 5. ดาวน์โหลด artifact `db-backup-…` แล้วซ้อมกู้ตามหัวข้อ 2 | เครื่องของทีม |

- schedule (02:00 น. ทุกวัน) ทำงานเมื่อไฟล์อยู่บน `main` แล้วเท่านั้น — บน `develop` สั่งรันมือได้
- artifact เก็บ 30 วัน เป็นไฟล์เข้ารหัส AES-256 คนที่เข้า repo ได้แต่ไม่มี passphrase เปิดไม่ได้
- **database free ตัวปัจจุบันหมดอายุ 2026-11-04** ([render-free-db.md](render-free-db.md)) — ตัวก่อนหน้าหมดอายุแล้วข้อมูลหายทั้งหมด
  ให้ backup อย่างน้อย 1 ครั้งก่อนวันนั้น แล้วใช้หัวข้อ 2 กู้ลง database ตัวใหม่

## 2. ซ้อมกู้ข้อมูล (restore drill) — วัด RTO

```bash
BACKUP_PASSPHRASE='...' scripts/restore-drill.sh paireval-YYYYMMDDTHHMMZ.dump.gpg
```

สคริปต์ถอดรหัส → ยก Postgres 18 ตัวใหม่ใน docker → `pg_restore` → นับแถวตารางหลัก → ลบ container ทิ้ง
ไม่แตะ database จริง · ถ้า passphrase ผิดจะหยุดที่ขั้นถอดรหัส (exit ≠ 0) ไม่กู้ข้อมูลเสีย

กู้ลง database ตัวใหม่บน Render จริง: `pg_restore --no-owner --no-privileges -d "<External URL ของตัวใหม่>" paireval.dump`
แล้วเปลี่ยน `DATABASE_URL` ของ API ไปที่ตัวใหม่

### ผลซ้อม

| วันที่ | แหล่งข้อมูล | ขนาด | แถว (user / classroom / comparison) | เวลารวม | หมายเหตุ |
|---|---|---|---|---|---|
| 2026-10-20 | DB dev บนเครื่อง (compose) | 115 KB | 93 / 5 / 116 | 4 วินาที | พิสูจน์ว่าสคริปต์ทำงานครบวง (dump → เข้ารหัส → ถอด → กู้) · **ยังไม่ใช่ข้อมูล production** |

ซ้อมกับ backup ของ production จริงภาคเรียนละครั้งตาม NFR-AVAIL-02 แล้วเติมแถวในตารางนี้

### เทียบเป้า PRD

| เป้า | ทำได้ตอนนี้ | ผ่านไหม |
|---|---|---|
| RPO ≤ 15 นาที | 24 ชม. (backup วันละครั้ง) | ❌ ต้องใช้ Postgres แบบเสียเงินที่มี PITR |
| RTO ≤ 4 ชม. | ส่วนข้อมูลไม่กี่วินาทีที่ขนาดปัจจุบัน + เวลาสร้าง DB ใหม่และเปลี่ยน `DATABASE_URL` | ✅ ถ้ามีไฟล์ backup และ passphrase |
| ทดสอบ restore ภาคเรียนละครั้ง | มีสคริปต์และผลซ้อมบนเครื่อง | ⚠️ ยังต้องซ้อมกับ backup จริง |

## 3. Alert เข้าช่องแชต (NFR-OBS-02)

แอปตรวจ error rate และ p95 อยู่แล้ว ([app/alerting.py](../backend/app/alerting.py)) แต่ถ้า `ALERT_WEBHOOK_URL` ว่าง
alert จะอยู่แค่ใน log ที่ไม่มีใครเฝ้า

1. Discord: Server Settings → Integrations → Webhooks → New Webhook → เลือกช่อง → **Copy Webhook URL**
   (Slack: Incoming Webhooks ก็ใช้ได้ — แอปส่ง JSON `{"text": ...}` ซึ่งทั้งสองรับได้)
2. Render → `paireval-api` → Environment → `ALERT_WEBHOOK_URL` = URL จากข้อ 1 → Save (service จะ restart)
3. ยืนยันว่าเข้าช่องจริง 1 ครั้ง แล้วแนบภาพไว้ใน `docs/screenshots/`

เป้า p95 ที่เฝ้าอยู่: autosave 300 ms · submit 800 ms · หน้า Evaluation (`GET …/my-evaluations`) 1,000 ms —
แจ้งเมื่อเกิน 2 เท่า ต่อเนื่องในหน้าต่าง 5 นาที และมีตัวอย่าง ≥ 20 ครั้ง
