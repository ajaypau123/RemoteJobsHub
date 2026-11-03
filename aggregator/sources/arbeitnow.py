"""Arbeitnow source connector.

API documentation: https://www.arbeitnow.com/api/job-board-api
Terms of service:  https://www.arbeitnow.com/terms-of-service
Permission status: APPROVED
API key required:  No
Rate limit:        Not documented; paginate conservatively.
Attribution:       Jobs sourced from Arbeitnow (https://www.arbeitnow.com)
"""

import logging

from aggregator.config.sources import SourceConfig
from aggregator.sources.base import BaseJobSource, SourceError

logger = logging.getLogger(__name__)

MAX_PAGES = 50  # safety ceiling; each page returns up to 25 jobs


class ArbeitnowSource(BaseJobSource):
    """Collects job listings from the Arbeitnow public job-board API."""

    def collect_jobs(self) -> list[dict]:
        """Paginate through all available Arbeitnow job records.

        The API returns JSON with the shape::

            {
                "data": [ <job>, ... ],
                "links": { "next": "<url> | null", ... },
                "meta": { "current_page": 1, "last_page": N, ... }
            }

        Returns a list of raw job dicts (the "data" arrays concatenated).
        """
        all_jobs: list[dict] = []
        page = 1
        base_url = self.config.api_url

        while page <= MAX_PAGES:
            logger.debug("[Arbeitnow] Fetching page %d", page)
            try:
                data = self._get(base_url, params={"page": page})
            except SourceError:
                raise  # let main.py handle source-level failures

            jobs = data.get("data", [])
            if not jobs:
                break  # no more records

            all_jobs.extend(jobs)

            # Check if there are more pages via meta or links
            meta = data.get("meta", {})
            last_page = meta.get("last_page")
            if last_page is not None and page >= last_page:
                break

            links = data.get("links", {})
            if not links.get("next"):
                break

            page += 1

        logger.info("[Arbeitnow] Retrieved %d raw job records.", len(all_jobs))
        return all_jobs
