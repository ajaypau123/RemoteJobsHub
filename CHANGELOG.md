# 📜 RemoteJobsHub — Engineering & Product Changelog

This document tracks all **UI, API, backend, and monetization changes** implemented in RemoteJobsHub, along with the current production readiness status and pending items.

---

## 🚦 Production Status Summary

- **Live Application URL:** [https://ajaypau123.github.io/RemoteJobsHub/](https://ajaypau123.github.io/RemoteJobsHub/)
- **Repository Branch:** `main` (clean, fully synced)
- **Deployment Mode:** Automated GitHub Pages via GitHub Actions ($0/month serverless)
- **Overall Completion:** **95% Code Complete** (only 3 external user credentials pending)

---

## 📊 Feature Status Matrix (Implemented vs. Pending)

| Feature / Module | Category | Status | Details / Location |
| :--- | :--- | :--- | :--- |
| **Linear / Vercel Modern Dark UI** | UI Aesthetic | ✅ **DONE** | Obsidian Charcoal (`#09090b`/`#121215`), 1px micro-borders, Electric Emerald accents |
| **Monochrome Vector SVG Icons** | UI / Icons | ✅ **DONE** | Replaced all OS emojis with sharp 16-20px Lucide-style inline SVGs across all cards & modals |
| **JetBrains Mono Metadata Tags** | Typography | ✅ **DONE** | Monospace typography for salaries, scopes, dates, ATS provider, and skill pills |
| **Global `Cmd+K` / `Ctrl+K` Palette** | UX / Shortcut | ✅ **DONE** | Keyboard-first search jump and smooth focus navigation with `Escape` modal dismissal |
| **Unified Filter Toolbar Search** | UI | ✅ **DONE** | Single prominent search bar with Scope pills inside filter toolbar |
| **Hero Promo Showcase Card** | UI / Monetization | ✅ **DONE** | Converts visitors to VIP Alerts ($5-$10) & Post a Job ($49) |
| **15 Tech Role Category Pills** | UI / Filtering | ✅ **DONE** | Sharp vector line icons for Eng, AI, DevOps, QA, Product, Data, Design, etc. with counts |
| **3-Tier Job Alert Modal** | UI / Monetization | ✅ **DONE** | Free ($0), 1-Mo VIP ($5), 3-Mo Sprint Pass ($10 • 33% OFF) in Obsidian glassmorphism |
| **Recruiter Post a Job Modal** | UI / Monetization | ✅ **DONE** | $49 for 30-day pin with modern form inputs, preview, and instant checkout hook |
| **ATS Resume Checker Card** | UI / Referral | ✅ **DONE** | High-converting pre-apply card in Job Detail modal ($15-$35/sale) |
| **Personal Job Tracker** | UI / LocalStorage | ✅ **DONE** | Saved Jobs & Applied Tracker with floating confirmation toast |
| **Privacy Policy Page** | Legal / Compliance | ✅ **DONE** | [`dashboard/privacy.html`](dashboard/privacy.html) (GDPR & CCPA compliant) |
| **Terms of Service Page** | Legal / Compliance | ✅ **DONE** | [`dashboard/terms.html`](dashboard/terms.html) (Fair use, takedown procedure) |
| **SEO: robots.txt & sitemap.xml**| SEO | ✅ **DONE** | [`dashboard/robots.txt`](dashboard/robots.txt), [`sitemap.xml`](dashboard/sitemap.xml) |
| **Stripe Redirection Hooks** | Monetization | ✅ **DONE** | Auto-redirects paid subscribers & recruiters to Stripe Checkout |
| **Google Sheets Webhook Script** | Backend / Database | ✅ **DONE** | [`docs/google_sheets_setup.md`](docs/google_sheets_setup.md) |
| **Expiration & Downgrade Logic** | Backend / Dispatch | ✅ **DONE** | Checks 30/90-day expiry; downgrades to free digest in [`dispatcher.py`](aggregator/alerts/dispatcher.py) |
| **Automated 6-Hour Scraper Cron**| Backend / CI/CD | ✅ **DONE** | [`.github/workflows/scrape_and_deploy.yml`](.github/workflows/scrape_and_deploy.yml) |
| **Stripe Payment Links** | External Setup | ⏳ **PENDING USER** | User needs to create $5, $10, and $49 links in Stripe Dashboard |
| **Google Sheet Web App Deploy** | External Setup | ⏳ **PENDING USER** | User needs to click "Deploy as Web App" in Google Sheets |
| **Resend.com Email API Key** | External Setup | ⏳ **PENDING USER** | Add `RESEND_API_KEY` to GitHub Repo Secrets |

---

## 📅 Detailed Chronological Release History

### [v2.3.0] — November 10, 2026: Modern Linear & Vercel Developer UI Makeover
- **Elite Dark Mode Obsidian Palette:**
  - Transitioned the entire dashboard canvas from generic slate (`#020617`/`#0f172a`) to obsidian charcoal (`#09090b` for background, `#121215` for cards/surfaces, and `#18181d` for inputs/modals).
  - Implemented 1px micro-borders (`border-white/[0.08]`) with subtle `hover:border-emerald-500/40` transitions.
  - Retained a single high-contrast accent: Electric Emerald (`#10b981` / `#34d399`).
- **Monochrome Vector SVG Icons (Lucide Style):**
  - Replaced colored OS emojis across the entire UI with crisp inline SVG vector icons:
    - Navigation: Geometric globe logo, Star/Bookmark, Applied check, Bell, Plus, Search command pill.
    - 15 Role Domains: Clean line icons for Engineering (Code), AI/ML (Spark), DevOps (Cloud), QA (Sliders), Data (Bar chart), Product (Rocket), Design (Palette), Mobile (Smartphone), Security (Shield), Marketing (Megaphone), Support (Headphones), etc.
    - Job Cards & Modals: Sleek SVGs for experience, seniority ownership, geographic scope, compensation, direct ATS verification, and bookmarking.
- **Developer Monospace Typography (JetBrains Mono):**
  - Formatted technical metadata (salaries, remote geographic scopes, relative posted dates, ATS source tags, company applicant counters) with `font-mono text-[11px]` for a precision developer feel.
- **Global `Cmd+K` / `Ctrl+K` Command Palette Navigation:**
  - Added native keyboard listener: pressing `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux) smoothly scrolls and focuses the search bar from anywhere on the page.
  - Added `Escape` handler to close active modals or blur the search input.
- **Cache Invalidation:**
  - Bumped dashboard script tags to `?v=20261110_modern_linear_ui`.

### [v2.2.0] — November 9, 2026: Production Release Pack & Monetization Engine
- **Legal Compliance:**
  - Created [`dashboard/privacy.html`](dashboard/privacy.html) covering minimal data collection, zero spam policy, 1-click unsubscribe, and GDPR rights.
  - Created [`dashboard/terms.html`](dashboard/terms.html) covering aggregator fair use, non-affiliation disclaimer, and official employer DMCA takedown procedure.
  - Added footer links to Privacy and Terms in [`dashboard/index.html`](dashboard/index.html).
- **SEO & Search Indexing:**
  - Added [`dashboard/robots.txt`](dashboard/robots.txt) allowing search engine crawlers.
  - Added [`dashboard/sitemap.xml`](dashboard/sitemap.xml) for Google & Bing indexing.
- **Affiliate & Referral Monetization:**
  - Injected high-converting **ATS Resume Matcher Card** into the Job Details modal before candidates click Apply.
  - Connected [`dashboard/affiliates-config.js`](dashboard/affiliates-config.js) to dynamic modal buttons.
- **Payment & Checkout:**
  - Added `STRIPE_CHECKOUT_LINKS` hooks in [`dashboard/app.js`](dashboard/app.js) to automatically redirect paid subscribers ($5 / $10) and recruiters ($49) to Stripe Checkout.
- **Automated Alerts CI:**
  - Added `SUBSCRIBERS_SHEET_CSV_URL` to [`.github/workflows/scrape_and_deploy.yml`](.github/workflows/scrape_and_deploy.yml).

---

### [v2.1.0] — November 9, 2026: Clean Single Search & 3-Tier Pricing Model
- **UI Architecture:**
  - Removed duplicate search bar from Hero section to eliminate visual clutter.
  - Placed single unified search bar directly inside the Filter Toolbar with quick category chips.
  - Converted Hero section into a high-converting **Hero Showcase Promotion Card** highlighting VIP alerts and Post a Job.
- **Candidate Alert Tiers:**
  - Implemented 3-tier pricing:
    1. **Free Digest ($0)** — Curated top 20 remote jobs every Monday.
    2. **1-Month VIP ($5/mo)** — Instant direct-ATS alerts.
    3. **3-Month Sprint Pass ($10 one-time • Save 33%)** — 90-day coverage, checked by default.
- **Backend Alert Dispatcher:**
  - Added live Google Sheet CSV sync to [`aggregator/alerts/dispatcher.py`](aggregator/alerts/dispatcher.py).
  - Implemented automatic expiration check: expires passes after 90 days and downgrades them to the free Monday digest.

---

### [v2.0.0] — November 9, 2026: Candidate Alerts & Recruiter Monetization Modals
- **Candidate Job Alerts Modal:**
  - Added `#alerts-modal` with role, location scope, keyword preferences, and email capture.
  - LocalStorage persistence under `rjh_alert_subscribers`.
- **Recruiter Post a Job Modal ($49):**
  - Added `#post-job-modal` allowing employers to publish a featured job listing.
  - Pinned job cards display a distinct ⭐ Featured golden badge at the top of the feed.

---

### [v1.9.0] — November 9, 2026: Faceted Filter Toolbar & Title Only Search
- **Search Precision:**
  - Added **"Job Title / Profession Only"** toggle to eliminate broad keyword false positives.
  - Added quick scope filter buttons (`All Worldwide`, `Americas`, `Europe`, `APAC`).
- **Live Search Header Badge:**
  - Displays dynamic count of available remote positions in real time.

---

### [v1.8.0] — November 6, 2026: Multi-Domain Role Expansion
- **Domain Expansion:**
  - Scaled job board from software engineering only to **15 distinct tech domains**:
    `Engineering`, `Sales & BD`, `AI & ML`, `Marketing`, `HR & Finance`, `DevOps`, `Operations`, `Support`, `Data`, `Product`, `Design`, `Mobile`, `QA`, and `Other Roles`.
  - Added keyword classification taxonomy in `aggregator/config/exclusions.py`.

---

### [v1.7.0] — November 4, 2026: Production Scraper & Zero-Cost CI/CD
- **Automated Pipeline:**
  - Created `.github/workflows/scrape_and_deploy.yml` running every 6 hours via GitHub Actions.
  - Automatic link validation and 404 dead link pruning via `aggregator/processing/link_validator.py`.
  - Built-in SQLite job archive database (`output/jobs.db`).

---

## 🎯 Next Steps Checklist for Public Release

- [ ] **1. Stripe Payment Links:** Create \$5, \$10, and \$49 links in [Stripe Dashboard](https://dashboard.stripe.com/payment-links) and paste URLs into `dashboard/app.js`.
- [ ] **2. Google Sheets Webhook:** Follow [`docs/google_sheets_setup.md`](docs/google_sheets_setup.md) to deploy your Web App URL.
- [ ] **3. Resend.com API Key:** Add `RESEND_API_KEY` to GitHub Repository Secrets for live email dispatch.
- [ ] **4. Google Analytics 4:** Replace `'G-XXXXXXXXXX'` in `dashboard/index.html` with your real GA4 Measurement ID.
