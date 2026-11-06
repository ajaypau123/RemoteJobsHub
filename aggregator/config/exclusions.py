"""Exclusion & takedown registry for RemoteJobsHub.

Allows immediate unindexing and removal of any employer or job requisition
upon receipt of a verified DMCA or employer takedown request.
"""

# Exact company names (case-insensitive) to permanently exclude from indexing
EXCLUDED_COMPANIES: set[str] = {
    # e.g., "example-corp",
}

# Substring or regex patterns in URLs to exclude
EXCLUDED_URL_PATTERNS: list[str] = [
    # e.g., "greenhouse.io/example-corp",
]


def is_excluded(company: str | None, url: str | None) -> bool:
    """Return True if the company or URL is on the exclusion/takedown list."""
    if company:
        c_clean = company.strip().lower()
        if c_clean in {c.lower() for c in EXCLUDED_COMPANIES}:
            return True

    if url:
        u_clean = url.strip().lower()
        for pattern in EXCLUDED_URL_PATTERNS:
            if pattern.lower() in u_clean:
                return True

    return False
