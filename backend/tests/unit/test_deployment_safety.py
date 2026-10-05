"""public staging ต้องระบุเป้าหมายได้โดยไม่เปิด endpoint ปลอม session"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest


@pytest.mark.parametrize("tier", ["staging", "production"])
def test_public_deployments_keep_test_endpoints_closed(tier):
    result = subprocess.run(
        [sys.executable, "-c", (
            "import json; from app.main import app, health; "
            "from fastapi.testclient import TestClient; client = TestClient(app); "
            "print(json.dumps({'health': health(), 'testStatuses': "
            "[client.post('/api/test/' + p).status_code "
            "for p in ('seed', 'cleanup', 'session')]}))"
        )],
        cwd=Path(__file__).resolve().parents[2],
        env={
            "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
            "PATH": os.environ.get("PATH", ""),
            "ENVIRONMENT": "production", "DEPLOYMENT_TIER": tier,
        },
        capture_output=True, text=True, check=True,
    )
    payload = json.loads(result.stdout.splitlines()[-1])
    assert payload["health"]["deploymentTier"] == tier
    assert payload["health"]["environment"] == "production"
    assert payload["testStatuses"] == [404, 404, 404]
