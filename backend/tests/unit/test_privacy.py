"""FR-PRIV-02 — พ้นระยะเก็บแล้วแทนตัวตนด้วย pseudonym คงที่"""
from datetime import UTC, datetime, timedelta

from app.domain.privacy import (
    anonymized_identity,
    identity_expired,
    is_anonymized,
    pseudonym,
    time_on_task_expired,
)

NOW = datetime(2029, 6, 1, tzinfo=UTC)


def test_pseudonym_is_stable_and_differs_per_user_and_secret():
    assert pseudonym("u1", "s") == pseudonym("u1", "s")
    assert pseudonym("u1", "s") != pseudonym("u2", "s")
    assert pseudonym("u1", "s") != pseudonym("u1", "other")


def test_anonymized_identity_has_no_original_data_and_is_recognisable():
    identity = anonymized_identity("u1", "s")
    assert is_anonymized(identity["email_normalized"])
    assert identity["email_normalized"] == identity["email_raw"]
    assert "u1" not in identity["display_name"]


def test_identity_retention_is_two_academic_years():
    assert not identity_expired(NOW - timedelta(days=729), NOW)
    assert identity_expired(NOW - timedelta(days=731), NOW)


def test_time_on_task_retention_is_one_academic_year():
    assert not time_on_task_expired(NOW - timedelta(days=364), NOW)
    assert time_on_task_expired(NOW - timedelta(days=366), NOW)
