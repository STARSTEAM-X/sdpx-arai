"""จัดการ app_user — ใช้ตอน login"""

import uuid
from dataclasses import dataclass

from psycopg import Connection

from app.google_oidc import GoogleIdentity


@dataclass(frozen=True)
class UserRecord:
    id: str
    email_normalized: str
    display_name: str | None
    status: str


class PgUserRepository:
    def __init__(self, conn: Connection):
        self._conn = conn

    def upsert_from_google(self, identity: GoogleIdentity) -> UserRecord:
        """สร้างหรืออัปเดต user จากข้อมูลที่ Google ยืนยันแล้ว

        รองรับสองเส้นทางที่ต่างกัน:
        - อีเมลถูก import มาจาก roster ไว้ก่อน → มี user สถานะ PENDING อยู่แล้ว
          ต้องเปลี่ยนเป็น ACTIVE และผูก google_sub (FR-CLASS-04)
        - login ครั้งแรกโดยไม่เคยอยู่ใน roster → สร้างใหม่เป็น ACTIVE เลย

        ใช้ ON CONFLICT เพื่อให้สองเส้นทางนี้เป็น statement เดียว
        ถ้าเขียนเป็น SELECT-แล้ว-INSERT จะมีช่องให้สอง request ชนกันตอน login พร้อมกัน
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_user
                    (id, email_normalized, email_raw, display_name, google_sub,
                     status, last_login_at)
                VALUES (%s, %s, %s, %s, %s, 'ACTIVE', now())
                ON CONFLICT (email_normalized) DO UPDATE SET
                    google_sub    = EXCLUDED.google_sub,
                    display_name  = COALESCE(EXCLUDED.display_name, app_user.display_name),
                    -- บัญชีที่ถูกระงับต้องคงสถานะไว้ ไม่ใช่ถูกปลุกคืนด้วยการ login ใหม่
                    -- เดิมเขียน 'ACTIVE' ตรง ๆ ทำให้ guard USER_DISABLED ใน api/auth.py
                    -- เป็น dead code — คนที่ถูกแบนแค่ login ซ้ำก็กลับมาใช้ได้
                    status        = CASE
                                        WHEN app_user.status = 'DISABLED' THEN 'DISABLED'
                                        ELSE 'ACTIVE'
                                    END,
                    last_login_at = now()
                RETURNING id, email_normalized, display_name, status
                """,
                (
                    str(uuid.uuid4()),
                    identity.email_normalized,
                    identity.email_raw,
                    identity.display_name,
                    identity.google_sub,
                ),
            )
            row = cur.fetchone()

        assert row is not None
        return UserRecord(
            id=str(row["id"]),
            email_normalized=row["email_normalized"],
            display_name=row["display_name"],
            status=row["status"],
        )

    def get_by_email(self, email_normalized: str) -> UserRecord | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, email_normalized, display_name, status
                FROM app_user WHERE email_normalized = %s
                """,
                (email_normalized,),
            )
            row = cur.fetchone()

        if row is None:
            return None
        return UserRecord(
            id=str(row["id"]),
            email_normalized=row["email_normalized"],
            display_name=row["display_name"],
            status=row["status"],
        )

    def roles_by_classroom(self, user_id: str) -> list[dict]:
        """role ของผู้ใช้แยกตาม classroom

        คืนเป็นรายการเพราะ 1 คนเป็น instructor ในห้องหนึ่งและ student ในอีกห้องได้
        (FR-AUTHZ-03) — การเก็บ role เดียวต่อคนจะผิดตั้งแต่ข้อมูล
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.id AS classroom_id, c.name AS classroom_name, m.role
                FROM classroom_member m
                JOIN classroom c ON c.id = m.classroom_id
                WHERE m.user_id = %s
                ORDER BY c.created_at DESC
                """,
                (user_id,),
            )
            return [
                {
                    "classroomId": str(r["classroom_id"]),
                    "classroomName": r["classroom_name"],
                    "role": r["role"],
                }
                for r in cur.fetchall()
            ]
