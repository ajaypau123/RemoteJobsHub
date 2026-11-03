# Job Aggregator V1

A Python CLI tool that collects job listings from approved free APIs, normalizes them to a common schema, validates and deduplicates records, and exports a timestamped CSV file.

---

## Purpose

This project provides a clean, maintainable platform for **Indian job seekers** to discover and apply to tech jobs directly on hiring companies' official ATS portals (Greenhouse, Lever, Workday, etc.):

```
APPROVED SOURCES → INGEST → NORMALIZE → VALIDATE → DEDUPLICATE → INDIA ELIGIBILITY → DIRECT ATS RESOLVER → DASHBOARD
```

---

## Architecture

```
JobAggregater/
├── .github/
│   └── workflows/
│       └── scrape_and_deploy.yml # Automated GitHub Actions cron & deploy ($0/month)
├── aggregator/
│   ├── main.py              # CLI entry point — orchestrates pipeline
│   ├── db.py                # SQLite persistence & historical job tracking
│   ├── config/
│   │   ├── sources.py       # Source registry & compliance
│   │   └── companies.py     # Curated company ATS directory (Greenhouse/Lever/Ashby)
│   ├── sources/
│   │   ├── base.py          # BaseJobSource ABC + shared HTTP/retry logic
│   │   ├── ats.py           # Company ATS connector (Greenhouse, Lever, Ashby)
│   │   ├── remotive.py      # Remotive connector
│   │   ├── jobicy.py        # Jobicy connector
│   │   ├── himalayas.py     # Himalayas connector
│   │   ├── remoteok.py      # RemoteOK connector (public remote API)
│   │   ├── adzuna.py        # Adzuna connector (requires free API key)
│   │   └── arbeitnow.py     # Arbeitnow connector (REVIEW_REQUIRED)
│   └── processing/
│       ├── normalizer.py    # Maps raw records → common job schema
│       ├── validator.py     # Rejects records missing required fields
│       ├── deduplicator.py  # Three-tier deterministic deduplication
│       ├── filter.py        # Role, experience, and India candidate eligibility filter
│       └── resolver.py      # Direct company ATS apply link resolver
├── dashboard/               # SEO-optimized, accessible job seeker dashboard
│   ├── index.html           # Semantic HTML5, Schema.org JobPosting microdata
│   └── app.js               # Instant search, filter pills, keyboard navigation
├── output/                  # jobs.db, jobs_latest.json, and CSV exports
├── tests/                   # 139 unit and integration tests (100% passing)
├── serve.py                 # Local development server for the dashboard
├── .env.example             # Environment variable template
├── requirements.txt
├── README.md
```

---

## Requirements

- Python 3.11 or newer
- Internet access (to reach source APIs)

---

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd job-aggregator

# Create a virtual environment (recommended)
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
copy .env.example .env      # Windows
# cp .env.example .env       # macOS / Linux
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
# Adzuna (free registration at https://developer.adzuna.com/)
ADZUNA_APP_ID=your_app_id_here
ADZUNA_APP_KEY=your_app_key_here

# Comma-separated Adzuna country codes (e.g. gb,us,in,de)
ADZUNA_COUNTRIES=gb,us
```

The five no-key sources (CompanyATS, RemoteOK, Remotive, Jobicy, Himalayas) work out of the box without any environment variables or API keys.

---

## How to Run

```bash
# 1. Collect & filter jobs eligible for candidates in India:
python -m aggregator.main --india

# 2. Filter specifically for QA jobs with ~2 years experience:
python -m aggregator.main --role qa --exp 2

# 3. Filter by role and Indian eligibility:
python -m aggregator.main --role developer --india

# 4. Launch the local web dashboard:
python serve.py
```

The aggregator outputs:
- **JSON (Dashboard feed)**: `output/jobs_latest.json` (and timestamped `.json`)
- **CSV (Spreadsheet export)**: `output/jobs_YYYY_MM_DD_HH-MM-SS.csv` (UTF-8 with BOM)

---

## Web Dashboard, SEO & Accessibility (WCAG 2.1 AA)

Run `python serve.py` to open the search dashboard at `http://localhost:8000`.

