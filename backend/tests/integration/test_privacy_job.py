"""FR-PRIV-02 กับ Postgres จริง — ปิดตัวตนแต่แถวยังอยู่ · ผู้ใช้ที่ยังมีห้องใหม่ไม่ถูกแตะ"""
import uuid
from datetime import UTC, datetime, timedelta

import psycopg
import pytest
from psycopg.types.json import Jsonb

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


def _audit(cur, actor_id, actor_email, *, after_state=None):
    audit_id = str(uuid.uuid4())
    cur.execute("INSERT INTO audit_log (id, actor_user_id, actor_email, action, resource_type, after_state) "
                "VALUES (%s, %s, %s, 'MEMBER_ADDED', 'classroom_member', %s)",
                (audit_id, actor_id, actor_email, Jsonb(after_state) if after_state is not None else None))
    return audit_id


def test_audit_log_emails_are_pseudonymized_and_rows_survive(db):
    # FR-PRIV-02 ครอบอีเมลใน audit ด้วย (ADR-004) — ทั้งผู้กระทำและอีเมลที่อยู่ใน after_state
    with db.cursor() as cur:
        old_email = f"old-{uuid.uuid4().hex[:6]}@kmitl.ac.th"
        old_only = _user(cur, old_email)
        owner_email = f"owner-{uuid.uuid4().hex[:6]}@kmitl.ac.th"
        owner = _user(cur, owner_email)
        old_room = _room(cur, owner, NOW - timedelta(days=3 * 365))
        _room(cur, owner, NOW - timedelta(days=10))  # ผู้สอนยังมีห้องใหม่ จึงไม่หมดระยะ
        _join(cur, old_room, old_only)
        as_actor = _audit(cur, old_only, old_email)
        as_subject = _audit(cur, owner, owner_email, after_state={"email": old_email, "role": "STUDENT"})

    result = privacy_job.run(db, now=NOW, apply=True, secret="test-secret")
    assert result["auditRowsAnonymized"] >= 2
    with db.cursor() as cur:
        cur.execute("SELECT id, actor_email, after_state, action FROM audit_log WHERE id = ANY(%s)",
                    ([as_actor, as_subject],))
        rows = {str(r["id"]): r for r in cur.fetchall()}
    assert rows[as_actor]["actor_email"].endswith("@anonymized.invalid")
    assert rows[as_subject]["actor_email"] == owner_email  # ผู้สอนที่ยังไม่หมดระยะไม่ถูกแตะ
    assert rows[as_subject]["after_state"] == {"email": rows[as_actor]["actor_email"], "role": "STUDENT"}
    assert rows[as_actor]["action"] == "MEMBER_ADDED"  # แถวยังอยู่และเหตุการณ์เดิม


def test_privacy_flag_still_rejects_anything_but_pseudonymizing_email(db):
    # ข้อยกเว้นแคบที่สุด — ตั้งตัวแปรเองแล้วก็ยังปลอมเหตุการณ์ เปลี่ยนอีเมลเป็นค่าอื่น หรือลบแถวไม่ได้
    with db.cursor() as cur:
        email = f"x-{uuid.uuid4().hex[:6]}@kmitl.ac.th"
        audit_id = _audit(cur, _user(cur, email), email)
        cur.execute("SELECT set_config('paireval.privacy_job', 'on', true)")
    for sql in ("UPDATE audit_log SET action = 'ของปลอม' WHERE id = %s",
                "UPDATE audit_log SET actor_email = 'someone@kmitl.ac.th' WHERE id = %s",
                "DELETE FROM audit_log WHERE id = %s"):
        with pytest.raises(psycopg.errors.CheckViolation), db.transaction(), db.cursor() as cur:
            cur.execute(sql, (audit_id,))


def test_pseudonymizing_without_privacy_flag_is_rejected(db):
    with db.cursor() as cur:
        email = f"y-{uuid.uuid4().hex[:6]}@kmitl.ac.th"
        audit_id = _audit(cur, _user(cur, email), email)
    with pytest.raises(psycopg.errors.CheckViolation), db.transaction(), db.cursor() as cur:
        cur.execute("UPDATE audit_log SET actor_email = 'anon-abc@anonymized.invalid' WHERE id = %s", (audit_id,))
