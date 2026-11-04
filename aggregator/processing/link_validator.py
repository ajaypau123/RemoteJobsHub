"""Lightweight link and requisition lifecycle validator for active ATS listings.

Performs:
1. TTL-based expiration pruning (default 45 days) for stale requisitions.
2. Concurrent HEAD/lightweight request verification on a batch of oldest active
   ATS jobs to catch 404s and closed job boards without slowing down CI runs.
"""

import concurrent.futures
import datetime
import logging
from urllib.parse import urlparse

import requests

logger = logging.getLogger(__name__)

# Request headers simulating standard desktop browsers
CHECKER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

DEFAULT_MAX_CHECKS_PER_RUN = 300
DEFAULT_TTL_DAYS = 120


def filter_by_ttl(jobs: list[dict], max_age_days: int = DEFAULT_TTL_DAYS) -> tuple[list[dict], int]:
    """Filter out jobs older than max_age_days from the active dashboard feed."""
    now = datetime.date.today()
    valid_jobs: list[dict] = []
    expired_count = 0

    for job in jobs:
        date_str = job.get("posted_date") or job.get("collected_date")
        if not date_str:
            valid_jobs.append(job)
            continue

        try:
            parts = [int(p) for p in date_str[:10].split("-")]
            job_date = datetime.date(parts[0], parts[1], parts[2])
            age_days = (now - job_date).days
            if age_days > max_age_days:
                expired_count += 1
                continue
        except Exception:
            pass

        valid_jobs.append(job)

    if expired_count > 0:
        logger.info(
            "[Validator] Pruned %d jobs older than %d days (TTL expiration).",
            expired_count,
            max_age_days,
        )

    return valid_jobs, expired_count


def _check_single_url(job: dict, session: requests.Session) -> tuple[str, bool]:
    """Check if an ATS job requisition URL is still open and reachable."""
    job_id = job.get("job_id", "")
    url = job.get("direct_apply_url") or job.get("apply_url")
    if not url:
        return job_id, True

    try:
        # Use HEAD with a short timeout; fall back to GET stream=True if HEAD is 405 Method Not Allowed
        resp = session.head(url, timeout=4.5, allow_redirects=True)
        if resp.status_code == 405:
            resp = session.get(url, timeout=4.5, stream=True, allow_redirects=True)

        if resp.status_code in (404, 410):
            return job_id, False

        # Greenhouse closed job heuristic: redirects to board home without job ID in path
        if "greenhouse.io" in url and resp.url:
            parsed_orig = urlparse(url).path.rstrip("/")
            parsed_final = urlparse(resp.url).path.rstrip("/")
            # If original had /jobs/<id> but final landed on /<company> (main board)
            if "/jobs/" in parsed_orig and "/jobs/" not in parsed_final:
                return job_id, False

        # Lever closed job heuristic
        if "jobs.lever.co" in url and resp.status_code in (404, 410):
            return job_id, False

        return job_id, True

    except Exception:
        # On connection timeout or transient network hiccups, assume alive to prevent false drops
        return job_id, True


def prune_dead_ats_links(
    jobs: list[dict],
    max_checks: int = DEFAULT_MAX_CHECKS_PER_RUN,
    db_path: str | None = None,
) -> tuple[list[dict], int]:
    """Verify a sample of oldest ATS job links and prune 404s/closed jobs."""
    ats_candidates = [
        j for j in jobs
        if j.get("direct_apply_url") or any(
            d in (j.get("apply_url") or "")
            for d in ("greenhouse.io", "ashbyhq.com", "lever.co", "workday")
        )
    ]

    if not ats_candidates:
        return jobs, 0

    # Sort oldest first so aging listings get validated first
    ats_candidates.sort(
        key=lambda j: j.get("posted_date") or j.get("collected_date") or "9999-99-99"
    )
    batch = ats_candidates[:max_checks]
    logger.info(
        "[Validator] Checking %d active ATS URLs for closed requisitions...",
        len(batch),
    )

    dead_job_ids: set[str] = set()

    with requests.Session() as session:
        session.headers.update(CHECKER_HEADERS)
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(_check_single_url, j, session) for j in batch]
            for future in concurrent.futures.as_completed(futures):
                try:
                    job_id, is_alive = future.result()
                    if not is_alive:
                        dead_job_ids.add(job_id)
                except Exception:
                    pass

    if dead_job_ids:
        logger.info(
            "[Validator] Pruned %d closed / 404 ATS requisitions.",
            len(dead_job_ids),
        )
        if db_path:
            try:
                from aggregator.db import mark_jobs_closed
                mark_jobs_closed(dead_job_ids, db_path=db_path)
            except Exception as exc:
                logger.warning("Failed to mark closed jobs in DB: %s", exc)

        pruned_jobs = [j for j in jobs if j.get("job_id") not in dead_job_ids]
        return pruned_jobs, len(dead_job_ids)

    return jobs, 0

