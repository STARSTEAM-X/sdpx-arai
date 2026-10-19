"""สำเนาข้อมูลของเจ้าตัว — FR-PRIV-03 (PDPA มาตรา 30) · GAP-02

เดิมระบบรับคำขอแล้วค้างที่ IN_PROGRESS ตลอดไป เพราะไม่มีใครส่งสำเนาได้ ตอนนี้เจ้าตัว
ดาวน์โหลดสำเนาได้เองทันที (self-service) จึงทำได้เร็วกว่าเส้นตาย 30 วันเสมอ
และไม่ต้องพึ่งอีเมลซึ่งระบบยังไม่มี (GAP-03)

pure function ล้วน — ไฟล์นี้ตัดสินแค่ "อะไรอยู่ในสำเนาได้" กับ "คำขอไหนเลยกำหนด"
"""

from datetime import datetime, timedelta

DUE_DAYS = 30
STATUS_SENT = "SENT"

# FR-ANON-01 — สำเนาของเจ้าตัวห้ามมีตัวตนของผู้ประเมินคนอื่น แม้จะเป็นข้อมูล "เกี่ยวกับ" เจ้าตัวก็ตาม
FORBIDDEN_KEYS = frozenset({"evaluator", "evaluatorId", "evaluatorEmail", "evaluator_user_id", "evaluator_email"})


def due_at(requested_at: datetime) -> datetime:
    return requested_at + timedelta(days=DUE_DAYS)


def is_overdue(*, requested_at: datetime, status: str, now: datetime) -> bool:
    return status != STATUS_SENT and now > due_at(requested_at)


def _assert_no_evaluator_identity(value: object, path: str = "") -> None:
    if isinstance(value, dict):
        for key, inner in value.items():
            if key in FORBIDDEN_KEYS:
                raise ValueError(f"สำเนาข้อมูลมีตัวตนผู้ประเมินที่ {path}.{key} (FR-ANON-01)")
            _assert_no_evaluator_identity(inner, f"{path}.{key}")
    elif isinstance(value, list):
        for i, inner in enumerate(value):
            _assert_no_evaluator_identity(inner, f"{path}[{i}]")


def build_data_copy(
    *,
    generated_at: datetime,
    profile: dict,
    memberships: list[dict],
    evaluations_given: list[dict],
    scores: list[dict],
    requests: list[dict],
) -> dict:
    """รวมข้อมูลของเจ้าตัวเป็นเอกสารเดียว — ตรวจซ้ำว่าไม่มีตัวตนผู้ประเมินคนอื่นก่อนคืน

    `evaluations_given` คือคำตอบที่เจ้าตัวเป็นคนประเมินเอง (เห็นอยู่แล้วบนหน้าประเมิน)
    `scores` ต้องผ่านกฎ k-anonymity มาแล้ว — ส่วนที่ซ่อนจากหน้าคะแนนต้องซ่อนในสำเนาด้วย (FR-ANON-02)
    """
    document = {
        "generatedAt": generated_at.isoformat(),
        "profile": profile,
        "classrooms": memberships,
        "evaluationsGiven": evaluations_given,
        "scores": scores,
        "dataCopyRequests": requests,
    }
    _assert_no_evaluator_identity(document)
    return document
