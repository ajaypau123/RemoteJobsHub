"""Job filtering module — filters jobs by role and experience level.

Provides deterministic keyword and regex-based filtering on job titles
and descriptions for targeted querying (e.g., QA positions with ~2 years experience).
"""

import logging
import re

logger = logging.getLogger(__name__)

# ── QA Role Patterns ──────────────────────────────────────────────────────────
# Matches common QA and software testing roles while avoiding false positives
# (e.g. word boundary prevents "EQUAL" or "EQUIPMENT" matching "QA").
QA_TITLE_PATTERNS = [
    re.compile(r"\bqa\b", re.IGNORECASE),
    re.compile(r"\bquality\s+assurance\b", re.IGNORECASE),
    re.compile(r"\bsdet\b", re.IGNORECASE),
    re.compile(r"\bsoftware\s+development\s+engineer\s+in\s+test\b", re.IGNORECASE),
    re.compile(r"\btest\s+engineer\b", re.IGNORECASE),
    re.compile(r"\bsoftware\s+tester\b", re.IGNORECASE),
    re.compile(r"\bautomation\s+tester\b", re.IGNORECASE),
    re.compile(r"\btest\s+automation\b", re.IGNORECASE),
    re.compile(r"\bmanual\s+tester\b", re.IGNORECASE),
    re.compile(r"\bquality\s+engineer\b", re.IGNORECASE),
    re.compile(r"\bqa\s+lead\b", re.IGNORECASE),
    re.compile(r"\bqa\s+analyst\b", re.IGNORECASE),
    re.compile(r"\bsoftware\s+test\b", re.IGNORECASE),
]


def is_qa_job(title: str | None, description: str | None = None) -> bool:
    """Return True if the job title indicates a QA / testing role.

    Strict title matching is enforced because staffing agencies (like Lemon.io)
    often paste footers in job descriptions listing 50+ unrelated tech roles
    (including QA Automation, QA Manual), which would otherwise cause false positives.
    """
    clean_title = (title or "").strip()
    if not clean_title:
        return False

    for pattern in QA_TITLE_PATTERNS:
        if pattern.search(clean_title):
            return True

    return False


def matches_experience(text: str | None, target_years: int = 2) -> bool:
    """Return True if the text indicates a requirement for approximately `target_years` of experience.

    Matches patterns like:
      - "2+ years of experience"
      - "2-4 years"
      - "2 to 3 yrs"
      - "minimum 2 years"
      - "at least 2 years"
    """
    if not text:
        return False

    y = target_years
    patterns = [
        # e.g., "2+ years of experience", "2 yrs exp", "2+ yrs"
        re.compile(rf"\b{y}\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp|hands[- ]on)\b", re.IGNORECASE),
        # e.g., "2-4 years", "2 to 5 yrs"
        re.compile(rf"\b{y}\+?\s*(?:to|-)\s*\d+\s*(?:years?|yrs?)\b", re.IGNORECASE),
        # e.g., "minimum 2 years", "at least 2 yrs"
        re.compile(rf"\b(?:minimum|at least|approx(?:imately)?)\s*{y}\+?\s*(?:years?|yrs?)\b", re.IGNORECASE),
        # e.g., "requires 2 years", "seeking 2+ years"
        re.compile(rf"\b(?:requires?|requiring|seeking|with)\s+{y}\+?\s*(?:years?|yrs?)\b", re.IGNORECASE),
    ]

    for pat in patterns:
        if pat.search(text):
            return True

    return False


# ── India Eligibility Patterns ───────────────────────────────────────────────
INDIAN_LOCATIONS = {
    "india", "kerala", "kochi", "cochin", "trivandrum", "thiruvananthapuram",
    "bengaluru", "bangalore", "hyderabad", "pune", "mumbai", "delhi", "new delhi",
    "ncr", "noida", "greater noida", "gurgaon", "gurugram", "chennai", "kolkata",
    "ahmedabad", "chandigarh", "jaipur", "indore", "calicut", "kozhikode", "mysore",
    "mysuru", "coimbatore", "bhubaneswar", "nagpur", "surat", "vadodara", "lucknow",
    "karnataka", "telangana", "maharashtra", "tamil nadu", "haryana", "uttar pradesh",
    "gujarat", "visakhapatnam", "vizag", "bhopal", "patna", "goa", "mangalore",
}

