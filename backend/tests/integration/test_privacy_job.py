"""FR-PRIV-02 กับ Postgres จริง — ปิดตัวตนแต่แถวยังอยู่ · ผู้ใช้ที่ยังมีห้องใหม่ไม่ถูกแตะ"""
import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app import privacy_job

pytestmark = pytest.mark.integration

NOW = datetime.now(UTC)


def _user(cur, email):
    user_id = str(uuid.uuid4())
    cur.execute("INSERT INTO app_user (id, email_normalized, email_raw, display_name, status) "
                "VALUES (%s, %s, %s, %s, 'ACTIVE')", (user_id, email, email, "ชื่อจริง"))
    return user_id


def _room(cur, owner, created_at):
    room_id = str(uuid.uuid4())
    cur.execute("INSERT INTO classroom (id, name, slug, timezone, created_by, created_at) "
                "VALUES (%s, 'ห้อง', %s, 'Asia/Bangkok', %s, %s)", (room_id, uuid.uuid4().hex, owner, created_at))
    return room_id


def _join(cur, room_id, user_id):
    cur.execute("INSERT INTO classroom_member (id, classroom_id, user_id, role) VALUES (%s, %s, %s, 'STUDENT')",
                (str(uuid.uuid4()), room_id, user_id))


def test_expired_users_get_stable_pseudonym_and_rows_survive(db):
    with db.cursor() as cur:
        old_only = _user(cur, f"old-{uuid.uuid4().hex[:6]}@kmitl.ac.th")
        still_active = _user(cur, f"active-{uuid.uuid4().hex[:6]}@kmitl.ac.th")
        owner = _user(cur, f"owner-{uuid.uuid4().hex[:6]}@kmitl.ac.th")
        old_room = _room(cur, owner, NOW - timedelta(days=3 * 365))
        new_room = _room(cur, owner, NOW - timedelta(days=10))
        _join(cur, old_room, old_only)
        _join(cur, old_room, still_active)
        _join(cur, new_room, still_active)

    dry = privacy_job.run(db, now=NOW, apply=False, secret="test-secret")
    assert dry["applied"] is False and dry["usersAnonymized"] >= 1
    with db.cursor() as cur:
        cur.execute("SELECT email_normalized FROM app_user WHERE id = %s", (old_only,))
        assert not cur.fetchone()["email_normalized"].endswith("@anonymized.invalid")  # dry-run ไม่แก้

    privacy_job.run(db, now=NOW, apply=True, secret="test-secret")
    with db.cursor() as cur:
        cur.execute("SELECT id, email_normalized, display_name FROM app_user WHERE id = ANY(%s)",
                    ([old_only, still_active],))
        rows = {str(r["id"]): r for r in cur.fetchall()}
        cur.execute("SELECT count(*) AS n FROM classroom_member WHERE user_id = %s", (old_only,))
        memberships = cur.fetchone()["n"]
    assert rows[old_only]["email_normalized"].endswith("@anonymized.invalid")
    assert rows[old_only]["display_name"] != "ชื่อจริง"
    assert memberships == 1  # ไม่ลบแถว — สถิติเชิงรวมยังเชื่อมกับผู้ใช้คนเดิมได้
    assert not rows[still_active]["email_normalized"].endswith("@anonymized.invalid")

    # รันซ้ำได้ผลเดิม ไม่แปลงซ้ำ
    again = privacy_job.run(db, now=NOW, apply=True, secret="test-secret")
    with db.cursor() as cur:
        cur.execute("SELECT email_normalized FROM app_user WHERE id = %s", (old_only,))
        assert cur.fetchone()["email_normalized"] == rows[old_only]["email_normalized"]
    assert again["applied"] is True
