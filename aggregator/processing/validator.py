"""Validator — enforces minimum required fields on normalized job records.

Minimum required fields:
    title       Non-empty string
    company     Non-empty string
    apply_url   Valid HTTP/HTTPS URL
    source      Registered source name

Records that fail any check are rejected and counted.
Rejection reasons are returned for logging/statistics.
"""

import re
import logging

from aggregator.config.sources import KNOWN_SOURCE_NAMES

logger = logging.getLogger(__name__)

_URL_PATTERN = re.compile(r"^https?://[^\s]+$", re.IGNORECASE)


def validate(job: dict) -> tuple[bool, str | None]:
    """Check whether a normalized job record meets the minimum requirements.

    Args:
        job: A normalized job dict.

    Returns:
        (True, None)           — if the record is valid.
        (False, reason_str)    — if the record should be rejected.
    """
    title = job.get("title")
    company = job.get("company")
    apply_url = job.get("apply_url")
    source = job.get("source")

    if not _is_non_empty_str(title):
        return False, "missing or empty 'title'"

    if not _is_non_empty_str(company):
        return False, "missing or empty 'company'"

    if not _is_non_empty_str(apply_url):
        return False, "missing or empty 'apply_url'"

    if not _is_valid_url(apply_url):
        return False, f"invalid 'apply_url': {apply_url!r}"

    if not _is_non_empty_str(source):
        return False, "missing or empty 'source'"

    if source not in KNOWN_SOURCE_NAMES:
        return False, f"unknown source: {source!r}"

    return True, None


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _is_non_empty_str(value) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _is_valid_url(value: str) -> bool:
    return bool(_URL_PATTERN.match(value.strip()))
