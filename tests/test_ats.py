"""Tests for CompanyATSSource connector (mocked HTTP)."""

import pytest
from unittest.mock import MagicMock, patch
from aggregator.config.sources import SOURCES_BY_NAME
from aggregator.config.companies import ATSCompany
from aggregator.sources.ats import CompanyATSSource


def _mock_response(data, status_code: int = 200):
    mock = MagicMock()
    mock.status_code = status_code
    mock.json.return_value = data
    mock.raise_for_status.return_value = None
    return mock


SAMPLE_GH_JOB = {
    "id": 1001,
    "title": "Staff Engineer",
    "absolute_url": "https://boards.greenhouse.io/inmobi/jobs/1001",
    "location": {"name": "Bengaluru, India"},
    "updated_at": "2026-10-10T10:00:00Z",
    "content": "<p>Build high scale systems</p>",
}

SAMPLE_LEVER_JOB = {
    "id": "lever-001",
    "text": "Senior SDE - Backend",
    "hostedUrl": "https://jobs.lever.co/meesho/lever-001",
    "applyUrl": "https://jobs.lever.co/meesho/lever-001/apply",
    "categories": {
        "commitment": "Full Time",
        "location": "Bangalore, India",
    },
    "workplaceType": "remote",
    "createdAt": 1728374400000,
    "descriptionPlain": "Develop e-commerce backend",
}

SAMPLE_ASHBY_JOB = {
    "id": "ashby-001",
    "title": "Software Engineer",
    "location": "Worldwide",
    "isRemote": True,
    "workplaceType": "Remote",
    "employmentType": "FullTime",
    "jobUrl": "https://jobs.ashbyhq.com/linear/ashby-001",
    "applyUrl": "https://jobs.ashbyhq.com/linear/ashby-001/apply",
    "publishedAt": "2026-10-11T12:00:00.000Z",
    "descriptionPlain": "Build developer productivity tools",
}

SAMPLE_SMARTRECRUITERS_JOB = {
    "id": "sr-001",
    "name": "Senior Embedded Software Engineer",
    "releasedDate": "2026-10-12T10:00:00.000Z",
    "location": {
        "city": "Bengaluru",
        "region": "KA",
        "country": "in",
        "remote": False,
        "hybrid": True,
        "fullLocation": "Bengaluru, KA, India",
    },
    "typeOfEmployment": {"label": "Full-time"},
    "experienceLevel": {"label": "Senior"},
    "industry": {"label": "Automotive"},
    "function": {"label": "Engineering"},
}


class TestCompanyATSSource:
    def test_collect_jobs_all_platforms(self):
        config = SOURCES_BY_NAME["CompanyATS"]
        test_companies = [
            ATSCompany(name="InMobi", ats_type="greenhouse", slug="inmobi"),
            ATSCompany(name="Meesho", ats_type="lever", slug="meesho"),
            ATSCompany(name="Linear", ats_type="ashby", slug="linear"),
            ATSCompany(name="Bosch Group", ats_type="smartrecruiters", slug="BoschGroup", extra_params={"country": "in"}),
        ]
        src = CompanyATSSource(config, companies=test_companies)

        def mock_get(url, params=None, **kwargs):
            if "greenhouse.io" in url:
                return _mock_response({"jobs": [SAMPLE_GH_JOB]})
            elif "lever.co" in url:
                return _mock_response([SAMPLE_LEVER_JOB])
            elif "ashbyhq.com" in url:
                return _mock_response({"jobs": [SAMPLE_ASHBY_JOB]})
            elif "smartrecruiters.com" in url:
                return _mock_response({"totalFound": 1, "content": [SAMPLE_SMARTRECRUITERS_JOB]})
            return _mock_response({})

        with patch.object(src.session, "get", side_effect=mock_get):
            jobs = src.collect_jobs()

        assert len(jobs) == 4
        # Check Greenhouse item
        gh = next(j for j in jobs if j.get("_ats_type") == "greenhouse")
        assert gh["_company_name"] == "InMobi"
        assert gh["title"] == "Staff Engineer"

        # Check Lever item
        lev = next(j for j in jobs if j.get("_ats_type") == "lever")
        assert lev["_company_name"] == "Meesho"
        assert lev["text"] == "Senior SDE - Backend"

        # Check Ashby item
        ash = next(j for j in jobs if j.get("_ats_type") == "ashby")
        assert ash["_company_name"] == "Linear"
        assert ash["title"] == "Software Engineer"

        # Check SmartRecruiters item
        sr = next(j for j in jobs if j.get("_ats_type") == "smartrecruiters")
        assert sr["_company_name"] == "Bosch Group"
        assert sr["name"] == "Senior Embedded Software Engineer"
        assert sr["_company_slug"] == "BoschGroup"

    def test_single_company_failure_does_not_abort_others(self):
        config = SOURCES_BY_NAME["CompanyATS"]
        test_companies = [
            ATSCompany(name="BrokenCo", ats_type="greenhouse", slug="broken"),
            ATSCompany(name="Linear", ats_type="ashby", slug="linear"),
        ]
        src = CompanyATSSource(config, companies=test_companies)

        def mock_get(url, params=None, **kwargs):
            if "broken" in url:
                import requests
                m = MagicMock()
                m.raise_for_status.side_effect = requests.HTTPError("404 Not Found")
                return m
            return _mock_response({"jobs": [SAMPLE_ASHBY_JOB]})

        with patch.object(src.session, "get", side_effect=mock_get):
            jobs = src.collect_jobs()

        # BrokenCo failed gracefully; Linear still returned
        assert len(jobs) == 1
        assert jobs[0]["_company_name"] == "Linear"

