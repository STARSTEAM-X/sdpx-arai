"""เทียบรายชื่อใน CSV กับรายชื่อปัจจุบันก่อนกดยืนยัน — FR-CLASS-05 (GAP-12)

การนำเข้าแทนที่นักศึกษาทั้งห้อง (`replace_roster`) ผู้สอนจึงต้องเห็นก่อนว่าใครจะถูกถอด
และใครจะย้ายกลุ่ม ไม่ใช่เห็นแค่รายชื่อในไฟล์ · pure function ล้วน ไม่แตะ DB
"""

from dataclasses import dataclass, field

from app.domain.models import MemberRole, RosterMember, RosterRow


@dataclass(frozen=True)
class RosterDiff:
    added: list[str] = field(default_factory=list)
    # (อีเมล, กลุ่มเดิม, กลุ่มใหม่)
    moved: list[tuple[str, str | None, str]] = field(default_factory=list)
    unchanged: list[str] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)


def diff_roster(current: list[RosterMember], incoming: list[RosterRow]) -> RosterDiff:
    # เฉพาะ STUDENT — OWNER / CO_TEACHER / TA ไม่ได้มาจากไฟล์ และ replace_roster ไม่แตะ
    before = {m.email: m.group_name for m in current if m.role is MemberRole.STUDENT}
    after = {r.email_normalized: r.group_name for r in incoming}

    added = sorted(email for email in after if email not in before)
    removed = sorted(email for email in before if email not in after)
    moved = sorted(
        (email, before[email], group)
        for email, group in after.items()
        if email in before and before[email] != group
    )
    unchanged = sorted(email for email, group in after.items() if before.get(email, None) == group and email in before)
    return RosterDiff(added=added, moved=moved, unchanged=unchanged, removed=removed)
