"""SQLite database storage module for persistent job archiving.

Provides deterministic persistence, deduplication across runs, and historical
tracking without requiring external database servers or recurring costs.
"""

import logging
import os
import sqlite3
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = os.path.join("output", "jobs.db")

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS jobs (
    job_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT,
    location TEXT,
    country TEXT,
    remote_type TEXT,
    employment_type TEXT,
    experience TEXT,
    salary TEXT,
    description TEXT,
    apply_url TEXT,
    direct_apply_url TEXT,
    source TEXT,
    source_job_id TEXT,
    posted_date TEXT,
    collected_date TEXT,
    status TEXT DEFAULT 'active',
    is_direct_ats INTEGER DEFAULT 0,
    is_india_eligible INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_date ON jobs(posted_date);
"""

UPSERT_JOB_SQL = """
INSERT INTO jobs (
    job_id, title, company, location, country,
    remote_type, employment_type, experience, salary,
    description, apply_url, direct_apply_url, source,
    source_job_id, posted_date, collected_date, status,
    is_direct_ats, is_india_eligible, updated_at
) VALUES (
    :job_id, :title, :company, :location, :country,
    :remote_type, :employment_type, :experience, :salary,
    :description, :apply_url, :direct_apply_url, :source,
    :source_job_id, :posted_date, :collected_date, :status,
    :is_direct_ats, :is_india_eligible, CURRENT_TIMESTAMP
)
ON CONFLICT(job_id) DO UPDATE SET
    title = excluded.title,
    company = excluded.company,
    location = excluded.location,
    country = excluded.country,
    remote_type = excluded.remote_type,
    employment_type = excluded.employment_type,
    experience = excluded.experience,
    salary = excluded.salary,
    description = excluded.description,
    apply_url = excluded.apply_url,
    direct_apply_url = excluded.direct_apply_url,
    status = excluded.status,
    is_direct_ats = excluded.is_direct_ats,
    is_india_eligible = excluded.is_india_eligible,
    updated_at = CURRENT_TIMESTAMP;
"""


def init_db(db_path: str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Initialize the SQLite database schema if not already present."""
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    with conn:
        conn.executescript(CREATE_TABLE_SQL)
        # Migrate table if column is missing in an existing database
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(jobs)")
        existing_cols = {row[1] for row in cursor.fetchall()}
        if "is_india_eligible" not in existing_cols:
            conn.execute("ALTER TABLE jobs ADD COLUMN is_india_eligible INTEGER DEFAULT 0")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_india_eligible ON jobs(is_india_eligible)")
    return conn


def save_jobs_to_db(jobs: list[dict[str, Any]], db_path: str = DEFAULT_DB_PATH) -> tuple[int, int]:
    """Insert or update job listings in the SQLite database.

    Returns:
        tuple[int, int]: (total_processed, total_active)
    """
    if not jobs:
        return 0, 0

    conn = init_db(db_path)
    processed = 0

    with conn:
        for job in jobs:
            payload = {
                "job_id": job.get("job_id"),
                "title": job.get("title") or "Untitled",
                "company": job.get("company"),
                "location": job.get("location"),
                "country": job.get("country"),
                "remote_type": job.get("remote_type"),
                "employment_type": job.get("employment_type"),
                "experience": job.get("experience"),
                "salary": job.get("salary"),
                "description": job.get("description"),
                "apply_url": job.get("apply_url"),
                "direct_apply_url": job.get("direct_apply_url") or job.get("apply_url"),
                "source": job.get("source"),
                "source_job_id": job.get("source_job_id"),
                "posted_date": job.get("posted_date"),
                "collected_date": job.get("collected_date"),
                "status": job.get("status", "active"),
                "is_direct_ats": 1 if job.get("is_direct_ats") else 0,
                "is_india_eligible": 1 if job.get("is_india_eligible") else 0,
            }
            conn.execute(UPSERT_JOB_SQL, payload)
            processed += 1

    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM jobs WHERE status = 'active'")
    active_count = cursor.fetchone()[0]
    conn.close()

    return processed, active_count


def get_active_jobs_from_db(db_path: str = DEFAULT_DB_PATH) -> list[dict[str, Any]]:
    """Retrieve all active jobs from SQLite as standard dictionaries."""
    if not os.path.exists(db_path):
        return []

    conn = init_db(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE status = 'active' ORDER BY posted_date DESC, created_at DESC")
    rows = cursor.fetchall()
    jobs = [dict(row) for row in rows]
    conn.close()

    # Convert integer flags back to booleans for consistency
    for j in jobs:
        j["is_direct_ats"] = bool(j.get("is_direct_ats"))
        j["is_india_eligible"] = bool(j.get("is_india_eligible"))

    return jobs


def query_jobs_from_db(
    db_path: str = DEFAULT_DB_PATH,
    search: str | None = None,
    company: str | None = None,
    role: str | None = None,
    is_india_eligible: bool | None = None,
    city: str | None = None,
    remote_only: bool = False,
    direct_ats_only: bool = False,
    max_days_old: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Query and filter jobs directly from the SQLite database with high precision."""
    if not os.path.exists(db_path):
        return []

    conn = init_db(db_path)
    cursor = conn.cursor()

    conditions = ["status = 'active'"]
    params: list[Any] = []

    if is_india_eligible is not None:
        conditions.append("is_india_eligible = ?")
        params.append(1 if is_india_eligible else 0)

    if direct_ats_only:
        conditions.append("is_direct_ats = 1")

    if remote_only:
        conditions.append("(remote_type = 'Remote' OR location LIKE '%Remote%' OR location LIKE '%Worldwide%')")

    if company:
        conditions.append("company LIKE ?")
        params.append(f"%{company}%")

    if city:
        conditions.append("location LIKE ?")
        params.append(f"%{city}%")

    if role:
        r = role.lower()
        if r == "qa":
            conditions.append("(title LIKE '%qa%' OR title LIKE '%test%' OR title LIKE '%sdet%' OR title LIKE '%quality%')")
        elif r in ("engineer", "dev"):
            conditions.append("(title LIKE '%engineer%' OR title LIKE '%developer%' OR title LIKE '%software%')")
        elif r == "devops":
            conditions.append("(title LIKE '%devops%' OR title LIKE '%cloud%' OR title LIKE '%sre%')")
        elif r in ("data", "ai"):
            conditions.append("(title LIKE '%data%' OR title LIKE '%ai%' OR title LIKE '%machine learning%' OR title LIKE '%ml%')")

    if search:
        s = f"%{search}%"
        conditions.append("(title LIKE ? OR company LIKE ? OR location LIKE ? OR description LIKE ?)")
        params.extend([s, s, s, s])

    if max_days_old is not None:
        conditions.append("posted_date >= date('now', ?)")
        params.append(f"-{int(max_days_old)} days")

    where_clause = " AND ".join(conditions)
    query = f"SELECT * FROM jobs WHERE {where_clause} ORDER BY posted_date DESC, created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor.execute(query, params)
    rows = cursor.fetchall()
    jobs = [dict(row) for row in rows]
    conn.close()

    for j in jobs:
        j["is_direct_ats"] = bool(j.get("is_direct_ats"))
        j["is_india_eligible"] = bool(j.get("is_india_eligible"))

    return jobs

