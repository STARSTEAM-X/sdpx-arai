"""config ทั้งหมดของ backend อ่านจาก environment variable ที่เดียว

ตั้งใจใช้ os.getenv ตรง ๆ ไม่ใช้ library เพิ่ม เพราะตอนนี้มีค่าแค่ 2 ตัว
ถ้า config โตจนคุมยาก ค่อยย้ายไป pydantic-settings แล้วบันทึกเป็น ADR (WS-08)
"""

import os


def _split_csv(raw: str) -> list[str]:
    """แปลง "a, b ,c" เป็น ["a", "b", "c"] และตัดค่าว่างทิ้ง"""
    return [item.strip() for item in raw.split(",") if item.strip()]


# origin ที่อนุญาตให้เรียก API ได้ — ระบุเป็นรายตัว ไม่ใช้ "*"
# เพราะ "*" ใช้ร่วมกับ credentials ไม่ได้ และเปิดกว้างเกินจำเป็น
CORS_ORIGINS: list[str] = _split_csv(os.getenv("CORS_ORIGINS", "http://localhost:5173"))

# Render ใส่ RENDER_GIT_COMMIT ให้อัตโนมัติ — ใช้เป็น version เพื่อดูว่า commit ไหนขึ้นอยู่
# ค่านี้คือสิ่งที่ทำให้วัด commit-to-live time ได้แม่นยำ ไม่ต้องเดาจากข้อความบนหน้าเว็บ
APP_VERSION: str = os.getenv("RENDER_GIT_COMMIT", "dev")[:7]
