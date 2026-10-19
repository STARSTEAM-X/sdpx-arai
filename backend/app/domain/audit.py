"""เหตุการณ์ที่ต้องบันทึกไว้แบบลบไม่ได้ — US-14

รายการ action มาจาก AC ข้อแรกของ story ตรง ๆ ประกาศเป็น enum เพื่อให้
"ลืมบันทึก" กับ "พิมพ์ชื่อ action ผิด" กลายเป็น error ตอน import ไม่ใช่ช่องว่างใน log
"""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class AuditAction(StrEnum):
    """เหตุการณ์ที่ PRD บังคับให้บันทึก (FR-AUDIT-01)

    ตัวที่ยังไม่มีในระบบถูกประกาศไว้ล่วงหน้าโดยตั้งใจ — story ที่มาทีหลัง
    จะได้หยิบไปใช้แทนที่จะตั้งชื่อใหม่เอง แล้วเกิดสองชื่อสำหรับเรื่องเดียวกัน
    """

    ASSIGNMENT_PUBLISHED = "ASSIGNMENT_PUBLISHED"
    ASSIGNMENT_UNPUBLISHED = "ASSIGNMENT_UNPUBLISHED"
    PAIRS_REGENERATED = "PAIRS_REGENERATED"
    MEMBER_ROLE_CHANGED = "MEMBER_ROLE_CHANGED"
    MEMBER_REMOVED = "MEMBER_REMOVED"
    SCORE_OVERRIDDEN = "SCORE_OVERRIDDEN"
    SCORES_FINALIZED = "SCORES_FINALIZED"
    SCORES_REOPENED = "SCORES_REOPENED"
    IDENTIFIED_EXPORT = "IDENTIFIED_EXPORT"
    EVALUATOR_IDENTITY_VIEWED = "EVALUATOR_IDENTITY_VIEWED"
    CLASSROOM_ARCHIVED = "CLASSROOM_ARCHIVED"
    CLASSROOM_RESTORED = "CLASSROOM_RESTORED"
    CLASSROOM_DELETED = "CLASSROOM_DELETED"
    CLASSROOM_UPDATED = "CLASSROOM_UPDATED"
    APPEAL_CREATED = "APPEAL_CREATED"
    APPEAL_RESOLVED = "APPEAL_RESOLVED"
    DEADLINE_EXTENDED = 'DEADLINE_EXTENDED'
    ASSIGNMENT_COPIED = 'ASSIGNMENT_COPIED'
    MEMBER_ENROLLMENT_CHANGED = 'MEMBER_ENROLLMENT_CHANGED'
    COMPARISONS_EXCLUDED = 'COMPARISONS_EXCLUDED'
    COMPARISONS_INCLUDED = 'COMPARISONS_INCLUDED'
    EXTRA_EVALUATIONS_ASSIGNED = 'EXTRA_EVALUATIONS_ASSIGNED'
    INSTRUCTOR_COMPARISON_SUBMITTED = 'INSTRUCTOR_COMPARISON_SUBMITTED'
    DATA_COPY_PROVIDED = 'DATA_COPY_PROVIDED'


# action ที่ห้ามบันทึกโดยไม่มีเหตุผลกำกับ — ทุกตัวคือการแทรกแซงคะแนนด้วยมือ
# ถ้าปล่อยให้ reason ว่างได้ log จะตอบได้แค่ "ใครทำ" แต่ตอบ "ทำไม" ไม่ได้
# ซึ่งเป็นคำถามที่คนถามจริงเมื่อคะแนนเปลี่ยน
ACTIONS_REQUIRING_REASON = frozenset(
    {
        AuditAction.SCORE_OVERRIDDEN,
        AuditAction.SCORES_REOPENED,
        AuditAction.IDENTIFIED_EXPORT,
        AuditAction.ASSIGNMENT_UNPUBLISHED,
        AuditAction.DEADLINE_EXTENDED,
        AuditAction.MEMBER_ENROLLMENT_CHANGED,
        AuditAction.EVALUATOR_IDENTITY_VIEWED,
        AuditAction.COMPARISONS_EXCLUDED,
        AuditAction.COMPARISONS_INCLUDED,
        AuditAction.EXTRA_EVALUATIONS_ASSIGNED,
        AuditAction.INSTRUCTOR_COMPARISON_SUBMITTED,
    }
)


@dataclass(frozen=True)
class AuditEvent:
    actor_email: str
    action: AuditAction
    resource_type: str
    resource_id: str | None = None
    classroom_id: str | None = None
    before_state: dict | None = None
    after_state: dict | None = None
    reason: str | None = None
    ip: str | None = None
    occurred_at: datetime | None = None


class MissingAuditReason(Exception):
    """action ที่บังคับเหตุผลถูกบันทึกโดยไม่มี reason

    ไม่ใช่ DomainError เพราะไม่ใช่ความผิดของผู้ใช้ — เป็นความผิดของ code ที่เรียก
    ปล่อยให้เป็น 500 ถูกแล้ว: มันคือบั๊กที่ต้องแก้ ไม่ใช่ input ที่ต้องแก้
    """


def validate(event: AuditEvent) -> AuditEvent:
    if event.action in ACTIONS_REQUIRING_REASON and not (event.reason or "").strip():
        raise MissingAuditReason(
            f"action {event.action} ต้องมีเหตุผลกำกับเสมอ (FR-AUDIT-02)"
        )
    return event
