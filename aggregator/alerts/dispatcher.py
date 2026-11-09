"""
RemoteJobsHub - Automated Candidate Job Alert Dispatcher

Matches new direct-ATS job postings against subscriber preferences and sends
curated daily/weekly alerts via Email (Resend API or SMTP) or Telegram.

Zero third-party package dependencies: Uses standard library urllib and smtplib.
"""

import os
import sys
import io
import csv
import json
import logging
import argparse
import smtplib
import urllib.request
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AlertDispatcher")

# Role category keyword map
ROLE_KEYWORDS = {
    "qa": ["qa", "test", "quality", "sdet", "automation", "cypress", "selenium", "playwright"],
    "frontend": ["frontend", "front-end", "react", "next.js", "vue", "angular", "javascript", "typescript", "ui developer"],
    "backend": ["backend", "back-end", "node", "python", "golang", "go ", "java ", "spring", "rust", "c++", "c#", ".net"],
    "fullstack": ["fullstack", "full-stack", "full stack", "software engineer"],
    "devops": ["devops", "sre", "cloud", "aws", "kubernetes", "k8s", "docker", "terraform", "infrastructure"],
    "data": ["data engineer", "ai", "ml", "machine learning", "data scientist", "analytics", "bi developer"],
    "mobile": ["android", "ios", "flutter", "react native", "swift", "kotlin mobile"],
    "product": ["product manager", "ui/ux", "ux designer", "product design"]
}

CITY_SYNONYMS = {
    "bengaluru": ["bengaluru", "bangalore"],
    "delhi": ["delhi", "gurgaon", "gurugram", "noida", "ncr"],
    "mumbai": ["mumbai", "bombay", "navi mumbai", "thane"],
    "kochi": ["kochi", "cochin", "kerala", "trivandrum", "thiruvananthapuram"]
}


