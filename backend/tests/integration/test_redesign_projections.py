"""Real SQL checks for Figma metadata; independent from browser rendering."""
import uuid
from contextlib import nullcontext
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import Response
from starlette.requests import Request

from app.api import appeals, assignment_lifecycle, coverage, enrollment, quality
from app.api import assignments as assignments_api
from app.domain.assignment_service import Assignment, Criterion
from app.domain.errors import ConflictError
from app.domain.models import Classroom, ClassroomMember, MemberRole, RosterRow
from app.domain.pairing import Side
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_classroom_repo import PgClassroomRepository
from app.repositories.pg_comparison_repo import PgComparisonRepository
from app.repositories.pg_scoring_repo import PgScoringRepository

pytestmark = pytest.mark.integration


def test_context_questions_and_artifacts_round_trip_without_cross_room_context(db):
    owner = f"redesign-{uuid.uuid4().hex}@example.com"
    with db.cursor() as cur:
        cur.execute("INSERT INTO app_user (id, email_normalized, email_raw, status) VALUES (%s,%s,%s,'ACTIVE')", (str(uuid.uuid4()), owner, owner))
    rooms = PgClassroomRepository(db)
    classroom = rooms.save(Classroom(id=str(uuid.uuid4()), name="Context", slug=uuid.uuid4().hex, timezone="Asia/Bangkok", created_by=owner, created_at=datetime.now(UTC), course_code="CE-SDPX", semester="1/2569"))
    rooms.save_member(ClassroomMember(classroom.id, owner, MemberRole.OWNER))
    rooms.replace_roster(classroom.id, [RosterRow(2, "redesign-student@example.com", "redesign-student@example.com", "Aurora")])
    listed = rooms.list_for_user(owner)
    assert [(room.course_code, room.semester) for room in listed] == [("CE-SDPX", "1/2569")]
    assert rooms.context_for_user(owner)[classroom.id]["student_count"] == 1
    assert rooms.context_for_user("outsider@example.com") == {}
    assignments = PgAssignmentRepository(db)
    criterion = Criterion(str(uuid.uuid4()), Side.GROUP, "UX", Decimal(100), question="Which work is easier to use?")
    assignment = assignments.create(Assignment(id=str(uuid.uuid4()), classroom_id=classroom.id, name="Artifacts", group_max_score=Decimal(15), individual_max_score=Decimal(0), group_deadline_utc=datetime(2099, 1, 1, tzinfo=UTC), created_by=owner, criteria=[criterion], score_floor=Decimal('0.5'), score_ceiling=Decimal('0.95'), instructor_weight=Decimal('2'), completion_threshold=Decimal('0.8')))
    assignments.save_artifacts(assignment.id, classroom.id, {"Aurora": "https://example.com/aurora"})
    assert assignments.get(assignment.id).criteria[0].question == criterion.question
    assert list(assignments.artifacts(assignment.id).values()) == ["https://example.com/aurora"]
    loaded = assignments.get(assignment.id)
    assert (loaded.score_floor, loaded.score_ceiling, loaded.instructor_weight, loaded.completion_threshold) == (Decimal('0.5'), Decimal('0.95'), Decimal('2'), Decimal('0.8'))


def test_appeal_expiry_is_enforced_by_server_without_writing(db, monkeypatch):
    owner = f'appeal-owner-{uuid.uuid4().hex}@example.com'
    student = f'appeal-student-{uuid.uuid4().hex}@example.com'
    with db.cursor() as cur:
        for email in (owner, student):
            cur.execute("INSERT INTO app_user (id, email_normalized, email_raw, status) VALUES (%s,%s,%s,'ACTIVE')", (str(uuid.uuid4()), email, email))
    rooms = PgClassroomRepository(db)
    classroom = rooms.save(Classroom(id=str(uuid.uuid4()), name='Appeals', slug=uuid.uuid4().hex, timezone='Asia/Bangkok', created_by=owner, created_at=datetime.now(UTC)))
    rooms.save_member(ClassroomMember(classroom.id, owner, MemberRole.OWNER))
    rooms.replace_roster(classroom.id, [RosterRow(2, student, student, 'A')])
    assignments = PgAssignmentRepository(db)
    assignment = assignments.create(Assignment(id=str(uuid.uuid4()), classroom_id=classroom.id, name='Expired appeal', group_max_score=Decimal(15), individual_max_score=Decimal(0), group_deadline_utc=datetime(2020, 1, 1, tzinfo=UTC), created_by=owner, criteria=[Criterion(str(uuid.uuid4()), Side.GROUP, 'UX', Decimal(100))]))
    assignments.mark_finalized(assignment.id, at=datetime.now(UTC) - timedelta(days=8))
    monkeypatch.setattr(appeals, 'transaction', lambda: nullcontext(db))
    with pytest.raises(ConflictError, match='7 วัน'):
        appeals.create_appeal(assignment.id, appeals.AppealIn(message='เหตุผลในการขอทบทวนคะแนนอย่างละเอียดครบถ้วน'), student, Request({'type': 'http', 'client': ('127.0.0.1', 1234)}))
    with db.cursor() as cur:
        cur.execute('SELECT count(*) AS n FROM appeal WHERE assignment_id = %s', (assignment.id,))
        assert cur.fetchone()['n'] == 0


