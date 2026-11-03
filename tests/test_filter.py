"""Tests for the filter module (role and experience filtering)."""

import pytest
from aggregator.processing.filter import filter_jobs, is_qa_job, matches_experience


def _job(title="Software Engineer", description="Build web apps", exp=None):
    return {
        "job_id": "test-1",
        "title": title,
        "company": "Acme Corp",
        "location": "Remote",
        "country": "US",
        "remote_type": "Remote",
        "employment_type": "Full-time",
        "experience": exp,
        "salary": None,
        "description": description,
        "apply_url": "https://example.com/job/1",
        "source": "Remotive",
        "source_job_id": "1",
        "posted_date": "2026-10-01",
        "collected_date": "2026-10-08",
        "status": "active",
    }


class TestIsQAJob:
    def test_direct_qa_acronym(self):
        assert is_qa_job("QA Engineer") is True
        assert is_qa_job("Senior QA Automation Tester") is True
        assert is_qa_job("Lead QA Analyst") is True

    def test_quality_assurance_phrase(self):
        assert is_qa_job("Quality Assurance Specialist") is True
        assert is_qa_job("Director of Quality Assurance") is True

    def test_sdet(self):
        assert is_qa_job("SDET - Python Automation") is True
        assert is_qa_job("Senior SDET") is True

    def test_test_engineer(self):
        assert is_qa_job("Software Test Engineer") is True
        assert is_qa_job("Automation Tester") is True
        assert is_qa_job("Manual Tester") is True
        assert is_qa_job("Quality Engineer") is True

    def test_non_qa_roles_rejected(self):
        assert is_qa_job("Full Stack Software Engineer") is False
        assert is_qa_job("Data Scientist") is False
        assert is_qa_job("Product Manager") is False
        assert is_qa_job("DevOps Engineer") is False

    def test_word_boundary_avoids_false_positives(self):
        # Substrings like "equal" or "quarter" or "equipment" must not match "qa"
        assert is_qa_job("Equal Opportunity Officer") is False
        assert is_qa_job("Equipment Maintenance Tech") is False
        assert is_qa_job("Quarterback Consultant") is False

    def test_description_does_not_override_unrelated_title(self):
        # A backend/fullstack title must NOT match as QA even if body mentions QA
        assert is_qa_job("Software Engineer", "Responsible for test automation and QA validation.") is False
        assert is_qa_job("Senior AI Engineer", "NOT YOUR STACK? We place QA Automation.") is False


class TestMatchesExperience:
    def test_patterns_for_2_years(self):
        assert matches_experience("Requires 2+ years of experience in test automation.", 2) is True
        assert matches_experience("Must have 2 years of experience.", 2) is True
        assert matches_experience("2-4 years experience with Selenium.", 2) is True
        assert matches_experience("2 to 3 yrs of software testing experience.", 2) is True
        assert matches_experience("Minimum 2 years hands-on testing.", 2) is True
        assert matches_experience("At least 2 years in QA.", 2) is True
        assert matches_experience("Seeking 2+ years QA analyst.", 2) is True

    def test_other_year_counts_not_matched_when_looking_for_2(self):
        assert matches_experience("5+ years of experience required.", 2) is False
        assert matches_experience("10+ years leading enterprise QA teams.", 2) is False
        assert matches_experience("Requires 1 year of experience.", 2) is False

    def test_empty_or_none(self):
        assert matches_experience(None, 2) is False
        assert matches_experience("", 2) is False


