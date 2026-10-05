"""Keep only k6 metrics/groups before publishing; never expose setup sessions."""

import json
import re
import sys
from pathlib import Path

SENSITIVE = re.compile(
    r"postgres(?:ql)?://|Bearer\s+[A-Za-z0-9._-]+|"
    r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b|"
    r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE,
)
PRIVATE_KEYS = {"setup_data", "password", "token", "teachertoken", "students",
                "ajarn", "session_secret", "authorization", "cookie"}


def public_summary(data: dict) -> dict:
    if not isinstance(data, dict) or not isinstance(data.get("metrics"), dict):
        raise ValueError("Invalid performance summary")
    result = {key: data[key] for key in ("metrics", "root_group") if key in data}

    def check(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key.lower() in PRIVATE_KEYS:
                    raise ValueError("Private field in performance summary")
                check(key)
                check(child)
        elif isinstance(value, list):
            for child in value:
                check(child)
        elif isinstance(value, str) and SENSITIVE.search(value):
            raise ValueError("Sensitive pattern in performance summary")

    check(result)
    return result


def main() -> int:
    processed = 0
    try:
        for filename in sys.argv[1:]:
            path = Path(filename)
            if not path.exists():
                continue
            data = json.loads(path.read_text(encoding="utf-8-sig"))
            result = public_summary(data)
            path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            processed += 1
    except Exception:
        # Do not print input or exception details: they may contain credentials.
        print("Unsafe or invalid performance summary; upload blocked", file=sys.stderr)
        return 1
    if not processed:
        print("No fresh performance summaries; upload blocked", file=sys.stderr)
        return 1
    print(f"Safe performance summaries: {processed}; metrics/groups only")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
