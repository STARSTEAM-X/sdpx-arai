"""fixture ของ integration test — ตัวที่ต้องมี Postgres จริง

ทำไมต้องมีชั้นนี้แยกจาก unit test:
unit test ใช้ fake repository จึงพิสูจน์ได้แค่ว่า *ตรรกะ* ถูก
แต่พิสูจน์ไม่ได้ว่า **SQL ที่เขียนไว้ทำในสิ่งที่ fake แกล้งทำ**
ช่องว่างตรงนี้คือที่ที่บั๊ก "test เขียวแต่ production พัง" ชอบอยู่
— บั๊ก DISABLED ที่ test_user_repo.py ปกป้องอยู่ก็เกิดในช่องว่างนี้พอดี

ทุก test รันในทรานแซกชันที่ **rollback เสมอ** จึงไม่ทิ้งขยะไว้ใน database
และรันซ้ำกี่รอบก็ได้ผลเดิม ไม่ต้องล้างอะไรระหว่างรอบ
"""

from collections.abc import Iterator

import psycopg
import pytest
from psycopg import Connection
from psycopg.rows import dict_row

from app.config import DATABASE_URL
from app.migrate import run as run_migrations


@pytest.fixture(scope="session", autouse=True)
def _schema() -> None:
    """สร้างตารางให้ครบก่อนเริ่ม — runner เป็น idempotent เรียกซ้ำได้"""
    try:
        run_migrations()
    except psycopg.OperationalError as exc:
        pytest.skip(f"ต่อ Postgres ไม่ได้ ({exc}) — สั่ง docker compose up -d db ก่อน")


@pytest.fixture
def db() -> Iterator[Connection]:
    """connection ที่ rollback ทุกครั้งเมื่อจบ test

    ใช้ `conn.transaction()` แล้วโยน Rollback ออกมาตอนจบ แทนการ TRUNCATE ทีหลัง
    เพราะการ rollback ไม่มีทางลืม และไม่แตะข้อมูลของ test ตัวอื่นที่รันคู่กัน
    """
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        tx = conn.transaction(force_rollback=True)
        with tx:
            yield conn
