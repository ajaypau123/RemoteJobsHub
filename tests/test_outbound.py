"""
Tests for B2B recruiter lead generation and cold outreach templates.
"""

import os
import tempfile
import pytest
from aggregator.outbound.generate_recruiter_leads import (
    generate_linkedin_recruiter_search,
    build_cold_email_pitch,
    extract_recruiter_leads,
    generate_outbound_report
)

SAMPLE_JOBS = [
    {
        "company": "Acme Corp",
        "title": "Senior Backend Engineer",
        "salary": "$140,000 - $170,000",
        "remote_scope": "Worldwide",
        "source": "CompanyATS",
        "direct_apply_url": "https://boards.greenhouse.io/acmepay/jobs/123",
        "posted_date": "2026-11-10"
    },
    {
        "company": "Acme Corp",  # Duplicate company
        "title": "Frontend Engineer",
        "salary": "$120,000 - $150,000",
        "remote_scope": "Americas",
        "source": "CompanyATS",
        "direct_apply_url": "https://boards.greenhouse.io/acmepay/jobs/124",
        "posted_date": "2026-11-10"
    },
    {
        "company": "Beta Cloud",
        "title": "DevOps Architect",
        "salary": None,
        "remote_scope": "Europe",
        "source": "Lever",
        "apply_url": "https://jobs.lever.co/betacloud/456",
        "posted_date": "2026-11-09"
    }
]


def test_generate_linkedin_recruiter_search():
    url = generate_linkedin_recruiter_search("Stripe, Inc.")
    assert "https://www.linkedin.com/search/results/people/?keywords=" in url
    assert "recruiter" in url
    assert "Stripe" in url


def test_build_cold_email_pitch():
    pitch = build_cold_email_pitch(
        company="GitLab",
        role_title="Senior SDET",
        ats_source="Greenhouse",
        apply_url="https://boards.greenhouse.io/gitlab/jobs/999"
    )
    assert "GitLab" in pitch
    assert "Senior SDET" in pitch
    assert "$49 Featured Placement" in pitch
    assert "RemoteJobsHub" in pitch
    assert "Subject:" in pitch


def test_extract_recruiter_leads_deduplication():
    leads = extract_recruiter_leads(SAMPLE_JOBS, limit=10)
    # Should deduplicate Acme Corp down to 1 lead
    companies = [lead["company"] for lead in leads]
    assert len(companies) == 2
    assert "Acme Corp" in companies
    assert "Beta Cloud" in companies


def test_extract_recruiter_leads_respects_limit():
    leads = extract_recruiter_leads(SAMPLE_JOBS, limit=1)
    assert len(leads) == 1


def test_generate_outbound_report_creates_file():
    leads = extract_recruiter_leads(SAMPLE_JOBS, limit=5)
    with tempfile.TemporaryDirectory() as tmpdir:
        out_path = os.path.join(tmpdir, "test_leads.md")
        res_path = generate_outbound_report(leads, output_path=out_path)
        assert os.path.exists(res_path)
        with open(res_path, "r", encoding="utf-8") as f:
            content = f.read()
            assert "RemoteJobsHub — Daily Recruiter Outreach Hit-List" in content
            assert "Acme Corp" in content
            assert "LinkedIn People Search" in content

