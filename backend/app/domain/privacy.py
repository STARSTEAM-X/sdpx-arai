"""ระยะเก็บข้อมูลและการปิดตัวตน (PRD §14.1 FR-PRIV-02)

พ้นระยะเก็บแล้วต้อง **แทนตัวตนด้วย pseudonym คงที่** ไม่ใช่ลบแถว เพื่อให้สถิติเชิงรวม (คะแนน คู่ประเมิน coverage)
ยังคำนวณย้อนหลังได้ · pure logic — การอ่าน/เขียน database อยู่ที่ `app/privacy_job.py`
"""

import hashlib
import hmac
from datetime import datetime, timedelta

# PRD §14.1 ตารางระยะเก็บ: ตัวตน ผลประเมิน = 2 ปีการศึกษา · time-on-task = 1 ปีการศึกษา
# ใช้ 365 วันต่อปีการศึกษา — ระบบไม่มีปฏิทินการศึกษาของมหาวิทยาลัย จึงนับจากกิจกรรมล่าสุดของห้อง
IDENTITY_RETENTION = timedelta(days=2 * 365)
TIME_ON_TASK_RETENTION = timedelta(days=365)
ANONYMIZED_DOMAIN = "anonymized.invalid"  # .invalid สงวนไว้ไม่ให้เป็นโดเมนจริง (RFC 2606)


def pseudonym(user_id: str, secret: str) -> str:
    """รหัสคงที่ของผู้ใช้หนึ่งคน — คนเดิมได้ค่าเดิมเสมอ ย้อนกลับเป็นตัวตนไม่ได้ถ้าไม่มี secret"""
    return hmac.new(secret.encode(), f"privacy:{user_id}".encode(), hashlib.sha256).hexdigest()[:12]


def anonymized_identity(user_id: str, secret: str) -> dict[str, str]:
    code = pseudonym(user_id, secret)
    email = f"anon-{code}@{ANONYMIZED_DOMAIN}"
    return {"email_normalized": email, "email_raw": email, "display_name": f"ผู้ใช้ที่ปิดตัวตน {code[:6]}"}


def is_anonymized(email: str) -> bool:
    return email.endswith(f"@{ANONYMIZED_DOMAIN}")


def identity_expired(last_activity: datetime, now: datetime) -> bool:
    """ผู้ใช้หมดระยะเก็บเมื่อ **ทุกห้อง** ที่อยู่มีกิจกรรมล่าสุดเก่ากว่า 2 ปีการศึกษา — ผู้เรียกส่งค่าล่าสุดของทุกห้องมา"""
    return now - last_activity > IDENTITY_RETENTION


def time_on_task_expired(deadline: datetime, now: datetime) -> bool:
    return now - deadline > TIME_ON_TASK_RETENTION
