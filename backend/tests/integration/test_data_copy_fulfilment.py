"""FR-PRIV-03 กับ Postgres จริง — ดาวน์โหลดสำเนาแล้วคำขอที่ค้างต้องปิดเป็น SENT (GAP-02)"""
import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.api.account import provide_data_copy
from app.domain.data_copy import is_overdue

pytestmark = pytest.mark.integration


def _user(cur, email):
    user_id = str(uuid.uuid4())
    cur.execute("INSERT INTO app_user (id, email_normalized, email_raw, display_name, status) "
                "VALUES (%s, %s, %s, %s, 'ACTIVE')", (user_id, email, email, "นักศึกษา"))
    return user_id


def test_GAP02_ดาวน์โหลดสำเนาแล้วคำขอค้างถูกปิดพร้อมเวลาและ_audit(db):
    email = f"{uuid.uuid4().int % 10**8:08d}@kmitl.ac.th"
    with db.cursor() as cur:
        user_id = _user(cur, email)
        old = datetime.now(UTC) - timedelta(days=31)
        cur.execute("INSERT INTO data_copy_request (user_id, requested_at) VALUES (%s, %s) RETURNING id",
                    (user_id, old))
        request_id = cur.fetchone()["id"]
        cur.execute("SELECT requested_at, status FROM data_copy_request WHERE id = %s", (request_id,))
        before = cur.fetchone()
    # ก่อนแก้: คำขออายุ 31 วันที่ยังไม่ส่งต้องขึ้นเป็นรายการค้าง
    assert is_overdue(requested_at=before["requested_at"], status=before["status"], now=datetime.now(UTC))

    document, fulfilled = provide_data_copy(db, email)

    assert fulfilled == [request_id]
    assert document["profile"]["email"] == email
    with db.cursor() as cur:
        cur.execute("SELECT status, fulfilled_at FROM data_copy_request WHERE id = %s", (request_id,))
        row = cur.fetchone()
        cur.execute("SELECT count(*) AS n FROM audit_log WHERE action = 'DATA_COPY_PROVIDED' AND actor_email = %s",
                    (email,))
        audits = cur.fetchone()["n"]
    assert row["status"] == "SENT" and row["fulfilled_at"] is not None
    assert audits == 1


def test_ดาวน์โหลดซ้ำไม่มีคำขอค้างก็ยังได้สำเนา(db):
    email = f"{uuid.uuid4().int % 10**8:08d}@kmitl.ac.th"
    with db.cursor() as cur:
        _user(cur, email)

    document, fulfilled = provide_data_copy(db, email)

    assert fulfilled == []
    assert document["dataCopyRequests"] == []
