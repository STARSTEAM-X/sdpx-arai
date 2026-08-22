"""normalize อีเมลก่อนนำไปจับคู่กับ roster

กฎ R4 / FR-AUTH-03 — คนเดียวกันอาจพิมพ์อีเมลต่างกันได้หลายแบบ
ถ้าไม่ normalize จะกลายเป็นคนละ user แล้วคะแนนหาย

## ⚠️ ข้อขัดแย้งใน PRD ที่ยังไม่ได้ข้อสรุป

FR-AUTH-03 ขัดกับ acceptance criteria ของตัวเอง

- **ตัวกฎ** เขียนว่า `lowercase, ตัด dot ใน gmail, ตัด +tag`
- **AC ของข้อเดียวกัน** เขียนว่า roster มี `Somchai.A+x@uni.ac.th`
  แล้ว login ด้วย `somchaia@uni.ac.th` ต้องจับคู่สำเร็จ

`uni.ac.th` ไม่ใช่ gmail — สองข้อนี้เป็นจริงพร้อมกันไม่ได้

เลือกทำเป็น **policy ที่ config ได้** โดย default ตามตัวกฎ (ตัดจุดเฉพาะ gmail)
เพราะเป็นฝั่งที่ปลอดภัยกว่า: การตัดจุดทุก domain จะรวม `somchai.a@uni.ac.th`
กับ `somchaia@uni.ac.th` เป็นคนเดียวกัน ซึ่งหลายมหาวิทยาลัยใช้จุดแยกชื่อ-นามสกุลจริง
และการรวมคนผิดในระบบให้คะแนน แก้ย้อนหลังยากกว่าการจับคู่ไม่ติด

รอคำตอบจาก product owner แล้วค่อยเปลี่ยน default — ดูคำถามข้อ 4 ใน docs/backlog.md
"""

import re
from collections.abc import Iterable

# ยอมรับรูปแบบพื้นฐานพอสำหรับ roster ไม่ได้ตั้งใจ implement RFC 5322 เต็ม
# เพราะ regex ที่ตาม RFC เป๊ะ ๆ อ่านไม่ออกและไม่ได้ทำให้ปลอดภัยขึ้นจริง
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# domain ที่ถือว่าจุดใน local part ไม่มีความหมาย
DEFAULT_DOT_INSENSITIVE_DOMAINS = frozenset({"gmail.com", "googlemail.com"})


def is_valid_email(raw: str) -> bool:
    return bool(_EMAIL_RE.match(raw.strip()))


def normalize_email(
    raw: str,
    *,
    dot_insensitive_domains: Iterable[str] = DEFAULT_DOT_INSENSITIVE_DOMAINS,
) -> str:
    """แปลงอีเมลให้อยู่ในรูปมาตรฐานเพื่อใช้เป็น key

    - ตัด whitespace หัวท้าย แล้ว lowercase ทั้งหมด
    - ตัด `+tag` ออกจาก local part (ทำกับทุก domain เพราะเป็นมาตรฐานที่ใช้กันทั่วไป)
    - ตัดจุดใน local part เฉพาะ domain ที่อยู่ใน `dot_insensitive_domains`
    """
    email = raw.strip().lower()
    if "@" not in email:
        return email

    local, _, domain = email.partition("@")
    local = local.split("+", 1)[0]

    if domain in set(dot_insensitive_domains):
        local = local.replace(".", "")

    return f"{local}@{domain}"
