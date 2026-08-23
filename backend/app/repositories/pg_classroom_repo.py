"""implementation จริงของ ClassroomRepository ด้วย SQL ตรง ๆ

ตัวนี้ต้องมี method ครบและ signature ตรงกับ Protocol เดียวกับที่ FakeClassroomRepo ใช้
ถ้าสองตัวนี้หลุดจากกันเมื่อไร unit test จะเขียวแต่ของจริงพัง
"""

import uuid

from psycopg import Connection

from app.domain.models import (
    Classroom,
    ClassroomMember,
    ClassroomStatus,
    MemberRole,
    RosterMember,
    RosterRow,
)
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

    def get_member_role(self, classroom_id: str, email_normalized: str) -> MemberRole | None:
        """role ของผู้ใช้ในห้องนี้ — query เดียวตอบทั้ง "ไม่มีห้อง" และ "ไม่ใช่สมาชิก"

        ทั้งสองกรณีได้ None เหมือนกัน ซึ่งเป็นสิ่งที่ US-11 ต้องการพอดี
        และเป็นเหตุผลที่ไม่แยกเป็น get_by_id() แล้วค่อยเช็คสมาชิกทีหลัง —
        การแยกจะเปิดช่องให้ route ไหนสักที่เช็คไม่ครบแล้วรั่วว่า id นั้นมีอยู่จริง
        """
        # id ที่ไม่ใช่รูปแบบ uuid จะทำให้ Postgres โยน error แทนที่จะคืนผลว่าง
        # ซึ่งจะกลายเป็น 500 ทั้งที่ความหมายจริงคือ "ไม่พบ" — ตัดจบตรงนี้เลย
        try:
            uuid.UUID(classroom_id)
        except (ValueError, AttributeError, TypeError):
            return None

        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT m.role
                FROM classroom_member m
                JOIN app_user u ON u.id = m.user_id
                WHERE m.classroom_id = %s AND u.email_normalized = %s
                """,
                (classroom_id, email_normalized),
            )
            row = cur.fetchone()

        return MemberRole(row["role"]) if row else None

    def replace_roster(self, classroom_id: str, rows: list[RosterRow]) -> None:
        """เขียนรายชื่อนักศึกษาทั้งชุด — เรียกอยู่ใน transaction ของชั้นบนเสมอ

        ทุก statement ในนี้อยู่ใน transaction เดียวกับที่ route เปิดไว้
        ถ้าแถวสุดท้ายพัง แถวก่อนหน้าจะถูก rollback ไปด้วย — กฎ atomic (R1)
        ไม่ได้อาศัยแค่การ parse ให้จบก่อน แต่ชั้นเก็บข้อมูลก็รับประกันซ้ำอีกชั้น
        """
        with self._conn.cursor() as cur:
            # ผู้ใช้ที่ยังไม่เคยมีในระบบถูกสร้างเป็น PENDING
            # ไม่แตะ status ของคนที่ login ไปแล้ว — การ import ไม่ควรถีบใครกลับไป PENDING
            for row in rows:
                cur.execute(
                    """
                    INSERT INTO app_user (id, email_normalized, email_raw, display_name, status)
                    VALUES (%s, %s, %s, %s, 'PENDING')
                    ON CONFLICT (email_normalized) DO UPDATE SET
                        display_name = COALESCE(app_user.display_name, EXCLUDED.display_name)
                    """,
                    (
                        str(uuid.uuid4()),
                        row.email_normalized,
                        row.email_raw,
                        row.display_name,
                    ),
                )

            # กลุ่มต้องมีตัวตนของตัวเองก่อน เพราะ pairing อ้างกลุ่มด้วย id ไม่ใช่ชื่อ
            # ไม่ลบกลุ่มเก่าที่ไม่อยู่ในไฟล์ใหม่ทิ้ง — งานที่ publish ไปแล้วอ้างถึงกลุ่มพวกนั้นอยู่
            for name in sorted({r.group_name for r in rows}):
                cur.execute(
                    """
                    INSERT INTO group_entity (id, classroom_id, name)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (classroom_id, name) DO NOTHING
                    """,
                    (str(uuid.uuid4()), classroom_id, name),
                )

            # ล้างเฉพาะ STUDENT — OWNER / CO_TEACHER / TA ไม่ได้มาจากไฟล์นี้
            cur.execute(
                "DELETE FROM classroom_member WHERE classroom_id = %s AND role = 'STUDENT'",
                (classroom_id,),
            )

            for row in rows:
                # เขียน group_name กับ group_id พร้อมกันเสมอ — ถ้าเขียนแค่อย่างใดอย่างหนึ่ง
                # หน้า roster กับ pairing จะเห็นกลุ่มไม่ตรงกันโดยไม่มี error ให้เห็น
                cur.execute(
                    """
                    INSERT INTO classroom_member
                        (id, classroom_id, user_id, role, group_name, group_id)
                    SELECT %s, %s, u.id, 'STUDENT', %s, g.id
                    FROM app_user u
                    JOIN group_entity g
                      ON g.classroom_id = %s AND g.name = %s
                    WHERE u.email_normalized = %s
                    ON CONFLICT (classroom_id, user_id) DO UPDATE SET
                        group_name = EXCLUDED.group_name,
                        group_id   = EXCLUDED.group_id
                    """,
                    (
                        str(uuid.uuid4()),
                        classroom_id,
                        row.group_name,
                        classroom_id,
                        row.group_name,
                        row.email_normalized,
                    ),
                )

    def list_roster(self, classroom_id: str) -> list[RosterMember]:
        """สมาชิกทั้งห้อง เรียงอาจารย์ขึ้นก่อนแล้วตามด้วยกลุ่มและอีเมล

        เรียงให้คงที่เพื่อให้หน้าเว็บและ E2E เห็นลำดับเดิมทุกครั้ง
        ลำดับที่ขึ้นกับ physical order ของ Postgres คือบ่อเกิดของ flaky test
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.id, u.email_normalized, u.display_name, u.status,
                       m.id AS member_id, m.role, m.group_name
                FROM classroom_member m
                JOIN app_user u ON u.id = m.user_id
                WHERE m.classroom_id = %s
                ORDER BY (m.role = 'STUDENT'), m.group_name NULLS FIRST, u.email_normalized
                """,
                (classroom_id,),
            )
            return [
                RosterMember(
                    member_id=str(row["member_id"]),
                    user_id=str(row["id"]),
                    email=row["email_normalized"],
                    display_name=row["display_name"],
                    role=MemberRole(row["role"]),
                    status=row["status"],
                    group_name=row["group_name"],
                )
                for row in cur.fetchall()
            ]

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

    # --- จัดการสมาชิกฝั่งผู้สอน (US-12) ---

    def get_by_id(self, classroom_id: str) -> Classroom | None:
        try:
            uuid.UUID(classroom_id)
        except (ValueError, AttributeError, TypeError):
            return None

        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.id, c.name, c.slug, c.timezone, c.allowed_email_domains,
                       c.status, c.created_at, u.email_normalized AS created_by
                FROM classroom c
                JOIN app_user u ON u.id = c.created_by
                WHERE c.id = %s
                """,
                (classroom_id,),
            )
            row = cur.fetchone()

        return self._to_entity(row) if row else None

    def count_owners(self, classroom_id: str) -> int:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT count(*) AS n FROM classroom_member "
                "WHERE classroom_id = %s AND role = 'OWNER'",
                (classroom_id,),
            )
            return cur.fetchone()["n"]

    def add_instructor(
        self, classroom_id: str, *, email_normalized: str, email_raw: str, role: MemberRole
    ) -> str:
        """เพิ่มผู้ร่วมสอนหรือ TA — สร้าง user เป็น PENDING ถ้ายังไม่เคย login

        เส้นทางเดียวกับที่ roster import ใช้ (US-03) เพื่อให้คนที่ถูกเพิ่มไว้ก่อน
        แล้วค่อย login ทีหลัง จับคู่กับบัญชีเดิมได้ ไม่กลายเป็นคนใหม่
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_user (id, email_normalized, email_raw, status)
                VALUES (%s, %s, %s, 'PENDING')
                ON CONFLICT (email_normalized) DO NOTHING
                """,
                (str(uuid.uuid4()), email_normalized, email_raw),
            )

            member_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO classroom_member (id, classroom_id, user_id, role)
                SELECT %s, %s, u.id, %s
                FROM app_user u
                WHERE u.email_normalized = %s
                """,
                (member_id, classroom_id, str(role), email_normalized),
            )
        return member_id

    def get_member(self, classroom_id: str, member_id: str) -> tuple[str, MemberRole] | None:
        """คืน (email, role) ของสมาชิกแถวหนึ่ง — None ถ้าไม่มีหรือไม่ได้อยู่ห้องนี้"""
        try:
            uuid.UUID(member_id)
        except (ValueError, AttributeError, TypeError):
            return None

        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.email_normalized, m.role
                FROM classroom_member m
                JOIN app_user u ON u.id = m.user_id
                WHERE m.id = %s AND m.classroom_id = %s
                """,
                (member_id, classroom_id),
            )
            row = cur.fetchone()

        return (row["email_normalized"], MemberRole(row["role"])) if row else None

    def remove_member(self, classroom_id: str, member_id: str) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                "DELETE FROM classroom_member WHERE id = %s AND classroom_id = %s",
                (member_id, classroom_id),
            )


def _assert_matches_protocol() -> None:
    """ให้ type checker ยืนยันว่าตัวจริงยังทำตามสัญญาเดียวกับ fake"""
    _: ClassroomRepository = PgClassroomRepository(None)  # type: ignore[arg-type]
