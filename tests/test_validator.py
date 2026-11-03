"""Tests for the validator."""

import pytest
from aggregator.processing.validator import validate


def _base_job(**overrides):
    job = {
        "title": "Software Engineer",
        "company": "Acme Corp",
        "apply_url": "https://example.com/apply/123",
        "source": "Remotive",
        "job_id": "abc-123",
        "source_job_id": "123",
        "location": None,
        "country": None,
        "remote_type": "Remote",
        "employment_type": "Full-time",
        "experience": None,
        "salary": None,
        "description": "A great job",
        "posted_date": "2026-10-01",
        "collected_date": "2026-10-08",
        "status": "active",
    }
    job.update(overrides)
    return job


class TestValidator:
    def test_valid_job_passes(self):
        ok, reason = validate(_base_job())
        assert ok is True
        assert reason is None

    # ── title ──────────────────────────────────────────────────────────────

    def test_missing_title_rejected(self):
        ok, reason = validate(_base_job(title=None))
        assert ok is False
        assert "title" in reason

    def test_empty_title_rejected(self):
        ok, reason = validate(_base_job(title=""))
        assert ok is False

    def test_whitespace_only_title_rejected(self):
        ok, reason = validate(_base_job(title="   "))
        assert ok is False

    # ── company ────────────────────────────────────────────────────────────

    def test_missing_company_rejected(self):
        ok, reason = validate(_base_job(company=None))
        assert ok is False
        assert "company" in reason

    def test_empty_company_rejected(self):
        ok, reason = validate(_base_job(company=""))
        assert ok is False

    # ── apply_url ──────────────────────────────────────────────────────────

    def test_missing_url_rejected(self):
        ok, reason = validate(_base_job(apply_url=None))
        assert ok is False
        assert "apply_url" in reason

    def test_invalid_url_no_scheme_rejected(self):
        ok, reason = validate(_base_job(apply_url="example.com/job"))
        assert ok is False
        assert "apply_url" in reason

    def test_https_url_accepted(self):
        ok, _ = validate(_base_job(apply_url="https://example.com/job/1"))
        assert ok is True

    def test_http_url_accepted(self):
        ok, _ = validate(_base_job(apply_url="http://example.com/job/1"))
        assert ok is True

    def test_ftp_url_rejected(self):
        ok, reason = validate(_base_job(apply_url="ftp://example.com/job"))
        assert ok is False

    # ── source ─────────────────────────────────────────────────────────────

    def test_missing_source_rejected(self):
        ok, reason = validate(_base_job(source=None))
        assert ok is False
        assert "source" in reason

    def test_unknown_source_rejected(self):
        ok, reason = validate(_base_job(source="FakeJobBoard"))
        assert ok is False
        assert "source" in reason

    def test_all_known_sources_accepted(self):
        from aggregator.config.sources import KNOWN_SOURCE_NAMES
        for source_name in KNOWN_SOURCE_NAMES:
            ok, _ = validate(_base_job(source=source_name))
            assert ok is True, f"Known source {source_name!r} should be accepted"
