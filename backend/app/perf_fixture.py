"""เตรียม fixture จากสิทธิ์ DB ของ staging โดยไม่เปิด HTTP test endpoints.

รันใน environment ของ staging; session เขียนเฉพาะ performance/.secrets/ เท่านั้น.
ห้ามใช้คำสั่งนี้กับ production database.
"""

import argparse
import json
import os
import sys
import uuid
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import psycopg

from app.auth import issue_session
from app.config import ALLOWED_EMAIL_DOMAINS, DATABASE_URL, DEPLOYMENT_TIER

PRIVATE_DIR = Path(__file__).resolve().parents[2] / "performance" / ".secrets"


def validate_target(base_url: str, health: dict, configured_tier: str) -> None:
    parsed = urlparse(base_url)
    local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if not local and parsed.scheme != "https":
        raise ValueError("Remote load tests require HTTPS")
    tier = health.get("deploymentTier")
    if tier not in {"local", "staging"} or tier != configured_tier:
        raise ValueError("Refusing production, unknown or mismatched deployment tier")
    if not local and (tier != "staging" or health.get("environment") != "production"):
        raise ValueError("Public staging must keep ENVIRONMENT=production")
    if not local and any(not os.getenv(key) for key in ("DATABASE_URL", "SESSION_SECRET")):
        raise ValueError("Staging fixture requires explicit database and session credentials")


def prepare(base_url: str, output: Path, students: int, domain: str) -> dict:
    output = output.resolve()
    if not output.is_relative_to(PRIVATE_DIR.resolve()):
        raise ValueError("Session fixture must stay in performance/.secrets/")
    if students < 12 or students % 4:
        raise ValueError("Use at least 12 students, in complete groups of four")
    if ALLOWED_EMAIL_DOMAINS and domain not in ALLOWED_EMAIL_DOMAINS:
        raise ValueError("Test account domain must match ALLOWED_EMAIL_DOMAINS")

    def api(path, *, token=None, body=None, method="GET", content_type="application/json"):
        data = json.dumps(body).encode() if isinstance(body, dict) else body
        headers = {"Content-Type": content_type}
        if token:
            headers["Authorization"] = "Bearer " + token
        with urlopen(Request(base_url + path, data=data, headers=headers, method=method), timeout=30) as res:
            return json.load(res)

    health = api("/api/health")
    validate_target(base_url, health, DEPLOYMENT_TIER)
    run_id = uuid.uuid4().hex[:12]
    emails = [f"perf-{run_id}-teacher@{domain}"] + [
        f"perf-{run_id}-s{i:03}@{domain}" for i in range(students)
    ]
    with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO app_user (id,email_normalized,email_raw,display_name,status) "
            "VALUES (%s,%s,%s,%s,'ACTIVE')",
            [(str(uuid.uuid4()), email, email, "Load test account") for email in emails],
        )
    sessions = [issue_session(email) for email in emails]
    teacher = sessions[0][0]
    classroom_id = api("/api/classrooms", token=teacher, method="POST", body={
        "name": f"Load test {run_id}", "timezone": "Asia/Bangkok",
    })["id"]
    csv = "email,group_name\n" + "\n".join(
        f"{email},perf-group-{i // 4:03}" for i, email in enumerate(emails[1:])
    )
    boundary = "pair-eval-" + run_id
    multipart = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
                 f'filename="roster.csv"\r\nContent-Type: text/csv\r\n\r\n'
                 f'{csv}\r\n--{boundary}--\r\n').encode()
    api(f"/api/classrooms/{classroom_id}/roster:import", token=teacher, method="POST",
        body=multipart, content_type=f"multipart/form-data; boundary={boundary}")
    assignment_id = api("/api/assignments", token=teacher, method="POST", body={
        "classroomId": classroom_id, "name": f"Load test {run_id}",
        "groupMaxScore": 15, "individualMaxScore": 0,
        "groupDeadlineUtc": "2099-01-01T00:00:00Z", "targetCoverage": 1,
        "criteria": [
            {"side": "GROUP", "name": "UX", "weightPct": 50},
            {"side": "GROUP", "name": "Code quality", "weightPct": 50},
        ],
    })["id"]
    api(f"/api/assignments/{assignment_id}:publish", token=teacher, method="POST")
    fixture = {
        "baseUrl": base_url, "classroomId": classroom_id, "assignmentId": assignment_id,
        "teacherToken": teacher, "students": [token for token, _ in sessions[1:]],
        "expiresAt": min(expires for _, expires in sessions).isoformat(),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(fixture), encoding="utf-8")
    output.chmod(0o600)
    return {"students": students, "expiresAt": fixture["expiresAt"]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--output", type=Path, default=PRIVATE_DIR / "fixture.json")
    parser.add_argument("--students", type=int, default=60)
    parser.add_argument("--domain", default=ALLOWED_EMAIL_DOMAINS[0] if ALLOWED_EMAIL_DOMAINS else "example.com")
    args = parser.parse_args()
    try:
        result = prepare(args.base_url.rstrip("/"), args.output, args.students, args.domain)
    except Exception as exc:
        # ห้ามพิมพ์ exception/body: อาจมี URL ของ DB, email หรือ session ปนอยู่
        print(f"Fixture preparation failed ({type(exc).__name__}); check staging configuration", file=sys.stderr)
        return 1
    print(f"Private fixture ready: {result['students']} students; expires {result['expiresAt']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
