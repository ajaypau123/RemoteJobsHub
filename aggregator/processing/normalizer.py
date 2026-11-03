"""Normalizer — maps raw source records to the common job schema.

The common schema fields are:

    job_id          Deterministic UUID5 (source + source_job_id)
    title           Job title
    company         Hiring company name
    location        City / region as provided by the source
    country         Country name or code
    remote_type     "Remote" | "Hybrid" | "On-site" | None
    employment_type "Full-time" | "Part-time" | "Contract" | "Internship" | None
    experience      Experience requirement string or None
    salary          Salary string or None
    description     Job description text or None
    apply_url       Application URL
    source          Source name (e.g. "Arbeitnow")
    source_job_id   ID assigned by the source
    posted_date     ISO date string (YYYY-MM-DD) or None
    collected_date  ISO date string (today)
    status          Always "active" in V1

Rules:
  - If the source does not provide a field, use None.
  - Do NOT invent or guess missing information.
  - Do NOT use an LLM to fill gaps.
"""

import email.utils
import hashlib
import html
import logging
import re
import uuid
from datetime import date, datetime, timezone

logger = logging.getLogger(__name__)

# Namespace UUID for deterministic job_id generation
_UUID5_NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  # URL namespace


# ──────────────────────────────────────────────────────────────────────────────
# Public entry point
# ──────────────────────────────────────────────────────────────────────────────

def normalize(raw: dict, source_name: str) -> dict:
    """Convert a raw source record into the common job schema.

    Args:
        raw:         The raw dict as returned by the source API.
        source_name: The registered name of the source (e.g. "Remotive").

    Returns:
        A dict conforming to the common job schema.
    """
    if source_name == "Arbeitnow":
        return _normalize_arbeitnow(raw)
    if source_name == "Adzuna":
        return _normalize_adzuna(raw)
    if source_name == "Remotive":
        return _normalize_remotive(raw)
    if source_name == "Jobicy":
        return _normalize_jobicy(raw)
    if source_name == "Himalayas":
        return _normalize_himalayas(raw)
    if source_name == "RemoteOK":
        return _normalize_remoteok(raw)
    if source_name == "CompanyATS":
        return _normalize_company_ats(raw)
    if source_name == "WeWorkRemotely":
        return _normalize_weworkremotely(raw)
    if source_name == "Jobspresso":
        return _normalize_jobspresso(raw)
    if source_name == "Amazon":
        return _normalize_amazon(raw)
    if source_name == "Workday":
        return _normalize_workday(raw)
    # Fallback — generic best-effort mapping; should not be reached in V1
    logger.warning("No specific normalizer for source %r; using generic.", source_name)
    return _normalize_generic(raw, source_name)



# ──────────────────────────────────────────────────────────────────────────────
# Per-source normalizers
# ──────────────────────────────────────────────────────────────────────────────

def _normalize_arbeitnow(raw: dict) -> dict:
    """Map an Arbeitnow API record to the common schema.

    Arbeitnow record shape (key fields):
        slug, title, company_name, location, remote, job_types,
        description, url, created_at, tags
    """
    source_job_id = str(raw.get("slug") or raw.get("id") or "")
    title = _clean_str(raw.get("title"))
    company = _clean_str(raw.get("company_name"))
    location = _clean_str(raw.get("location"))
    apply_url = _clean_str(raw.get("url"))

    # Remote type
    is_remote = raw.get("remote", False)
    remote_type = "Remote" if is_remote else "On-site"

    # Employment type — Arbeitnow uses a list called "job_types"
    job_types = raw.get("job_types") or []
    employment_type = _parse_employment_type(job_types[0] if job_types else None)

    # Posted date — Arbeitnow provides a Unix timestamp in "created_at"
    posted_date = _parse_unix_timestamp(raw.get("created_at"))

    return _build_job(
        source="Arbeitnow",
        source_job_id=source_job_id,
        title=title,
        company=company,
        location=location,
        country=None,  # Arbeitnow does not provide a separate country field
        remote_type=remote_type,
        employment_type=employment_type,
        experience=None,
        salary=None,
        description=_clean_description(raw.get("description")),
        apply_url=apply_url,
        posted_date=posted_date,
    )


