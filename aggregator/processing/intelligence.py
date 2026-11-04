"""Job Intelligence & Candidate Insight Extractor.

Extracts factual requirements from the full job description and title:
1. Experience Required: Exact years required by employer (or None if unstated).
2. Seniority Level & Rationale: Autonomy and responsibility tier expectations.
3. Tech Stack & Skills: Curated taxonomy matching verified technologies in the posting.
"""

import html
import re
from typing import Any

# Comprehensive curated taxonomy of technical skills and tools
TECH_TAXONOMY: list[tuple[str, str]] = [
    # (regex_pattern, display_name)
    (r"\bpython\b", "Python"),
    (r"\btypescript\b", "TypeScript"),
    (r"\bjavascript\b", "JavaScript"),
    (r"\b(golang|go)\b", "Go"),
    (r"\bjava\b", "Java"),
    (r"\brust\b", "Rust"),
    (r"\bc#\b|\b\.net\b", "C# / .NET"),
    (r"\bc\+\+\b", "C++"),
    (r"\bruby\b|\brails\b", "Ruby on Rails"),
    (r"\bphp\b|\blaravel\b", "PHP / Laravel"),
    (r"\bswift\b|\bios\b", "Swift / iOS"),
    (r"\bkotlin\b|\bandroid\b", "Kotlin / Android"),
    (r"\bscala\b", "Scala"),
    
    # Frameworks & Frontend
    (r"\breact(\.js)?\b", "React"),
    (r"\bnext(\.js)?\b", "Next.js"),
    (r"\bnode(\.js)?\b", "Node.js"),
    (r"\bvue(\.js)?\b", "Vue.js"),
    (r"\bangular\b", "Angular"),
    (r"\btailwind(css)?\b", "Tailwind CSS"),
    (r"\bflutter\b", "Flutter"),
    (r"\breact native\b", "React Native"),
    (r"\bdjango\b", "Django"),
    (r"\bfastapi\b", "FastAPI"),
    (r"\bflask\b", "Flask"),
    (r"\bspring( boot)?\b", "Spring Boot"),
    (r"\bgraphql\b", "GraphQL"),
    
    # Cloud & DevOps
    (r"\baws\b|\bamazon web services\b", "AWS"),
    (r"\bgcp\b|\bgoogle cloud\b", "Google Cloud (GCP)"),
    (r"\bazure\b", "Microsoft Azure"),
    (r"\bkubernetes\b|\bk8s\b", "Kubernetes"),
    (r"\bdocker\b", "Docker"),
    (r"\bterraform\b", "Terraform"),
    (r"\bci/cd\b|\bcontinuous integration\b", "CI/CD"),
    (r"\bgithub actions\b", "GitHub Actions"),
    (r"\blinux\b", "Linux"),
    (r"\bmicroservices\b", "Microservices"),
    
    # Data & Databases
    (r"\bpostgres(ql)?\b", "PostgreSQL"),
    (r"\bmysql\b", "MySQL"),
    (r"\bmongodb\b", "MongoDB"),
    (r"\bredis\b", "Redis"),
    (r"\bkafka\b", "Kafka"),
    (r"\belasticsearch\b", "Elasticsearch"),
    (r"\bsnowflake\b", "Snowflake"),
    (r"\bbigquery\b", "BigQuery"),
    (r"\bdatabricks\b|\bspark\b", "Spark / Databricks"),
    (r"\bsql\b", "SQL"),
    
    # AI & ML
    (r"\bllm\b|\blarge language models?\b", "LLMs & Generative AI"),
    (r"\bmachine learning\b|\bml\b", "Machine Learning"),
    (r"\bpytorch\b", "PyTorch"),
    (r"\btensorflow\b", "TensorFlow"),
    (r"\bnlp\b|\bnatural language processing\b", "NLP"),
    (r"\bcomputer vision\b", "Computer Vision"),
    (r"\blangchain\b|\bllamaindex\b", "LangChain / AI Agents"),
    
    # QA & Test Automation
    (r"\bsdet\b", "SDET"),
    (r"\bselenium\b", "Selenium"),
    (r"\bcypress\b", "Cypress"),
    (r"\bplaywright\b", "Playwright"),
    (r"\bjest\b", "Jest"),
    (r"\bpytest\b", "PyTest"),
    (r"\btest automation\b|\bqa automation\b", "Test Automation"),
    (r"\bqa\b|\bquality assurance\b", "Quality Assurance"),

    # Architecture & Practices
    (r"\brest(ful)?\s*(api|apis)?\b", "REST APIs"),
    (r"\bfull[- ]?stack\b", "Full Stack"),
    (r"\bgit\b|\bgithub\b|\bgitlab\b", "Git"),
    (r"\bagile\b|\bscrum\b", "Agile / Scrum"),
    (r"\bcybersecurity\b|\bappsec\b|\binfosec\b|\bsecurity\b", "Security"),
    (r"\betl\b|\bdata pipelines?\b", "Data Pipelines / ETL"),
]


