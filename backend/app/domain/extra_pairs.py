"""Eligible student evaluators for one pair, using the existing self-evaluation rules."""
from app.domain.errors import ValidationError
from app.domain.pairing import GroupInfo, Side


def eligible_evaluators(groups: list[GroupInfo], side: Side, a: str, b: str) -> set[str]:
    if a == b:
        raise ValidationError('รายการ A และ B ต้องต่างกัน', field='itemBId')
    if side is Side.GROUP:
        ids = {group.id for group in groups}
        if a not in ids or b not in ids:
            raise ValidationError('ไม่พบกลุ่มที่เลือกในห้องเรียนนี้', field='items')
        return {member for group in groups if group.id not in {a, b} for member in group.member_ids}
    group = next((group for group in groups if a in group.member_ids and b in group.member_ids), None)
    if group is None:
        raise ValidationError('การประเมินรายบุคคลต้องเป็นสมาชิกที่ยังเรียนอยู่ในกลุ่มเดียวกัน', field='items')
    return set(group.member_ids) - {a, b}
