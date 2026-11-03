"""Jobspresso source connector.

Ingests public RSS job feeds from Jobspresso (remote tech, marketing, support).
"""

import html
import logging
import re
import xml.etree.ElementTree as ET
from aggregator.sources.base import BaseJobSource, SourceError

logger = logging.getLogger(__name__)

JOBSPRESSO_FEED_URL = "https://jobspresso.co/feed/?post_type=job_listing"


class JobspressoSource(BaseJobSource):
    """Collects remote job listings from Jobspresso's public RSS feed."""

    def __init__(self, config) -> None:
        super().__init__(config)
        self.session.headers.update({
            "User-Agent": "JobsForIndia-Aggregator/1.0 (https://jobsforindia.local)"
        })

    def collect_jobs(self) -> list[dict]:
        """Fetch and parse jobs from Jobspresso RSS feed."""
        all_jobs: list[dict] = []

        try:
            xml_text = self._get_text(self.config.api_url or JOBSPRESSO_FEED_URL)
            root = ET.fromstring(xml_text)
            items = root.findall(".//item")
            logger.debug("[Jobspresso] Found %d raw items in feed", len(items))

            for item in items:
                link = (item.findtext("link") or "").strip()
                title = (item.findtext("title") or "").strip()
                post_id = (item.findtext("{com-wordpress:feed-additions:1}post-id") or "").strip()
                guid = (item.findtext("guid") or "").strip()
                pub_date = (item.findtext("pubDate") or "").strip()
                creator_raw = (item.findtext("{http://purl.org/dc/elements/1.1/}creator") or "").strip()
                description = (
                    item.findtext("{http://purl.org/rss/1.0/modules/content/}encoded")
                    or item.findtext("description")
                    or ""
                )

                # Parse company and location from creator
                # Format: "Company<br>\u26b2&nbsp;United States" or "Company"
                company = None
                location = None
                if "<br>" in creator_raw:
                    parts = creator_raw.split("<br>", 1)
                    company = html.unescape(parts[0]).strip()
                    loc_part = html.unescape(parts[1]).strip()
                    loc_part = re.sub(r"^[^\w]+", "", loc_part).strip()
                    loc_part = re.sub(r"[^\w\s,\.\-]", "", loc_part).strip()
                    location = loc_part if loc_part else None
                elif creator_raw:
                    company = html.unescape(creator_raw).strip()

                all_jobs.append({
                    "id": post_id or guid or link,
                    "title": title,
                    "company": company,
                    "location": location,
                    "link": link,
                    "pubDate": pub_date,
                    "description": description,
                    "_source": "Jobspresso",
                })

        except Exception as exc:
            logger.warning("[Jobspresso] Could not fetch feed: %s", exc)

        logger.info("[Jobspresso] Total jobs retrieved: %d", len(all_jobs))
        return all_jobs

