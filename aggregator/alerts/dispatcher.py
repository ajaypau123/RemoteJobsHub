"""
TechJobsForIndia - Automated Candidate Job Alert Dispatcher

Matches new direct-ATS job postings against subscriber preferences and sends
curated daily/weekly alerts via Email (Resend API or SMTP) or Telegram.

Zero third-party package dependencies: Uses standard library urllib and smtplib.
"""

import os
import sys
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
                # strip window.ALL_JOBS = [ ... ];
                if "=" in content:
                    raw_json = content.split("=", 1)[1].strip().rstrip(";")
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
    Loads active subscribers from JSON file or SUBSCRIBERS_DATA env var.
    """
    env_data = os.environ.get("SUBSCRIBERS_DATA")
    if env_data:
        try:
            return json.loads(env_data)
        except Exception as e:
            logger.error(f"Failed to parse SUBSCRIBERS_DATA env var: {e}")

    if os.path.exists(subscribers_file):
        with open(subscribers_file, "r", encoding="utf-8") as f:
            return json.load(f)

    # Sample demo subscriber for testing/dry-runs
    return [
        {
            "email": "demo.subscriber@example.com",
            "roleCategory": "qa",
            "keywords": "automation",
            "location": "remote",
            "experience": "all",
            "plan": "vip3mo",
            "subscribedAt": "2026-10-29T00:00:00Z"
        }
    ]


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

    # 3. Location filter
    if target_location != "any":
        if target_location == "remote":
            if "remote" not in location:
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
        apply_url = j.get("direct_apply_url") or j.get("apply_url", "https://techjobsforindia.com")
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
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">JobsForIndia Alerts</h1>
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
            <a href="https://techjobsforindia.com" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 10px;">
              Browse All 3,300+ Verified Tech Jobs ➔
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #ffffff; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
          <p style="margin: 0 0 6px 0;">You received this email because you subscribed to VIP Job Alerts on JobsForIndia.</p>
          <p style="margin: 0;">100% Direct Company Applications. Zero spam.</p>
        </div>

      </div>
    </body>
    </html>
    """
    return html


def send_via_resend(api_key: str, to_email: str, subject: str, html_body: str, from_email: str = "JobsForIndia Alerts <alerts@techjobsforindia.com>") -> bool:
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
    sender_email = os.environ.get("SENDER_EMAIL", "alerts@techjobsforindia.com")

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


def run_alert_dispatch(dry_run: bool = False, limit_subscribers: int = 50) -> Dict[str, Any]:
    """Runs the alert matching and dispatch pipeline."""
    jobs = load_jobs()
    subscribers = load_subscribers()

    logger.info(f"Loaded {len(jobs)} jobs and {len(subscribers)} subscribers.")
    resend_key = os.environ.get("RESEND_API_KEY")

    dispatched = 0
    matched_total = 0

    for sub in subscribers[:limit_subscribers]:
        matched = [j for j in jobs if matches_subscriber(j, sub)]
        if not matched:
            logger.info(f"No matching roles today for {sub.get('email')}")
            continue

        matched_total += len(matched)
        subject = f"🎯 {len(matched)} New {sub.get('roleCategory', 'Tech').upper()} Jobs Open for Direct Apply"
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
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    logger.info(f"Dispatch summary: {summary}")
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Dispatch tech job alerts to subscribers")
    parser.add_argument("--dry-run", action="store_true", help="Preview matches without sending actual emails")
    args = parser.parse_args()

    run_alert_dispatch(dry_run=args.dry_run)
