"""Tests for the normalizer."""

import uuid
import pytest
from aggregator.processing.normalizer import (
    normalize,
    _make_job_id,
    _clean_str,
    _parse_employment_type,
    _parse_unix_timestamp,
    _parse_iso_datetime,
    _parse_adzuna_salary,
    _parse_jobicy_salary,
    _parse_remoteok_salary,
)


# ── Common schema field check ──────────────────────────────────────────────────

EXPECTED_FIELDS = {
    "job_id", "title", "company", "location", "country",
    "remote_type", "employment_type", "experience", "salary",
    "description", "apply_url", "source", "source_job_id",
    "posted_date", "collected_date", "status",
}


def _assert_schema(job: dict):
    assert set(job.keys()) == EXPECTED_FIELDS, f"Schema mismatch: {set(job.keys()) ^ EXPECTED_FIELDS}"
    assert job["status"] == "active"
    assert job["collected_date"]  # must be set


# ── Arbeitnow normalization ────────────────────────────────────────────────────

class TestNormalizeArbeitnow:
    def _raw(self, **overrides):
        base = {
            "slug": "qa-engineer-123",
            "title": "QA Engineer",
            "company_name": "Acme Corp",
            "location": "Remote",
            "remote": True,
            "job_types": ["full_time"],
            "description": "Great job",
            "url": "https://arbeitnow.com/view/qa-engineer-123",
            "created_at": 1728374400,  # 2024-10-08
        }
        base.update(overrides)
        return base

    def test_all_schema_fields_present(self):
        job = normalize(self._raw(), "Arbeitnow")
        _assert_schema(job)

    def test_title_and_company_mapped(self):
        job = normalize(self._raw(), "Arbeitnow")
        assert job["title"] == "QA Engineer"
        assert job["company"] == "Acme Corp"

    def test_remote_type_true(self):
        job = normalize(self._raw(remote=True), "Arbeitnow")
        assert job["remote_type"] == "Remote"

    def test_remote_type_false(self):
        job = normalize(self._raw(remote=False), "Arbeitnow")
        assert job["remote_type"] == "On-site"

    def test_employment_type_full_time(self):
        job = normalize(self._raw(job_types=["full_time"]), "Arbeitnow")
        assert job["employment_type"] == "Full-time"

    def test_missing_optional_fields_are_none(self):
        raw = {"slug": "x", "title": "Dev", "company_name": "Y", "url": "https://x.com"}
        job = normalize(raw, "Arbeitnow")
        assert job["salary"] is None
        assert job["experience"] is None
        assert job["country"] is None

    def test_source_and_source_job_id(self):
        job = normalize(self._raw(), "Arbeitnow")
        assert job["source"] == "Arbeitnow"
        assert job["source_job_id"] == "qa-engineer-123"

    def test_job_id_is_deterministic(self):
        job1 = normalize(self._raw(), "Arbeitnow")
        job2 = normalize(self._raw(), "Arbeitnow")
        assert job1["job_id"] == job2["job_id"]

    def test_posted_date_from_unix_timestamp(self):
        job = normalize(self._raw(created_at=1728374400), "Arbeitnow")
        # Timestamp 1728374400 = 2024-10-08
        assert job["posted_date"] == "2024-10-08"


# ── Adzuna normalization ───────────────────────────────────────────────────────

class TestNormalizeAdzuna:
    def _raw(self, **overrides):
        base = {
            "id": "9988776655",
            "title": "  Software Engineer  ",
            "company": {"display_name": "BigTech"},
            "location": {"display_name": "London, UK"},
            "salary_min": 60000,
            "salary_max": 90000,
            "description": "Exciting role",
            "redirect_url": "https://adzuna.com/jobs/9988776655",
            "created": "2026-10-01T09:00:00Z",
            "contract_type": "permanent",
            "_adzuna_country": "gb",
        }
        base.update(overrides)
        return base

    def test_all_schema_fields_present(self):
        job = normalize(self._raw(), "Adzuna")
        _assert_schema(job)

    def test_title_is_stripped(self):
        job = normalize(self._raw(), "Adzuna")
        assert job["title"] == "Software Engineer"

    def test_salary_range(self):
        job = normalize(self._raw(salary_min=60000, salary_max=90000), "Adzuna")
        assert "60,000" in job["salary"]
        assert "90,000" in job["salary"]

    def test_salary_none_when_absent(self):
        job = normalize(self._raw(salary_min=None, salary_max=None), "Adzuna")
        assert job["salary"] is None

    def test_country_mapped_from_code(self):
        job = normalize(self._raw(_adzuna_country="gb"), "Adzuna")
        assert job["country"] == "United Kingdom"

    def test_country_us(self):
        job = normalize(self._raw(_adzuna_country="us"), "Adzuna")
        assert job["country"] == "United States"

    def test_posted_date_iso(self):
        job = normalize(self._raw(created="2026-10-01T09:00:00Z"), "Adzuna")
        assert job["posted_date"] == "2026-10-01"


