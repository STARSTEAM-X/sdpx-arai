"""ส่งออกรายงานของงานประเมิน (Figma J36) และประวัติการส่งออก (Figma S10)

XLSX รวมทุกรายงานเป็น sheet ในไฟล์เดียว · CSV ได้ไฟล์ละรายงาน (หลายรายงานรวมเป็น zip)
ผู้ประเมินในผลเปรียบเทียบดิบเป็นรหัส E1, E2, ... เสมอ เว้นแต่ Owner เลือกอีเมลจริงพร้อมเหตุผล
ซึ่งบันทึก audit ทุกครั้งเหมือน `comparisons:export-identified` (FR-EXPORT-03/04)
"""
import csv
import io
import re
import zipfile
from datetime import UTC, datetime
from enum import StrEnum
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from app.api.assignments import _load_for_instructor
from app.api.scoring import _spreadsheet_text
from app.auth import CurrentUser
from app.coverage_orchestrator import coverage_rows
from app.db import transaction
from app.domain.access import Capability, ClassroomAccess
from app.domain.anonymity import pseudonymize_evaluators
from app.domain.assignment_service import Assignment, AssignmentStatus
from app.domain.audit import AuditAction, AuditEvent
from app.domain.errors import ValidationError
from app.domain.xlsx import workbook
from app.repositories.pg_audit_repo import PgAuditRepository
from app.repositories.pg_classroom_repo import PgClassroomRepository
from app.repositories.pg_quality_repo import PgQualityRepository
from app.repositories.pg_scoring_repo import PgScoringRepository

router = APIRouter(prefix='/api/assignments', tags=['scoring'])


class Report(StrEnum):
    GROUP = 'GROUP'
    INDIVIDUAL = 'INDIVIDUAL'
    PAIR_COVERAGE = 'PAIR_COVERAGE'
    METADATA = 'METADATA'
    RAW_COMPARISONS = 'RAW_COMPARISONS'


class ExportFormat(StrEnum):
    XLSX = 'XLSX'
    CSV = 'CSV'


class Identity(StrEnum):
    PSEUDONYM = 'PSEUDONYM'
    EMAIL = 'EMAIL'


# ชื่อ sheet ตาม Figma J36 · ชื่อไฟล์ CSV ใช้ slug ด้านขวา
_REPORTS = {
    Report.GROUP: ('Group Summary', 'group-summary'),
    Report.INDIVIDUAL: ('Individual Summary', 'individual-summary'),
    Report.PAIR_COVERAGE: ('Pair Coverage', 'pair-coverage'),
    Report.METADATA: ('Metadata', 'metadata'),
    Report.RAW_COMPARISONS: ('Raw Comparisons', 'raw-comparisons'),
}
_STANDARD = [Report.GROUP, Report.INDIVIDUAL, Report.PAIR_COVERAGE, Report.METADATA]
_ROLE_LABELS = {'OWNER': 'Owner', 'CO_TEACHER': 'Co-teacher', 'TA': 'TA'}


class ExportIn(BaseModel):
    reports: list[Report] = Field(min_length=1)
    format: ExportFormat = ExportFormat.XLSX
    identity: Identity = Identity.PSEUDONYM
    reason: str | None = Field(default=None, max_length=2000)


class ExportLogOut(BaseModel):
    createdAt: datetime
    format: ExportFormat
    reports: list[Report]
    identified: bool
    actorName: str
    actorRole: str


class ExportHistoryOut(BaseModel):
    items: list[ExportLogOut]


def _slug(text: str | None) -> str:
    return re.sub(r'[^a-z0-9]+', '-', (text or '').lower()).strip('-')


def export_basename(*, course_code: str | None, semester: str | None, assignment: Assignment,
                    reports: list[Report], at: datetime, timezone: str) -> str:
    """{ห้องเรียน}_{งาน}_{รายงาน}_{YYYYMMDD-HHmm} ตาม Figma J36 · ส่วนที่เป็นภาษาไทยล้วนแทนด้วย id สั้น
    เพื่อให้ชื่อไฟล์ปลอดภัยทุกระบบปฏิบัติการ"""
    room = _slug(f'{course_code or ""} {semester or ""}') or 'classroom'
    work = _slug(assignment.name)
    if not re.search('[a-z]', work):  # ชื่องานภาษาไทยล้วนเหลือแต่ตัวเลข — ใช้ id สั้นแทนเพื่อไม่ให้ชื่อชนกัน
        work = f'assignment-{assignment.id[:8]}'
    if sorted(reports) == sorted(_STANDARD):
        part = 'all-reports'
    elif sorted(reports) == sorted([*_STANDARD, Report.RAW_COMPARISONS]):
        part = 'all-reports-raw'
    else:
        part = '+'.join(_REPORTS[report][1] for report in reports)
    stamp = at.astimezone(ZoneInfo(timezone)).strftime('%Y%m%d-%H%M')
    return f'{room}_{work}_{part}_{stamp}'


