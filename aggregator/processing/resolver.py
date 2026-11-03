"""URL Resolver module — extracts and resolves direct company application URLs.

Helps job seekers apply directly on the hiring company's ATS or career site
(e.g., Greenhouse, Lever, Workday, Ashby, Workable) instead of third-party portals.
"""

import logging
import re
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# ── Known Applicant Tracking Systems (ATS) and Career Portals ─────────────────
ATS_DOMAINS = [
    r"boards\.greenhouse\.io",
    r"job-boards\.greenhouse\.io",
    r"jobs\.lever\.co",
    r"jobs\.ashbyhq\.com",
    r"apply\.workable\.com",
    r"[a-zA-Z0-9-]+\.bamboohr\.com/(?:careers|jobs)",
    r"jobs\.smartrecruiters\.com",
    r"smartrecruiters\.com",
    r"[a-zA-Z0-9-]+\.myworkdayjobs\.com",
    r"[a-zA-Z0-9-]+\.recruitee\.com",
    r"[a-zA-Z0-9-]+\.jobs\.personio\.(?:com|de)",
    r"[a-zA-Z0-9-]+\.applytojob\.com",
    r"[a-zA-Z0-9-]+\.breezy\.hr",
    r"ats\.rippling\.com",
    r"[a-zA-Z0-9-]+\.teamtailor\.com",
    r"amazon\.jobs",
]

# Regex pattern matching any direct ATS link
ATS_URL_REGEX = re.compile(
    r"https?://(?:[a-zA-Z0-9-]+\.)*(?:"
    + "|".join(ATS_DOMAINS)
    + r")[^\s\"'<>\)]+",
    re.IGNORECASE,
)

# Common general URL regex to find links in job text
URL_REGEX = re.compile(r"https?://[^\s\"'<>\)]+", re.IGNORECASE)


def extract_direct_apply_url(job: dict) -> str | None:
    """Find a direct ATS or company application link for a given job record.

    Checks:
      1. If the job's current `apply_url` is already a direct ATS link.
      2. If the `description` contains any direct ATS application links.
      3. Returns None if no direct ATS link could be found.
    """
    apply_url = job.get("apply_url") or ""
    description = job.get("description") or ""

    # 1. Check if apply_url is already a known ATS link
    if ATS_URL_REGEX.search(apply_url):
        return apply_url.strip()

    # 2. Search description for known ATS links
    ats_matches = ATS_URL_REGEX.findall(description)
    if ats_matches:
        # Return the first clean match
        clean_url = ats_matches[0].rstrip(".,;:")
        return clean_url

    return None


def resolve_job_urls(job: dict) -> dict:
    """Enrich a normalized job dict with a `direct_apply_url` field.

    If a direct company ATS link is identified, it is set in `direct_apply_url`.
    Otherwise, `direct_apply_url` defaults to the job's existing `apply_url`.
    """
    direct_url = extract_direct_apply_url(job)
    job_copy = dict(job)
    job_copy["direct_apply_url"] = direct_url if direct_url else job.get("apply_url")
    job_copy["is_direct_ats"] = bool(direct_url)
    return job_copy

