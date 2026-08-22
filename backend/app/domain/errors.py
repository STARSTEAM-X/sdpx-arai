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