def test_unpublish_preserves_submitted_history_and_republish_uses_only_new_generation(db, monkeypatch):
    owner = f'history-owner-{uuid.uuid4().hex}@example.com'
    with db.cursor() as cur:
        cur.execute("INSERT INTO app_user (id, email_normalized, email_raw, status) VALUES (%s,%s,%s,'ACTIVE')", (str(uuid.uuid4()), owner, owner))
    rooms = PgClassroomRepository(db)
    room = rooms.save(Classroom(id=str(uuid.uuid4()), name='Generations', slug=uuid.uuid4().hex, timezone='Asia/Bangkok', created_by=owner, created_at=datetime.now(UTC)))
    rooms.save_member(ClassroomMember(room.id, owner, MemberRole.OWNER))
    rows = [RosterRow(i + 2, f'history{i}-{uuid.uuid4().hex}@example.com', f'raw{i}@example.com', f'Group-{i // 2}') for i in range(6)]
    rooms.replace_roster(room.id, rows)
    repo = PgAssignmentRepository(db)
    criterion = Criterion(str(uuid.uuid4()), Side.GROUP, 'Old criterion', Decimal(100))
    assignment = repo.create(Assignment(id=str(uuid.uuid4()), classroom_id=room.id, name='History', group_max_score=Decimal(15), individual_max_score=Decimal(0), group_deadline_utc=datetime(2099, 1, 1, tzinfo=UTC), created_by=owner, target_coverage=1, criteria=[criterion]))
    for module in (assignments_api, assignment_lifecycle):
        monkeypatch.setattr(module, 'transaction', lambda: nullcontext(db))
    request = Request({'type': 'http', 'client': ('127.0.0.1', 1234)})
    assignments_api.publish_assignment(assignment.id, owner, request, 42)
    assert rooms.context_for_user(rows[0].email_normalized)[room.id]['pending_assignment_count'] == 1
    old_pair = repo.my_pairs(assignment.id, side=Side.GROUP, evaluator_email=rows[0].email_normalized)[0]
    answers = PgComparisonRepository(db)
    answers.save(old_pair.pair_assignment_id, choice=5, time_on_task_ms=6000, now=datetime.now(UTC))
    answers.submit_all(assignment_id=assignment.id, side=Side.GROUP, evaluator_email=rows[0].email_normalized, now=datetime.now(UTC))
    assert rooms.context_for_user(rows[0].email_normalized)[room.id]['pending_assignment_count'] == 0
    assignment_lifecycle.unpublish_assignment(assignment.id, assignment_lifecycle.UnpublishIn(confirmInvalidate=True, reason='เปลี่ยนเกณฑ์โดยเก็บหลักฐานเดิม'), owner, request)
    assignments_api.update_assignment(assignment.id, assignments_api.AssignmentIn(classroomId=room.id, name='New generation', groupMaxScore=15, individualMaxScore=0, groupDeadlineUtc=datetime(2099, 1, 1, tzinfo=UTC), targetCoverage=1, criteria=[assignments_api.CriterionIn(side=Side.GROUP, name='New criterion', weightPct=100)]), owner)
    assignments_api.publish_assignment(assignment.id, owner, request, 42)
    with db.cursor() as cur:
        cur.execute('SELECT c.status, p.generation, p.retired_at, cr.retired_at AS criterion_retired FROM comparison c JOIN pair_assignment p ON p.id = c.pair_assignment_id JOIN criterion cr ON cr.id = p.criterion_id WHERE p.id = %s', (old_pair.pair_assignment_id,))
        history = cur.fetchone()
        assert history['status'] == 'SUBMITTED'
        assert history['generation'] == 1 and history['retired_at'] and history['criterion_retired']
        cur.execute('SELECT DISTINCT generation FROM pair_assignment WHERE assignment_id = %s AND retired_at IS NULL', (assignment.id,))
        assert [row['generation'] for row in cur.fetchall()] == [2]
    assert answers.find_pair(old_pair.pair_assignment_id) is None
    assert PgScoringRepository(db).submitted_comparisons(assignment.id, Side.GROUP) == []
    assert all(item.choice is None for item in repo.my_pairs(assignment.id, side=Side.GROUP, evaluator_email=rows[0].email_normalized))

    # Withdrawal repairs pending work while preserving another active evaluator's submission.
    for index in (0, 2):
        current = repo.my_pairs(assignment.id, side=Side.GROUP, evaluator_email=rows[index].email_normalized)[0]
        answers.save(current.pair_assignment_id, choice=5, time_on_task_ms=6000, now=datetime.now(UTC))
        answers.submit_all(assignment_id=assignment.id, side=Side.GROUP, evaluator_email=rows[index].email_normalized, now=datetime.now(UTC))
        if index == 2:
            preserved_id = current.pair_assignment_id
    member = next(item for item in rooms.list_roster(room.id) if item.email == rows[0].email_normalized)
    monkeypatch.setattr(enrollment, 'transaction', lambda: nullcontext(db))
    result = enrollment.change_enrollment(room.id, member.member_id, enrollment.EnrollmentIn(withdrawn=True, reason='ถอนจากรายวิชาตามคำขอ'), owner, request)
    assert result.enrollmentStatus == 'WITHDRAWN'
    assert result.repairs
    assert repo.my_pairs(assignment.id, side=Side.GROUP, evaluator_email=member.email) == []
    assert all(member.user_id not in group.member_ids for group in repo.groups_with_members(room.id))
    with db.cursor() as cur:
        cur.execute('SELECT c.status, p.retired_at FROM comparison c JOIN pair_assignment p ON p.id = c.pair_assignment_id WHERE p.id = %s', (preserved_id,))
        assert cur.fetchone() == {'status': 'SUBMITTED', 'retired_at': None}
        cur.execute('SELECT status FROM app_user WHERE id = %s', (member.user_id,))
        assert cur.fetchone()['status'] == 'PENDING'
    enrollment.change_enrollment(room.id, member.member_id, enrollment.EnrollmentIn(withdrawn=False, reason='กลับเข้าเรียนตามคำขอ'), owner, request)
    assert repo.my_pairs(assignment.id, side=Side.GROUP, evaluator_email=member.email)
    monkeypatch.setattr(quality, 'transaction', lambda: nullcontext(db))
    report = quality.quality_report(assignment.id, owner)
    reviewer = next(item for item in report.evaluators if item['submittedCount'] > 0)
    assert rows[2].email_normalized not in str(report.evaluators)
    before = PgScoringRepository(db).participation(assignment.id, Side.GROUP, rows[2].email_normalized)
    identity = quality.reveal_identity(assignment.id, reviewer['key'], quality.ReasonIn(reason='ตรวจสอบคำตอบที่มีสัญญาณ'), owner, request, Response())
    assert identity.email == rows[2].email_normalized
    original_count = len(PgScoringRepository(db).submitted_comparisons(assignment.id, Side.GROUP))
    quality.set_exclusion(assignment.id, reviewer['key'], quality.ExclusionIn(excluded=True, reason='ตัดเฉพาะการคำนวณหลังทบทวนด้วยตา'), owner, request)
    assert len(PgScoringRepository(db).submitted_comparisons(assignment.id, Side.GROUP)) < original_count
    assert PgScoringRepository(db).participation(assignment.id, Side.GROUP, rows[2].email_normalized) == before
    with db.cursor() as cur:
        cur.execute('SELECT status FROM comparison WHERE pair_assignment_id = %s', (preserved_id,))
        assert cur.fetchone()['status'] == 'SUBMITTED'
    quality.set_exclusion(assignment.id, reviewer['key'], quality.ExclusionIn(excluded=False, reason='คืนคำตอบหลังทบทวนหลักฐาน'), owner, request)
    assert len(PgScoringRepository(db).submitted_comparisons(assignment.id, Side.GROUP)) == original_count

    # Instructor revisions keep a single pair and normalize reversed display orientation.
    monkeypatch.setattr(coverage, 'transaction', lambda: nullcontext(db))
    pair = quality.quality_report(assignment.id, owner).pairCoverage[0]
    body = dict(criterionId=pair['criterionId'], itemAId=pair['itemAId'], itemBId=pair['itemBId'], reason='เพิ่มหลักฐานจากผู้สอนหลังตรวจผลงานจริง', choice=1)
    assert coverage.instructor_comparison(assignment.id, coverage.InstructorComparisonIn(**body), owner, request).pairsAdded == 1
    body.update(itemAId=pair['itemBId'], itemBId=pair['itemAId'])
    assert coverage.instructor_comparison(assignment.id, coverage.InstructorComparisonIn(**body), owner, request).pairsAdded == 0
    with db.cursor() as cur:
        cur.execute('SELECT c.id, c.choice, c.status FROM comparison c JOIN pair_assignment p ON p.id = c.pair_assignment_id JOIN app_user u ON u.id = p.evaluator_user_id WHERE p.assignment_id = %s AND u.email_normalized = %s AND p.retired_at IS NULL', (assignment.id, owner))
        answer = cur.fetchone()
        assert answer['choice'] == 6 and answer['status'] == 'SUBMITTED'
        cur.execute('SELECT choice FROM comparison_revision WHERE comparison_id = %s ORDER BY revision_no', (answer['id'],))
        assert [revision['choice'] for revision in cur.fetchall()] == [1, 6]


