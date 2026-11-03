"""Tests for the Adzuna source connector (mocked HTTP)."""

import os
import pytest
from unittest.mock import MagicMock, patch
from aggregator.config.sources import SOURCES_BY_NAME
from aggregator.sources.adzuna import AdzunaSource
from aggregator.sources.base import SourceError


def _make_source(app_id="test_id", app_key="test_key", countries="gb"):
    config = SOURCES_BY_NAME["Adzuna"]
    with patch.dict(os.environ, {
        "ADZUNA_APP_ID": app_id,
        "ADZUNA_APP_KEY": app_key,
        "ADZUNA_COUNTRIES": countries,
    }):
        src = AdzunaSource(config)
    return src


def _mock_response(data: dict, status_code: int = 200):
    mock = MagicMock()
    mock.status_code = status_code
    mock.json.return_value = data
    mock.raise_for_status.return_value = None
    return mock


SAMPLE_JOB = {
    "id": "9988776655",
    "title": "Software Engineer",
    "company": {"display_name": "BigTech"},
    "location": {"display_name": "London"},
    "salary_min": 60000,
    "salary_max": 90000,
    "description": "Great role",
    "redirect_url": "https://adzuna.com/jobs/9988776655",
    "created": "2026-10-01T09:00:00Z",
    "contract_type": "permanent",
}


class TestAdzunaSource:
    def test_collect_jobs_returns_jobs(self):
        src = _make_source(countries="gb")
        page1 = _mock_response({"results": [SAMPLE_JOB], "count": 1})
        with patch.object(src.session, "get", side_effect=[page1]):
            jobs = src.collect_jobs()
        assert len(jobs) == 1
        assert jobs[0]["_adzuna_country"] == "gb"

    def test_multi_country_collects_from_all(self):
        src = _make_source(countries="gb,us")
        # Each country gets its own set of mocked pages
        job_gb = {**SAMPLE_JOB, "id": "gb1"}
        job_us = {**SAMPLE_JOB, "id": "us1"}
        page_gb = _mock_response({"results": [job_gb], "count": 1})
        page_gb_empty = _mock_response({"results": [], "count": 1})
        page_us = _mock_response({"results": [job_us], "count": 1})
        page_us_empty = _mock_response({"results": [], "count": 1})
        with patch.object(src.session, "get", side_effect=[page_gb, page_us]):
            jobs = src.collect_jobs()
        assert len(jobs) == 2
        countries_seen = {j["_adzuna_country"] for j in jobs}
        assert "gb" in countries_seen
        assert "us" in countries_seen

    def test_missing_credentials_raises_source_error(self):
        src = _make_source(app_id="", app_key="")
        with pytest.raises(SourceError, match="ADZUNA_APP_ID"):
            src.collect_jobs()

    def test_empty_results_returns_empty_list(self):
        src = _make_source(countries="gb")
        page_empty = _mock_response({"results": [], "count": 0})
        with patch.object(src.session, "get", return_value=page_empty):
            jobs = src.collect_jobs()
        assert jobs == []

    def test_auth_error_raises_source_error(self):
        src = _make_source(countries="gb")
        mock_resp = _mock_response({}, status_code=401)
        with patch.object(src.session, "get", return_value=mock_resp):
            with pytest.raises(SourceError):
                src.collect_jobs()

    def test_malformed_response_no_results_key(self):
        src = _make_source(countries="gb")
        mock_resp = _mock_response({"unexpected": "data"})
        with patch.object(src.session, "get", return_value=mock_resp):
            jobs = src.collect_jobs()
        assert jobs == []