def _normalize_adzuna(raw: dict) -> dict:
    """Map an Adzuna API record to the common schema.

    Adzuna record shape (key fields):
        id, title, company.display_name, location.display_name,
        location.area (list), salary_min, salary_max,
        description, redirect_url, created, contract_type,
        _adzuna_country (injected by connector)
    """
    source_job_id = str(raw.get("id") or "")
    title = _clean_str(raw.get("title"))
    company = _clean_str(
        (raw.get("company") or {}).get("display_name")
    )

    # Location
    location_obj = raw.get("location") or {}
    location = _clean_str(location_obj.get("display_name"))

    # Country — use the injected _adzuna_country tag or location area
    country_code = raw.get("_adzuna_country")
    country = _adzuna_country_name(country_code) if country_code else None

    # Salary — combine min/max if available
    salary = _parse_adzuna_salary(raw.get("salary_min"), raw.get("salary_max"))

    # Remote type — Adzuna doesn't have a direct remote flag in free tier
    remote_type = None

    # Employment type
    contract_type = raw.get("contract_type")
    employment_type = _parse_employment_type(contract_type)

    # Posted date
    posted_date = _parse_iso_datetime(raw.get("created"))

    return _build_job(
        source="Adzuna",
        source_job_id=source_job_id,
        title=title,
        company=company,
        location=location,
        country=country,
        remote_type=remote_type,
        employment_type=employment_type,
        experience=None,
        salary=salary,
        description=_clean_description(raw.get("description")),
        apply_url=_clean_str(raw.get("redirect_url")),
        posted_date=posted_date,
    )


