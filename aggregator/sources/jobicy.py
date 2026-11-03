"""Jobicy source connector.

API documentation: https://jobicy.com/jobs-rss-feed
Terms:             https://jobicy.com/jobs-rss-feed  /  https://jobicy.com/terms/
Permission status: APPROVED — explicitly permits aggregation for job boards, apps,
                   newsletters, AI products, and internal applications.
API key required:  No (for public listings)
Rate limit:        Poll at most 1x/hour; cache responses locally.
Attribution:       Must preserve canonical Jobicy job URL and credit Jobicy as source.
Restriction:       Do NOT claim listings as original job postings.
"""

import logging

from aggregator.sources.base import BaseJobSource, SourceError

logger = logging.getLogger(__name__)

MAX_PAGES = 20          # safety ceiling
JOBS_PER_PAGE = 50      # Jobicy maximum allowed count per request is 50


class JobicySource(BaseJobSource):
    """Collects remote job listings from the Jobicy public API (v2)."""

    def collect_jobs(self) -> list[dict]:
        """Paginate through available Jobicy job records.

        Jobicy API v2 shape::

            {
                "success": true,
                "job_count": 1234,
                "jobs": [ <job>, ... ]
            }

        Returns a list of raw job dicts.
        """
        all_jobs: list[dict] = []
        page = 1

        params = {"count": JOBS_PER_PAGE}
        try:
            data = self._get(self.config.api_url, params=params)
        except SourceError:
            raise

        if not data.get("success", True):
            logger.warning("[Jobicy] API returned success=false")
            return []

        jobs = data.get("jobs", [])
        all_jobs.extend(jobs)


        logger.info("[Jobicy] Retrieved %d raw job records.", len(all_jobs))
        return all_jobs