### 🔍 Organic Search & SEO Architecture
* **Google Jobs Schema.org JSON-LD Microdata**: Dynamically embeds `JobPosting` microdata with `jobLocationType=TELECOMMUTE`, `applicantLocationRequirements=India`, and `directApply=true` for Google Jobs indexing.
* **Semantic HTML5 & Open Graph**: Full Open Graph (`og:title`, `og:image`), Twitter cards, canonical tags, and structured heading tags (`<h1>`, `<h2>`, `<article>`) for search engine crawlers.

### ♿ Accessibility (WCAG 2.1 AA Compliant)
* **Screen Reader Support**: `aria-live="polite"` result counter announces filtered count changes; interactive buttons have explicit `aria-label` tags.
* **Keyboard Navigation**: Full keyboard tab order, skip-to-content bypass link, and visible focus rings (`focus-visible:ring-2`).
* **Color Contrast**: Compliant color ratios across all tags, pills, and action buttons.

### ⚡ User-Friendly Features & Interactive Dropdowns
* **5 Dedicated Filter Dropdowns**:
  * 🎓 **Experience**: Fresher / Entry (0-1 yrs), Junior (1-3 yrs), Mid-Level (3-5 yrs), Senior (5+ yrs).
  * 💼 **Job Level / Seniority**: Entry / Junior, Mid-Level, Senior / Lead, Manager / Director.
  * ⏰ **Job Type**: Full-time, Part-time, Contract / Freelance, Internship.
  * 📡 **Source**: Filter by API origin (Remotive, Himalayas, Jobicy, Adzuna).
  * 🌐 **Workplace**: Remote, Hybrid, On-site.
* **Instant Debounced Search**: Type any role, tech stack (Python, React, QA, SDET), or company name.
* **One-Click Quick Pills**: QA & Testing, Software Dev, DevOps & Cloud, Data & AI, Support & Ops.
* **Direct ATS Filter**: Toggle to isolate jobs hosted directly on Greenhouse, Lever, Workday, etc.
* **Modal Preview**: Read sanitized full job descriptions without leaving the portal.
* **Copy Share Link**: One-click link copying with toast notification.


---

## Zero-Server Deployment Guide ($0/Month Forever)

This repository is pre-configured to run **100% free with zero servers**:

1. **Automated Scraping (GitHub Actions)**:
   * File: [`.github/workflows/scrape_and_deploy.yml`](.github/workflows/scrape_and_deploy.yml)
   * Runs automatically every 6 hours via free GitHub Actions cron.
   * Scrapes new jobs, persists to `output/jobs.db`, and updates `dashboard/jobs_latest.json`.
   * Pushes updates back to your repo automatically.

2. **Free Hosting (GitHub Pages or Cloudflare Pages)**:
   * **GitHub Pages** (Instant):
     1. Push your repository to GitHub.
     2. In GitHub repo, go to **Settings** → **Pages**.
     3. Under *Build and deployment*, set Source to **GitHub Actions**.
     4. Done! Your dashboard will be live at `https://<your-username>.github.io/<repo-name>/`.
   * **Cloudflare Pages** (Alternative):
     1. Connect your GitHub repository to Cloudflare Pages.
     2. Set build directory to `dashboard/`.
     3. Enjoy free, lightning-fast edge CDN hosting with unlimited bandwidth!

---

## Schema Format

| Column | Description |
|---|---|
| `job_id` | Deterministic UUID5 (source + source_job_id) |
| `title` | Job title |
| `company` | Hiring company |
| `location` | City / region |
| `country` | Country name |
| `remote_type` | Remote / Hybrid / On-site |
| `employment_type` | Full-time / Part-time / Contract / Internship |
| `experience` | Experience requirement (if provided) |
| `salary` | Salary string (if provided) |
| `description` | Job description text |
| `apply_url` | Source application URL |
| `direct_apply_url` | Direct company ATS link (Greenhouse, Lever, Workday, etc.) or canonical URL |
| `source` | Source name (e.g. Remotive) |
| `source_job_id` | ID assigned by the source |
| `posted_date` | ISO date (YYYY-MM-DD) |
| `collected_date` | ISO date of collection run |
| `status` | Always `active` in V1 |

