import pytest

from app.perf_fixture import prepare, validate_target


@pytest.mark.parametrize("tier", ["production", None, "unknown"])
def test_fixture_refuses_production_or_unknown_target(tier):
    with pytest.raises(ValueError):
        validate_target("https://staging.example.com", {"deploymentTier": tier}, "staging")


def test_public_staging_keeps_production_security_mode(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://test-only")
    monkeypatch.setenv("SESSION_SECRET", "fixture-test-only-secret-at-least-32-bytes")
    validate_target("https://staging.example.com", {
        "deploymentTier": "staging", "environment": "production",
    }, "staging")
    with pytest.raises(ValueError):
        validate_target("https://staging.example.com", {
            "deploymentTier": "staging", "environment": "development",
        }, "staging")


@pytest.mark.parametrize("missing", ["DATABASE_URL", "SESSION_SECRET"])
def test_staging_fixture_cannot_fall_back_to_dev_credentials(monkeypatch, missing):
    monkeypatch.setenv("DATABASE_URL", "postgresql://test-only")
    monkeypatch.setenv("SESSION_SECRET", "fixture-test-only-secret-at-least-32-bytes")
    monkeypatch.delenv(missing)
    with pytest.raises(ValueError, match="explicit database and session credentials"):
        validate_target("https://staging.example.com", {
            "deploymentTier": "staging", "environment": "production",
        }, "staging")


def test_fixture_requires_matching_tier_and_https():
    for url, configured in [("http://staging.example.com", "staging"), ("https://staging.example.com", "production")]:
        with pytest.raises(ValueError):
            validate_target(url, {"deploymentTier": "staging", "environment": "production"}, configured)


def test_fixture_cannot_write_sessions_to_unprotected_files(tmp_path):
    with pytest.raises(ValueError, match="performance/.secrets/"):
        prepare("http://127.0.0.1:8000", tmp_path / "fixture.json", 60, "example.com")


def test_GAP04_prd_scale_ใช้_5_เกณฑ์ต่อฝั่งและเปิดฝั่งบุคคล_ตาม_NFR_PERF_04():
    from app.perf_fixture import assignment_body

    body = assignment_body("cid", "run", prd_scale=True)
    group = [c for c in body["criteria"] if c["side"] == "GROUP"]
    individual = [c for c in body["criteria"] if c["side"] == "INDIVIDUAL"]

    assert len(group) == 5 and len(individual) == 5
    assert sum(c["weightPct"] for c in group) == 100 and sum(c["weightPct"] for c in individual) == 100
    assert body["individualMaxScore"] > 0 and body["targetCoverage"] == 5


def test_ค่าเริ่มต้นยังเป็น_journey_เดิม():
    from app.perf_fixture import assignment_body

    body = assignment_body("cid", "run", prd_scale=False)

    assert body["individualMaxScore"] == 0 and len(body["criteria"]) == 2
