"""จับเวลา full recompute บน staging จริง — NFR-PERF-05 (≤ 30 วินาที) · GAP-04

อ่าน fixture ส่วนตัว (performance/.secrets/fixture.json) ที่ app.perf_fixture สร้าง แล้วเรียก
`POST /api/assignments/{id}:recompute` ด้วย token ของผู้สอน — รันหลัง load test เพื่อให้มีผลประเมินจริงให้คำนวณ
พิมพ์แค่เวลาและสถานะ ห้ามพิมพ์ token หรือ body (ตามกติกาเดียวกับ perf_fixture)
"""

import json
import statistics
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

TARGET_SECONDS = 30.0


def main(fixture_path: str, runs: int = 3) -> int:
    fixture = json.loads(Path(fixture_path).read_text(encoding="utf-8"))
    url = f"{fixture['baseUrl']}/api/assignments/{fixture['assignmentId']}:recompute"
    durations = []
    for _ in range(runs):
        request = Request(url, data=b"", method="POST",
                          headers={"Authorization": "Bearer " + fixture["teacherToken"]})
        started = time.perf_counter()
        try:
            with urlopen(request, timeout=120) as res:
                res.read()
        except Exception as exc:
            print(f"recompute failed ({type(exc).__name__})", file=sys.stderr)
            return 1
        durations.append(time.perf_counter() - started)
    median = statistics.median(durations)
    print(f"NFR-PERF-05 recompute runs: {', '.join(f'{d:.2f}s' for d in durations)} · median {median:.2f}s "
          f"(target ≤ {TARGET_SECONDS:.0f}s)")
    return 0 if median <= TARGET_SECONDS else 99


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "performance/.secrets/fixture.json"))