def test_review_state_instructor_pairs_and_report_exports_are_recorded(db, monkeypatch):
    import io
    import zipfile

    from app.api import reports_export
    from app.domain.errors import ForbiddenError, ValidationError

    owner = f'export-owner-{uuid.uuid4().hex}@example.com'
    teacher = f'export-co-{uuid.uuid4().hex}@example.com'
    with db.cursor() as cur:
        for email, name in ((owner, 'สมชาย ใจดี'), (teacher, 'ปรียา')):
            cur.execute("INSERT INTO app_user (id, email_normalized, email_raw, display_name, status) VALUES (%s,%s,%s,%s,'ACTIVE')", (str(uuid.uuid4()), email, email, name))
    rooms = PgClassroomRepository(db)
    room = rooms.save(Classroom(id=str(uuid.uuid4()), name='Exports', slug=uuid.uuid4().hex, timezone='Asia/Bangkok', created_by=owner, created_at=datetime.now(UTC), course_code='SDPX', semester='1/2569'))
    rooms.save_member(ClassroomMember(room.id, owner, MemberRole.OWNER))
    rooms.save_member(ClassroomMember(room.id, teacher, MemberRole.CO_TEACHER))
    rows = [RosterRow(i + 2, f'export{i}-{uuid.uuid4().hex}@example.com', f'raw{i}@example.com', f'Group-{i // 2}') for i in range(6)]
    rooms.replace_roster(room.id, rows)
    repo = PgAssignmentRepository(db)
    assignment = repo.create(Assignment(id=str(uuid.uuid4()), classroom_id=room.id, name='Group work 1', group_max_score=Decimal(15), individual_max_score=Decimal(0), group_deadline_utc=datetime(2099, 1, 1, tzinfo=UTC), created_by=owner, target_coverage=1, criteria=[Criterion(str(uuid.uuid4()), Side.GROUP, '=HYPERLINK("x")', Decimal(100))]))
    for module in (assignments_api, quality, coverage, reports_export):
        monkeypatch.setattr(module, 'transaction', lambda: nullcontext(db))
    request = Request({'type': 'http', 'client': ('127.0.0.1', 1234)})
    assignments_api.publish_assignment(assignment.id, owner, request, 7)
    answers = PgComparisonRepository(db)
    pair = repo.my_pairs(assignment.id, side=Side.GROUP, evaluator_email=rows[0].email_normalized)[0]
    answers.save(pair.pair_assignment_id, choice=1, time_on_task_ms=500, now=datetime.now(UTC))
    answers.submit_all(assignment_id=assignment.id, side=Side.GROUP, evaluator_email=rows[0].email_normalized, now=datetime.now(UTC))

    # "ดูแล้ว · เก็บไว้": ครั้งแรกที่เปิดดูถูกบันทึก ครั้งถัดไปไม่เลื่อนเวลา และไม่กระทบคะแนน
    reviewer = next(item for item in quality.quality_report(assignment.id, owner).evaluators if item['submittedCount'])
    assert reviewer['reviewedAt'] is None
    first = quality.mark_reviewed(assignment.id, reviewer['key'], teacher).reviewedAt
    assert quality.mark_reviewed(assignment.id, reviewer['key'], owner).reviewedAt == first
    assert next(item for item in quality.quality_report(assignment.id, owner).evaluators if item['key'] == reviewer['key'])['reviewedAt'] == first
    with pytest.raises(Exception, match='ไม่พบผู้ประเมิน'):
        quality.mark_reviewed(assignment.id, 'not-a-key', owner)

    # อาจารย์ประเมินเองนับแยก และไม่โผล่เป็นผู้ประเมินที่ต้องตรวจสัญญาณ
    target = next(p for p in quality.quality_report(assignment.id, owner).pairCoverage if p['submittedCount'] == 0)
    coverage.instructor_comparison(assignment.id, coverage.InstructorComparisonIn(criterionId=target['criterionId'], itemAId=target['itemAId'], itemBId=target['itemBId'], reason='ผู้สอนประเมินเองเพื่อเติมคู่', choice=2), owner, request)
    report = quality.quality_report(assignment.id, owner)
    updated = next(p for p in report.pairCoverage if (p['itemAId'], p['itemBId']) == (target['itemAId'], target['itemBId']))
    assert updated['instructorCount'] == 1 and updated['submittedCount'] == 1
    assert len(report.evaluators) == len({row.email_normalized for row in rows if repo.my_pairs(assignment.id, side=Side.GROUP, evaluator_email=row.email_normalized)})

    # XLSX ครบ 4 sheet มาตรฐาน · ข้อความที่ขึ้นต้นด้วย "=" ถูก escape และไม่เป็นสูตร
    body = reports_export.ExportIn(reports=['GROUP', 'INDIVIDUAL', 'PAIR_COVERAGE', 'METADATA'], format='XLSX')
    response = reports_export.export_reports(assignment.id, body, teacher, request)
    assert 'sdpx-1-2569_group-work-1_all-reports_' in response.headers['content-disposition']
    with zipfile.ZipFile(io.BytesIO(response.body)) as book:
        workbook_xml = book.read('xl/workbook.xml').decode()
        assert [name in workbook_xml for name in ('Group Summary', 'Individual Summary', 'Pair Coverage', 'Metadata')] == [True] * 4
        coverage_xml = book.read('xl/worksheets/sheet3.xml').decode()
        assert "'=HYPERLINK" in coverage_xml and '<f>' not in coverage_xml

    # CSV หลายรายงาน → zip ไฟล์ละรายงาน มี BOM · ผู้ประเมินเป็นรหัส ไม่ใช่อีเมล
    raw = reports_export.export_reports(assignment.id, reports_export.ExportIn(reports=['GROUP', 'RAW_COMPARISONS'], format='CSV'), owner, request)
    with zipfile.ZipFile(io.BytesIO(raw.body)) as files:
        names = files.namelist()
        assert len(names) == 2 and all(name.endswith('.csv') for name in names)
        text = files.read(next(name for name in names if 'raw-comparisons' in name)).decode('utf-8')
        assert text.startswith('﻿') and 'E1' in text and rows[0].email_normalized not in text

    # failure cases: ตัวตนจริงต้องเป็น Owner + เหตุผล + มีผลเปรียบเทียบดิบ — ไม่ผ่านต้องไม่บันทึกประวัติ
    with pytest.raises(ForbiddenError):
        reports_export.export_reports(assignment.id, reports_export.ExportIn(reports=['RAW_COMPARISONS'], format='CSV', identity='EMAIL', reason='ตรวจสอบ'), teacher, request)
    with pytest.raises(ValidationError, match='เหตุผล'):
        reports_export.export_reports(assignment.id, reports_export.ExportIn(reports=['RAW_COMPARISONS'], format='CSV', identity='EMAIL', reason='  '), owner, request)
    with pytest.raises(ValidationError, match='ผลเปรียบเทียบดิบ'):
        reports_export.export_reports(assignment.id, reports_export.ExportIn(reports=['GROUP'], identity='EMAIL', reason='ตรวจสอบ'), owner, request)
    identified = reports_export.export_reports(assignment.id, reports_export.ExportIn(reports=['RAW_COMPARISONS'], format='CSV', identity='EMAIL', reason='ส่งกรรมการตรวจสอบ'), owner, request)
    assert rows[0].email_normalized in identified.body.decode('utf-8')

    history = reports_export.export_history(assignment.id, owner).items
    assert [(item.format, item.identified, item.actorName, item.actorRole) for item in history] == [
        ('CSV', True, 'สมชาย ใจดี', 'Owner'), ('CSV', False, 'สมชาย ใจดี', 'Owner'), ('XLSX', False, 'ปรียา', 'Co-teacher')]
    with db.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM audit_log WHERE resource_id = %s AND action = 'IDENTIFIED_EXPORT'", (assignment.id,))
        assert cur.fetchone()['n'] == 1
