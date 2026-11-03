"""Job Aggregator V1 — main entry point.

Run with:
    python -m aggregator.main

Or from the project root:
    python aggregator/main.py
"""

import argparse
import logging
import os
import sys
from datetime import datetime

import pandas as pd
from dotenv import load_dotenv

from aggregator.config.sources import SOURCES, SourceConfig
from aggregator.db import save_jobs_to_db, get_active_jobs_from_db
from aggregator.processing.deduplicator import deduplicate
from aggregator.processing.filter import filter_jobs
from aggregator.processing.normalizer import normalize
from aggregator.processing.resolver import resolve_job_urls
from aggregator.processing.validator import validate
from aggregator.sources.arbeitnow import ArbeitnowSource
from aggregator.sources.adzuna import AdzunaSource
from aggregator.sources.remotive import RemotiveSource
from aggregator.sources.jobicy import JobicySource
from aggregator.sources.himalayas import HimalayasSource
from aggregator.sources.remoteok import RemoteOKSource
from aggregator.sources.ats import CompanyATSSource
from aggregator.sources.weworkremotely import WeWorkRemotelySource
from aggregator.sources.jobspresso import JobspressoSource
from aggregator.sources.amazon import AmazonSource
from aggregator.sources.workday import WorkdaySource
from aggregator.sources.base import BaseJobSource, SourceError

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.WARNING,
    format="%(levelname)s  %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

load_dotenv()

# Reconfigure stdout for UTF-8 / safe fallback on Windows console
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ── CSV schema column order ───────────────────────────────────────────────────
CSV_COLUMNS = [
    "job_id", "title", "company", "location", "country",
    "remote_type", "employment_type", "experience", "salary",
    "description", "apply_url", "direct_apply_url", "source", "source_job_id",
    "posted_date", "collected_date", "status",
]

# ── Source connector registry ─────────────────────────────────────────────────
# To add a new source:
#   1. Create aggregator/sources/<name>.py with a class extending BaseJobSource
#   2. Add a SourceConfig entry in aggregator/config/sources.py
#   3. Add the source name → class mapping here
_SOURCE_CLASSES: dict[str, type[BaseJobSource]] = {
    "Arbeitnow": ArbeitnowSource,
    "Adzuna": AdzunaSource,
    "Remotive": RemotiveSource,
    "Jobicy": JobicySource,
    "Himalayas": HimalayasSource,
    "RemoteOK": RemoteOKSource,
    "CompanyATS": CompanyATSSource,
    "WeWorkRemotely": WeWorkRemotelySource,
    "Jobspresso": JobspressoSource,
    "Amazon": AmazonSource,
    "Workday": WorkdaySource,
}


# ──────────────────────────────────────────────────────────────────────────────
# Terminal output helpers
# ──────────────────────────────────────────────────────────────────────────────

def _print_header() -> None:
    print()
    print("+--------------------------------------+")
    print("|          Job Aggregator V1           |")
    print("+--------------------------------------+")
    print()


def _print_source_start(config: SourceConfig) -> None:
    print(f"  Source     : {config.name}")
    print(f"  Permission : {config.permission_status}")
    print(f"  Collecting ...")


def _print_source_result(name: str, count: int) -> None:
    print(f"  Jobs received: {count}")
    print()


def _print_source_error(name: str, error: str) -> None:
    # Never expose API secrets in error messages
    print(f"  [ERROR] {error}")
    print()


def _print_skipped_source(config: SourceConfig) -> None:
    print(f"  Source     : {config.name}")
    print(f"  Permission : {config.permission_status}  [SKIPPED]")
    print()


def _print_summary(
    total_collected: int,
    valid_count: int,
    invalid_count: int,
    duplicates_removed: int,
    final_count: int,
    csv_path: str,
    filter_label: str | None = None,
    unfiltered_count: int | None = None,
) -> None:
    width = 40
    print("-" * width)
    print("  Processing")
    print("-" * width)
    print(f"  Total collected    : {total_collected:>6}")
    print(f"  Valid jobs         : {valid_count:>6}")
    print(f"  Invalid jobs       : {invalid_count:>6}")
    print(f"  Duplicates removed : {duplicates_removed:>6}")
    if filter_label and unfiltered_count is not None:
        print(f"  Before filter      : {unfiltered_count:>6}")
        print(f"  Filter criteria    : {filter_label}")
    print(f"  Final jobs         : {final_count:>6}")
    print()
    if final_count > 0:
        print(f"  [OK] CSV created: {csv_path}")
    else:
        print("  [!] No jobs to export matching criteria.")
    print()


# ──────────────────────────────────────────────────────────────────────────────
# Pipeline
# ──────────────────────────────────────────────────────────────────────────────

