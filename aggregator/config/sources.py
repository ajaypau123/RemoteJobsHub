"""Source registry — defines which sources are approved and enabled.

Permission status definitions:
  APPROVED        Terms explicitly permit this type of aggregation use.
  REVIEW_REQUIRED Terms are unclear, commercial use may be restricted,
                  or additional vetting is needed. Do NOT enable.
  DENIED          Terms prohibit this use. Never enable.

Only sources with permission_status="APPROVED" AND enabled=True are queried.
"""

from dataclasses import dataclass
import os
from dotenv import load_dotenv

load_dotenv()


@dataclass
class SourceConfig:
    """Configuration and compliance record for a single job source."""

    name: str
    api_url: str
    permission_status: str  # "APPROVED" | "REVIEW_REQUIRED" | "DENIED"
    enabled: bool
    notes: str
    terms_url: str
    requires_api_key: bool
    rate_limit: str | None = None
    attribution: str | None = None

    def is_usable(self) -> bool:
        """Return True only when the source is both APPROVED and enabled."""
        return self.permission_status == "APPROVED" and self.enabled


# ──────────────────────────────────────────────────────────────────────────────
# Source registry
#
# Research conducted 2026-10-08. See notes for per-source terms summary.
# ──────────────────────────────────────────────────────────────────────────────

