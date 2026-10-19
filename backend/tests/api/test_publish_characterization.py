"""Capture publish's existing contract before WS-08 extraction; no real database."""

from contextlib import contextmanager
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest
from starlette.requests import Request

from app.api import assignments as api
from app.domain.assignment_service import Assignment, AssignmentStatus, Criterion
from app.domain.audit import AuditAction
from app.domain.errors import ConflictError, ValidationError
from app.domain.pairing import GroupInfo, Side


@pytest.fixture
def publication(monkeypatch):
    assignment = Assignment(
        id="assignment", classroom_id="classroom", name="งานประเมิน",
        group_max_score=Decimal(10), individual_max_score=Decimal(0),
        group_deadline_utc=datetime(2030, 1, 1, tzinfo=UTC), created_by="teacher@example.test",
        target_coverage=1, criteria=[Criterion("group", Side.GROUP, "คุณภาพ", Decimal(100))],
    )
    state = SimpleNamespace(assignment=assignment, calls=[], saved=[], audits=[], fail=None, archived=False)
    state.groups = [
        GroupInfo(f"g{i}", f"กลุ่ม {i}", tuple(f"u{i}{j}" for j in range(3)))
        for i in range(3)
    ]

    @contextmanager
    def transaction():
        state.calls.append("begin")
        try:
            yield object()
        except Exception:
            state.calls.append("rollback")
            raise
        else:
            state.calls.append("commit")

    class Repository:
        def __init__(self, conn):
            pass

        def lock(self, assignment_id):
            # Lifecycle now serializes publishing against draft edits/unpublish.
            assert assignment_id == assignment.id
            return assignment

        def groups_with_members(self, classroom_id):
            assert classroom_id == assignment.classroom_id
            state.calls.append("groups")
            return state.groups

        def save_pairs(self, assignment_id, pairs, *, criterion_id):
            assert assignment_id == assignment.id
            state.calls.append(criterion_id)
            if state.fail == "save":
                raise RuntimeError("synthetic persistence failure")
            state.saved.extend(pairs)

        def mark_published(self, assignment_id, *, seed, at):
            state.calls.append("published")
            assert assignment_id == assignment.id and at.tzinfo is UTC
            state.seed = seed

        def record(self, event):
            state.calls.append("audit")
            if state.fail == "audit":
                raise RuntimeError("synthetic audit failure")
            state.audits.append(event)

    def load(conn, assignment_id, email):
        assert assignment_id == assignment.id and email == assignment.created_by
        state.calls.append("authorize")
        return assignment

    monkeypatch.setattr(api, "transaction", transaction)
    monkeypatch.setattr(api, "_load_for_instructor", load)
    # New archive requirement: preserve the existing publication characterization while
    # replacing the new database-backed classroom guard with an explicit fixture state.
    def writable(conn, classroom_id):
        assert classroom_id == assignment.classroom_id
        if state.archived:
            raise ConflictError("ห้องเรียนนี้เก็บเข้าคลังแล้ว")
    monkeypatch.setattr(api, "require_writable_classroom", writable)
    monkeypatch.setattr(api, "PgAssignmentRepository", Repository)
    monkeypatch.setattr(api, "PgAuditRepository", Repository)
    monkeypatch.setattr(api, "log_event", lambda *args, **kwargs: state.calls.append("log"))
    state.request = Request({"type": "http", "client": ("127.0.0.1", 1234)})
    return state


def publish(state, seed=0):
    return api.publish_assignment(state.assignment.id, state.assignment.created_by, state.request, seed)


def test_archived_classroom_rejects_publication_before_creating_pairs(publication):
    publication.archived = True
    with pytest.raises(ConflictError, match="เก็บเข้าคลัง"):
        publish(publication)
    assert publication.saved == []
    assert publication.audits == []


@pytest.mark.parametrize("individual", [False, True])
def test_publish_response_pair_counts_and_audit_order(publication, individual):
    state = publication
    if individual:
        state.assignment.individual_max_score = Decimal(10)
        state.assignment.criteria.append(Criterion("individual", Side.INDIVIDUAL, "ผลงาน", Decimal(100)))

    response = publish(state)

    assert response.model_dump() == {
        "assignmentId": "assignment", "status": "PUBLISHED",
        "pairsCreated": 18 if individual else 9, "pairingSeed": 0,
    }
    assert state.calls == [
        "begin", "authorize", "groups", "group", *(["individual"] if individual else []),
        "published", "audit", "commit", "log",
    ]
    assert len(state.saved) == response.pairsCreated
    event, = state.audits
    assert event.action is AuditAction.ASSIGNMENT_PUBLISHED
    assert event.actor_email == state.assignment.created_by and event.ip == "127.0.0.1"
    assert event.before_state == {"status": "DRAFT"}
    assert event.after_state == {"status": "PUBLISHED", "pairsCreated": response.pairsCreated, "pairingSeed": 0}


def test_publish_without_seed_preserves_generated_seed(publication, monkeypatch):
    monkeypatch.setattr(api.secrets, "randbelow", lambda limit: 123 if limit == 2**31 else None)
    assert publish(publication, seed=None).pairingSeed == 123
    assert publication.seed == 123


def test_non_draft_is_rejected_before_loading_roster(publication):
    publication.assignment.status = AssignmentStatus.PUBLISHED
    with pytest.raises(ConflictError):
        publish(publication)
    assert publication.calls == ["begin", "authorize", "rollback"]


def test_infeasible_roster_is_rejected_before_writes(publication):
    publication.groups = publication.groups[:1]
    with pytest.raises(ValidationError) as error:
        publish(publication)
    assert error.value.field == "targetCoverage"
    assert publication.calls == ["begin", "authorize", "groups", "rollback"]


@pytest.mark.parametrize("failure", ["save", "audit"])
def test_persistence_errors_escape_transaction_without_success_log(publication, failure):
    publication.fail = failure
    with pytest.raises(RuntimeError, match="synthetic"):
        publish(publication)
    assert publication.calls[-1] == "rollback"
    assert "commit" not in publication.calls and "log" not in publication.calls
    if failure == "save":
        assert "published" not in publication.calls