def _clean_text(raw: str | None) -> str:
    if not raw:
        return ""
    text = html.unescape(raw)
    # Strip HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Normalize whitespaces
    return re.sub(r"\s+", " ", text).strip()


def extract_experience(title: str, description: str) -> str | None:
    """Extract factual years of experience required from the full text."""
    combined = f"{title} {_clean_text(description)}"

    # Pattern 1: 'minimum of 4 years', 'at least 3 years'
    p1 = re.search(
        r"(?:minimum(?:\s+of)?|at\s+least)\s+(\d+)\s*(?:years?|yrs?)",
        combined,
        re.IGNORECASE,
    )
    if p1:
        return f"{p1.group(1)}+ years"

    # Pattern 2: '5+ years of experience', '3-5 years experience', '3 to 5 yrs'
    p2 = re.search(
        r"(\d+\s*(?:[-–to]\s*\d+)?|\d+\+)\s*(?:years?|yrs?)(?:\s+of)?\s+(?:relevant\s+|proven\s+|professional\s+|hands[- ]on\s+|industry\s+|software\s+|work\s+)?experience",
        combined,
        re.IGNORECASE,
    )
    if p2:
        match_str = re.sub(r"[-–to]+", "–", p2.group(1)).replace(" ", "")
        return f"{match_str} years"

    # Pattern 3: 'requires 3+ years', 'require 5 years'
    p3 = re.search(
        r"require[sd]?\s+(?:at\s+least\s+)?(\d+\+?)\s*(?:years?|yrs?)",
        combined,
        re.IGNORECASE,
    )
    if p3:
        val = p3.group(1)
        if not val.endswith("+"):
            val = f"{val}+"
        return f"{val} years"

    # Pattern 4: in requirements block
    p4 = re.search(
        r"(?:requirements?|qualifications?|you\s+have|background)[\s\S]{0,100}?(\d+\+)\s*(?:years?|yrs?)",
        combined,
        re.IGNORECASE,
    )
    if p4:
        return f"{p4.group(1)} years"

    return None


def extract_seniority(title: str, description: str) -> dict[str, str]:
    """Determine verified seniority tier and the expectations rationale."""
    t = title.lower()

    if re.search(r"\b(lead|staff|principal|architect|director|head of|vp)\b", t):
        return {
            "level": "Lead / Staff / Principal",
            "rationale": "High architectural autonomy. Expected to lead technical strategy, drive cross-team system design, and mentor senior engineers.",
            "badge_color": "emerald",
        }
    elif re.search(r"\b(senior|sr\.?)\b", t):
        return {
            "level": "Senior Level",
            "rationale": "Autonomous end-to-end execution. Expected to own complex features, write clean testable code, and conduct rigorous code reviews.",
            "badge_color": "emerald",
        }
    elif re.search(r"\b(junior|jr\.?|entry|associate|intern|trainee|apprentice)\b", t):
        return {
            "level": "Entry / Junior",
            "rationale": "Foundational programming skills. Mentorship and structured ramp-up provided with focus on learning and pair programming.",
            "badge_color": "cyan",
        }
    else:
        return {
            "level": "Mid-Level",
            "rationale": "Solid domain fundamentals. Expected to deliver user stories reliably, collaborate across teams, and follow engineering best practices.",
            "badge_color": "teal",
        }


def extract_tech_stack(title: str, description: str, limit: int = 12) -> list[str]:
    """Extract verified technologies mentioned in the job posting."""
    combined = f"{title} {_clean_text(description)}".lower()
    found: list[str] = []

    for pattern, display_name in TECH_TAXONOMY:
        if re.search(pattern, combined, re.IGNORECASE):
            if display_name not in found:
                found.append(display_name)
                if len(found) >= limit:
                    break

    return found


def enrich_job_intelligence(job: dict[str, Any]) -> dict[str, Any]:
    """Enrich job dictionary with verified experience, seniority, and tech stack."""
    title = job.get("title") or ""
    description = job.get("description") or ""

    exp = extract_experience(title, description)
    sen = extract_seniority(title, description)
    stack = extract_tech_stack(title, description)

    job["experience_required"] = exp
    job["seniority_level"] = sen["level"]
    job["seniority_rationale"] = sen["rationale"]
    job["tech_stack"] = stack

    return job