---

## Deduplication Logic

Records are deduplicated in priority order. The **first occurrence** is kept.

1. **Same source + source_job_id** (exact match after normalizing case/whitespace)
2. **Same normalized apply_url** (lowercased, trailing slash stripped)
3. **Same normalized company + title + location** (lowercased, whitespace collapsed)

> **Note:** Only exact matches trigger deduplication. Two jobs with merely *similar* titles are never merged.

---

## How to Add a New Source

1. **Check terms.** Read the API documentation and terms of service. If aggregation is explicitly permitted, proceed. If uncertain, mark as `REVIEW_REQUIRED` and do not enable.

2. **Create the connector** in `aggregator/sources/<name>.py`:
   ```python
   from aggregator.sources.base import BaseJobSource
   
   class MySource(BaseJobSource):
       def collect_jobs(self) -> list[dict]:
           # Fetch and return raw records using self._get(url, params)
           ...
   ```

3. **Register the source config** in `aggregator/config/sources.py`:
   ```python
   SourceConfig(
       name="MySource",
       api_url="https://api.mysource.com/jobs",
       permission_status="APPROVED",  # Only if explicitly verified
       enabled=True,
       notes="...",
       terms_url="https://mysource.com/terms",
       requires_api_key=False,
       rate_limit="...",
       attribution="...",
   )
   ```

4. **Add a normalizer** in `aggregator/processing/normalizer.py`:
   - Add a `_normalize_mysource(raw)` function
   - Add a dispatch case in `normalize()`

5. **Register the connector class** in `aggregator/main.py`:
   ```python
   _SOURCE_CLASSES["MySource"] = MySourceClass
   ```

6. **Write tests** in `tests/test_mysource.py` using mocked HTTP responses.

No changes to the core pipeline (normalizer/validator/deduplicator) are required.

---

## Source Compliance Policy

This system only collects from sources whose API terms **explicitly permit** this type of aggregation use.

### What we do:
- Read and document API terms for every source before enabling it.
- Only set `permission_status = "APPROVED"` when terms clearly permit aggregation.
- Respect documented rate limits. Do not retry aggressively on rate-limit responses.
- Never hard-code API credentials. Use environment variables.
- Never bypass CAPTCHA, authentication, rate limits, or anti-bot protections.
- Never use proxies to circumvent restrictions.
- Never assume a public endpoint automatically permits scraping or aggregation.

### What we do NOT do:
- Scrape websites that prohibit automated collection.
- Collect from sources marked `REVIEW_REQUIRED` or `DENIED`.
- Hard-code API keys in source code.
- Use AI/LLM to invent or fill in missing data.

### Enabled Sources

| Source | Permission | Key Required | Terms |
|---|---|---|---|
| Remotive | APPROVED | No | [Terms](https://github.com/remotive-com/remote-jobs-api) |
| Jobicy | APPROVED | No | [Terms](https://jobicy.com/jobs-rss-feed) |
| Himalayas | APPROVED | No | [Terms](https://himalayas.app/jobs/api) |
| Adzuna | APPROVED | Yes (free) | [Terms](https://developer.adzuna.com/terms) |

### Disabled Sources

| Source | Status | Reason |
|---|---|---|
| Arbeitnow | REVIEW_REQUIRED | General terms restrict to personal/non-commercial use. Contact contact@arbeitnow.com for a commercial agreement. |

---

## Running Tests

```bash
pytest tests/ -v
```

All tests use mocked HTTP responses. No real API calls are made during the test suite.

---

## Limitations (V1)

- No scheduling — run manually or via cron/task scheduler.
- No database — results are CSV files only.
- No deduplication across runs (each run is independent).
- Adzuna free tier: 250 requests/day, 2,500/month. Large country lists may exhaust this quickly.
- Remotive free tier listings are delayed by 24 hours.
- No frontend or dashboard.
- No AI-based normalization or fuzzy duplicate detection.

These are intentional V1 constraints. Later versions may introduce scheduled collection, database storage, and more advanced processing.
