"""migration runner แบบเล็กที่สุดที่ยังปลอดภัย

เลือกเขียนเองแทนใช้ Alembic เพราะ project ใช้ SQL ตรง ๆ อยู่แล้ว
และสิ่งที่ต้องการมีแค่ 3 อย่าง: รันตามลำดับ, รันซ้ำได้, จำว่ารันอะไรไปแล้ว

รัน:  python -m app.migrate
"""

import pathlib
import sys

import psycopg

from app.config import DATABASE_URL

# console ของ Windows ใช้ cp1252 เป็น default ซึ่งเข้ารหัสภาษาไทยไม่ได้
# ถ้าไม่บังคับตรงนี้ migration จะพังตั้งแต่บรรทัด print ไม่ใช่ที่ SQL
# แล้วคนอ่าน traceback จะไปไล่หาสาเหตุที่ database ทั้งที่ปัญหาอยู่ที่หน้าจอ
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parent.parent / "migrations"

_SCHEMA_TABLE = """
CREATE TABLE IF NOT EXISTS schema_migration (
    filename   text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
)
"""


def run() -> int:
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        print(f"ไม่พบไฟล์ migration ใน {MIGRATIONS_DIR}")
        return 1

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(_SCHEMA_TABLE)
            cur.execute("SELECT filename FROM schema_migration")
            applied = {row[0] for row in cur.fetchall()}
        conn.commit()

        for path in files:
            if path.name in applied:
                print(f"ข้าม  {path.name} (รันไปแล้ว)")
                continue

            # หนึ่ง migration = หนึ่ง transaction — ถ้าพังกลางคัน จะไม่ทิ้ง schema ครึ่ง ๆ
            with conn.transaction(), conn.cursor() as cur:
                cur.execute(path.read_text(encoding="utf-8"))
                cur.execute(
                    "INSERT INTO schema_migration (filename) VALUES (%s)", (path.name,)
                )
            print(f"รัน   {path.name}")

    print("migration เสร็จสิ้น")
    return 0


if __name__ == "__main__":
    sys.exit(run())
