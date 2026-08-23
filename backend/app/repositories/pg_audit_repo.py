"""SQL ของ audit log — US-14

รับ connection เข้ามาเหมือน repository ตัวอื่น และนั่นคือหัวใจของ AC ข้อ 4:
audit ถูกเขียนใน transaction เดียวกับ action ที่มันบันทึก
ถ้าเขียน audit ไม่สำเร็จ action ก็ rollback ตามไปด้วย — ไม่มี action ที่สำเร็จโดยไม่มีร่องรอย
"""

import json
import uuid

from psycopg import Connection

from app.domain.audit import AuditEvent, validate


class PgAuditRepository:
    def __init__(self, conn: Connection):
        self._conn = conn

    def record(self, event: AuditEvent) -> str:
        validate(event)

        audit_id = str(uuid.uuid4())
        with self._conn.cursor() as cur:
            # หา id แยกก่อน แล้วยอมให้เป็น NULL ถ้าหาไม่เจอ
            # actor_email เก็บไว้เสมออยู่แล้ว log จึงยังอ่านออกว่าใครทำ
            # แม้ผู้ใช้คนนั้นจะถูกลบไปภายหลัง
            cur.execute(
                "SELECT id FROM app_user WHERE email_normalized = %s",
                (event.actor_email,),
            )
            row = cur.fetchone()

            cur.execute(
                """
                INSERT INTO audit_log
                    (id, actor_user_id, actor_email, action, resource_type, resource_id,
                     classroom_id, before_state, after_state, reason, ip)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    audit_id,
                    row["id"] if row else None,
                    event.actor_email,
                    str(event.action),
                    event.resource_type,
                    event.resource_id,
                    event.classroom_id,
                    json.dumps(event.before_state) if event.before_state else None,
                    json.dumps(event.after_state) if event.after_state else None,
                    event.reason,
                    event.ip,
                ),
            )
        return audit_id

    def list_for_classroom(self, classroom_id: str, *, limit: int = 100) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, actor_email, action, resource_type, resource_id,
                       before_state, after_state, reason, occurred_at
                FROM audit_log
                WHERE classroom_id = %s
                ORDER BY occurred_at DESC, id
                LIMIT %s
                """,
                (classroom_id, limit),
            )
            return [
                {
                    "id": str(r["id"]),
                    "actorEmail": r["actor_email"],
                    "action": r["action"],
                    "resourceType": r["resource_type"],
                    "resourceId": r["resource_id"],
                    "beforeState": r["before_state"],
                    "afterState": r["after_state"],
                    "reason": r["reason"],
                    "occurredAt": r["occurred_at"].isoformat(),
                }
                for r in cur.fetchall()
            ]