GLOBAL_REMOTE_TERMS = {
    "worldwide", "global", "anywhere", "apac", "work from anywhere",
    "wfh worldwide", "remote - worldwide", "everywhere", "all locations",
}

EXCLUSION_PATTERNS = [
    re.compile(r"\b(us|usa|united states|canada|uk|europe|eu|emea|latam|americas?)\s+only\b", re.IGNORECASE),
    re.compile(r"\b(us|u\.s\.)\s+citizenship\b", re.IGNORECASE),
    re.compile(r"\bgreen\s+card\b", re.IGNORECASE),
    re.compile(r"\b(?:must|have to)\s+be\s+(?:located|based|resident)\s+in\s+(?:the\s+)?(?:us|usa|united states|uk|europe|canada)\b", re.IGNORECASE),
    re.compile(r"\b(?:authorized|eligible)\s+to\s+work\s+in\s+the\s+(?:us|usa|united states)\b", re.IGNORECASE),
    re.compile(r"\bw2\s+only\b", re.IGNORECASE),
]


def is_india_eligible(job: dict) -> bool:
    """Return True if an Indian candidate is eligible to apply for this job.

    Eligible jobs include:
      1. Jobs located in India (e.g. country is India, or city in Kerala, Bengaluru, etc.)
      2. Remote roles open Worldwide, Globally, Anywhere, or APAC with no exclusionary geo-fencing.

    Ineligible jobs include:
      1. On-site or Hybrid jobs located in other countries.
      2. Remote jobs restricted to specific foreign regions (e.g. US Only, EU Only).
      3. Jobs requiring foreign citizenship or authorization (e.g. US Citizenship, Green Card).
    """
    country = (job.get("country") or "").strip().lower()
    location = (job.get("location") or "").strip().lower()
    desc = (job.get("description") or "").lower()
    remote_type = (job.get("remote_type") or "").strip()

    # 1. Direct India match in country or location
    if country in ("india", "in", "ind"):
        return True
    if re.search(r",\s*in(?:\b|$)", location) or re.search(r"\bindia\b", location):
        return True
    for term in INDIAN_LOCATIONS:
        if re.search(rf"\b{re.escape(term)}\b", location):
            return True

    # 2. On-site or Hybrid jobs located outside India are not eligible
    if remote_type in ("On-site", "Hybrid"):
        return False

    # 3. Check for explicit regional exclusions
    for pat in EXCLUSION_PATTERNS:
        if pat.search(location) or pat.search(desc[:600]):
            return False

    # 4. Check for Global Remote / Anywhere terms
    for term in GLOBAL_REMOTE_TERMS:
        if term in location:
            return True

    # 5. Remote jobs with no explicit geographical restriction
    if remote_type == "Remote" and (not location or location in ("remote", "telecommute")):
        return True

    return False


def filter_jobs(
    jobs: list[dict],
    role: str | None = None,
    exp_years: int | None = None,
    india_eligible: bool = False,
) -> list[dict]:
    """Filter a list of normalized job dicts by role, experience, and/or India eligibility.

    Args:
        jobs: List of normalized job dicts.
        role: Target role string (e.g., "qa"). Case-insensitive.
        exp_years: Target years of experience (e.g., 2).
        india_eligible: If True, only keep jobs eligible for candidates in India.

    Returns:
        Filtered list of job dicts matching all criteria.
    """
    if not role and exp_years is None and not india_eligible:
        return jobs

    filtered = []
    for job in jobs:
        title = job.get("title") or ""
        description = job.get("description") or ""
        combined_text = f"{title}\n{description}"

        # 1. Role match
        if role:
            role_norm = role.strip().lower()
            if role_norm == "qa":
                if not is_qa_job(title, description):
                    continue
            else:
                # Generic role keyword match on title or description
                role_pat = re.compile(rf"\b{re.escape(role_norm)}\b", re.IGNORECASE)
                if not role_pat.search(title) and not role_pat.search(description):
                    continue

        # 2. Experience match
        if exp_years is not None:
            if not matches_experience(combined_text, target_years=exp_years):
                continue

        # 3. India candidate eligibility match
        if india_eligible:
            if not is_india_eligible(job):
                continue

        filtered.append(job)

    return filtered

