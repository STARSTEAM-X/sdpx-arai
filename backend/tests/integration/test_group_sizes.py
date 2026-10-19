"""FR-PAIR-13 กับ Postgres จริง — ขนาดกลุ่มนับเฉพาะนักศึกษา ACTIVE (GAP-09)"""
import uuid

import pytest

from app.repositories.pg_scoring_repo import PgScoringRepository

pytestmark = pytest.mark.integration


def _user(cur):
    user_id = str(uuid.uuid4())
    email = f"{uuid.uuid4().hex[:10]}@kmitl.ac.th"
    cur.execute("INSERT INTO app_user (id, email_normalized, email_raw, status) VALUES (%s, %s, %s, 'ACTIVE')",
                (user_id, email, email))
    return user_id


def test_GAP09_ขนาดกลุ่มไม่นับคนที่ถอนแล้ว(db):
    with db.cursor() as cur:
        owner = _user(cur)
        room = str(uuid.uuid4())
        cur.execute("INSERT INTO classroom (id, name, slug, timezone, created_by) "
                    "VALUES (%s, 'ห้อง', %s, 'Asia/Bangkok', %s)", (room, uuid.uuid4().hex, owner))
        small, big = str(uuid.uuid4()), str(uuid.uuid4())
        cur.execute("INSERT INTO group_entity (id, classroom_id, name) VALUES (%s, %s, 'A'), (%s, %s, 'B')",
                    (small, room, big, room))
        members = {}
        for group, n, withdrawn in ((small, 4, 1), (big, 5, 0)):
            for i in range(n):
                uid = _user(cur)
                status = "WITHDRAWN" if i < withdrawn else "ACTIVE"
                cur.execute("INSERT INTO classroom_member (id, classroom_id, user_id, role, group_id, enrollment_status) "
                            "VALUES (%s, %s, %s, 'STUDENT', %s, %s)", (str(uuid.uuid4()), room, uid, group, status))
                if status == "ACTIVE":
                    members[uid] = group

    sizes = PgScoringRepository(db).individual_group_sizes(room)

    assert {sizes[u] for u, g in members.items() if g == small} == {3}
    assert {sizes[u] for u, g in members.items() if g == big} == {5}
