"""RemoteOK source connector.

API documentation: https://remoteok.com/api
Terms:             Free public API for remote jobs.
Permission status: APPROVED
API key required:  No
Rate limit:        Polite use expected (max 1 req/min recommended).
"""

import logging
from aggregator.sources.base import BaseJobSource, SourceError

logger = logging.getLogger(__name__)


class RemoteOKSource(BaseJobSource):
    """Collects remote job listings from the RemoteOK public API."""

    def __init__(self, config) -> None:
        super().__init__(config)
        # RemoteOK requires a descriptive User-Agent header
        self.session.headers.update({
            "User-Agent": "JobsForIndia-Aggregator/1.0 (https://jobsforindia.local; contact@jobsforindia.local)"
        })

    def collect_jobs(self) -> list[dict]:
        """Fetch remote jobs from RemoteOK.

        RemoteOK returns a JSON array where the first item is metadata (legal notice)
        and subsequent items are job objects containing 'position', 'company', etc.
        """
        logger.info("[RemoteOK] Fetching jobs from %s", self.config.api_url)
        try:
            data = self._get(self.config.api_url)
        except SourceError:
            raise

        if not isinstance(data, list):
            logger.warning("[RemoteOK] Unexpected response format (expected list, got %s)", type(data))
            return []

        # Filter out the first item if it is metadata without 'position' or 'id'
        jobs = [item for item in data if isinstance(item, dict) and ("position" in item or "title" in item)]
        logger.info("[RemoteOK] Retrieved %d job records.", len(jobs))
        return jobs