SOURCES: list[SourceConfig] = [

    # ── Remotive ──────────────────────────────────────────────────────────────
    # Explicitly permits aggregation/job-boards. No API key required.
    # Must preserve canonical Remotive URLs and credit Remotive as source.
    # Rate: max 2 req/min; recommended max 4 polls/day (feed updates slowly).
    # Listings are delayed 24h vs live site on the free tier.
    # Prohibition: do NOT submit to meta-aggregators (Google Jobs, LinkedIn Jobs).
    SourceConfig(
        name="Remotive",
        api_url="https://remotive.com/api/remote-jobs",
        permission_status="APPROVED",
        enabled=True,
        notes=(
            "Explicitly permits job board and aggregator use. "
            "Must credit Remotive and link to canonical job URL. "
            "Do NOT submit listings to Google Jobs / LinkedIn Jobs meta-aggregators. "
            "Free tier listings delayed 24h. Poll max 4x/day."
        ),
        terms_url="https://github.com/remotive-com/remote-jobs-api",
        requires_api_key=False,
        rate_limit="2 req/min; max 4 polls/day",
        attribution="Jobs sourced from Remotive (https://remotive.com)",
    ),

    # ── Jobicy ────────────────────────────────────────────────────────────────
    # Explicitly intended for job boards, apps, AI products, newsletters.
    # No API key needed for public listings. Poll max 1x/hour, cache locally.
    # Prohibition: do not claim listings as your own; preserve canonical URLs.
    SourceConfig(
        name="Jobicy",
        api_url="https://jobicy.com/api/v2/remote-jobs",
        permission_status="APPROVED",
        enabled=True,
        notes=(
            "Explicitly permits aggregation for job boards, apps, newsletters, AI products. "
            "Must preserve canonical Jobicy job URL. Poll max 1x/hour with local caching. "
            "Free public tier; paid tier provides direct ATS links."
        ),
        terms_url="https://jobicy.com/jobs-rss-feed",
        requires_api_key=False,
        rate_limit="1 poll/hour",
        attribution="Jobs sourced from Jobicy (https://jobicy.com)",
    ),

    # ── Himalayas ─────────────────────────────────────────────────────────────
    # Explicitly permits job boards, dashboards, AI agents.
    # No API key required. Cursor-based pagination (20 records/page).
    # Prohibition: do NOT submit to Google Jobs / LinkedIn Jobs meta-aggregators.
    SourceConfig(
        name="Himalayas",
        api_url="https://himalayas.app/jobs/api",
        permission_status="APPROVED",
        enabled=True,
        notes=(
            "Explicitly permits job boards, aggregators, and AI agents. "
            "Must credit Himalayas and link to source job URL. "
            "Do NOT submit to Google Jobs / LinkedIn Jobs. "
            "20 records/page; cursor pagination. Returns HTTP 429 if rate limited."
        ),
        terms_url="https://himalayas.app/jobs/api",
        requires_api_key=False,
        rate_limit="Soft limit; HTTP 429 when exceeded",
        attribution="Jobs sourced from Himalayas (https://himalayas.app)",
    ),

    # ── Adzuna ────────────────────────────────────────────────────────────────
    # Permitted as a click-through publisher sending candidate traffic to Adzuna.
    # Requires free App ID + App Key from https://developer.adzuna.com/.
    # Strict attribution: must show "Jobs by Adzuna" badge (116x23px) on all listings.
    # Free tier: 25 req/min, 250/day, 2,500/month. Multi-country endpoint.
    SourceConfig(
        name="Adzuna",
        api_url="https://api.adzuna.com/v1/api/jobs",
        permission_status="APPROVED",
        enabled=True,
        notes=(
            "Permitted as publisher/referral aggregator. "
            "IMPORTANT: All displayed listings must show 'Jobs by Adzuna' badge (116x23px) "
            "linked to the Adzuna regional site. "
            "Register at https://developer.adzuna.com/ for free App ID + App Key. "
            "Rate limit: 25 req/min, 250/day, 2,500/month (free tier). "
            "Configure countries via ADZUNA_COUNTRIES env var (e.g. gb,us,in)."
        ),
        terms_url="https://developer.adzuna.com/terms",
        requires_api_key=True,
        rate_limit="25 req/min; 250 req/day; 2,500 req/month",
        attribution='Jobs by Adzuna — must display "Jobs by Adzuna" badge (116x23px) with link',
    ),

    # ── Arbeitnow ─────────────────────────────────────────────────────────────
    # REVIEW_REQUIRED: General terms restrict to personal/non-commercial use.
    # Section 11 contemplates third-party platforms (requires backlink) but
    # conflicts with Section 2 which prohibits commercial/public display.
    # Disabled until terms are clarified with Arbeitnow or a private agreement
    # is in place. Contact: contact@arbeitnow.com for commercial arrangement.
    SourceConfig(
        name="Arbeitnow",
        api_url=os.getenv(
            "ARBEITNOW_API_URL",
            "https://www.arbeitnow.com/api/job-board-api",
        ),
        permission_status="REVIEW_REQUIRED",
        enabled=False,
        notes=(
            "REVIEW_REQUIRED: General terms (Section 2) restrict to personal/non-commercial use "
            "and prohibit public display. Section 11 contemplates third-party platforms but "
            "conflicts with the general use restriction. "
            "To enable: obtain written permission or a private agreement from Arbeitnow "
            "(contact@arbeitnow.com). Change permission_status to APPROVED only after confirmation. "
            "Attribution: link back to Arbeitnow.com is required per Section 11."
        ),
        terms_url="https://www.arbeitnow.com/terms",
        requires_api_key=False,
        rate_limit="Not published; polite use expected",
        attribution="Jobs sourced from Arbeitnow (https://www.arbeitnow.com) — link-back required",
    ),

    # ── RemoteOK ──────────────────────────────────────────────────────────────
    # Free public API for remote jobs. Explicitly permits integration for job seekers.
    # No API key required.
    SourceConfig(
        name="RemoteOK",
        api_url="https://remoteok.com/api",
        permission_status="APPROVED",
        enabled=True,
        notes="Free public API providing remote tech, developer, and QA listings worldwide.",
        terms_url="https://remoteok.com/legal",
        requires_api_key=False,
        rate_limit="1 req/min recommended",
        attribution="Jobs sourced from RemoteOK (https://remoteok.com)",
    ),

    # ── CompanyATS ────────────────────────────────────────────────────────────
    # Direct integration with official unauthenticated public ATS endpoints
    # (Greenhouse, Lever, Ashby) for top verified tech companies.
    SourceConfig(
        name="CompanyATS",
        api_url="https://boards-api.greenhouse.io",
        permission_status="APPROVED",
        enabled=True,
        notes=(
            "Pulls directly from official unauthenticated company ATS endpoints "
            "(Greenhouse, Lever, Ashby, SmartRecruiters) for verified tech employers. "
            "100% legal public career APIs with direct first-party apply links."
        ),
        terms_url="https://developers.greenhouse.io/",
        requires_api_key=False,
        rate_limit="1 req/sec per company",
        attribution="Direct from official employer ATS portals",
    ),

    # ── WeWorkRemotely ────────────────────────────────────────────────────────
    SourceConfig(
        name="WeWorkRemotely",
        api_url="https://weworkremotely.com/categories/remote-programming-jobs.rss",
        permission_status="APPROVED",
        enabled=True,
        notes=(
            "Official public RSS feeds for remote tech, product, and management jobs. "
            "100% legal syndication format with canonical application links."
        ),
        terms_url="https://weworkremotely.com/",
        requires_api_key=False,
        rate_limit="Polite RSS polling (max 1 req/min recommended)",
        attribution="Jobs sourced from We Work Remotely (https://weworkremotely.com)",
    ),

    # ── Jobspresso ────────────────────────────────────────────────────────────
    SourceConfig(
        name="Jobspresso",
        api_url="https://jobspresso.co/feed/?post_type=job_listing",
        permission_status="APPROVED",
        enabled=True,
        notes=(
            "Official public WordPress RSS feed for curated remote tech and operations jobs. "
            "Free open syndication protocol."
        ),
        terms_url="https://jobspresso.co/",
        requires_api_key=False,
        rate_limit="Polite RSS polling",
        attribution="Jobs sourced from Jobspresso (https://jobspresso.co)",
    ),

    # ── Amazon ────────────────────────────────────────────────────────────────
    SourceConfig(
        name="Amazon",
        api_url="https://www.amazon.jobs/en/search.json",
        permission_status="APPROVED",
        enabled=True,
        notes=(
            "Official unauthenticated public career search API from Amazon Jobs. "
            "Provides verified direct engineering and tech listings across India (Bengaluru, Hyderabad, Chennai, Pune)."
        ),
        terms_url="https://www.amazon.jobs/",
        requires_api_key=False,
        rate_limit="Polite polling (max 1 req/sec)",
        attribution="Direct from Amazon Careers (https://www.amazon.jobs)",
    ),

    # ── Workday ───────────────────────────────────────────────────────────────
    SourceConfig(
        name="Workday",
        api_url="https://myworkdayjobs.com",
        permission_status="APPROVED",
        enabled=True,
        notes=(
            "Direct integration with official unauthenticated Workday CXS endpoints "
            "for Big 4 (PwC) and Global Tech MNCs (Nvidia, Adobe, Mastercard, HP, Autodesk). "
            "100% legal public candidate endpoints with direct first-party apply links."
        ),
        terms_url="https://www.myworkdayjobs.com/",
        requires_api_key=False,
        rate_limit="Polite polling (max 1 req/sec per tenant)",
        attribution="Direct from official company Workday career sites",
    ),
]

# Convenience lookup by name
SOURCES_BY_NAME: dict[str, SourceConfig] = {s.name: s for s in SOURCES}
KNOWN_SOURCE_NAMES: set[str] = set(SOURCES_BY_NAME.keys())
