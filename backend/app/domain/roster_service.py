"""นำเข้าและอ่านรายชื่อสมาชิกห้องเรียน — US-03

แบ่งหน้าที่กับ `roster_import.py` ชัดเจน:
- `parse_roster_csv()` ตัดสินว่าไฟล์ใช้ได้ไหม — ไม่แตะ database เลย
- service นี้ตัดสินว่า *ใครทำได้* แล้วสั่งบันทึก

การแยกแบบนี้ทำให้กฎ atomic (R1) บังคับใช้ได้จริง เพราะ parse จบก่อนเสมอ
ถ้ามีแถวผิดมันจะ raise ตั้งแต่ยังไม่มีการเขียนอะไรลง database สักแถว
"""

from app.domain.access import Capability, ClassroomAccess
from app.domain.errors import RosterImportError, RowError
from app.domain.models import RosterImportResult, RosterMember
from app.domain.repositories import ClassroomRepository
from app.domain.roster_import import parse_roster_csv


class RosterService:
    def __init__(
        self,
        classroom_repo: ClassroomRepository,
        allowed_email_domains: list[str] | None = None,
    ):
        self._repo = classroom_repo
        self._access = ClassroomAccess(classroom_repo)
        self._allowed_email_domains = {
            domain.strip().lower()
            for domain in (allowed_email_domains or [])
            if domain.strip()
        }

    def import_csv(
        self, *, classroom_id: str, actor_email: str, raw: bytes
    ) -> RosterImportResult:
        """นำเข้ารายชื่อจากไฟล์ CSV — ทั้งไฟล์ผ่านหรือไม่บันทึกเลย

        ตรวจสิทธิ์ก่อน parse โดยตั้งใจ: คนที่ไม่มีสิทธิ์ไม่ควรได้รู้ด้วยซ้ำว่า
        ไฟล์ที่เขาส่งมาถูกหรือผิด — นั่นก็เป็นข้อมูลรูปแบบหนึ่ง
        """
        self._access.require(classroom_id, actor_email, Capability.MANAGE_ROSTER)

        # raise RosterImportError พร้อมความผิดทุกแถวถ้าไฟล์ไม่ผ่าน (R1 + R2)
        result = parse_roster_csv(raw)

        if self._allowed_email_domains:
            domain_errors = [
                RowError(
                    row.row_number,
                    (
                        f"อีเมล domain '{row.email_normalized.rpartition('@')[2]}' "
                        f"ใช้ไม่ได้ · domain ที่อนุญาต: "
                        f"{', '.join(sorted(self._allowed_email_domains))}"
                    ),
                )
                for row in result.rows
                if row.email_normalized.rpartition("@")[2]
                not in self._allowed_email_domains
            ]
            if domain_errors:
                raise RosterImportError(
                    f"พบอีเมลนอก domain ที่อนุญาต {len(domain_errors)} แถว "
                    "— ไม่มีแถวใดถูกบันทึก",
                    rows=domain_errors,
                )

        self._repo.replace_roster(classroom_id, result.rows)
        return result

    def list_roster(self, *, classroom_id: str, actor_email: str) -> list[RosterMember]:
        """รายชื่อสมาชิกทั้งห้อง — นักศึกษาในห้องก็ดูได้ ไม่ใช่แค่ผู้สอน"""
        self._access.require_member(classroom_id, actor_email)
        return self._repo.list_roster(classroom_id)
