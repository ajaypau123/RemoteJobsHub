"""Tests for RSS source connectors (WeWorkRemotely and Jobspresso)."""

import pytest
from unittest.mock import MagicMock, patch
from aggregator.config.sources import SOURCES_BY_NAME
from aggregator.processing.normalizer import normalize
from aggregator.sources.weworkremotely import WeWorkRemotelySource
from aggregator.sources.jobspresso import JobspressoSource

EXPECTED_FIELDS = {
    "job_id", "title", "company", "location", "country",
    "remote_type", "employment_type", "experience", "salary",
    "description", "apply_url", "source", "source_job_id",
    "posted_date", "collected_date", "status",
}

SAMPLE_WWR_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>We Work Remotely</title>
    <item>
      <title>Discord: Senior Backend Engineer</title>
      <link>https://weworkremotely.com/remote-jobs/discord-senior-backend-engineer</link>
      <guid>https://weworkremotely.com/remote-jobs/discord-senior-backend-engineer</guid>
      <pubDate>Mon, 12 Oct 2026 14:00:00 +0000</pubDate>
      <region>Anywhere in the World</region>
      <category>Back-End Programming</category>
      <description>&lt;p&gt;Build distributed real-time systems at scale.&lt;/p&gt;</description>
    </item>
  </channel>
</rss>
"""

SAMPLE_JOBSPRESSO_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:wp="com-wordpress:feed-additions:1">
  <channel>
    <title>Jobspresso</title>
    <item>
      <title>Staff Frontend Architect</title>
      <link>https://jobspresso.co/job/acme-corp-staff-frontend-architect/</link>
      <guid>https://jobspresso.co/?post_type=job_listing&amp;p=998877</guid>
      <pubDate>Tue, 13 Oct 2026 16:30:00 +0000</pubDate>
      <dc:creator><![CDATA[Acme Corp<br>&#9906;&nbsp;Worldwide]]></dc:creator>
      <wp:post-id>998877</wp:post-id>
      <description>&lt;p&gt;Lead web frontend architecture.&lt;/p&gt;</description>
    </item>
  </channel>
</rss>
"""


class TestWeWorkRemotelySource:
    def test_collect_jobs(self):
        config = SOURCES_BY_NAME["WeWorkRemotely"]
        src = WeWorkRemotelySource(config)

        with patch.object(src, "_get_text", return_value=SAMPLE_WWR_XML):
            jobs = src.collect_jobs()

        assert len(jobs) == 1
        j = jobs[0]
        assert j["company"] == "Discord"
        assert j["title"] == "Senior Backend Engineer"
        assert j["region"] == "Anywhere in the World"
        assert j["link"] == "https://weworkremotely.com/remote-jobs/discord-senior-backend-engineer"

    def test_normalize_weworkremotely(self):
        raw = {
            "id": "https://weworkremotely.com/remote-jobs/discord-senior-backend-engineer",
            "title": "Senior Backend Engineer",
            "company": "Discord",
            "region": "Anywhere in the World",
            "link": "https://weworkremotely.com/remote-jobs/discord-senior-backend-engineer",
            "pubDate": "Mon, 12 Oct 2026 14:00:00 +0000",
            "description": "<p>Build distributed real-time systems at scale.</p>",
            "_source": "WeWorkRemotely",
        }
        job = normalize(raw, "WeWorkRemotely")
        assert set(job.keys()) == EXPECTED_FIELDS
        assert job["source"] == "WeWorkRemotely"
        assert job["company"] == "Discord"
        assert job["title"] == "Senior Backend Engineer"
        assert job["location"] == "Anywhere in the World"
        assert job["remote_type"] == "Remote"
        assert job["posted_date"] == "2026-10-12"
        assert job["apply_url"] == "https://weworkremotely.com/remote-jobs/discord-senior-backend-engineer"


class TestJobspressoSource:
    def test_collect_jobs(self):
        config = SOURCES_BY_NAME["Jobspresso"]
        src = JobspressoSource(config)

        with patch.object(src, "_get_text", return_value=SAMPLE_JOBSPRESSO_XML):
            jobs = src.collect_jobs()

        assert len(jobs) == 1
        j = jobs[0]
        assert j["company"] == "Acme Corp"
        assert j["title"] == "Staff Frontend Architect"
        assert j["location"] == "Worldwide"
        assert j["id"] == "998877"

    def test_normalize_jobspresso(self):
        raw = {
            "id": "998877",
            "title": "Staff Frontend Architect",
            "company": "Acme Corp",
            "location": "Worldwide",
            "link": "https://jobspresso.co/job/acme-corp-staff-frontend-architect/",
            "pubDate": "Tue, 13 Oct 2026 16:30:00 +0000",
            "description": "<p>Lead web frontend architecture.</p>",
            "_source": "Jobspresso",
        }
        job = normalize(raw, "Jobspresso")
        assert set(job.keys()) == EXPECTED_FIELDS
        assert job["source"] == "Jobspresso"
        assert job["company"] == "Acme Corp"
        assert job["title"] == "Staff Frontend Architect"
        assert job["location"] == "Worldwide"
        assert job["remote_type"] == "Remote"
        assert job["posted_date"] == "2026-10-13"
        assert job["apply_url"] == "https://jobspresso.co/job/acme-corp-staff-frontend-architect/"

