"""Tests for the deduplicator."""

import pytest
from aggregator.processing.deduplicator import deduplicate, _norm, _url_key


def _job(
    job_id="1",
    title="Engineer",
    company="Acme",
    location="London",
    apply_url="https://example.com/job/1",
    source="Remotive",
    source_job_id="1",
):
    return {
        "job_id": job_id,
        "title": title,
        "company": company,
        "location": location,
        "apply_url": apply_url,
        "source": source,
        "source_job_id": source_job_id,
        "country": None,
        "remote_type": "Remote",
        "employment_type": "Full-time",
        "experience": None,
        "salary": None,
        "description": None,
        "posted_date": None,
        "collected_date": "2026-10-08",
        "status": "active",
    }


class TestDeduplicator:

    # ── Tier 1: source + source_job_id ────────────────────────────────────

    def test_exact_source_id_duplicate_removed(self):
        jobs = [
            _job(job_id="A", apply_url="https://a.com", source="Remotive", source_job_id="99"),
            _job(job_id="B", apply_url="https://b.com", source="Remotive", source_job_id="99"),
        ]
        unique, removed = deduplicate(jobs)
        assert removed == 1
        assert len(unique) == 1
        assert unique[0]["job_id"] == "A"  # keeps first

    def test_same_id_different_source_not_deduped(self):
        jobs = [
            _job(job_id="A", title="Backend Dev", apply_url="https://a.com", source="Remotive", source_job_id="99"),
            _job(job_id="B", title="Frontend Dev", apply_url="https://b.com", source="Jobicy", source_job_id="99"),
        ]
        unique, removed = deduplicate(jobs)
        assert removed == 0
        assert len(unique) == 2

    # ── Tier 2: normalized apply_url ──────────────────────────────────────

    def test_same_url_duplicate_removed(self):
        jobs = [
            _job(job_id="A", source_job_id="1", apply_url="https://example.com/job/1"),
            _job(job_id="B", source_job_id="2", apply_url="https://example.com/job/1"),
        ]
        unique, removed = deduplicate(jobs)
        assert removed == 1
        assert len(unique) == 1

    def test_url_trailing_slash_normalized(self):
        jobs = [
            _job(job_id="A", source_job_id="1", apply_url="https://example.com/job/1/"),
            _job(job_id="B", source_job_id="2", apply_url="https://example.com/job/1"),
        ]
        unique, removed = deduplicate(jobs)
        assert removed == 1

    def test_url_case_normalized(self):
        jobs = [
            _job(job_id="A", source_job_id="1", apply_url="https://Example.COM/Job/1"),
            _job(job_id="B", source_job_id="2", apply_url="https://example.com/Job/1"),
        ]
        unique, removed = deduplicate(jobs)
        assert removed == 1

    # ── Tier 3: company + title + location ────────────────────────────────

    def test_same_company_title_location_duplicate_removed(self):
        jobs = [
            _job(job_id="A", source_job_id="1", apply_url="https://a.com",
                 company="Acme", title="Engineer", location="London"),
            _job(job_id="B", source_job_id="2", apply_url="https://b.com",
                 company="Acme", title="Engineer", location="London"),
        ]
        unique, removed = deduplicate(jobs)
        assert removed == 1

    def test_same_company_title_different_location_not_deduped(self):
        jobs = [
            _job(job_id="A", source_job_id="1", apply_url="https://a.com",
                 company="Acme", title="Engineer", location="London"),
            _job(job_id="B", source_job_id="2", apply_url="https://b.com",
                 company="Acme", title="Engineer", location="New York"),
        ]
        unique, removed = deduplicate(jobs)
        assert removed == 0

    def test_similar_titles_not_merged(self):
        """Deduplication must not merge jobs with merely similar (not identical) titles."""
        jobs = [
            _job(job_id="A", source_job_id="1", apply_url="https://a.com",
                 title="Senior Engineer", company="Acme", location="London"),
            _job(job_id="B", source_job_id="2", apply_url="https://b.com",
                 title="Junior Engineer", company="Acme", location="London"),
        ]
        unique, removed = deduplicate(jobs)
        assert removed == 0
        assert len(unique) == 2

    def test_whitespace_and_case_normalization_in_tier3(self):
        jobs = [
            _job(job_id="A", source_job_id="1", apply_url="https://a.com",
                 company="ACME Corp", title="  Engineer  ", location="london"),
            _job(job_id="B", source_job_id="2", apply_url="https://b.com",
                 company="acme corp", title="Engineer", location="London"),
        ]
        unique, removed = deduplicate(jobs)
        assert removed == 1

    # ── Edge cases ────────────────────────────────────────────────────────

    def test_empty_list(self):
        unique, removed = deduplicate([])
        assert unique == []
        assert removed == 0

    def test_single_job_no_removal(self):
        jobs = [_job()]
        unique, removed = deduplicate(jobs)
        assert len(unique) == 1
        assert removed == 0

    def test_no_source_job_id_falls_through_to_url(self):
        jobs = [
            _job(job_id="A", source_job_id="", apply_url="https://example.com/job/5"),
            _job(job_id="B", source_job_id="", apply_url="https://example.com/job/5"),
        ]
        unique, removed = deduplicate(jobs)
        assert removed == 1


class TestNormHelper:
    def test_lowercase(self):
        assert _norm("Hello") == "hello"

    def test_strips_whitespace(self):
        assert _norm("  hi  ") == "hi"

    def test_collapses_spaces(self):
        assert _norm("hello   world") == "hello world"

    def test_none_returns_empty(self):
        assert _norm(None) == ""
