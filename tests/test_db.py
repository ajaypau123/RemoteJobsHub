"""Unit tests for SQLite database module."""

import os
import pytest
from aggregator.db import init_db, save_jobs_to_db, get_active_jobs_from_db


def _sample_job(job_id="test-101", title="Python Engineer"):
    return {
        "job_id": job_id,
        "title": title,
        "company": "Tech Corp",
        "location": "Kochi, Kerala",
        "country": "India",
        "remote_type": "Remote",
        "employment_type": "Full-time",
        "experience": "1-3 years",
        "salary": "INR 8-12 LPA",
        "description": "Develop backend services",
        "apply_url": "https://example.com/job",
        "direct_apply_url": "https://jobs.lever.co/techcorp/101",
        "source": "Himalayas",
        "source_job_id": "101",
        "posted_date": "2026-10-12",
        "collected_date": "2026-10-12",
        "status": "active",
        "is_direct_ats": True,
    }


class TestSQLiteStorage:
    def test_init_db_creates_table(self, tmp_path):
        db_path = str(tmp_path / "test_jobs.db")
        conn = init_db(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='jobs'")
        assert cursor.fetchone() is not None
        conn.close()

    def test_save_and_retrieve_jobs(self, tmp_path):
        db_path = str(tmp_path / "test_jobs.db")
        job1 = _sample_job(job_id="job-1", title="QA Engineer")
        job2 = _sample_job(job_id="job-2", title="DevOps Engineer")

        processed, active = save_jobs_to_db([job1, job2], db_path=db_path)
        assert processed == 2
        assert active == 2

        retrieved = get_active_jobs_from_db(db_path=db_path)
        assert len(retrieved) == 2
        titles = [j["title"] for j in retrieved]
        assert "QA Engineer" in titles
        assert "DevOps Engineer" in titles

    def test_upsert_updates_existing_job(self, tmp_path):
        db_path = str(tmp_path / "test_jobs.db")
        job = _sample_job(job_id="job-1", title="QA Tester")
        save_jobs_to_db([job], db_path=db_path)

        # Update title and salary
        job_updated = _sample_job(job_id="job-1", title="Senior QA Lead")
        job_updated["salary"] = "INR 18 LPA"
        save_jobs_to_db([job_updated], db_path=db_path)

        retrieved = get_active_jobs_from_db(db_path=db_path)
        assert len(retrieved) == 1
        assert retrieved[0]["title"] == "Senior QA Lead"
        assert retrieved[0]["salary"] == "INR 18 LPA"

    def test_query_jobs_filters(self, tmp_path):
        from aggregator.db import query_jobs_from_db
        db_path = str(tmp_path / "test_jobs.db")
        job_india = _sample_job(job_id="job-india", title="Senior QA Engineer")
        job_india["is_india_eligible"] = True
        job_india["location"] = "Bengaluru, India"

        job_global = _sample_job(job_id="job-global", title="Staff DevOps Architect")
        job_global["is_india_eligible"] = False
        job_global["location"] = "San Francisco, US"

        save_jobs_to_db([job_india, job_global], db_path=db_path)

        # Test filter by is_india_eligible
        india_only = query_jobs_from_db(db_path=db_path, is_india_eligible=True)
        assert len(india_only) == 1
        assert india_only[0]["job_id"] == "job-india"

        # Test filter by role
        qa_jobs = query_jobs_from_db(db_path=db_path, role="qa")
        assert len(qa_jobs) == 1
        assert qa_jobs[0]["title"] == "Senior QA Engineer"

        # Test filter by city
        blr_jobs = query_jobs_from_db(db_path=db_path, city="Bengaluru")
        assert len(blr_jobs) == 1
        assert blr_jobs[0]["location"] == "Bengaluru, India"