def run(
    role: str | None = None,
    exp: int | None = None,
    india_eligible: bool = False,
    export_json: bool = True,
) -> str | None:
    """Execute the full collection → normalize → validate → deduplicate → (optional filter) → CSV/JSON pipeline."""
    _print_header()

    all_raw: list[tuple[dict, str]] = []  # (raw_record, source_name)
    source_stats: list[dict] = []

    # ── 1. Collect from each enabled + approved source ────────────────────────
    for config in SOURCES:
        if not config.is_usable():
            _print_skipped_source(config)
            source_stats.append({
                "source": config.name,
                "status": "skipped",
                "collected": 0,
                "error": None,
            })
            continue

        _print_source_start(config)
        connector_class = _SOURCE_CLASSES.get(config.name)

        if connector_class is None:
            msg = f"No connector class registered for source '{config.name}'."
            _print_source_error(config.name, msg)
            logger.error(msg)
            source_stats.append({
                "source": config.name,
                "status": "error",
                "collected": 0,
                "error": msg,
            })
            continue

        try:
            connector = connector_class(config)
            raw_jobs = connector.collect_jobs()
            _print_source_result(config.name, len(raw_jobs))
            for job in raw_jobs:
                all_raw.append((job, config.name))
            source_stats.append({
                "source": config.name,
                "status": "ok",
                "collected": len(raw_jobs),
                "error": None,
            })
        except SourceError as exc:
            # One failed source must not stop the pipeline
            safe_msg = _sanitize_error(str(exc))
            _print_source_error(config.name, safe_msg)
            logger.error("[%s] Source error: %s", config.name, exc)
            source_stats.append({
                "source": config.name,
                "status": "error",
                "collected": 0,
                "error": safe_msg,
            })
        except Exception as exc:  # noqa: BLE001
            safe_msg = _sanitize_error(f"Unexpected error: {type(exc).__name__}: {exc}")
            _print_source_error(config.name, safe_msg)
            logger.exception("[%s] Unexpected error.", config.name)
            source_stats.append({
                "source": config.name,
                "status": "error",
                "collected": 0,
                "error": safe_msg,
            })

    total_collected = len(all_raw)

    # ── 2. Normalize ──────────────────────────────────────────────────────────
    normalized: list[dict] = []
    for raw, source_name in all_raw:
        try:
            job = normalize(raw, source_name)
            normalized.append(job)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Normalization failed for a %s record: %s", source_name, exc)

    # ── 3. Validate ───────────────────────────────────────────────────────────
    valid_jobs: list[dict] = []
    rejection_reasons: list[str] = []

    for job in normalized:
        ok, reason = validate(job)
        if ok:
            valid_jobs.append(job)
        else:
            rejection_reasons.append(reason or "unknown")

    invalid_count = len(rejection_reasons)

    # ── 4. Deduplicate ────────────────────────────────────────────────────────
    unique_jobs, duplicates_removed = deduplicate(valid_jobs)
    unfiltered_count = len(unique_jobs)

    # ── 4a. Resolve Direct ATS Apply URLs & Tag India Eligibility ─────────────
    from aggregator.processing.filter import is_india_eligible as check_india
    for j in unique_jobs:
        j["is_india_eligible"] = check_india(j)

    unique_jobs = [resolve_job_urls(j) for j in unique_jobs]
    full_dataset = list(unique_jobs)

    # ── 4b. Optional Filter (Role / Experience / India Eligibility) ───────────
    filter_label = None
    filter_slug = ""
    export_jobs = list(unique_jobs)
    if role or exp is not None or india_eligible:
        parts = []
        if role:
            parts.append(f"role={role.upper()}")
            filter_slug += f"_{role.lower()}"
        if exp is not None:
            parts.append(f"exp={exp}yr")
            filter_slug += f"_{exp}yr"
        if india_eligible:
            parts.append("eligible=India")
            filter_slug += "_india"
        filter_label = ", ".join(parts)
        export_jobs = filter_jobs(
            export_jobs,
            role=role,
            exp_years=exp,
            india_eligible=india_eligible,
        )

    final_count = len(export_jobs)

    # ── 5. Persist to SQLite & Export CSV/JSON ────────────────────────────────
    timestamp = datetime.now().strftime("%Y_%m_%d_%H-%M-%S")
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)
    csv_filename = f"jobs{filter_slug}_{timestamp}.csv"
    csv_path = os.path.join(output_dir, csv_filename)

    if export_jobs:
        # Save permanently to SQLite database
        db_path = os.path.join(output_dir, "jobs.db")
        try:
            save_jobs_to_db(full_dataset, db_path=db_path)
        except Exception as exc:
            logger.warning("Failed saving to SQLite: %s", exc)

        # Retrieve cumulative active dataset from SQLite so jobs across runs accumulate and never disappear
        try:
            cumulative_dataset = get_active_jobs_from_db(db_path=db_path)
            if not cumulative_dataset:
                cumulative_dataset = full_dataset
            else:
                for cj in cumulative_dataset:
                    cj["is_india_eligible"] = check_india(cj)
        except Exception as exc:
            logger.warning("Failed reading cumulative jobs from SQLite: %s", exc)
            cumulative_dataset = full_dataset

        df = pd.DataFrame(export_jobs)
        # Ensure all columns are present in the correct order
        for col in CSV_COLUMNS:
            if col not in df.columns:
                df[col] = None
        df = df[CSV_COLUMNS]
        # UTF-8 with BOM for Excel/Google Sheets compatibility
        df.to_csv(csv_path, index=False, encoding="utf-8-sig")

        # Export JSON for the web dashboard (cumulative dataset with is_india_eligible flag)
        if export_json:
            import json
            import re
            import html

            def _clean_str(s: str | None) -> str:
                if not s:
                    return ""
                s = html.unescape(s)
                if any(c in s for c in ("\u00e2", "\u00f0", "\u00c3")):
                    try:
                        fixed = s.encode("latin-1", errors="ignore").decode("utf-8", errors="ignore")
                        if fixed and len(fixed) >= len(s) * 0.7:
                            s = fixed
                    except Exception:
                        pass
                return s

            def _to_lightweight(j: dict) -> dict:
                c = dict(j)
                c["title"] = _clean_str(c.get("title"))
                c["company"] = _clean_str(c.get("company"))
                c["location"] = _clean_str(c.get("location"))
                desc = _clean_str(c.get("description"))
                text = re.sub(r"<[^>]+>", " ", desc)
                text = re.sub(r"\s+", " ", text).strip()
                if len(text) > 600:
                    c["description"] = text[:600] + "... [Click 'Apply on Official Site' for full requirements]"
                else:
                    c["description"] = text
                return c

            json_filename = f"jobs{filter_slug}_{timestamp}.json"
            json_path = os.path.join(output_dir, json_filename)
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(export_jobs, f, indent=2, ensure_ascii=False)
            latest_json = os.path.join(output_dir, "jobs_latest.json")
            with open(latest_json, "w", encoding="utf-8") as f:
                json.dump(cumulative_dataset, f, indent=2, ensure_ascii=False)
            dashboard_dir = os.path.join(os.path.dirname(output_dir), "dashboard")
            if os.path.isdir(dashboard_dir):
                # Prepare high-performance lightweight dataset for the browser
                if india_eligible:
                    dash_jobs = [
                        _to_lightweight(j)
                        for j in cumulative_dataset
                        if j.get("is_india_eligible") is not False
                    ]
                else:
                    dash_jobs = [_to_lightweight(j) for j in cumulative_dataset]

                dash_json = os.path.join(dashboard_dir, "jobs_latest.json")
                with open(dash_json, "w", encoding="utf-8") as f:
                    json.dump(dash_jobs, f, indent=2, ensure_ascii=False)
                dash_js = os.path.join(dashboard_dir, "jobs_latest.js")
                clean_js = (
                    json.dumps(dash_jobs, ensure_ascii=False)
                    .replace("\u2028", "\\u2028")
                    .replace("\u2029", "\\u2029")
                )
                with open(dash_js, "w", encoding="utf-8") as f:
                    f.write(f"window.JOBS_DATA = {clean_js};\n")

    # ── 6. Terminal summary ───────────────────────────────────────────────────
    _print_summary(
        total_collected=total_collected,
        valid_count=len(valid_jobs),
        invalid_count=invalid_count,
        duplicates_removed=duplicates_removed,
        final_count=final_count,
        csv_path=csv_path,
        filter_label=filter_label,
        unfiltered_count=unfiltered_count if filter_label else None,
    )

    # Show rejection breakdown if there were any
    if rejection_reasons:
        from collections import Counter
        counts = Counter(rejection_reasons)
        print("  Rejection breakdown:")
        for reason, count in counts.most_common():
            print(f"    {count:>5}  {reason}")
        print()

    return csv_path if final_count > 0 else None