# ── Remotive normalization ─────────────────────────────────────────────────────

class TestNormalizeRemotive:
    def _raw(self, **overrides):
        base = {
            "id": 55432,
            "url": "https://remotive.com/remote-jobs/engineering/dev-55432",
            "title": "Backend Developer",
            "company_name": "RemoteCo",
            "job_type": "full_time",
            "candidate_required_location": "Worldwide",
            "salary": "$80,000 - $100,000",
            "description": "Great remote job",
            "publication_date": "2026-09-15T00:00:00+00:00",
        }
        base.update(overrides)
        return base

    def test_all_schema_fields_present(self):
        job = normalize(self._raw(), "Remotive")
        _assert_schema(job)

    def test_remote_type_is_always_remote(self):
        job = normalize(self._raw(), "Remotive")
        assert job["remote_type"] == "Remote"

    def test_source_is_remotive(self):
        job = normalize(self._raw(), "Remotive")
        assert job["source"] == "Remotive"


class TestNormalizeRemoteOK:
    def _raw(self, **overrides) -> dict:
        base = {
            "id": "1137510",
            "position": "Lead Software Engineer",
            "company": "Tech Corp",
            "location": "Worldwide",
            "salary_min": 90000,
            "salary_max": 130000,
            "date": "2026-10-10T14:00:00+00:00",
            "url": "https://remoteok.com/remote-jobs/1137510",
            "apply_url": "https://remoteok.com/apply/1137510",
            "tags": ["python", "full-time"],
            "description": "Develop high scale backend systems",
        }
        base.update(overrides)
        return base

    def test_all_schema_fields_present(self):
        job = normalize(self._raw(), "RemoteOK")
        _assert_schema(job)

    def test_remote_type_is_always_remote(self):
        job = normalize(self._raw(), "RemoteOK")
        assert job["remote_type"] == "Remote"

    def test_source_is_remoteok(self):
        job = normalize(self._raw(), "RemoteOK")
        assert job["source"] == "RemoteOK"

    def test_location_default_worldwide(self):
        job = normalize(self._raw(location=""), "RemoteOK")
        assert job["location"] == "Worldwide"
        job_remote = normalize(self._raw(location="Remote"), "RemoteOK")
        assert job_remote["location"] == "Worldwide"

    def test_salary_parsing(self):
        job = normalize(self._raw(), "RemoteOK")
        assert job["salary"] == "USD 90,000 - 130,000"

    def test_employment_type_from_tags(self):
        job = normalize(self._raw(tags=["contract"]), "RemoteOK")
        assert job["employment_type"] == "Contract"


