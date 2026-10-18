"""Production must not sign sessions with a development fallback key."""

import runpy
import secrets
from pathlib import Path

import pytest


def read_config(monkeypatch: pytest.MonkeyPatch, *, environment: str, key: str | None):
    # Isolate this check from developer .env files and never read their contents.
    monkeypatch.setattr("dotenv.load_dotenv", lambda *args, **kwargs: None)
    monkeypatch.setenv("ENVIRONMENT", environment)
    monkeypatch.setenv("DEPLOYMENT_TIER", "local")
    if key is None:
        monkeypatch.delenv("SESSION_SECRET", raising=False)
    else:
        monkeypatch.setenv("SESSION_SECRET", key)
    return runpy.run_path(str(Path(__file__).resolve().parents[2] / "app" / "config.py"))


def test_production_without_explicit_signing_key_refuses_to_start(monkeypatch):
    with pytest.raises(RuntimeError, match="SESSION_SECRET"):
        read_config(monkeypatch, environment="production", key=None)


def test_production_rejects_the_development_key_even_when_explicitly_set(monkeypatch):
    development_key = read_config(monkeypatch, environment="development", key=None)["SESSION_SECRET"]

    with pytest.raises(RuntimeError, match="SESSION_SECRET"):
        read_config(monkeypatch, environment="production", key=development_key)


@pytest.mark.parametrize("environment", ["development", "test"])
def test_isolated_development_and_test_keep_their_fallback(monkeypatch, environment):
    config = read_config(monkeypatch, environment=environment, key=None)

    assert len(config["SESSION_SECRET"].encode()) >= config["MIN_SESSION_SECRET_BYTES"]


def test_production_accepts_an_explicit_strong_key(monkeypatch):
    test_key = secrets.token_urlsafe(48)
    config = read_config(monkeypatch, environment="production", key=test_key)

    assert config["SESSION_SECRET"] == test_key
