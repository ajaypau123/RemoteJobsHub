"""Remotive source connector.

API documentation: https://github.com/remotive-com/remote-jobs-api
Terms:             https://github.com/remotive-com/remote-jobs-api (README)
Permission status: APPROVED — explicitly permits job boards and aggregators.
API key required:  No
Rate limit:        Max 2 requests/min; recommended max 4 polls/day
Attribution:       Must credit Remotive and link to canonical job URL on Remotive.
Restriction:       Do NOT submit listings to Google Jobs / LinkedIn Jobs / Neuvoo.
                   Do NOT require user sign-up/email to view listings.
Note:              Free tier listings are delayed 24 hours vs the live Remotive site.
"""

import logging

from aggregator.sources.base import BaseJobSource, SourceError

logger = logging.getLogger(__name__)


class RemotiveSource(BaseJobSource):
    """Collects remote job listings from the Remotive public API."""

    def collect_jobs(self) -> list[dict]:
        """Fetch all available jobs from Remotive.

        The API returns::

            {
                "job-count": 1234,
                "jobs": [ <job>, ... ]
            }

        All jobs are returned in a single response (no pagination).
        Returns a list of raw job dicts.
        """
        logger.debug("[Remotive] Fetching jobs")
        try:
            data = self._get(self.config.api_url)
        except SourceError:
            raise

        jobs = data.get("jobs", [])
        logger.info("[Remotive] Retrieved %d raw job records.", len(jobs))
        return jobs