class TestNormalizeCompanyATS:
    def test_normalize_greenhouse(self):
        raw = {
            "_ats_type": "greenhouse",
            "_company_name": "InMobi",
            "id": 998877,
            "title": "Senior Backend Engineer",
            "absolute_url": "https://boards.greenhouse.io/inmobi/jobs/998877",
            "location": {"name": "Bengaluru, India"},
            "updated_at": "2026-10-10T08:00:00Z",
            "content": "<p>Build high volume APIs</p>",
        }
        job = normalize(raw, "CompanyATS")
        _assert_schema(job)
        assert job["company"] == "InMobi"
        assert job["title"] == "Senior Backend Engineer"
        assert job["location"] == "Bengaluru, India"
        assert job["apply_url"] == "https://boards.greenhouse.io/inmobi/jobs/998877"
        assert job["source"] == "CompanyATS"

    def test_normalize_lever(self):
        raw = {
            "_ats_type": "lever",
            "_company_name": "Meesho",
            "id": "lever-1234",
            "text": "Product Manager",
            "hostedUrl": "https://jobs.lever.co/meesho/lever-1234",
            "applyUrl": "https://jobs.lever.co/meesho/lever-1234/apply",
            "categories": {
                "commitment": "Full Time",
                "location": "Bangalore, India",
            },
            "workplaceType": "hybrid",
            "createdAt": 1728374400000,
            "descriptionPlain": "Own the e-commerce roadmap",
        }
        job = normalize(raw, "CompanyATS")
        _assert_schema(job)
        assert job["company"] == "Meesho"
        assert job["title"] == "Product Manager"
        assert job["remote_type"] == "Hybrid"
        assert job["employment_type"] == "Full-time"
        assert job["apply_url"] == "https://jobs.lever.co/meesho/lever-1234/apply"

    def test_normalize_ashby(self):
        raw = {
            "_ats_type": "ashby",
            "_company_name": "Linear",
            "id": "ashby-5678",
            "title": "Frontend Engineer",
            "location": "Remote - Worldwide",
            "isRemote": True,
            "workplaceType": "Remote",
            "employmentType": "FullTime",
            "jobUrl": "https://jobs.ashbyhq.com/linear/ashby-5678",
            "applyUrl": "https://jobs.ashbyhq.com/linear/ashby-5678/apply",
            "publishedAt": "2026-10-09T15:00:00.000Z",
            "descriptionPlain": "Craft beautiful UI components",
        }
        job = normalize(raw, "CompanyATS")
        _assert_schema(job)
        assert job["company"] == "Linear"
        assert job["title"] == "Frontend Engineer"
        assert job["remote_type"] == "Remote"
        assert job["employment_type"] == "Full-time"
        assert job["apply_url"] == "https://jobs.ashbyhq.com/linear/ashby-5678/apply"

    def test_normalize_smartrecruiters(self):
        raw = {
            "_ats_type": "smartrecruiters",
            "_company_name": "Bosch Group",
            "_company_slug": "BoschGroup",
            "id": "744000155480459",
            "name": "Engineer Manufacturing",
            "releasedDate": "2026-10-14T11:05:42.517Z",
            "location": {
                "city": "Bengaluru",
                "region": "KA",
                "country": "in",
                "remote": False,
                "hybrid": False,
                "fullLocation": "Bengaluru, KA, India",
            },
            "typeOfEmployment": {"label": "Full-time"},
            "experienceLevel": {"label": "Executive"},
            "industry": {"label": "Automotive"},
            "function": {"label": "Manufacturing"},
        }
        job = normalize(raw, "CompanyATS")
        _assert_schema(job)
        assert job["company"] == "Bosch Group"
        assert job["title"] == "Engineer Manufacturing"
        assert job["location"] == "Bengaluru, KA, India"
        assert job["country"] == "India"
        assert job["remote_type"] == "On-site"
        assert job["employment_type"] == "Full-time"
        assert job["experience"] == "Executive"
        assert job["posted_date"] == "2026-10-14"
        assert job["apply_url"] == "https://jobs.smartrecruiters.com/BoschGroup/744000155480459"
        assert "Position: Engineer Manufacturing" in job["description"]
        assert "Location: Bengaluru, KA, India" in job["description"]





# ── Helpers ───────────────────────────────────────────────────────────────────

class TestHelpers:
    def test_clean_str_strips_whitespace(self):
        assert _clean_str("  hello world  ") == "hello world"

    def test_clean_str_collapses_spaces(self):
        assert _clean_str("hello   world") == "hello world"

    def test_clean_str_none_input(self):
        assert _clean_str(None) is None

    def test_clean_str_empty_string(self):
        assert _clean_str("   ") is None

    def test_parse_employment_full_time(self):
        assert _parse_employment_type("full_time") == "Full-time"
        assert _parse_employment_type("Full Time") == "Full-time"

    def test_parse_employment_contract(self):
        assert _parse_employment_type("contract") == "Contract"
        assert _parse_employment_type("freelance") == "Contract"

    def test_parse_employment_none(self):
        assert _parse_employment_type(None) is None

    def test_parse_unix_timestamp(self):
        assert _parse_unix_timestamp(1728374400) == "2024-10-08"

    def test_parse_unix_timestamp_none(self):
        assert _parse_unix_timestamp(None) is None

    def test_parse_iso_datetime_with_z(self):
        assert _parse_iso_datetime("2026-10-01T09:00:00Z") == "2026-10-01"

    def test_parse_iso_datetime_date_only(self):
        assert _parse_iso_datetime("2026-10-01") == "2026-10-01"

    def test_parse_iso_datetime_invalid(self):
        assert _parse_iso_datetime("not-a-date") is None

    def test_parse_adzuna_salary_range(self):
        result = _parse_adzuna_salary(50000, 80000)
        assert "50,000" in result
        assert "80,000" in result

    def test_parse_adzuna_salary_min_only(self):
        result = _parse_adzuna_salary(50000, None)
        assert "50,000" in result
        assert "+" in result

    def test_parse_adzuna_salary_none(self):
        assert _parse_adzuna_salary(None, None) is None

    def test_make_job_id_deterministic(self):
        id1 = _make_job_id("Remotive", "12345", "https://example.com")
        id2 = _make_job_id("Remotive", "12345", "https://example.com")
        assert id1 == id2

    def test_make_job_id_different_sources(self):
        id1 = _make_job_id("Remotive", "12345", None)
        id2 = _make_job_id("Jobicy", "12345", None)
        assert id1 != id2
