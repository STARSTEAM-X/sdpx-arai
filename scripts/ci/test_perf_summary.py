import unittest

from perf_summary import public_summary


class PerformanceSummarySafetyTests(unittest.TestCase):
    def test_legacy_setup_sessions_are_excluded_without_changing_metrics(self):
        metrics = {"http_reqs": {"count": 335}, "latency": {"p(95)": 317.9503064}}
        groups = {"name": "", "checks": [{"name": "save 200", "passes": 108}]}
        exported = public_summary({
            "metrics": metrics, "root_group": groups,
            "setup_data": {"teacherToken": "private-test-placeholder", "students": ["private-test-placeholder"]},
            "debug": {"password": "private-test-placeholder"},
        })
        self.assertEqual(exported, {"metrics": metrics, "root_group": groups})

    def test_unexpected_private_data_in_metrics_blocks_upload_without_echoing_it(self):
        with self.assertRaises(ValueError) as result:
            public_summary({"metrics": {"debug": {"password": "private-test-placeholder"}}})
        self.assertNotIn("private-test-placeholder", str(result.exception))
        with self.assertRaises(ValueError):
            public_summary({"metrics": {"debug": "Bearer private-test-placeholder"}})


if __name__ == "__main__":
    unittest.main()
