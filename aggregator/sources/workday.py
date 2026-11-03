"""Workday CXS API source connector.

Ingests public job postings directly from official Workday career sites
for Big 4 (PwC) and Global Tech MNCs (Nvidia, Adobe, Mastercard, HP, Autodesk).
"""

import logging
import re
from datetime import date, timedelta
from typing import Sequence

from aggregator.config.companies import WorkdayCompany, DEFAULT_WORKDAY_COMPANIES
from aggregator.config.sources import SourceConfig
from aggregator.sources.base import BaseJobSource

logger = logging.getLogger(__name__)

MAX_JOBS_PER_COMPANY = 500


def _parse_workday_posted_on(posted_on_text: str | None) -> str | None:
    """Parse relative Workday string like 'Posted 2 Days Ago' or 'Posted Today' to ISO date."""
    if not posted_on_text:
        return date.today().isoformat()
    
    t = posted_on_text.lower().strip()
    today = date.today()
    if "today" in t or "just" in t:
        return today.isoformat()
    if "yesterday" in t:
        return (today - timedelta(days=1)).isoformat()
    
    match = re.search(r"posted\s+(\d+)\s+day", t)
    if match:
        days = int(match.group(1))
        return (today - timedelta(days=days)).isoformat()
    
    match_weeks = re.search(r"posted\s+(\d+)\s+week", t)
    if match_weeks:
        weeks = int(match_weeks.group(1))
        return (today - timedelta(days=weeks * 7)).isoformat()
        
    return today.isoformat()


class WorkdaySource(BaseJobSource):
    """Collects engineering, consulting, and tech postings from Workday enterprise endpoints."""

    def __init__(self, config: SourceConfig, companies: Sequence[WorkdayCompany] | None = None) -> None:
        super().__init__(config)
        self.companies = list(companies) if companies is not None else DEFAULT_WORKDAY_COMPANIES
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Content-Type": "application/json",
            "Accept": "application/json",
        })

    def collect_jobs(self) -> list[dict]:
        """Iterate through configured Workday companies and collect active Indian job postings."""
        all_jobs: list[dict] = []

        logger.info("[Workday] Querying %d curated Big 4 & MNC Workday endpoints...", len(self.companies))

        for comp in self.companies:
            try:
                jobs = self._collect_company(comp)
                all_jobs.extend(jobs)
                logger.debug("[Workday] %s: %d jobs retrieved", comp.name, len(jobs))
            except Exception as e:
                logger.warning("[Workday] Could not fetch %s: %s", comp.name, e)
                continue

        logger.info("[Workday] Total verified Big 4 & MNC Workday jobs collected: %d", len(all_jobs))
        return all_jobs

    def _collect_company(self, company: WorkdayCompany) -> list[dict]:
        """Fetch active jobs for a single Workday tenant in fast batch mode."""
        search_url = f"https://{company.subdomain}.myworkdayjobs.com/wday/cxs/{company.tenant}/{company.site}/jobs"
        company_jobs: list[dict] = []
        offset = 0
        limit = 20

        while len(company_jobs) < MAX_JOBS_PER_COMPANY:
            payload = {
                "appliedFacets": {},
                "limit": limit,
                "offset": offset,
                "searchText": company.country_filter,
            }

            try:
                data = self._post(search_url, json_data=payload)
            except Exception as e:
                logger.warning("[Workday] Search error for %s (offset %d): %s", company.name, offset, e)
                break

            if not isinstance(data, dict):
                break

            postings = data.get("jobPostings", [])
            if not postings:
                break

            for p in postings:
                external_path = p.get("externalPath", "")
                if not external_path:
                    continue

                full_apply_url = f"https://{company.subdomain}.myworkdayjobs.com/en-US/{company.site}{external_path}"
                posted_date = _parse_workday_posted_on(p.get("postedOn"))
                
                bullets = p.get("bulletFields") or []
                req_text = f"Requisition ID: {bullets[0]}\n" if bullets else ""
                
                description = (
                    f"Verified direct employment opening at {company.name}.\n\n"
                    f"Position: {p.get('title')}\n"
                    f"Location: {p.get('locationsText', 'India')}\n"
                    f"{req_text}\n"
                    f"Review full role requirements and apply directly on the official {company.name} Workday career portal."
                )

                raw_record = {
                    "_source_type": "workday",
                    "_company_name": company.name,
                    "_apply_url": full_apply_url,
                    "_description": description,
                    "_posted_date": posted_date,
                    "title": p.get("title"),
                    "locationsText": p.get("locationsText"),
                    "postedOn": p.get("postedOn"),
                    "bulletFields": bullets,
                    "externalPath": external_path,
                }
                company_jobs.append(raw_record)

            offset += len(postings)
            total = data.get("total", 0)
            if offset >= total:
                break

        return company_jobs

