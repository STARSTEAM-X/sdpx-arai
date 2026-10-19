"""ข้อมูลบัญชีของตัวเอง — ประกาศความเป็นส่วนตัวและคำขอสำเนาข้อมูล (Figma ST03, ST07, T12b)

ทุก endpoint ทำกับบัญชีของ session เท่านั้น ไม่มี path ที่รับ user id จากภายนอก
จึงไม่มีทางอ่านหรือยื่นคำขอแทนคนอื่น
"""

import json
import logging
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.auth import CurrentUser
from app.db import transaction
from app.domain.assignment_service import AssignmentStatus
from app.domain.audit import AuditAction, AuditEvent
from app.domain.data_copy import build_data_copy, due_at, is_overdue
from app.observability import log_event, user_ref
from app.personal_score import personal_score
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_audit_repo import PgAuditRepository
from app.repositories.pg_scoring_repo import PgScoringRepository

log = logging.getLogger("paireval.account")

router = APIRouter(prefix="/api/me", tags=["account"])


class PrivacyAck(BaseModel):
    privacyAcknowledgedAt: datetime


class DataRequestOut(BaseModel):
    id: int
    requestedAt: datetime
    status: str
    # FR-PRIV-03 — ต้องส่งสำเนาภายใน 30 วัน · overdue = เลยกำหนดแล้วยังไม่ได้ส่ง
    dueAt: datetime
    fulfilledAt: datetime | None = None
    overdue: bool = False


def _request_out(row: dict, now: datetime) -> DataRequestOut:
    return DataRequestOut(
        id=row["id"], requestedAt=row["requested_at"], status=row["status"],
        dueAt=due_at(row["requested_at"]), fulfilledAt=row.get("fulfilled_at"),
        overdue=is_overdue(requested_at=row["requested_at"], status=row["status"], now=now),
    )


class DataRequestList(BaseModel):
    items: list[DataRequestOut]


def _user_id(cur, email: str) -> str:
    cur.execute("SELECT id FROM app_user WHERE email_normalized = %s", (email,))
    row = cur.fetchone()
    if row is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "ไม่พบผู้ใช้ของ session นี้"},
        )
    return row["id"]


@router.post("/privacy-ack", response_model=PrivacyAck)
def acknowledge_privacy(user_email: CurrentUser) -> PrivacyAck:
    # COALESCE เก็บเวลาที่รับทราบครั้งแรกไว้ — กดซ้ำไม่ทำให้หลักฐานเดิมหาย
    with transaction() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE app_user SET privacy_acknowledged_at = COALESCE(privacy_acknowledged_at, now()) "
            "WHERE email_normalized = %s RETURNING privacy_acknowledged_at",
            (user_email,),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "ไม่พบผู้ใช้ของ session นี้"},
        )
    return PrivacyAck(privacyAcknowledgedAt=row["privacy_acknowledged_at"])


@router.get("/data-requests", response_model=DataRequestList)
def list_data_requests(user_email: CurrentUser) -> DataRequestList:
    with transaction() as conn, conn.cursor() as cur:
        user_id = _user_id(cur, user_email)
        cur.execute(
            "SELECT id, requested_at, status, fulfilled_at FROM data_copy_request "
            "WHERE user_id = %s ORDER BY requested_at DESC, id DESC",
            (user_id,),
        )
        rows = cur.fetchall()
    now = datetime.now(UTC)
    return DataRequestList(items=[_request_out(r, now) for r in rows])


