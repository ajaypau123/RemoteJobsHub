"""Tests for the RemoteOK source connector (mocked HTTP)."""

import pytest
from unittest.mock import MagicMock, patch
from aggregator.config.sources import SOURCES_BY_NAME
from aggregator.sources.remoteok import RemoteOKSource
from aggregator.sources.base import SourceError


def _make_source():
    config = SOURCES_BY_NAME["RemoteOK"]
    src = RemoteOKSource(config)
    return src


def _mock_response(data: list | dict, status_code: int = 200):
    mock = MagicMock()
    mock.status_code = status_code
    mock.json.return_value = data
    mock.raise_for_status.return_value = None
    return mock


SAMPLE_LEGAL = {
    "legal": "Remote OK API Terms: https://remoteok.com/api"
}

SAMPLE_JOB = {
    "id": "1137510",
    "position": "Principal Product Manager",
    "company": "Thyme Care",
    "location": "Worldwide",
    "salary_min": 100000,
    "salary_max": 150000,
    "date": "2026-10-13T08:00:11+00:00",
    "url": "https://remoteok.com/remote-jobs/1137510",
    "apply_url": "https://remoteok.com/apply/1137510",
    "tags": ["product", "full-time"],
    "description": "<p>Great remote role</p>",
}


class TestRemoteOKSource:
    def test_collect_jobs_filters_out_legal_item(self):
        src = _make_source()
        # RemoteOK returns legal disclaimer as the first element in array
        mock_resp = _mock_response([SAMPLE_LEGAL, SAMPLE_JOB])
        with patch.object(src.session, "get", return_value=mock_resp):
            jobs = src.collect_jobs()
        assert len(jobs) == 1
        assert jobs[0]["id"] == "1137510"
        assert jobs[0]["position"] == "Principal Product Manager"

    def test_empty_response_returns_empty_list(self):
        src = _make_source()
        mock_resp = _mock_response([])
        with patch.object(src.session, "get", return_value=mock_resp):
            jobs = src.collect_jobs()
        assert jobs == []

    def test_invalid_type_returns_empty_list(self):
        src = _make_source()
        mock_resp = _mock_response({"error": "invalid format"})
        with patch.object(src.session, "get", return_value=mock_resp):
            jobs = src.collect_jobs()
        assert jobs == []

    def test_http_error_raises_source_error(self):
        src = _make_source()
        mock_resp = _mock_response([], status_code=500)
        import requests
        mock_resp.raise_for_status.side_effect = requests.HTTPError("500 Server Error")
        with patch.object(src.session, "get", return_value=mock_resp):
            with pytest.raises(SourceError):
                src.collect_jobs()