def load_jobs(json_path: str = "output/jobs_latest.json") -> List[Dict[str, Any]]:
    """Loads latest jobs list from JSON output."""
    if not os.path.exists(json_path):
        logger.warning(f"Jobs file {json_path} not found. Attempting dashboard/jobs_latest.js fallback.")
        js_path = "dashboard/jobs_latest.js"
        if os.path.exists(js_path):
            with open(js_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
                start = content.find("[")
                end = content.rfind("]")
                if start != -1 and end != -1:
                    raw_json = content[start:end+1]
                    return json.loads(raw_json)
        return []

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        if isinstance(data, dict) and "jobs" in data:
            return data["jobs"]
        if isinstance(data, list):
            return data
    return []


def load_subscribers(subscribers_file: str = "output/subscribers.json") -> List[Dict[str, Any]]:
    """
    Loads active subscribers from:
    1. Google Sheets published CSV URL (SUBSCRIBERS_SHEET_CSV_URL or GOOGLE_SHEET_CSV_URL)
    2. SUBSCRIBERS_DATA env var (JSON array)
    3. Local subscribers_file (output/subscribers.json)
    4. Fallback demo subscriber for testing.
    """
    # 1. Option 1: Live Google Sheets CSV URL
    csv_url = os.environ.get("SUBSCRIBERS_SHEET_CSV_URL") or os.environ.get("GOOGLE_SHEET_CSV_URL")
    if csv_url:
        try:
            req = urllib.request.Request(csv_url, headers={"User-Agent": "RemoteJobsHub-AlertDispatcher/1.0"})
            with urllib.request.urlopen(req, timeout=12) as response:
                raw_csv = response.read().decode("utf-8")
                reader = csv.DictReader(io.StringIO(raw_csv))
                subs = []
                for row in reader:
                    email = (row.get("Email") or row.get("email") or "").strip()
                    if not email or "@" not in email:
                        continue
                    status = (row.get("Status") or row.get("status") or "active").strip().lower()
                    if status == "unsubscribed":
                        continue
                    subs.append({
                        "email": email,
                        "roleCategory": (row.get("Role") or row.get("roleCategory") or "all").strip().lower(),
                        "location": (row.get("Scope") or row.get("location") or "worldwide").strip().lower(),
                        "keywords": (row.get("Keywords") or row.get("keywords") or "").strip(),
                        "plan": (row.get("Plan") or row.get("plan") or "free").strip().lower(),
                        "expiresAt": (row.get("ExpiresAt") or row.get("expiresAt") or "").strip(),
                        "status": status,
                        "subscribedAt": (row.get("Timestamp") or row.get("subscribedAt") or "").strip()
                    })
                if subs:
                    logger.info(f"Loaded {len(subs)} active subscribers from Google Sheet CSV.")
                    return subs
        except Exception as e:
            logger.error(f"Failed to fetch or parse subscribers from Google Sheet CSV: {e}")

    # 2. SUBSCRIBERS_DATA env var
    env_data = os.environ.get("SUBSCRIBERS_DATA")
    if env_data:
        try:
            return json.loads(env_data)
        except Exception as e:
            logger.error(f"Failed to parse SUBSCRIBERS_DATA env var: {e}")

    # 3. Local JSON file
    if os.path.exists(subscribers_file):
        with open(subscribers_file, "r", encoding="utf-8") as f:
            return json.load(f)

    # 4. Sample demo subscriber for testing/dry-runs
    return [
        {
            "email": "demo.subscriber@example.com",
            "roleCategory": "qa",
            "keywords": "automation",
            "location": "remote",
            "experience": "all",
            "plan": "vip3mo",
            "expiresAt": "2027-02-15T00:00:00Z",
            "status": "active",
            "subscribedAt": "2026-10-29T00:00:00Z"
        }
    ]


def is_subscriber_eligible(sub: Dict[str, Any], instant_mode: bool = False) -> bool:
    """
    Verifies if a subscriber is eligible for dispatch:
    - Excludes 'unsubscribed' users.
    - If plan has expired, downgrades user from VIP instant alerts to the free weekly digest.
    - If instant_mode=True, only sends to active, non-expired VIP subscribers (vip3mo, vip1mo).
    """
    if sub.get("status", "active").lower() == "unsubscribed":
        return False

    plan = (sub.get("plan") or "free").lower()
    expires_at_str = sub.get("expiresAt")
    now = datetime.now(timezone.utc)

    is_expired = False
    if expires_at_str:
        try:
            exp_dt = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if now > exp_dt:
                is_expired = True
        except Exception:
            pass

    if instant_mode:
        if is_expired:
            logger.debug(f"Subscriber {sub.get('email')} expired on {expires_at_str}. Skipping instant alert.")
            return False
        return plan in ("vip1mo", "vip3mo", "vip_pro")

    # Weekly digest is available to all non-unsubscribed users
    return True


def matches_subscriber(job: Dict[str, Any], sub: Dict[str, Any]) -> bool:
    """Evaluates whether a job matches a subscriber's alert preferences."""
    title = (job.get("title") or "").lower()
    desc = (job.get("description") or "").lower()
    location = (job.get("location") or "").lower()
    target_category = sub.get("roleCategory", "all").lower()
    user_keywords = (sub.get("keywords") or "").lower().strip()
    target_location = sub.get("location", "any").lower().strip()

    # 1. Role category filter
    if target_category != "all" and target_category in ROLE_KEYWORDS:
        keywords = ROLE_KEYWORDS[target_category]
        if not any(kw in title for kw in keywords):
            return False

    # 2. Custom user keywords
    if user_keywords:
        kw_list = [k.strip() for k in user_keywords.split(",") if k.strip()]
        if kw_list and not any(kw in title or kw in desc for kw in kw_list):
            return False

    # 3. Location / Remote Scope filter
    if target_location not in ("any", "all"):
        remote_scope = (job.get("remote_scope") or "").lower()
        if target_location == "worldwide":
            if remote_scope != "worldwide" and "worldwide" not in location and "anywhere" not in location and not job.get("is_remote"):
                return False
        elif target_location == "americas":
            if "americas" not in remote_scope and "us" not in location and "united states" not in location and "canada" not in location:
                return False
        elif target_location == "europe":
            if "europe" not in remote_scope and "emea" not in remote_scope and "uk" not in location and "europe" not in location:
                return False
        elif target_location == "apac":
            if "apac" not in remote_scope and "asia" not in location and "india" not in location:
                return False
        elif target_location == "remote":
            if not job.get("is_remote") and "remote" not in location:
                return False
        else:
            synonyms = CITY_SYNONYMS.get(target_location, [target_location])
            if not any(city in location for city in synonyms) and "remote" not in location:
                return False

    return True


def render_email_html(subscriber: Dict[str, Any], matched_jobs: List[Dict[str, Any]]) -> str:
    """Renders a responsive, modern HTML email template with direct ATS CTA buttons."""
    jobs_cards_html = ""
    for j in matched_jobs[:10]:  # Top 10 matches
        title = j.get("title", "Software Role")
        company = j.get("company", "Verified Employer")
        location = j.get("location", "India / Remote")
        apply_url = j.get("direct_apply_url") or j.get("apply_url", "https://ajaypau123.github.io/RemoteJobsHub/")
        ats_source = j.get("source", "Direct ATS")
        
        jobs_cards_html += f"""
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="font-size: 11px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            🎯 {ats_source}
          </div>
          <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.3;">
            {title}
          </h3>
          <div style="font-size: 13px; color: #475569; margin-bottom: 14px;">
            <strong style="color: #1e293b;">{company}</strong> • 📍 {location}
          </div>
          <div>
            <a href="{apply_url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #4f46e5); color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 8px 18px; border-radius: 8px;">
              Apply Directly on ATS ↗
            </a>
          </div>
        </div>
        """

    sub_category = subscriber.get("roleCategory", "Tech").upper()

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Direct ATS Job Drops</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #334155;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); color: #ffffff; padding: 28px 24px; text-align: center;">
          <div style="font-size: 28px; margin-bottom: 4px;">🎯</div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">RemoteJobsHub Alerts</h1>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #cbd5e1;">
            Curated Direct-to-ATS Tech Openings • Zero Consultancies
          </p>
        </div>

        <!-- Alert Notification Bar -->
        <div style="background-color: #fef3c7; border-bottom: 1px solid #fde68a; padding: 12px 24px; font-size: 12px; color: #92400e; font-weight: 600;">
          ⚡ {len(matched_jobs)} new roles matched your {sub_category} profile today!
        </div>

        <!-- Main Body -->
        <div style="padding: 24px; background-color: #f8fafc;">
          {jobs_cards_html}

          <!-- View All Jobs CTA -->
          <div style="text-align: center; margin-top: 24px;">
            <a href="https://ajaypau123.github.io/RemoteJobsHub/" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 10px;">
              Browse All Verified Remote Tech Jobs ➔
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #ffffff; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
          <p style="margin: 0 0 6px 0;">You received this email because you subscribed to Job Alerts on RemoteJobsHub.</p>
          <p style="margin: 0;">100% Direct Company Applications. Zero spam.</p>
        </div>

      </div>
    </body>
    </html>
    """
    return html


def send_via_resend(api_key: str, to_email: str, subject: str, html_body: str, from_email: str = "RemoteJobsHub Alerts <alerts@remotejobshub.com>") -> bool:
    """Sends email via Resend REST API (Zero 3rd party libs)."""
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html_body
    }

    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status in (200, 201):
                logger.info(f"Successfully dispatched alert to {to_email} via Resend")
                return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email} via Resend: {e}")
    return False


def send_via_smtp(to_email: str, subject: str, html_body: str) -> bool:
    """Sends email via SMTP (Brevo, Gmail SMTP, or Amazon SES)."""
    smtp_host = os.environ.get("SMTP_HOST", "smtp-relay.brevo.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    sender_email = os.environ.get("SENDER_EMAIL", "alerts@remotejobshub.com")

    if not smtp_user or not smtp_pass:
        logger.warning("SMTP credentials not provided in environment.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender_email
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(sender_email, [to_email], msg.as_string())
        server.quit()
        logger.info(f"Successfully sent email to {to_email} via SMTP")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email} via SMTP: {e}")
        return False


def run_alert_dispatch(dry_run: bool = False, limit_subscribers: int = 50, instant_mode: bool = False) -> Dict[str, Any]:
    """Runs the alert matching and dispatch pipeline."""
    jobs = load_jobs()
    all_subscribers = load_subscribers()
    subscribers = [s for s in all_subscribers if is_subscriber_eligible(s, instant_mode=instant_mode)]

    logger.info(f"Loaded {len(jobs)} jobs and {len(subscribers)} eligible subscribers (instant_mode={instant_mode}).")
    resend_key = os.environ.get("RESEND_API_KEY")

    dispatched = 0
    matched_total = 0

    for sub in subscribers[:limit_subscribers]:
        matched = [j for j in jobs if matches_subscriber(j, sub)]
        if not matched:
            logger.info(f"No matching roles today for {sub.get('email')}")
            continue

        matched_total += len(matched)
        mode_prefix = "⚡ Instant Alert:" if instant_mode else "🎯 Monday Digest:"
        subject = f"{mode_prefix} {len(matched)} New {sub.get('roleCategory', 'Tech').upper()} Jobs Open for Direct Apply"
        html = render_email_html(sub, matched)

        if dry_run:
            logger.info(f"[DRY-RUN] Would send alert to {sub.get('email')} with {len(matched)} matched jobs.")
            logger.info(f"[DRY-RUN] Subject: {subject}")
            dispatched += 1
        elif resend_key:
            if send_via_resend(resend_key, sub.get("email"), subject, html):
                dispatched += 1
        else:
            if send_via_smtp(sub.get("email"), subject, html):
                dispatched += 1

    summary = {
        "total_jobs": len(jobs),
        "subscribers_processed": len(subscribers[:limit_subscribers]),
        "matched_jobs_total": matched_total,
        "alerts_dispatched": dispatched,
        "mode": "dry_run" if dry_run else "live",
        "instant_mode": instant_mode,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    logger.info(f"Dispatch summary: {summary}")
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Dispatch tech job alerts to subscribers")
    parser.add_argument("--dry-run", action="store_true", help="Preview matches without sending actual emails")
    parser.add_argument("--instant", action="store_true", help="Run in VIP instant alert mode (skips weekly-only subscribers and expired passes)")
    args = parser.parse_args()

    run_alert_dispatch(dry_run=args.dry_run, instant_mode=args.instant)
