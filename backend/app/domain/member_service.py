"""เพิ่มและถอดผู้ร่วมสอนกับ TA — US-12

กฎทั้งหมดที่นี่ตอบคำถามเดียว: "ทำแล้วห้องเรียนยังอยู่ในสภาพที่ใช้งานได้ไหม"
ข้อที่สำคัญที่สุดคือ LAST_OWNER — ห้องที่ไม่มีเจ้าของแล้วไม่มีใครกู้คืนได้จากในระบบ
"""

from dataclasses import dataclass

from app.domain.email import normalize_email
from app.domain.errors import ConflictError, LastOwnerError, ValidationError
from app.domain.models import MemberRole

# role ที่เพิ่มผ่าน endpoint นี้ได้
#
# OWNER ไม่อยู่ในรายการโดยตั้งใจ — เจ้าของห้องเกิดจากการสร้างห้อง (กฎ C1)
# การโอนความเป็นเจ้าของเป็นคนละเรื่องและมีข้อควรระวังของตัวเอง ยังไม่มี story รองรับ
ASSIGNABLE_ROLES = frozenset({MemberRole.CO_TEACHER, MemberRole.TA})


@dataclass(frozen=True)
class MemberToAdd:
    email_normalized: str
    email_raw: str
    role: MemberRole


def validate_new_member(
    *,
    email_raw: str,
    role: MemberRole,
    allowed_email_domains: list[str],
    existing_role: MemberRole | None,
) -> MemberToAdd:
    """ตรวจทุกอย่างที่ตัดสินได้โดยไม่ต้องรู้ว่าใครเป็นคนสั่ง

    การตรวจสิทธิ์ของผู้สั่งอยู่ที่ชั้น API ผ่าน `Capability.MANAGE_MEMBERS`
    แยกกันเพราะสองเรื่องนี้เปลี่ยนด้วยเหตุผลคนละอย่าง
    """
    if role not in ASSIGNABLE_ROLES:
        raise ValidationError(
            f"เพิ่มสมาชิกด้วย role {role} ไม่ได้ — "
            f"รองรับเฉพาะ {', '.join(sorted(ASSIGNABLE_ROLES))}",
            field="role",
        )

    email = (email_raw or "").strip()
    if not email:
        raise ValidationError("ต้องระบุอีเมล", field="email")

    normalized = normalize_email(email)
    domain = normalized.rpartition("@")[2]

    # กฎเดียวกับ US-01 — ห้องเรียนที่จำกัด domain ต้องจำกัดกับทุกทางเข้า
    # ถ้าปิดเฉพาะทาง login แต่เปิดทางนี้ไว้ ข้อจำกัดนั้นก็ไม่มีความหมาย
    allowed = [d.strip().lower() for d in allowed_email_domains if d.strip()]
    if allowed and domain not in allowed:
        raise ValidationError(
            f"อีเมล domain '{domain}' เข้าห้องเรียนนี้ไม่ได้ "
            f"· domain ที่อนุญาต: {', '.join(allowed)}",
            field="email",
        )

    # FR-AUTHZ-03 — 1 คนมีได้ 1 role ต่อ 1 ห้องเรียน (แต่เป็นคนละ role ในห้องอื่นได้)
    if existing_role is not None:
        raise ConflictError(
            f"{normalized} เป็นสมาชิกห้องนี้อยู่แล้วในสถานะ {existing_role} — "
            f"ถอดออกก่อนแล้วเพิ่มใหม่ถ้าต้องการเปลี่ยน role",
            field="email",
        )

    return MemberToAdd(email_normalized=normalized, email_raw=email, role=role)


def assert_removable(*, role_to_remove: MemberRole, owner_count: int) -> None:
    """ห้ามถอด OWNER คนสุดท้าย รวมถึงกรณีถอดตัวเอง

    ห้องเรียนที่ไม่มี OWNER แล้วไม่มีใครเพิ่มสมาชิกหรือ finalize คะแนนได้อีกเลย
    และไม่มีทางกู้คืนจากในระบบ — ต้องไปแก้ที่ database ตรง ๆ
    """
    if role_to_remove is MemberRole.OWNER and owner_count <= 1:
        raise LastOwnerError(
            "ถอดเจ้าของห้องคนสุดท้ายไม่ได้ — "
            "ห้องเรียนที่ไม่มีเจ้าของจะไม่มีใครจัดการสมาชิกหรือตัดสินคะแนนได้อีก",
            field="role",
        )