class TestFilterJobs:
    def test_filter_by_qa_and_2yr(self):
        jobs = [
            _job(title="QA Engineer", description="We require 2+ years of experience in testing."),
            _job(title="Senior QA Engineer", description="Requires 7+ years of QA management."),
            _job(title="Software Engineer", description="Build APIs. Requires 2+ years experience."),
            _job(title="SDET", description="2-3 years of test automation required."),
        ]

        filtered = filter_jobs(jobs, role="qa", exp_years=2)
        assert len(filtered) == 2
        titles = [j["title"] for j in filtered]
        assert "QA Engineer" in titles
        assert "SDET" in titles

    def test_filter_no_criteria_returns_all(self):
        jobs = [_job(title="QA Engineer"), _job(title="DevOps")]
        assert len(filter_jobs(jobs)) == 2

    def test_filter_only_role(self):
        jobs = [
            _job(title="QA Engineer"),
            _job(title="Software Tester"),
            _job(title="Frontend Developer"),
        ]
        filtered = filter_jobs(jobs, role="qa")
        assert len(filtered) == 2

    def test_filter_only_exp(self):
        jobs = [
            _job(title="DevOps", description="Requires 2 years exp"),
            _job(title="Product Designer", description="Requires 5 years exp"),
        ]
        filtered = filter_jobs(jobs, exp_years=2)
        assert len(filtered) == 1
        assert filtered[0]["title"] == "DevOps"

    def test_filter_india_eligible(self):
        jobs = [
            {**_job(title="QA Engineer"), "location": "Kochi, Kerala", "country": "India"},
            {**_job(title="QA Engineer"), "location": "Worldwide", "country": None},
            {**_job(title="QA Engineer"), "location": "US Only", "country": "US"},
        ]
        filtered = filter_jobs(jobs, role="qa", india_eligible=True)
        assert len(filtered) == 2
        locs = [j["location"] for j in filtered]
        assert "Kochi, Kerala" in locs
        assert "Worldwide" in locs
        assert "US Only" not in locs


class TestIsIndiaEligible:
    def test_india_country(self):
        from aggregator.processing.filter import is_india_eligible
        assert is_india_eligible({**_job(), "country": "India"}) is True
        assert is_india_eligible({**_job(), "country": "IN"}) is True

    def test_indian_cities(self):
        from aggregator.processing.filter import is_india_eligible
        assert is_india_eligible({**_job(), "location": "Kochi, Kerala"}) is True
        assert is_india_eligible({**_job(), "location": "Bengaluru, Karnataka"}) is True
        assert is_india_eligible({**_job(), "location": "Pune, Maharashtra"}) is True
        assert is_india_eligible({**_job(), "location": "Hyderabad"}) is True

    def test_worldwide_remote(self):
        from aggregator.processing.filter import is_india_eligible
        assert is_india_eligible({**_job(), "remote_type": "Remote", "location": "Worldwide"}) is True
        assert is_india_eligible({**_job(), "remote_type": "Remote", "location": "Global"}) is True
        assert is_india_eligible({**_job(), "remote_type": "Remote", "location": "Anywhere"}) is True
        assert is_india_eligible({**_job(), "remote_type": "Remote", "location": "APAC"}) is True

    def test_us_only_excluded(self):
        from aggregator.processing.filter import is_india_eligible
        assert is_india_eligible({**_job(), "location": "US Only", "country": None}) is False
        assert is_india_eligible({**_job(), "location": "United States Only"}) is False
        assert is_india_eligible({**_job(), "location": "Remote - Canada only"}) is False
        assert is_india_eligible({**_job(), "location": "Worldwide", "description": "Must be located in the US to apply."}) is False

    def test_citizenship_excluded(self):
        from aggregator.processing.filter import is_india_eligible
        assert is_india_eligible({**_job(), "location": "Worldwide", "description": "Candidate must have US citizenship."}) is False
        assert is_india_eligible({**_job(), "location": "Worldwide", "description": "Must have green card or US work authorization."}) is False

    def test_onsite_outside_india_excluded(self):
        from aggregator.processing.filter import is_india_eligible
        assert is_india_eligible({**_job(), "remote_type": "On-site", "location": "Berlin, Germany", "country": "Germany"}) is False
        assert is_india_eligible({**_job(), "remote_type": "Hybrid", "location": "London, UK", "country": "UK"}) is False