@router.post("/data-requests", response_model=DataRequestOut, status_code=201)
def create_data_request(user_email: CurrentUser) -> DataRequestOut:
    with transaction() as conn, conn.cursor() as cur:
        user_id = _user_id(cur, user_email)
        cur.execute(
            "INSERT INTO data_copy_request (user_id) VALUES (%s) "
            "RETURNING id, requested_at, status, fulfilled_at",
            (user_id,),
        )
        row = cur.fetchone()
    return _request_out(row, datetime.now(UTC))


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _collect_copy(conn, user_id: str, email: str) -> dict:
    """ข้อมูลทุกชิ้นที่ระบบเก็บเกี่ยวกับเจ้าตัว — อ่านอย่างเดียว ไม่มีข้อมูลของผู้ประเมินคนอื่น"""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT email_raw, display_name, status, created_at, last_login_at, privacy_acknowledged_at "
            "FROM app_user WHERE id = %s",
            (user_id,),
        )
        u = cur.fetchone()
        cur.execute(
            "SELECT c.id AS classroom_id, c.name AS classroom_name, m.role, m.enrollment_status, "
            "m.joined_at, g.name AS group_name "
            "FROM classroom_member m JOIN classroom c ON c.id = m.classroom_id "
            "LEFT JOIN group_entity g ON g.id = m.group_id "
            "WHERE m.user_id = %s ORDER BY c.name",
            (user_id,),
        )
        memberships = cur.fetchall()
        cur.execute(
            "SELECT id, requested_at, status, fulfilled_at FROM data_copy_request "
            "WHERE user_id = %s ORDER BY requested_at",
            (user_id,),
        )
        requests = cur.fetchall()

    assignment_repo = PgAssignmentRepository(conn)
    scoring_repo = PgScoringRepository(conn)
    evaluations: list[dict] = []
    scores: list[dict] = []
    for m in memberships:
        classroom_id = str(m["classroom_id"])
        for a in assignment_repo.list_for_classroom(classroom_id, include_draft=False):
            # คำตอบที่เจ้าตัวเป็นผู้ประเมินเอง — เห็นอยู่แล้วบนหน้าประเมินของตัวเอง
            for side in a.enabled_sides:
                for pair in assignment_repo.my_pairs(a.id, side=side, evaluator_email=email):
                    evaluations.append({
                        "classroom": m["classroom_name"], "assignment": a.name, "side": str(side),
                        "criterion": pair.criterion_name, "left": pair.left_label,
                        "right": pair.right_label, "choice": pair.choice, "submitted": pair.completed,
                    })
            # คะแนนเฉพาะงานที่ประกาศผลแล้ว และผ่านกฎ k-anonymity ชุดเดียวกับหน้าคะแนน (FR-ANON-02)
            if m["role"] != "STUDENT" or a.status is not AssignmentStatus.FINALIZED:
                continue
            group_id = scoring_repo.group_id_for_student(classroom_id, email)
            mine = personal_score(conn, a, user_id=user_id, email=email, label=email,
                                  group_id=group_id, group_label=m["group_name"], is_final=True)
            scores.append({
                "classroom": m["classroom_name"], "assignment": a.name,
                "groupComponent": str(mine.group_component),
                "individualComponent": None if mine.individual_hidden else str(mine.individual_component),
                "participationRatio": str(mine.participation_ratio),
                "participationMultiplier": str(mine.participation_multiplier),
                "finalScore": None if mine.individual_hidden else str(mine.final_score),
            })

    return build_data_copy(
        generated_at=datetime.now(UTC),
        profile={
            "email": u["email_raw"], "displayName": u["display_name"], "status": u["status"],
            "createdAt": _iso(u["created_at"]), "lastLoginAt": _iso(u["last_login_at"]),
            "privacyAcknowledgedAt": _iso(u["privacy_acknowledged_at"]),
        },
        memberships=[{
            "classroom": m["classroom_name"], "role": m["role"], "group": m["group_name"],
            "enrollmentStatus": m["enrollment_status"], "joinedAt": _iso(m["joined_at"]),
        } for m in memberships],
        evaluations_given=evaluations,
        scores=scores,
        requests=[{
            "id": r["id"], "requestedAt": _iso(r["requested_at"]), "status": r["status"],
            "fulfilledAt": _iso(r["fulfilled_at"]),
        } for r in requests],
    )


def provide_data_copy(conn, user_email: str) -> tuple[dict, list[int]]:
    """สร้างสำเนา + ปิดคำขอที่ค้างเป็น SENT + audit ใน transaction ของผู้เรียก"""
    with conn.cursor() as cur:
        user_id = str(_user_id(cur, user_email))
    document = _collect_copy(conn, user_id, user_email)
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE data_copy_request SET status = 'SENT', fulfilled_at = now() "
            "WHERE user_id = %s AND status <> 'SENT' RETURNING id",
            (user_id,),
        )
        fulfilled = [r["id"] for r in cur.fetchall()]
    PgAuditRepository(conn).record(AuditEvent(
        actor_email=user_email, action=AuditAction.DATA_COPY_PROVIDED,
        resource_type="data_copy_request", resource_id=",".join(map(str, fulfilled)) or None,
        after_state={"fulfilledRequestIds": fulfilled},
    ))
    return document, fulfilled


@router.get("/data-copy")
def download_data_copy(user_email: CurrentUser) -> Response:
    """ดาวน์โหลดสำเนาข้อมูลของตัวเองทันที (FR-PRIV-03 · GAP-02)

    การดาวน์โหลดคือการส่งมอบ — คำขอที่ยังค้างทั้งหมดของบัญชีนี้ถูกปิดเป็น SENT พร้อมเวลา
    และบันทึก audit ไว้เป็นหลักฐานว่าส่งเมื่อไร (ไม่ต้องรออาจารย์ และไม่ต้องพึ่งอีเมล)
    """
    with transaction() as conn:
        document, fulfilled = provide_data_copy(conn, user_email)
    log_event(log, "data_copy_downloaded", user=user_ref(user_email), fulfilled=len(fulfilled))
    return Response(
        content=json.dumps(document, ensure_ascii=False, indent=2),
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="paireval-my-data.json"',
            "Cache-Control": "private, no-store",
        },
    )
