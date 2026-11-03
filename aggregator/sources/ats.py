"""Company ATS source connector.

Ingests job postings directly from companies' official public ATS endpoints
(Greenhouse, Lever, Ashby) without authentication or fragile HTML scraping.
"""

import logging
from typing import Sequence

from aggregator.config.companies import ATSCompany, DEFAULT_ATS_COMPANIES
from aggregator.sources.base import BaseJobSource, SourceError

logger = logging.getLogger(__name__)


class CompanyATSSource(BaseJobSource):
    """Collects jobs directly from official company ATS public endpoints."""

    def __init__(self, config, companies: Sequence[ATSCompany] | None = None) -> None:
        super().__init__(config)
        self.companies = list(companies) if companies is not None else DEFAULT_ATS_COMPANIES
        # Use descriptive user-agent
        self.session.headers.update({
            "User-Agent": "JobsForIndia-Aggregator/1.0 (https://jobsforindia.local)"
        })

    def collect_jobs(self) -> list[dict]:
        """Iterate through configured companies and collect their active public postings."""
        all_jobs: list[dict] = []

        logger.info("[CompanyATS] Querying %d curated company ATS endpoints...", len(self.companies))

        for comp in self.companies:
            try:
                jobs = self._collect_company(comp)
                all_jobs.extend(jobs)
                logger.debug("[CompanyATS] %s (%s): %d jobs found", comp.name, comp.ats_type, len(jobs))
            except Exception as e:
                logger.warning("[CompanyATS] Could not fetch %s (%s): %s", comp.name, comp.ats_type, e)
                continue

        logger.info("[CompanyATS] Total company ATS jobs retrieved: %d", len(all_jobs))
        return all_jobs

    def _collect_company(self, company: ATSCompany) -> list[dict]:
        """Fetch raw jobs for a single company based on its ATS platform."""
        if company.ats_type == "greenhouse":
            return self._fetch_greenhouse(company)
        elif company.ats_type == "lever":
            return self._fetch_lever(company)
        elif company.ats_type == "ashby":
            return self._fetch_ashby(company)
        elif company.ats_type == "smartrecruiters":
            return self._fetch_smartrecruiters(company)
        else:
            logger.warning("[CompanyATS] Unknown ATS type '%s' for %s", company.ats_type, company.name)
            return []

    def _fetch_greenhouse(self, company: ATSCompany) -> list[dict]:
        url = f"https://boards-api.greenhouse.io/v1/boards/{company.slug}/jobs"
        data = self._get(url, params={"content": "true"})
        if not isinstance(data, dict):
            return []
        raw_jobs = data.get("jobs", [])
        for j in raw_jobs:
            j["_ats_type"] = "greenhouse"
            j["_company_name"] = company.name
        return raw_jobs

    def _fetch_lever(self, company: ATSCompany) -> list[dict]:
        url = f"https://api.lever.co/v0/postings/{company.slug}"
        data = self._get(url, params={"mode": "json"})
        if not isinstance(data, list):
            return []
        for j in data:
            j["_ats_type"] = "lever"
            j["_company_name"] = company.name
        return data

    def _fetch_ashby(self, company: ATSCompany) -> list[dict]:
        url = f"https://api.ashbyhq.com/posting-api/job-board/{company.slug}"
        data = self._get(url, params={"includeCompensation": "true"})
        if not isinstance(data, dict):
            return []
        raw_jobs = data.get("jobs", [])
        for j in raw_jobs:
            j["_ats_type"] = "ashby"
            j["_company_name"] = company.name
        return raw_jobs

    def _fetch_smartrecruiters(self, company: ATSCompany) -> list[dict]:
        url = f"https://api.smartrecruiters.com/v1/companies/{company.slug}/postings"
        offset = 0
        limit = 100
        all_jobs: list[dict] = []
        base_params = company.extra_params.copy() if company.extra_params else {}

        while len(all_jobs) < 1000:
            params = {**base_params, "limit": limit, "offset": offset}
            data = self._get(url, params=params)
            if not isinstance(data, dict):
                break
            content = data.get("content", [])
            if not content:
                break
            for j in content:
                j["_ats_type"] = "smartrecruiters"
                j["_company_name"] = company.name
                j["_company_slug"] = company.slug
                all_jobs.append(j)

            total_found = data.get("totalFound", 0)
            offset += len(content)
            if offset >= total_found or len(content) < limit:
                break

        return all_jobs

