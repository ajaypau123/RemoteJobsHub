"""Adzuna source connector.

API documentation: https://developer.adzuna.com/overview
Terms of service:  https://developer.adzuna.com/terms
Permission status: APPROVED
API key required:  Yes — ADZUNA_APP_ID + ADZUNA_APP_KEY (free registration)
Rate limit:        250 API calls/month on free tier
Attribution:       Jobs sourced from Adzuna (https://www.adzuna.com)

Countries are configured via the ADZUNA_COUNTRIES environment variable
(comma-separated list of country codes, e.g. "gb,us,in"). Default: "gb,us".

Supported country codes:
  au  ca  de  fr  gb  in  nl  nz  pl  ru  sg  us  za  br  mx  at  be
"""

import logging
import os

from aggregator.config.sources import SourceConfig
from aggregator.sources.base import BaseJobSource, SourceError

logger = logging.getLogger(__name__)

DEFAULT_COUNTRIES = "in,gb,us"
RESULTS_PER_PAGE = 50   # Adzuna max is 50
MAX_PAGES = 20          # safety ceiling per country


class AdzunaSource(BaseJobSource):
    """Collects job listings from the Adzuna API across multiple countries."""

    def __init__(self, config: SourceConfig) -> None:
        super().__init__(config)
        self.app_id = os.getenv("ADZUNA_APP_ID", "").strip()
        self.app_key = os.getenv("ADZUNA_APP_KEY", "").strip()
        raw_countries = os.getenv("ADZUNA_COUNTRIES", DEFAULT_COUNTRIES)
        self.countries: list[str] = [
            c.strip().lower() for c in raw_countries.split(",") if c.strip()
        ]

    def _check_credentials(self) -> None:
        if not self.app_id or not self.app_key:
            raise SourceError(
                "[Adzuna] ADZUNA_APP_ID and/or ADZUNA_APP_KEY are not set. "
                "Register at https://developer.adzuna.com/ and add credentials to .env."
            )

    def collect_jobs(self) -> list[dict]:
        """Collect jobs from all configured Adzuna country endpoints.

        Each record is tagged with the country code it came from so the
        normalizer can populate the ``country`` field.

        Returns a list of raw job dicts.
        """
        self._check_credentials()
        all_jobs: list[dict] = []

        for country in self.countries:
            logger.info("[Adzuna] Collecting jobs for country: %s", country)
            country_jobs = self._collect_country(country)
            logger.info(
                "[Adzuna/%s] Retrieved %d raw job records.", country, len(country_jobs)
            )
            all_jobs.extend(country_jobs)

        logger.info(
            "[Adzuna] Total raw records across %d countries: %d",
            len(self.countries),
            len(all_jobs),
        )
        return all_jobs

    def _collect_country(self, country: str) -> list[dict]:
        """Paginate through all results for a single country code."""
        country_jobs: list[dict] = []
        base_url = self.config.api_url  # "https://api.adzuna.com/v1/api/jobs"

        for page in range(1, MAX_PAGES + 1):
            url = f"{base_url}/{country}/search/{page}"
            params = {
                "app_id": self.app_id,
                "app_key": self.app_key,
                "results_per_page": RESULTS_PER_PAGE,
                "content-type": "application/json",
            }

            logger.debug("[Adzuna/%s] Fetching page %d", country, page)
            try:
                data = self._get(url, params=params)
            except SourceError:
                raise

            results = data.get("results", [])
            if not results:
                break  # exhausted pages for this country

            # Tag each record with the country for the normalizer
            for job in results:
                job["_adzuna_country"] = country

            country_jobs.extend(results)

            # Stop early if we've retrieved everything
            total_available = data.get("count", 0)
            if len(country_jobs) >= total_available:
                break

        return country_jobs
