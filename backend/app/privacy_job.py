"""ปิดตัวตนข้อมูลที่พ้นระยะเก็บ (FR-PRIV-02) — รันด้วยมือหรือจาก cron ภายนอก ไม่มี scheduler ในแอป

    python -m app.privacy_job            # ดูอย่างเดียว ไม่แก้อะไร (ค่าเริ่มต้น)
    python -m app.privacy_job --apply    # แก้จริงใน transaction เดียว

ทำ 2 อย่าง:
- ผู้ใช้ที่ทุกห้องเก่ากว่า 2 ปีการศึกษา → แทนอีเมลและชื่อใน `app_user` ด้วย pseudonym คงที่ (แถวยังอยู่ครบ)
- time-on-task ของงานที่ปิดรับเกิน 1 ปีการศึกษา → ล้างเป็น NULL (สัญญาณ QS-05 ของงานเก่าจึงหายไป)

ข้อยกเว้นที่ตั้งใจ: `audit_log.actor_email` ไม่ถูกแก้ เพราะ audit เป็น append-only ตาม FR-AUDIT (trigger ห้าม UPDATE)
— บันทึกความขัดแย้งไว้ใน docs/adr/ADR-004-privacy-retention.md
"""

import argparse
import json
from datetime import UTC, datetime

from psycopg import Connection

from app.config import SESSION_SECRET
from app.db import transaction
from app.domain.privacy import (
    ANONYMIZED_DOMAIN,
    IDENTITY_RETENTION,
    TIME_ON_TASK_RETENTION,
    anonymized_identity,
)

# กิจกรรมล่าสุดของห้อง = กำหนดส่งล่าสุดของงานในห้อง หรือวันที่สร้างห้องถ้ายังไม่มีงาน
_LAST_ACTIVITY = """
    SELECT c.id, GREATEST(c.created_at, COALESCE(MAX(GREATEST(a.group_deadline_utc,
           COALESCE(a.individual_deadline_utc, a.group_deadline_utc))), c.created_at)) AS last_activity
    FROM classroom c LEFT JOIN assignment a ON a.classroom_id = c.id
    GROUP BY c.id
"""


def run(conn: Connection, *, now: datetime, apply: bool, secret: str = SESSION_SECRET) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            WITH room AS ({_LAST_ACTIVITY})
            SELECT u.id FROM app_user u
            JOIN classroom_member m ON m.user_id = u.id JOIN room r ON r.id = m.classroom_id
            WHERE u.email_normalized NOT LIKE %s
            GROUP BY u.id HAVING MAX(r.last_activity) < %s
            """,
            (f"%@{ANONYMIZED_DOMAIN}", now - IDENTITY_RETENTION),
        )
        users = [str(row["id"]) for row in cur.fetchall()]
        cur.execute(
            """
            SELECT count(*) AS n FROM comparison c JOIN pair_assignment p ON p.id = c.pair_assignment_id
            JOIN assignment a ON a.id = p.assignment_id
            WHERE c.time_on_task_ms IS NOT NULL
              AND GREATEST(a.group_deadline_utc, COALESCE(a.individual_deadline_utc, a.group_deadline_utc)) < %s
            """,
            (now - TIME_ON_TASK_RETENTION,),
        )
        timings = cur.fetchone()["n"]
        if apply:
            for user_id in users:
                identity = anonymized_identity(user_id, secret)
                cur.execute(
                    "UPDATE app_user SET email_normalized = %s, email_raw = %s, display_name = %s WHERE id = %s",
                    (identity["email_normalized"], identity["email_raw"], identity["display_name"], user_id),
                )
            cur.execute(
                """
                UPDATE comparison c SET time_on_task_ms = NULL FROM pair_assignment p, assignment a
                WHERE p.id = c.pair_assignment_id AND a.id = p.assignment_id AND c.time_on_task_ms IS NOT NULL
                  AND GREATEST(a.group_deadline_utc, COALESCE(a.individual_deadline_utc, a.group_deadline_utc)) < %s
                """,
                (now - TIME_ON_TASK_RETENTION,),
            )
    return {"applied": apply, "usersAnonymized": len(users), "timeOnTaskCleared": timings}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="แก้ข้อมูลจริง (ไม่ใส่ = ดูอย่างเดียว)")
    args = parser.parse_args()
    from app.db import close_pool, open_pool

    open_pool()
    try:
        with transaction() as conn:
            print(json.dumps(run(conn, now=datetime.now(UTC), apply=args.apply), ensure_ascii=False))
    finally:
        close_pool()


if __name__ == "__main__":
    main()
