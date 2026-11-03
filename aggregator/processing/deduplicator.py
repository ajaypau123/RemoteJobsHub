"""Deduplicator — removes duplicate job records using deterministic rules.

Deduplication priority (highest to lowest):

    1. Same source + source_job_id
       Exact match on both fields (after lowercasing / stripping).

    2. Same normalized apply_url
       Lowercase, strip whitespace, remove trailing slash.

    3. Same normalized company + title + location
       Lowercase, strip whitespace, collapse repeated spaces.

Rules:
  - Keep the FIRST occurrence; discard subsequent duplicates.
  - Do NOT use fuzzy / AI-based matching.
  - Do NOT merge two different jobs just because titles are similar.
"""

import logging
import re

logger = logging.getLogger(__name__)


def deduplicate(jobs: list[dict]) -> tuple[list[dict], int]:
    """Remove duplicate records from a list of validated job dicts.

    Args:
        jobs: List of validated, normalized job dicts.

    Returns:
        (unique_jobs, removed_count)
    """
    seen_source_id: set[str] = set()
    seen_url: set[str] = set()
    seen_company_title_loc: set[str] = set()

    unique: list[dict] = []
    removed = 0

    for job in jobs:
        dup_key = _check_duplicate(
            job, seen_source_id, seen_url, seen_company_title_loc
        )
        if dup_key is not None:
            logger.debug("Duplicate removed (%s): job_id=%s", dup_key, job.get("job_id"))
            removed += 1
            continue

        # Register all three keys for this unique job
        _register(job, seen_source_id, seen_url, seen_company_title_loc)
        unique.append(job)

    return unique, removed


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _check_duplicate(
    job: dict,
    seen_source_id: set,
    seen_url: set,
    seen_company_title_loc: set,
) -> str | None:
    """Return the name of the matching dedup key, or None if unique."""
    # Tier 1: source + source_job_id
    sid_key = _source_id_key(job)
    if sid_key and sid_key in seen_source_id:
        return "source+source_job_id"

    # Tier 2: normalized apply_url
    url_key = _url_key(job)
    if url_key and url_key in seen_url:
        return "apply_url"

    # Tier 3: company + title + location
    ctl_key = _company_title_location_key(job)
    if ctl_key and ctl_key in seen_company_title_loc:
        return "company+title+location"

    return None


def _register(
    job: dict,
    seen_source_id: set,
    seen_url: set,
    seen_company_title_loc: set,
) -> None:
    """Add all three dedup keys for this job to the seen sets."""
    sid_key = _source_id_key(job)
    if sid_key:
        seen_source_id.add(sid_key)

    url_key = _url_key(job)
    if url_key:
        seen_url.add(url_key)

    ctl_key = _company_title_location_key(job)
    if ctl_key:
        seen_company_title_loc.add(ctl_key)


def _source_id_key(job: dict) -> str | None:
    source = _norm(job.get("source"))
    sid = _norm(job.get("source_job_id"))
    if source and sid:
        return f"{source}::{sid}"
    return None


def _url_key(job: dict) -> str | None:
    url = job.get("apply_url")
    if not url:
        return None
    key = url.strip().lower().rstrip("/")
    return key if key else None


def _company_title_location_key(job: dict) -> str | None:
    company = _norm(job.get("company"))
    title = _norm(job.get("title"))
    # location is optional — use empty string if absent so we still dedup
    location = _norm(job.get("location") or "")
    if company and title:
        return f"{company}|{title}|{location}"
    return None


def _norm(value) -> str:
    """Lowercase, strip, and collapse whitespace."""
    if value is None:
        return ""
    text = str(value).lower().strip()
    return re.sub(r"\s+", " ", text)
