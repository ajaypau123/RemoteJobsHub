"""We Work Remotely (WWR) source connector.

Ingests public RSS job feeds from We Work Remotely across tech, product,
management, customer support, and design categories.
"""

import logging
import xml.etree.ElementTree as ET
from aggregator.sources.base import BaseJobSource, SourceError

logger = logging.getLogger(__name__)

# Official public RSS feeds by category
WWR_FEED_URLS = [
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
    "https://weworkremotely.com/categories/remote-product-jobs.rss",
    "https://weworkremotely.com/categories/remote-design-jobs.rss",
    "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
    "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
    "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
]


class WeWorkRemotelySource(BaseJobSource):
    """Collects remote job listings from We Work Remotely's public RSS feeds."""

    def __init__(self, config) -> None:
        super().__init__(config)
        self.session.headers.update({
            "User-Agent": "JobsForIndia-Aggregator/1.0 (https://jobsforindia.local)"
        })

    def collect_jobs(self) -> list[dict]:
        """Fetch and parse jobs from all configured WWR RSS category feeds."""
        all_jobs: list[dict] = []
        seen_links: set[str] = set()

        for feed_url in WWR_FEED_URLS:
            try:
                xml_text = self._get_text(feed_url)
                root = ET.fromstring(xml_text)
                items = root.findall(".//item")
                logger.debug("[WeWorkRemotely] %s: %d items", feed_url.split("/")[-1], len(items))

                for item in items:
                    link = (item.findtext("link") or "").strip()
                    if link in seen_links:
                        continue
                    seen_links.add(link)

                    title_raw = (item.findtext("title") or "").strip()
                    company = None
                    title = title_raw
                    if ":" in title_raw:
                        parts = title_raw.split(":", 1)
                        company = parts[0].strip()
                        title = parts[1].strip()

                    all_jobs.append({
                        "id": (item.findtext("guid") or link).strip(),
                        "title": title,
                        "company": company,
                        "link": link,
                        "pubDate": (item.findtext("pubDate") or "").strip(),
                        "region": (item.findtext("region") or "").strip(),
                        "category": (item.findtext("category") or "").strip(),
                        "description": item.findtext("description") or "",
                        "_source": "WeWorkRemotely",
                    })
            except Exception as exc:
                logger.warning("[WeWorkRemotely] Could not fetch %s: %s", feed_url, exc)
                continue

        logger.info("[WeWorkRemotely] Total unique jobs retrieved: %d", len(all_jobs))
        return all_jobs

