"""
RemoteJobsHub - Automated B2B Recruiter Outbound Engine

Scans newly indexed direct-ATS jobs, groups by hiring company, generates
1-click LinkedIn talent acquisition searches, and crafts personalized
high-converting 3-sentence cold outreach emails to sell $49 / $99 featured posts.
"""

import os
import re
import json
import logging
import argparse
from datetime import datetime, timezone
from urllib.parse import quote_plus
from typing import List, Dict, Any, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("RecruiterOutbound")


def load_jobs_from_feed(json_path: str = "output/jobs_latest.json", js_fallback: str = "dashboard/jobs_latest.js") -> List[Dict[str, Any]]:
    """Loads active jobs from output/jobs_latest.json or dashboard/jobs_latest.js."""
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "jobs" in data:
                    return data["jobs"]
                if isinstance(data, list):
                    return data
        except Exception as e:
            logger.warning(f"Error loading {json_path}: {e}")

    if os.path.exists(js_fallback):
        try:
            with open(js_fallback, "r", encoding="utf-8") as f:
                content = f.read().strip()
                start = content.find("[")
                end = content.rfind("]")
                if start != -1 and end != -1:
                    raw_json = content[start:end+1]
                    return json.loads(raw_json)
        except Exception as e:
            logger.warning(f"Error loading {js_fallback}: {e}")

    return []


def generate_linkedin_recruiter_search(company: str) -> str:
    """Builds a pre-calculated LinkedIn people search URL targeting tech recruiters."""
    clean_company = company.strip().replace('"', '')
    query = f'recruiter OR "talent acquisition" OR "engineering manager" "{clean_company}"'
    return f"https://www.linkedin.com/search/results/people/?keywords={quote_plus(query)}"


def build_cold_email_pitch(company: str, role_title: str, ats_source: str, apply_url: str) -> str:
    """Constructs a high-converting, courteous, 3-sentence recruiter email template."""
    clean_role = role_title.strip()
    clean_company = company.strip()
    source_label = ats_source if ats_source and ats_source != "CompanyATS" else "company careers"

    return f"""**Subject:** Featuring {clean_company}'s {clean_role} role to 16,000+ remote engineers

Hi {clean_company} Talent Acquisition Team,

I noticed {clean_company} recently opened the **{clean_role}** role on your {source_label} portal.

We just indexed and featured this position for free on **RemoteJobsHub** (https://ajaypau123.github.io/RemoteJobsHub/), where over 16,000 verified remote software engineers and tech professionals search for direct-ATS opportunities with zero agency middlemen.

If you'd like to pin this role to **#1 at the top of the feed for 30 days** and highlight it in our weekly tech digest to drive qualified direct applicants, you can activate a **$49 Featured Placement** here:
👉 https://ajaypau123.github.io/RemoteJobsHub/ (Click "Post a Job")

Best regards,  
Ajay Paul  
Founder, RemoteJobsHub  
support@remotejobshub.com
"""


def extract_recruiter_leads(jobs: List[Dict[str, Any]], limit: int = 15) -> List[Dict[str, Any]]:
    """
    Extracts distinct hiring companies from recent direct-ATS listings.
    Filters out empty company names and prioritizes direct ATS listings.
    """
    seen_companies = set()
    leads = []

    # Sort to prioritize featured or direct-ATS postings with valid titles & salaries
    def score_job(j: Dict[str, Any]) -> int:
        score = 0
        if j.get("direct_apply_url") or j.get("source") == "CompanyATS":
            score += 10
        if j.get("salary"):
            score += 5
        if j.get("posted_date"):
            score += 2
        return score

    sorted_jobs = sorted(jobs, key=score_job, reverse=True)

    for job in sorted_jobs:
        company = (job.get("company") or "").strip()
        title = (job.get("title") or "").strip()
        apply_url = job.get("direct_apply_url") or job.get("apply_url") or ""

        if not company or not title:
            continue

        company_key = company.lower()
        if company_key in seen_companies:
            continue

        seen_companies.add(company_key)
        ats_source = job.get("source") or "Careers Portal"
        linkedin_search = generate_linkedin_recruiter_search(company)
        email_pitch = build_cold_email_pitch(company, title, ats_source, apply_url)

        leads.append({
            "company": company,
            "title": title,
            "salary": job.get("salary") or "Competitive",
            "scope": job.get("remote_scope") or "Worldwide",
            "source": ats_source,
            "apply_url": apply_url,
            "linkedin_search": linkedin_search,
            "email_pitch": email_pitch
        })

        if len(leads) >= limit:
            break

    return leads


def generate_outbound_report(leads: List[Dict[str, Any]], output_path: str = "output/recruiter_leads_today.md") -> str:
    """Writes the markdown outreach hit-list for the founder."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    md_lines = [
        f"# 🎯 RemoteJobsHub — Daily Recruiter Outreach Hit-List ({today_str})",
        "",
        "> **Daily Goal:** Contact 10–15 recruiters on LinkedIn / Email to sell **$49 Featured Pins**.",
        "> A 3%–5% conversion rate on 15 emails yields **$150 – $250 / week** in pure profit.",
        "",
        "---",
        ""
    ]

    for idx, lead in enumerate(leads, 1):
        md_lines.append(f"## {idx}. {lead['company']} — {lead['title']}")
        md_lines.append(f"- **Compensation:** `{lead['salary']}`")
        md_lines.append(f"- **Scope:** `{lead['scope']}`")
        md_lines.append(f"- **ATS Source:** `{lead['source']}`")
        md_lines.append(f"- **Apply Link:** [Official Listing]({lead['apply_url']})")
        md_lines.append(f"- **🔍 Find Recruiter on LinkedIn:** [Open LinkedIn People Search]({lead['linkedin_search']})")
        md_lines.append("")
        md_lines.append("### Ready-to-Send Cold Email:")
        md_lines.append("```markdown")
        md_lines.append(lead['email_pitch'].strip())
        md_lines.append("```")
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")

    content = "\n".join(md_lines)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)

    return output_path


def main():
    parser = argparse.ArgumentParser(description="Generate daily recruiter cold outreach leads")
    parser.add_argument("--limit", type=int, default=15, help="Number of distinct hiring companies to generate (default: 15)")
    parser.add_argument("--output", type=str, default="output/recruiter_leads_today.md", help="Output markdown path")
    args = parser.parse_args()

    jobs = load_jobs_from_feed()
    if not jobs:
        logger.error("No jobs found in feed. Run pipeline or check output paths.")
        return

    leads = extract_recruiter_leads(jobs, limit=args.limit)
    report_path = generate_outbound_report(leads, output_path=args.output)
    logger.info(f"Successfully generated {len(leads)} recruiter leads in {report_path}")
    print(f"\n✅ Generated {len(leads)} B2B Recruiter Leads saved to {report_path}\n")


if __name__ == "__main__":
    main()

