"""Unit tests for URL resolver (extracting direct ATS and company links)."""

import pytest
from aggregator.processing.resolver import extract_direct_apply_url, resolve_job_urls


def _make_job(apply_url="https://jobboard.com/job/1", description="Great company"):
    return {
        "job_id": "test-1",
        "title": "Backend Engineer",
        "company": "Stripe",
        "apply_url": apply_url,
        "description": description,
    }


class TestURLResolver:
    def test_apply_url_already_greenhouse(self):
        job = _make_job(apply_url="https://boards.greenhouse.io/stripe/jobs/12345")
        assert extract_direct_apply_url(job) == "https://boards.greenhouse.io/stripe/jobs/12345"

    def test_apply_url_already_lever(self):
        job = _make_job(apply_url="https://jobs.lever.co/figma/67890")
        assert extract_direct_apply_url(job) == "https://jobs.lever.co/figma/67890"

    def test_apply_url_already_workday(self):
        job = _make_job(apply_url="https://adobe.myworkdayjobs.com/en-US/careers/job/1")
        assert extract_direct_apply_url(job) == "https://adobe.myworkdayjobs.com/en-US/careers/job/1"

    def test_apply_url_already_ashby(self):
        job = _make_job(apply_url="https://jobs.ashbyhq.com/openai/abc-def")
        assert extract_direct_apply_url(job) == "https://jobs.ashbyhq.com/openai/abc-def"

    def test_extract_ats_from_description(self):
        job = _make_job(
            apply_url="https://aggregator.com/post/999",
            description="To apply, submit your resume at https://boards.greenhouse.io/startup/jobs/555 today!",
        )
        ats = extract_direct_apply_url(job)
        assert ats == "https://boards.greenhouse.io/startup/jobs/555"

    def test_extract_workable_from_description(self):
        job = _make_job(
            apply_url="https://aggregator.com/post/888",
            description="Direct link: https://apply.workable.com/techcorp/j/XYZ123/ for application.",
        )
        ats = extract_direct_apply_url(job)
        assert ats == "https://apply.workable.com/techcorp/j/XYZ123/"

    def test_no_ats_returns_none(self):
        job = _make_job(
            apply_url="https://aggregator.com/post/111",
            description="Send an email with your portfolio.",
        )
        assert extract_direct_apply_url(job) is None

    def test_resolve_job_urls_enriches_record(self):
        job = _make_job(
            apply_url="https://aggregator.com/post/111",
            description="Apply via https://jobs.lever.co/acme/123",
        )
        resolved = resolve_job_urls(job)
        assert resolved["direct_apply_url"] == "https://jobs.lever.co/acme/123"
        assert resolved["is_direct_ats"] is True
        assert resolved["apply_url"] == "https://aggregator.com/post/111"

    def test_resolve_job_urls_fallback_to_apply_url(self):
        job = _make_job(
            apply_url="https://remotive.com/job/200",
            description="Standard job description with no ATS links.",
        )
        resolved = resolve_job_urls(job)
        assert resolved["direct_apply_url"] == "https://remotive.com/job/200"
        assert resolved["is_direct_ats"] is False

