"""implementation จริงของ ClassroomRepository ด้วย SQL ตรง ๆ

ตัวนี้ต้องมี method ครบและ signature ตรงกับ Protocol เดียวกับที่ FakeClassroomRepo ใช้
ถ้าสองตัวนี้หลุดจากกันเมื่อไร unit test จะเขียวแต่ของจริงพัง
"""

import uuid

from psycopg import Connection

from app.domain.models import Classroom, ClassroomMember, ClassroomStatus
from app.domain.repositories import ClassroomRepository


class PgClassroomRepository:
    """รับ connection เข้ามาแทนที่จะเปิดเอง

    เพราะ transaction boundary เป็นของชั้นบน — การสร้าง classroom กับ member
    ต้อง commit พร้อมกัน ถ้า repo เปิด/ปิด connection เองจะทำแบบนั้นไม่ได้
    """

    def __init__(self, conn: Connection):
        self._conn = conn

    def get_by_slug(self, slug: str) -> Classroom | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.id, c.name, c.slug, c.timezone, c.allowed_email_domains,
                       c.status, c.created_at, u.email_normalized AS created_by
                FROM classroom c
                JOIN app_user u ON u.id = c.created_by
                WHERE c.slug = %s
                """,
                (slug,),
            )
            row = cur.fetchone()

        return self._to_entity(row) if row else None

    def save(self, classroom: Classroom) -> Classroom:
        """บันทึก classroom โดยแปลงอีเมลผู้สร้างเป็น user id

        การ map email → id อยู่ตรงนี้เพราะเป็นเรื่องของการเก็บข้อมูล
        ชั้น domain ไม่ควรรู้ว่าฐานข้อมูลใช้ FK เป็น uuid
        """
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM app_user WHERE email_normalized = %s",
                (classroom.created_by,),
            )
            row = cur.fetchone()
            if row is None:
                raise LookupError(f"ไม่พบผู้ใช้ {classroom.created_by}")
            creator_id = row["id"]

            cur.execute(
                """
                INSERT INTO classroom
                    (id, name, slug, timezone, allowed_email_domains, status, created_by, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    classroom.id,
                    classroom.name,
                    classroom.slug,
                    classroom.timezone,
                    classroom.allowed_email_domains,
                    str(classroom.status),
                    creator_id,
                    classroom.created_at,
                ),
            )
        return classroom

    # --- method เพิ่มเติมที่ไม่ได้อยู่ใน Protocol ---

    def save_member(self, member: ClassroomMember) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM app_user WHERE email_normalized = %s",
                (member.user_email,),
            )
            row = cur.fetchone()
            if row is None:
                raise LookupError(f"ไม่พบผู้ใช้ {member.user_email}")

            cur.execute(
                """
                INSERT INTO classroom_member (id, classroom_id, user_id, role, group_name)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    str(uuid.uuid4()),
                    member.classroom_id,
                    row["id"],
                    str(member.role),
                    member.group_name,
                ),
            )

    def list_for_user(self, email_normalized: str) -> list[Classroom]:
        """ห้องเรียนที่ผู้ใช้คนนี้เป็นสมาชิก — คืนเฉพาะของตัวเองเท่านั้น (FR-AUTHZ-02)"""
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.id, c.name, c.slug, c.timezone, c.allowed_email_domains,
                       c.status, c.created_at, owner.email_normalized AS created_by
                FROM classroom c
                JOIN classroom_member m ON m.classroom_id = c.id
                JOIN app_user me       ON me.id = m.user_id
                JOIN app_user owner    ON owner.id = c.created_by
                WHERE me.email_normalized = %s
                ORDER BY c.created_at DESC
                """,
                (email_normalized,),
            )
            return [self._to_entity(row) for row in cur.fetchall()]

    @staticmethod
    def _to_entity(row: dict) -> Classroom:
        return Classroom(
            id=str(row["id"]),
            name=row["name"],
            slug=row["slug"],
            timezone=row["timezone"],
            created_by=row["created_by"],
            allowed_email_domains=list(row["allowed_email_domains"] or []),
            status=ClassroomStatus(row["status"]),
            created_at=row["created_at"],
        )


def _assert_matches_protocol() -> None:
    """ให้ type checker ยืนยันว่าตัวจริงยังทำตามสัญญาเดียวกับ fake"""
    _: ClassroomRepository = PgClassroomRepository(None)  # type: ignore[arg-type]