def _text(value: object) -> object:
    return _spreadsheet_text(value) if isinstance(value, str) else value


def _sheets(conn, assignment: Assignment, reports: list[Report], *, identified: bool,
            meta: dict) -> list[tuple[Report, list[list]]]:
    scoring = PgScoringRepository(conn)
    is_final = assignment.status == AssignmentStatus.FINALIZED
    scores = scoring.list_computed_scores(assignment.id, is_final=is_final) if {Report.GROUP, Report.INDIVIDUAL} & set(reports) else []
    result = []
    for report in reports:
        if report is Report.GROUP:
            rows = [['group', 'score', 'max_score', 'is_final', 'flags']]
            rows += [[s.item_label, s.component, assignment.group_max_score, is_final, ' '.join(s.flags)]
                     for s in scores if str(s.side) == 'GROUP']
        elif report is Report.INDIVIDUAL:
            with conn.cursor() as cur:
                cur.execute('''SELECT m.user_id, u.email_normalized, g.name AS group_name FROM classroom_member m
                               JOIN app_user u ON u.id = m.user_id LEFT JOIN group_entity g ON g.id = m.group_id
                               WHERE m.classroom_id = %s AND m.role = 'STUDENT' ''', (assignment.classroom_id,))
                members = {str(r['user_id']): r for r in cur.fetchall()}
            rows = [['student', 'email', 'group', 'individual_score', 'max_score', 'is_final', 'flags']]
            rows += [[s.item_label, members.get(s.item_id, {}).get('email_normalized'),
                      members.get(s.item_id, {}).get('group_name'), s.component, assignment.individual_max_score,
                      is_final, ' '.join(s.flags)] for s in scores if str(s.side) == 'INDIVIDUAL']
        elif report is Report.PAIR_COVERAGE:
            quality = PgQualityRepository(conn)
            pairs = coverage_rows(conn, assignment, quality.rows(assignment.id), quality.labels(assignment.classroom_id))
            rows = [['side', 'criterion', 'item_a', 'item_b', 'submitted', 'assigned', 'target', 'instructor_submitted', 'enough']]
            rows += [[p['side'], p['criterionName'], p['itemALabel'], p['itemBLabel'], p['submittedCount'], p['assignedCount'],
                      p['expectedCount'], p['instructorCount'], p['submittedCount'] >= p['expectedCount']] for p in pairs]
        elif report is Report.METADATA:
            rows = [['key', 'value'],
                    ['classroom', meta['classroom']], ['assignment', assignment.name], ['status', str(assignment.status)],
                    ['scores', 'final' if is_final else 'provisional'], ['exported_at', meta['exported_at']],
                    ['exported_by_role', meta['role']], ['evaluator_identity', 'email' if identified else 'pseudonym E1, E2, ...'],
                    ['group_max_score', assignment.group_max_score], ['individual_max_score', assignment.individual_max_score],
                    ['min_comparisons', assignment.min_comparisons], ['target_coverage', assignment.target_coverage],
                    ['instructor_weight', assignment.instructor_weight], ['score_floor', assignment.score_floor],
                    ['score_ceiling', assignment.score_ceiling], ['completion_threshold', assignment.completion_threshold],
                    ['formula', 'personal = (group component + individual component) x participation multiplier'],
                    ['excluded_answers', 'answers excluded by the owner are not counted in scores or coverage']]
            rows += [[f'criterion {c.display_order + 1}', f'{c.side} · {c.name} · {c.weight_pct}%'] for c in assignment.criteria]
        else:
            raw = scoring.export_comparisons(assignment.id)
            if identified:
                with conn.cursor() as cur:
                    cur.execute('SELECT id, email_normalized FROM app_user WHERE id = ANY(%s)',
                                (list({r.evaluator_user_id for r in raw}),))
                    names = {str(r['id']): r['email_normalized'] for r in cur.fetchall()}
            else:
                names = pseudonymize_evaluators([r.evaluator_user_id for r in raw])
            rows = [['side', 'criterion', 'item_a', 'item_b', 'shown_left', 'choice', 'evaluator', 'submitted_at']]
            rows += [[str(r.side), r.criterion_name, r.item_a_label, r.item_b_label,
                      r.item_a_label if r.display_left_item_id == r.item_a_id else r.item_b_label,
                      r.choice, names[r.evaluator_user_id], r.submitted_at.isoformat()] for r in raw]
        result.append((report, [[_text(value) for value in row] for row in rows]))
    return result


