"""การเชื่อมต่อ database

ใช้ connection pool เพราะ FastAPI รับหลาย request พร้อมกัน
การเปิด connection ใหม่ทุก request จะทำให้ p95 พุ่ง (จะเห็นผลชัดใน WS-07)
"""

from collections.abc import Iterator
from contextlib import contextmanager

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import DATABASE_URL

# open=False แล้วค่อยเปิดตอน startup — ไม่ให้ import ไฟล์นี้แล้วไปต่อ DB ทันที
# ซึ่งจะทำให้ unit test ที่เผลอ import โซ่ยาวมาถึงตรงนี้ต้องรอ timeout
_pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=10, open=False)


def open_pool() -> None:
    _pool.open()
    _pool.wait(timeout=10)


def close_pool() -> None:
    _pool.close()


@contextmanager
def transaction() -> Iterator[Connection]:
    """ยืม connection มาหนึ่งตัวแล้วครอบด้วย transaction เดียว

    ทุกอย่างที่ทำใน block นี้ commit พร้อมกันหรือ rollback พร้อมกัน
    สำคัญกับกฎ atomic เช่น "สร้าง classroom แล้วต้องมี OWNER เสมอ" (C1)
    — ถ้าเขียน classroom ติดแต่ member ไม่ติด จะได้ห้องเรียนที่ไม่มีเจ้าของ
    """
    with _pool.connection() as conn:
        conn.row_factory = dict_row
        with conn.transaction():
            yield conn
