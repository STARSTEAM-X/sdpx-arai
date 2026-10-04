"""Trigger Render deploy hooks and verify the exact API and web commit.

All configuration comes from environment variables; hook URLs are never logged.
"""

import argparse
import json
import os
import sys
import time
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen


def commit_hook(url: str, sha: str) -> str:
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k != "ref"]
    query.append(("ref", sha))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def is_ready(api: dict, web: dict, sha: str, tier: str) -> bool:
    return (
        api.get("status") == "ok"
        and api.get("version") in {sha, sha[:7]}
        and web.get("version") in {sha, sha[:7]}
        and api.get("deploymentTier") == tier
        and api.get("environment") == "production"
    )


def read_json(url: str) -> dict:
    with urlopen(Request(url, headers={"Cache-Control": "no-cache"}), timeout=15) as response:
        return json.load(response)


def deploy(*, sha: str, tier: str, api_url: str, web_url: str,
           api_hook: str, web_hook: str, verify_only: bool, timeout: float) -> float:
    if tier not in {"staging", "production"} or not sha or not api_url or not web_url:
        raise ValueError("Missing deployment variables")
    if not verify_only and (not api_hook or not web_hook):
        raise ValueError("Missing environment deploy hooks")
    started = time.monotonic()
    if not verify_only:
        for name, hook in (("web", web_hook), ("api", api_hook)):
            with urlopen(Request(commit_hook(hook, sha), method="POST"), timeout=30):
                print(f"Queued {name} @ {sha[:7]}")
    deadline = started + timeout
    while time.monotonic() < deadline:
        try:
            api = read_json(api_url.rstrip("/") + "/api/health")
            web = read_json(web_url.rstrip("/") + "/build-info.json?" + urlencode({"commit": sha, "t": time.time_ns()}))
            if is_ready(api, web, sha, tier):
                return round(time.monotonic() - started, 1)
        except Exception:
            # Response/exception text can contain sensitive data; never echo it.
            pass
        time.sleep(min(10, max(0, deadline - time.monotonic())))
    raise TimeoutError("API and frontend did not confirm the target commit and tier")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    sha = os.getenv("GITHUB_SHA", "")
    try:
        seconds = deploy(
            sha=sha, tier=os.getenv("TARGET_TIER", ""),
            api_url=os.getenv("API_URL", ""), web_url=os.getenv("WEB_URL", ""),
            api_hook=os.getenv("API_HOOK", ""), web_hook=os.getenv("WEB_HOOK", ""),
            verify_only=args.verify_only, timeout=float(os.getenv("TIMEOUT_SECONDS", "600")),
        )
    except Exception as exc:
        print(f"Deployment failed ({type(exc).__name__}); inspect Render and environment configuration", file=sys.stderr)
        return 1
    lead = round(time.time() - float(os.getenv("COMMIT_TIMESTAMP", str(time.time()))), 1)
    print(f"Verified API + frontend @ {sha[:7]}; deploy {seconds}s; commit-to-live {lead}s")
    if os.getenv("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write(f"deploy_seconds={seconds}\nlead_seconds={lead}\n")
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
            summary.write(f"### Deploy {sha[:7]} verified\n\nAPI and web commit match; deploy {seconds}s; commit-to-live {lead}s.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