def _csv(rows: list[list]) -> bytes:
    buf = io.StringIO()
    buf.write('﻿')  # BOM — Excel อ่านภาษาไทยถูก (FR-EXPORT-01)
    csv.writer(buf).writerows([['' if value is None else value for value in row] for row in rows])
    return buf.getvalue().encode('utf-8')


@router.post('/{assignment_id}/reports:export')
def export_reports(assignment_id: str, body: ExportIn, user_email: CurrentUser, request: Request) -> Response:
    reports = list(dict.fromkeys(body.reports))  # คงลำดับ ตัดตัวซ้ำ
    identified = body.identity is Identity.EMAIL
    with transaction() as conn, conn.cursor() as cur:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        access = ClassroomAccess(PgClassroomRepository(conn))
        role = access.require_member(assignment.classroom_id, user_email)
        reason = (body.reason or '').strip()
        if identified:
            access.require(assignment.classroom_id, user_email, Capability.VIEW_EVALUATOR_IDENTITY)
            if Report.RAW_COMPARISONS not in reports:
                raise ValidationError('ตัวตนผู้ประเมินมีเฉพาะในผลเปรียบเทียบดิบ กรุณาเลือกรายงานนี้ด้วย', field='identity')
            if not reason:
                raise ValidationError('ต้องระบุเหตุผลก่อนส่งออกพร้อมตัวตน', field='reason')
        cur.execute('SELECT name, course_code, semester, timezone FROM classroom WHERE id = %s', (assignment.classroom_id,))
        room = cur.fetchone()
        cur.execute('SELECT id FROM app_user WHERE email_normalized = %s', (user_email,))
        actor_id = cur.fetchone()['id']
        now = datetime.now(UTC)
        meta = {'classroom': room['name'], 'role': _ROLE_LABELS.get(str(role), str(role)),
                'exported_at': now.astimezone(ZoneInfo(room['timezone'])).isoformat(timespec='minutes')}
        sheets = _sheets(conn, assignment, reports, identified=identified, meta=meta)
        cur.execute('INSERT INTO export_log (assignment_id, actor_user_id, actor_role, format, reports, identified) '
                    'VALUES (%s, %s, %s, %s, %s, %s)',
                    (assignment_id, actor_id, str(role), str(body.format), [str(r) for r in reports], identified))
        if identified:
            PgAuditRepository(conn).record(AuditEvent(
                actor_email=user_email, action=AuditAction.IDENTIFIED_EXPORT, resource_type='assignment',
                resource_id=assignment_id, classroom_id=assignment.classroom_id, before_state=None,
                after_state={'format': str(body.format), 'reports': [str(r) for r in reports]},
                reason=reason, ip=request.client.host if request.client else None))
    def name(chosen: list[Report]) -> str:
        return export_basename(course_code=room['course_code'], semester=room['semester'], assignment=assignment,
                               reports=chosen, at=now, timezone=room['timezone'])
    base = name(reports)
    if body.format is ExportFormat.XLSX:
        content = workbook([(_REPORTS[report][0], rows) for report, rows in sheets])
        filename, media = f'{base}.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    elif len(sheets) == 1:
        content, filename, media = _csv(sheets[0][1]), f'{base}.csv', 'text/csv; charset=utf-8'
    else:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
            for report, rows in sheets:
                z.writestr(f'{name([report])}.csv', _csv(rows))
        content, filename, media = buf.getvalue(), f'{base}.zip', 'application/zip'
    return Response(content=content, media_type=media, headers={
        'Content-Disposition': f'attachment; filename="{filename}"', 'Cache-Control': 'private, no-store'})


@router.get('/{assignment_id}/exports', response_model=ExportHistoryOut)
def export_history(assignment_id: str, user_email: CurrentUser, limit: int = 10) -> ExportHistoryOut:
    with transaction() as conn, conn.cursor() as cur:
        _load_for_instructor(conn, assignment_id, user_email)
        cur.execute('''SELECT l.created_at, l.format, l.reports, l.identified, l.actor_role,
                              COALESCE(u.display_name, u.email_normalized) AS actor_name
                       FROM export_log l JOIN app_user u ON u.id = l.actor_user_id
                       WHERE l.assignment_id = %s ORDER BY l.created_at DESC, l.id DESC LIMIT %s''',
                    (assignment_id, max(1, min(limit, 50))))
        return ExportHistoryOut(items=[ExportLogOut(
            createdAt=r['created_at'], format=r['format'], reports=r['reports'], identified=r['identified'],
            actorName=r['actor_name'], actorRole=_ROLE_LABELS.get(r['actor_role'], r['actor_role'])) for r in cur.fetchall()])
