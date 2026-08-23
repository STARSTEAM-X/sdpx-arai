"""error ของชั้น domain

ตั้งใจไม่ให้ domain รู้จัก HTTP — ชั้น API เป็นคนแปลง error พวกนี้เป็น status code
ทำให้ทดสอบ business rule ได้โดยไม่ต้องยก web server ขึ้นมา
"""


class DomainError(Exception):
    """ฐานของ error ทุกตัวในชั้น domain

    `code` คือรหัสคงที่สำหรับเครื่องอ่าน ตรงกับที่ประกาศไว้ใน docs/openapi.yaml
    """

    code = "DOMAIN_ERROR"

    def __init__(self, message: str, *, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.field = field


class ValidationError(DomainError):
    """ข้อมูลที่ส่งเข้ามาผิดรูปแบบ — ชั้น API แปลงเป็น 422"""

    code = "VALIDATION_FAILED"


class ConflictError(DomainError):
    """ชนกับข้อมูลที่มีอยู่แล้ว — ชั้น API แปลงเป็น 409"""

    code = "ALREADY_EXISTS"


class NotFoundError(DomainError):
    """ไม่มี resource นี้ หรือผู้เรียกไม่มีสิทธิ์เห็นว่ามันมีอยู่ — ชั้น API แปลงเป็น 404

    สองกรณีนี้ต้องแยกไม่ออกจากกันโดยตั้งใจ (US-11)
    ถ้าตอบ 403 เมื่อ resource มีอยู่จริงแต่ไม่ใช่ของเรา คนนอกจะยิงไล่ id
    แล้วรู้ได้ว่า id ไหนมีอยู่จริง — เป็นการรั่วข้อมูลโดยไม่ต้อง login ด้วยซ้ำ
    """

    code = "NOT_FOUND"


class ForbiddenError(DomainError):
    """เห็น resource ได้แต่ทำสิ่งนี้ไม่ได้ — ชั้น API แปลงเป็น 403

    ใช้เฉพาะตอนที่ผู้เรียก **เป็นสมาชิกของ classroom นั้นอยู่แล้ว**
    การบอกว่า "คุณอยู่ในห้องนี้แต่ role ไม่พอ" ไม่ได้รั่วอะไรที่เขายังไม่รู้
    ถ้าไม่ได้เป็นสมาชิกต้องใช้ NotFoundError แทน
    """

    code = "FORBIDDEN"


class RosterImportError(DomainError):
    """CSV มีแถวที่ผิด — ชั้น API แปลงเป็น 422 พร้อม details รายแถว

    เก็บความผิด **ทุกแถว** ไม่ใช่แค่แถวแรก เพราะคนที่แก้ไฟล์อยากรู้ทีเดียวให้จบ
    ว่าต้องแก้ตรงไหนบ้าง ไม่ใช่แก้ทีละแถวแล้ว upload ใหม่ 20 รอบ (R2)
    """

    code = "ROSTER_INVALID"

    def __init__(self, message: str, *, rows: list["RowError"]):
        super().__init__(message)
        self.rows = rows


class RowError:
    """ความผิดของ CSV หนึ่งแถว"""

    def __init__(self, row: int, reason: str):
        self.row = row
        self.reason = reason

    def __eq__(self, other: object) -> bool:
        return (
            isinstance(other, RowError)
            and self.row == other.row
            and self.reason == other.reason
        )

    def __repr__(self) -> str:
        return f"RowError(row={self.row}, reason={self.reason!r})"
