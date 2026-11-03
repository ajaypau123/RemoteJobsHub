"""Tests for the Remotive source connector (mocked HTTP)."""

import pytest
from unittest.mock import MagicMock, patch
from aggregator.config.sources import SOURCES_BY_NAME
from aggregator.sources.remotive import RemotiveSource
from aggregator.sources.base import SourceError


def _make_source():
    config = SOURCES_BY_NAME["Remotive"]
    src = RemotiveSource(config)
    return src


def _mock_response(data: dict, status_code: int = 200):
    mock = MagicMock()
    mock.status_code = status_code
    mock.json.return_value = data
    mock.raise_for_status.return_value = None
    return mock


SAMPLE_JOB = {
    "id": 55432,
    "url": "https://remotive.com/remote-jobs/55432",
    "title": "Backend Developer",
    "company_name": "RemoteCo",
    "job_type": "full_time",
    "candidate_required_location": "Worldwide",
    "salary": "$80,000",
    "description": "Great role",
    "publication_date": "2026-09-15T00:00:00+00:00",
}


class TestRemotiveSource:
    def test_collect_jobs_returns_jobs(self):
        src = _make_source()
        mock_resp = _mock_response({"job-count": 1, "jobs": [SAMPLE_JOB]})
        with patch.object(src.session, "get", return_value=mock_resp):
            jobs = src.collect_jobs()
        assert len(jobs) == 1
        assert jobs[0]["title"] == "Backend Developer"

    def test_empty_response_returns_empty_list(self):
        src = _make_source()
        mock_resp = _mock_response({"job-count": 0, "jobs": []})
        with patch.object(src.session, "get", return_value=mock_resp):
            jobs = src.collect_jobs()
        assert jobs == []

    def test_http_error_raises_source_error(self):
        src = _make_source()
        mock_resp = _mock_response({}, status_code=500)
        import requests
        mock_resp.raise_for_status.side_effect = requests.HTTPError("500 Error")
        with patch.object(src.session, "get", return_value=mock_resp):
            with pytest.raises(SourceError):
                src.collect_jobs()

    def test_malformed_response_missing_jobs_key(self):
        src = _make_source()
        # Response missing "jobs" key — should return empty list gracefully
        mock_resp = _mock_response({"unexpected": "data"})
        with patch.object(src.session, "get", return_value=mock_resp):
            jobs = src.collect_jobs()
        assert jobs == []

    def test_rate_limit_response_raises_source_error(self):
        src = _make_source()
        mock_resp = _mock_response({}, status_code=429)
        with patch.object(src.session, "get", return_value=mock_resp):
            with patch("aggregator.sources.base.time.sleep"):
                with pytest.raises(SourceError):
                    src.collect_jobs()