def _sanitize_error(msg: str) -> str:
    """Remove potential secrets from error messages before printing to terminal."""
    import re
    # Redact anything that looks like an API key or credential value
    msg = re.sub(r"(app_id|app_key|api_key|token|secret)=[^\s&]+", r"\1=***", msg, flags=re.IGNORECASE)
    return msg


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Job Aggregator V1 — aggregate, clean, filter, and export job postings."
    )
    parser.add_argument(
        "--role",
        type=str,
        default=None,
        help="Filter jobs by role/title (e.g. qa, python, frontend)",
    )
    parser.add_argument(
        "--exp",
        type=int,
        default=None,
        help="Filter jobs requiring ~N years of experience (e.g. 2)",
    )
    parser.add_argument(
        "--india",
        action="store_true",
        help="Filter for jobs eligible for candidates in India (India-based + global remote)",
    )
    parser.add_argument(
        "--test-qa-2yr",
        action="store_true",
        help="Convenience testing preset: filter for QA jobs with ~2 years experience",
    )
    parser.add_argument(
        "--no-json",
        action="store_true",
        help="Skip exporting output/jobs.json",
    )
    args = parser.parse_args()

    target_role = "qa" if args.test_qa_2yr else args.role
    target_exp = 2 if args.test_qa_2yr else args.exp

    run(
        role=target_role,
        exp=target_exp,
        india_eligible=args.india,
        export_json=not args.no_json,
    )


