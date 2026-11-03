"""Himalayas source connector.

API documentation: https://himalayas.app/jobs/api
Terms:             https://himalayas.app/jobs/api  /  https://himalayas.app/terms
Permission status: APPROVED — explicitly permits job boards, dashboards, AI agents,
                   and aggregators.
API key required:  No
Rate limit:        Soft limit; returns HTTP 429 when exceeded.
                   20 records per page, cursor-based pagination.
Attribution:       Must mention Himalayas as source and link to the job on Himalayas.
Restriction:       Do NOT submit listings to Google Jobs / LinkedIn Jobs meta-aggregators.
"""

import logging

from aggregator.sources.base import BaseJobSource, SourceError

logger = logging.getLogger(__name__)

MAX_PAGES = 25      # 25 pages * 20 = 500 jobs per batch
PAGE_SIZE = 20      # Himalayas returns max 20 per page


class HimalayasSource(BaseJobSource):
    """Collects remote job listings from the Himalayas public API."""

    def collect_jobs(self) -> list[dict]:
        """Paginate through Himalayas job listings using cursor-based pagination.

        Himalayas API shape::

            {
                "jobs": [ <job>, ... ],
                "hasMore": true | false,
                "nextCursor": "<cursor_string> | null",
                "total": 12345
            }

        Returns a list of raw job dicts.
        """
        all_jobs: list[dict] = []
        cursor: str | None = None
        page_num = 0

        while page_num < MAX_PAGES:
            page_num += 1
            params: dict = {"limit": PAGE_SIZE}
            if cursor:
                params["cursor"] = cursor

            logger.debug("[Himalayas] Fetching page %d (cursor=%s)", page_num, cursor)
            try:
                data = self._get(self.config.api_url, params=params)
            except SourceError:
                raise

            jobs = data.get("jobs", [])
            if not jobs:
                break

            all_jobs.extend(jobs)

            cursor = data.get("nextCursor")
            if not cursor:
                break

        logger.info("[Himalayas] Retrieved %d raw job records.", len(all_jobs))
        return all_jobs
