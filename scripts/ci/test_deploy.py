"""Verify deployment safety without Docker, pytest or external credentials."""

import runpy
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

deployment = runpy.run_path(Path(__file__).with_name("deploy.py"))


class DeploymentContractTests(unittest.TestCase):
    def test_deploy_waits_for_both_api_and_frontend_commit(self):
        sha = "abcdef1234567890"
        api = {"status": "ok", "version": sha[:7], "environment": "production", "deploymentTier": "staging"}
        ready = deployment["is_ready"]
        self.assertTrue(ready(api, {"version": sha}, sha, "staging"))
        self.assertFalse(ready(api, {"version": "old-version"}, sha, "staging"))
        self.assertFalse(ready({**api, "version": "old-api"}, {"version": sha}, sha, "staging"))
        self.assertFalse(ready({**api, "deploymentTier": "production"}, {"version": sha}, sha, "staging"))
        self.assertFalse(ready({**api, "environment": "development"}, {"version": sha}, sha, "staging"))

    def test_deploy_hook_keeps_key_and_pins_exact_commit(self):
        for url in ("https://render.example/deploy?key=test-only", "https://render.example/deploy?key=test-only&ref=old"):
            result = deployment["commit_hook"](url, "abcdef1234567890")
            self.assertEqual(parse_qs(urlsplit(result).query), {"key": ["test-only"], "ref": ["abcdef1234567890"]})


if __name__ == "__main__":
    unittest.main()