def _normalize_generic(raw: dict, source_name: str) -> dict:
    """Best-effort generic normalizer for unknown sources."""
    return _build_job(
        source=source_name,
        source_job_id=str(raw.get("id") or raw.get("slug") or ""),
        title=_clean_str(raw.get("title")),
        company=_clean_str(raw.get("company") or raw.get("company_name")),
        location=_clean_str(raw.get("location")),
        country=None,
        remote_type=None,
        employment_type=None,
        experience=None,
        salary=None,
        description=_clean_description(raw.get("description")),
        apply_url=_clean_str(raw.get("url") or raw.get("apply_url") or raw.get("redirect_url")),
        posted_date=None,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Schema builder
# ──────────────────────────────────────────────────────────────────────────────

def _build_job(
    *,
    source: str,
    source_job_id: str,
    title: str | None,
    company: str | None,
    location: str | None,
    country: str | None,
    remote_type: str | None,
    employment_type: str | None,
    experience: str | None,
    salary: str | None,
    description: str | None,
    apply_url: str | None,
    posted_date: str | None,
) -> dict:
    job_id = _make_job_id(source, source_job_id, apply_url)
    return {
        "job_id": job_id,
        "title": title,
        "company": company,
        "location": location,
        "country": country,
        "remote_type": remote_type,
        "employment_type": employment_type,
        "experience": experience,
        "salary": salary,
        "description": description,
        "apply_url": apply_url,
        "source": source,
        "source_job_id": source_job_id or None,
        "posted_date": posted_date,
        "collected_date": date.today().isoformat(),
        "status": "active",
    }


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _make_job_id(source: str, source_job_id: str, apply_url: str | None) -> str:
    """Generate a deterministic UUID5 job_id.

    Prefers source+source_job_id. Falls back to apply_url if no job ID.
    """
    if source_job_id:
        key = f"{source}::{source_job_id}"
    elif apply_url:
        key = f"{source}::{apply_url}"
    else:
        # Last resort — random (non-deterministic), logged as warning
        logger.warning("Cannot generate deterministic job_id for source=%r; using random UUID.", source)
        return str(uuid.uuid4())
    return str(uuid.uuid5(_UUID5_NAMESPACE, key))


def _clean_str(value) -> str | None:
    """Strip and collapse whitespace; return None for empty/None values."""
    if value is None:
        return None
    text = str(value).strip()
    text = re.sub(r"\s+", " ", text)
    return text if text else None


def _clean_description(value) -> str | None:
    """Clean job description text or HTML, preserving formatting and unescaping entities."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    # Unescape HTML entities like &lt;div&gt;, &amp;, &quot;
    if "&lt;" in text or "&gt;" in text or "&amp;" in text or "&quot;" in text or "&#" in text:
        text = html.unescape(text)
    # Collapse multiple consecutive blank lines or excessive horizontal spaces
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() if text.strip() else None


def _parse_employment_type(value: str | list | None) -> str | None:
    """Map raw employment type string or list to a normalized label."""
    if not value:
        return None
    if isinstance(value, list):
        value = value[0] if value else None
        if not value:
            return None
    v = str(value).lower().strip()
    if "full" in v:
        return "Full-time"
    if "part" in v:
        return "Part-time"
    if "contract" in v or "freelance" in v:
        return "Contract"
    if "intern" in v:
        return "Internship"
    if "temporary" in v or "temp" in v:
        return "Temporary"
    return _clean_str(value)  # preserve original if unrecognized


def _parse_unix_timestamp(value) -> str | None:
    """Convert a Unix timestamp (int/float) to an ISO date string."""
    if value is None:
        return None
    try:
        dt = datetime.fromtimestamp(int(value), tz=timezone.utc)
        return dt.date().isoformat()
    except (ValueError, TypeError, OSError):
        return None


def _parse_iso_datetime(value: str | None) -> str | None:
    """Parse an ISO 8601 datetime string to a date string (YYYY-MM-DD)."""
    if not value:
        return None
    try:
        # Handle both "2026-10-08T12:00:00Z" and "2026-10-08"
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.date().isoformat()
    except (ValueError, AttributeError):
        return None


def _parse_rfc822_datetime(value: str | None) -> str | None:
    """Parse an RFC 822 / 2822 date string (common in RSS feeds) to ISO date (YYYY-MM-DD)."""
    if not value:
        return None
    try:
        dt = email.utils.parsedate_to_datetime(value)
        return dt.date().isoformat()
    except Exception:
        return None



def _parse_adzuna_salary(salary_min, salary_max) -> str | None:
    """Build a salary range string from Adzuna's min/max fields."""
    try:
        if salary_min is not None and salary_max is not None:
            lo = int(float(salary_min))
            hi = int(float(salary_max))
            return f"{lo:,} - {hi:,}"
        if salary_min is not None:
            return f"{int(float(salary_min)):,}+"
        if salary_max is not None:
            return f"up to {int(float(salary_max)):,}"
    except (ValueError, TypeError):
        pass
    return None


# Adzuna country code → human-readable name
_ADZUNA_COUNTRY_NAMES: dict[str, str] = {
    "au": "Australia", "at": "Austria", "be": "Belgium", "br": "Brazil",
    "ca": "Canada", "de": "Germany", "fr": "France", "gb": "United Kingdom",
    "in": "India", "mx": "Mexico", "nl": "Netherlands", "nz": "New Zealand",
    "pl": "Poland", "ru": "Russia", "sg": "Singapore", "us": "United States",
    "za": "South Africa",
}


def _adzuna_country_name(code: str) -> str:
    return _ADZUNA_COUNTRY_NAMES.get(code.lower(), code.upper())


def _normalize_remotive(raw: dict) -> dict:
    """Map a Remotive API record to the common schema.

    Remotive record shape (key fields):
        id, url, title, company_name, company_logo, category,
        tags, job_type, publication_date, candidate_required_location,
        salary, description
    """
    source_job_id = str(raw.get("id") or "")

    # Remote type — Remotive is always remote
    remote_type = "Remote"

    return _build_job(
        source="Remotive",
        source_job_id=source_job_id,
        title=_clean_str(raw.get("title")),
        company=_clean_str(raw.get("company_name")),
        location=_clean_str(raw.get("candidate_required_location")),
        country=None,
        remote_type=remote_type,
        employment_type=_parse_employment_type(raw.get("job_type")),
        experience=None,
        salary=_clean_str(raw.get("salary")),
        description=_clean_description(raw.get("description")),
        apply_url=_clean_str(raw.get("url")),
        posted_date=_parse_iso_datetime(raw.get("publication_date")),
    )


def _normalize_jobicy(raw: dict) -> dict:
    """Map a Jobicy API v2 record to the common schema."""
    source_job_id = str(raw.get("id") or "")

    # Salary
    sal_min = raw.get("salaryMin") if raw.get("salaryMin") is not None else raw.get("annualSalaryMin")
    sal_max = raw.get("salaryMax") if raw.get("salaryMax") is not None else raw.get("annualSalaryMax")
    currency = raw.get("salaryCurrency", "")
    salary = _parse_jobicy_salary(sal_min, sal_max, currency)

    # Remote type — Jobicy is always remote
    remote_type = "Remote"

    # Description — check full jobDescription first, then excerpt
    desc = raw.get("jobDescription") or raw.get("jobExcerpt")

    return _build_job(
        source="Jobicy",
        source_job_id=source_job_id,
        title=_clean_str(raw.get("jobTitle") or raw.get("title")),
        company=_clean_str(raw.get("companyName") or raw.get("company")),
        location=_clean_str(raw.get("jobGeo") or raw.get("location")),
        country=None,
        remote_type=remote_type,
        employment_type=_parse_employment_type(raw.get("jobType")),
        experience=None,
        salary=salary,
        description=_clean_description(desc),
        apply_url=_clean_str(raw.get("url")),
        posted_date=_parse_iso_datetime(raw.get("pubDate")),
    )


def _normalize_himalayas(raw: dict) -> dict:
    """Map a Himalayas API record to the common schema."""
    source_job_id = str(raw.get("id") or raw.get("slug") or raw.get("guid") or "")

    company_obj = raw.get("company") if isinstance(raw.get("company"), dict) else {}
    company = _clean_str(raw.get("companyName") or company_obj.get("name"))

    # Location restrictions — join list into a string
    loc_list = raw.get("locationRestrictions") or []
    location = ", ".join(loc_list) if loc_list else None

    # Salary
    sal_min = raw.get("minSalary")
    sal_max = raw.get("maxSalary")
    currency = raw.get("currency") or raw.get("currencyCode", "")
    salary = _parse_jobicy_salary(sal_min, sal_max, currency)

    # Remote type
    remote_type = "Remote" if raw.get("isRemote", True) else None

    # Employment type
    employment_type = _parse_employment_type(raw.get("employmentType") or raw.get("jobType"))

    # Posted date
    pub_date = raw.get("pubDate") or raw.get("publishedAt")
    if isinstance(pub_date, (int, float)):
        posted_date = _parse_unix_timestamp(pub_date)
    else:
        posted_date = _parse_iso_datetime(pub_date)

    apply_url = _clean_str(raw.get("applicationLink") or raw.get("applyUrl"))

    return _build_job(
        source="Himalayas",
        source_job_id=source_job_id,
        title=_clean_str(raw.get("title")),
        company=company,
        location=location,
        country=None,
        remote_type=remote_type,
        employment_type=employment_type,
        experience=None,
        salary=salary,
        description=_clean_description(raw.get("description")),
        apply_url=apply_url,
        posted_date=posted_date,
    )


def _parse_jobicy_salary(
    sal_min, sal_max, currency: str = ""
) -> str | None:
    """Build a salary range string from min/max annual salary fields."""
    try:
        cur = currency.upper() if currency else ""
        if sal_min is not None and sal_max is not None:
            lo = int(float(sal_min))
            hi = int(float(sal_max))
            return f"{cur} {lo:,} - {hi:,}".strip()
        if sal_min is not None:
            return f"{cur} {int(float(sal_min)):,}+".strip()
        if sal_max is not None:
            return f"{cur} up to {int(float(sal_max)):,}".strip()
    except (ValueError, TypeError):
        pass
    return None


def _normalize_remoteok(raw: dict) -> dict:
    """Map a RemoteOK API record to the common schema."""
    source_job_id = str(raw.get("id") or raw.get("slug") or "")

    loc = _clean_str(raw.get("location"))
    if not loc or loc.lower() in ("remote", "telecommute"):
        location = "Worldwide"
    else:
        location = loc

    # Parse employment type from tags if present
    tags = raw.get("tags") or []
    employment_type = None
    if isinstance(tags, list):
        for tag in tags:
            parsed = _parse_employment_type(tag)
            if parsed in ("Full-time", "Part-time", "Contract", "Internship"):
                employment_type = parsed
                break

    # Remote type — RemoteOK is inherently remote
    remote_type = "Remote"

    # Salary
    salary = _parse_remoteok_salary(raw.get("salary_min"), raw.get("salary_max"))

    # Posted date
    posted_date = _parse_iso_datetime(raw.get("date"))
    if not posted_date and raw.get("epoch"):
        posted_date = _parse_unix_timestamp(raw.get("epoch"))

    apply_url = _clean_str(raw.get("apply_url") or raw.get("url"))

    return _build_job(
        source="RemoteOK",
        source_job_id=source_job_id,
        title=_clean_str(raw.get("position") or raw.get("title")),
        company=_clean_str(raw.get("company")),
        location=location,
        country=None,
        remote_type=remote_type,
        employment_type=employment_type,
        experience=None,
        salary=salary,
        description=_clean_description(raw.get("description")),
        apply_url=apply_url,
        posted_date=posted_date,
    )


def _parse_remoteok_salary(sal_min, sal_max) -> str | None:
    """Build a salary range string from RemoteOK's min/max fields."""
    try:
        min_val = int(float(sal_min)) if sal_min else 0
        max_val = int(float(sal_max)) if sal_max else 0
        if min_val > 0 and max_val > 0:
            return f"USD {min_val:,} - {max_val:,}"
        if min_val > 0:
            return f"USD {min_val:,}+"
        if max_val > 0:
            return f"USD up to {max_val:,}"
    except (ValueError, TypeError):
        pass
    return None


def _normalize_company_ats(raw: dict) -> dict:
    """Map a CompanyATS record (Greenhouse, Lever, Ashby, or SmartRecruiters) to the common schema."""
    ats_type = raw.get("_ats_type")
    if ats_type == "greenhouse":
        return _normalize_ats_greenhouse(raw)
    elif ats_type == "lever":
        return _normalize_ats_lever(raw)
    elif ats_type == "ashby":
        return _normalize_ats_ashby(raw)
    elif ats_type == "smartrecruiters":
        return _normalize_ats_smartrecruiters(raw)
    return _normalize_generic(raw, "CompanyATS")


def _normalize_ats_greenhouse(raw: dict) -> dict:
    source_job_id = str(raw.get("id") or "")
    title = _clean_str(raw.get("title"))
    company = _clean_str(raw.get("_company_name"))

    loc_obj = raw.get("location")
    if isinstance(loc_obj, dict):
        location = _clean_str(loc_obj.get("name"))
    else:
        location = _clean_str(loc_obj)

    remote_type = None
    if location and "remote" in location.lower():
        remote_type = "Remote"

    apply_url = _clean_str(raw.get("absolute_url"))
    posted_date = _parse_iso_datetime(raw.get("updated_at"))

    return _build_job(
        source="CompanyATS",
        source_job_id=source_job_id,
        title=title,
        company=company,
        location=location,
        country=None,
        remote_type=remote_type,
        employment_type=None,
        experience=None,
        salary=None,
        description=_clean_description(raw.get("content")),
        apply_url=apply_url,
        posted_date=posted_date,
    )


def _normalize_ats_lever(raw: dict) -> dict:
    source_job_id = str(raw.get("id") or "")
    title = _clean_str(raw.get("text") or raw.get("title"))
    company = _clean_str(raw.get("_company_name"))

    categories = raw.get("categories") or {}
    location = _clean_str(categories.get("location"))

    wp = (raw.get("workplaceType") or "").lower()
    if wp == "remote" or (location and "remote" in location.lower()):
        remote_type = "Remote"
    elif wp == "hybrid":
        remote_type = "Hybrid"
    elif wp == "onsite":
        remote_type = "On-site"
    else:
        remote_type = None

    employment_type = _parse_employment_type(categories.get("commitment"))

    created_at = raw.get("createdAt")
    posted_date = None
    if created_at:
        try:
            posted_date = _parse_unix_timestamp(int(created_at) / 1000)
        except (ValueError, TypeError):
            pass

    apply_url = _clean_str(raw.get("applyUrl") or raw.get("hostedUrl"))
    description = _clean_description(raw.get("descriptionPlain") or raw.get("description"))

    return _build_job(
        source="CompanyATS",
        source_job_id=source_job_id,
        title=title,
        company=company,
        location=location,
        country=None,
        remote_type=remote_type,
        employment_type=employment_type,
        experience=None,
        salary=None,
        description=description,
        apply_url=apply_url,
        posted_date=posted_date,
    )


def _normalize_ats_ashby(raw: dict) -> dict:
    source_job_id = str(raw.get("id") or "")
    title = _clean_str(raw.get("title"))
    company = _clean_str(raw.get("_company_name"))
    location = _clean_str(raw.get("location"))

    wp = (raw.get("workplaceType") or "").lower()
    if raw.get("isRemote") or wp == "remote" or (location and "remote" in location.lower()):
        remote_type = "Remote"
    elif wp == "hybrid":
        remote_type = "Hybrid"
    elif wp in ("onsite", "office"):
        remote_type = "On-site"
    else:
        remote_type = None

    employment_type = _parse_employment_type(raw.get("employmentType"))
    posted_date = _parse_iso_datetime(raw.get("publishedAt"))
    apply_url = _clean_str(raw.get("applyUrl") or raw.get("jobUrl"))
    description = _clean_description(raw.get("descriptionPlain") or raw.get("descriptionHtml"))

    return _build_job(
        source="CompanyATS",
        source_job_id=source_job_id,
        title=title,
        company=company,
        location=location,
        country=None,
        remote_type=remote_type,
        employment_type=employment_type,
        experience=None,
        salary=None,
        description=description,
        apply_url=apply_url,
        posted_date=posted_date,
    )


def _normalize_ats_smartrecruiters(raw: dict) -> dict:
    source_job_id = str(raw.get("id") or "")
    title = _clean_str(raw.get("name"))
    company = _clean_str(raw.get("_company_name") or (raw.get("company") or {}).get("name"))

    loc_obj = raw.get("location") or {}
    location = _clean_str(loc_obj.get("fullLocation") or loc_obj.get("city"))
    raw_country = loc_obj.get("country")
    country = "India" if raw_country and raw_country.lower() == "in" else _clean_str(raw_country)

    if loc_obj.get("remote"):
        remote_type = "Remote"
    elif loc_obj.get("hybrid"):
        remote_type = "Hybrid"
    elif loc_obj.get("remote") is False and loc_obj.get("hybrid") is False:
        remote_type = "On-site"
    else:
        remote_type = None

    type_emp = raw.get("typeOfEmployment") or {}
    employment_type = _parse_employment_type(type_emp.get("label"))

    exp_obj = raw.get("experienceLevel") or {}
    experience = _clean_str(exp_obj.get("label"))

    posted_date = _parse_iso_datetime(raw.get("releasedDate"))

    slug = raw.get("_company_slug") or (raw.get("company") or {}).get("identifier") or ""
    apply_url = _clean_str(
        raw.get("applyUrl")
        or raw.get("postingUrl")
        or (f"https://jobs.smartrecruiters.com/{slug}/{source_job_id}" if slug and source_job_id else None)
    )

    # Description construction
    desc_parts = []
    job_ad = raw.get("jobAd")
    if isinstance(job_ad, dict):
        sections = job_ad.get("sections") or {}
        for sec_name, sec_val in sections.items():
            if isinstance(sec_val, dict) and sec_val.get("text"):
                desc_parts.append(f"### {sec_val.get('title', sec_name.title())}\n{sec_val['text']}")

    if not desc_parts:
        meta_lines = []
        if raw.get("name"):
            meta_lines.append(f"Position: {raw['name']}")
        if company:
            meta_lines.append(f"Company: {company}")
        if location:
            meta_lines.append(f"Location: {location}")
        if employment_type:
            meta_lines.append(f"Employment Type: {employment_type}")
        if experience:
            meta_lines.append(f"Experience Level: {experience}")

        industry = (raw.get("industry") or {}).get("label")
        if industry:
            meta_lines.append(f"Industry: {industry}")
        function = (raw.get("function") or {}).get("label")
        if function:
            meta_lines.append(f"Function: {function}")

        custom_fields = raw.get("customField") or []
        for cf in custom_fields:
            flabel = cf.get("fieldLabel")
            vlabel = cf.get("valueLabel")
            if flabel and vlabel and flabel not in ("Tariff Area", "Local Grade"):
                meta_lines.append(f"{flabel}: {vlabel}")

        meta_lines.append("\nFor complete job responsibilities, qualifications, and to apply, visit the official posting.")
        desc_parts.append("\n".join(meta_lines))

    description = _clean_description("\n\n".join(desc_parts))

    return _build_job(
        source="CompanyATS",
        source_job_id=source_job_id,
        title=title,
        company=company,
        location=location,
        country=country,
        remote_type=remote_type,
        employment_type=employment_type,
        experience=experience,
        salary=None,
        description=description,
        apply_url=apply_url,
        posted_date=posted_date,
    )


def _normalize_weworkremotely(raw: dict) -> dict:
    source_job_id = str(raw.get("id") or raw.get("link") or "")
    title = _clean_str(raw.get("title"))
    company = _clean_str(raw.get("company"))
    region = _clean_str(raw.get("region"))
    location = region if region else "Worldwide"
    country = "India" if region and "india" in region.lower() else None

    # WWR listings are remote by definition
    remote_type = "Remote"

    posted_date = _parse_rfc822_datetime(raw.get("pubDate"))
    apply_url = _clean_str(raw.get("link"))

    return _build_job(
        source="WeWorkRemotely",
        source_job_id=source_job_id,
        title=title,
        company=company,
        location=location,
        country=country,
        remote_type=remote_type,
        employment_type=None,
        experience=None,
        salary=None,
        description=_clean_description(raw.get("description")),
        apply_url=apply_url,
        posted_date=posted_date,
    )


def _normalize_jobspresso(raw: dict) -> dict:
    source_job_id = str(raw.get("id") or raw.get("link") or "")
    title = _clean_str(raw.get("title"))
    company = _clean_str(raw.get("company"))
    loc = _clean_str(raw.get("location"))
    location = loc if loc else "Worldwide"
    country = "India" if loc and "india" in loc.lower() else None

    # Jobspresso listings are remote by definition
    remote_type = "Remote"

    posted_date = _parse_rfc822_datetime(raw.get("pubDate"))
    apply_url = _clean_str(raw.get("link"))

    return _build_job(
        source="Jobspresso",
        source_job_id=source_job_id,
        title=title,
        company=company,
        location=location,
        country=country,
        remote_type=remote_type,
        employment_type=None,
        experience=None,
        salary=None,
        description=_clean_description(raw.get("description")),
        apply_url=apply_url,
        posted_date=posted_date,
    )


def _normalize_amazon(raw: dict) -> dict:
    source_job_id = str(raw.get("id_icims") or raw.get("id") or "")
    title = _clean_str(raw.get("title"))
    company = "Amazon"
    city = _clean_str(raw.get("city"))
    location = f"{city}, India" if city else "India"
    country = "India"

    employment_type = "Full-time"
    desc_lower = (raw.get("description") or "").lower()
    remote_type = "Remote" if "remote" in desc_lower or "virtual" in desc_lower else "On-site"

    raw_date = raw.get("posted_date")
    posted_date = None
    if raw_date:
        try:
            dt = datetime.strptime(raw_date.strip(), "%B %d, %Y")
            posted_date = dt.date().isoformat()
        except Exception:
            pass

    job_path = raw.get("job_path") or ""
    apply_url = f"https://www.amazon.jobs{job_path}" if job_path.startswith("/") else (raw.get("url") or job_path)
    description = _clean_description(raw.get("description"))

    return _build_job(
        source="Amazon",
        source_job_id=source_job_id,
        title=title,
        company=company,
        location=location,
        country=country,
        remote_type=remote_type,
        employment_type=employment_type,
        experience=None,
        salary=None,
        description=description,
        apply_url=apply_url,
        posted_date=posted_date,
    )


def _normalize_workday(raw: dict) -> dict:
    source_job_id = str(raw.get("externalPath") or (raw.get("bulletFields") or [""])[0] or "")
    title = _clean_str(raw.get("title"))
    company = _clean_str(raw.get("_company_name"))
    locations_text = _clean_str(raw.get("locationsText"))
    location = locations_text if locations_text else "India"
    country = "India"

    remote_type = None
    if locations_text and "remote" in locations_text.lower():
        remote_type = "Remote"
    elif locations_text and "hybrid" in locations_text.lower():
        remote_type = "Hybrid"

    time_type = raw.get("_time_type")
    employment_type = _parse_employment_type(time_type) or "Full-time"

    posted_date = _parse_iso_datetime(raw.get("_posted_date"))
    apply_url = _clean_str(raw.get("_apply_url"))
    description = _clean_description(raw.get("_description"))

    return _build_job(
        source="Workday",
        source_job_id=source_job_id,
        title=title,
        company=company,
        location=location,
        country=country,
        remote_type=remote_type,
        employment_type=employment_type,
        experience=None,
        salary=None,
        description=description,
        apply_url=apply_url,
        posted_date=posted_date,
    )



