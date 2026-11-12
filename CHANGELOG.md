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
| **1-Click LinkedIn Recruiter Finder**| UI / Value-Add | ✅ **DONE** | 1-Click dynamic LinkedIn People Search for hiring managers in Job Detail drawer |
| **Early Applicant Momentum Badges** | UI / Urgency | ✅ **DONE** | `⚡ Early Window (<25 applicants)` badge on listings posted within 48 hours |
| **VIP Telegram Alerts Integration** | Community / Alerts| ✅ **DONE** | Navbar button and modal join flow for instant phone alerts (`t.me/RemoteJobsHub`) |
| **B2B Recruiter Outbound Engine** | Sales / Automation| ✅ **DONE** | [`aggregator/outbound/generate_recruiter_leads.py`](aggregator/outbound/generate_recruiter_leads.py) ($49 cold pitch) |
| **Midnight Navy & Cyan Palette** | UI Aesthetic | ✅ **DONE** | Deep Midnight `#070b14`, Slate Navy `#0d1527` cards, `#111c34` hovers, Electric Cyan accents, Amber salaries/CTA |
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

### [v2.7.0] — November 12, 2026: Monetization Speed Engine, Recruiter Outbound & LinkedIn Finder
- **Candidate Speed & Urgency Reframing**:
  - Reframed `#alerts-modal` copy around the **"First 25 Applicants"** competitive advantage (*"Be in the first 25 applicants before postings saturate with 400+ resumes on LinkedIn"*).
  - Restyled alert plan tier cards in cohesive Midnight Slate Navy with high-converting CTA gradients (`⚡ Activate 3-Month Sprint Pass ($10) • Save 33%`).
  - Added VIP Telegram alerts integration (`https://t.me/RemoteJobsHub`) to top navigation and modal success state.
- **1-Click "Find Hiring Manager on LinkedIn" Helper**:
  - Injected an interactive `Find Recruiter` button inside the Job Detail Drawer (`#job-modal`).
  - Dynamically builds pre-filtered LinkedIn People Search queries targeting tech recruiters and engineering managers for that specific employer.
- **Early Applicant Momentum Badges**:
  - Added `isEarlyApplicantWindow` helper in `dashboard/app.js`.
  - Fresh listings posted within 48 hours render a glowing `⚡ Early Window (<25)` badge across list rows and rich cards.
- **Automated B2B Recruiter Outbound Engine**:
  - Built `aggregator/outbound/generate_recruiter_leads.py` CLI to extract distinct companies hiring remotely from the latest feed.
  - Automatically generates pre-formatted LinkedIn Recruiter search queries and personalized 3-sentence cold pitch emails to sell **$49 Featured Pins**.
  - Added full test suite in `tests/test_outbound.py` (5 unit tests, 100% passing).
- **Cache Invalidation**:
  - Bumped dashboard script tags to `?v=20261112_monetization_speed_v2`.

### [v2.6.1] — November 10, 2026: Fix Job Card Feed Rendering (logoUrl Scoping & TDZ Hoisting)
- **Resolved Fatal Render Loop Abort**:
  - Hoisted `const logoUrl = getCompanyLogoUrl(...)` to the outer card loop in `dashboard/app.js` so default `'card'` view mode inherits the variable cleanly, eliminating the uncaught `ReferenceError: logoUrl is not defined`.
  - Hoisted `const ROLE_PATTERNS` to top-level configuration next to `state` management, preventing Temporal Dead Zone (TDZ) access during early `init()` execution.
  - Moved the `init()` application bootstrap execution to the absolute bottom of `dashboard/app.js` after all functions and global exports are declared.
  - Bumped script cache query version to `?v=20261110_fix_jobs_render` in `dashboard/index.html` to guarantee immediate browser cache invalidation.

### [v2.6.0] — November 10, 2026: Midnight Navy & Electric Cyan High-End Modern Aesthetic
- **Option 2 Theme Redesign**:
  - Replaced pitch-black obsidian (`#09090b`/`#121215`) with Stripe/Mercury-inspired Deep Midnight Blue-Black (`#070b14`).
  - Elevated surfaces and card containers to Midnight Slate Navy (`#0d1527`) with 1px subtle borders (`border-white/[0.08]`).
  - Added subtle `#111c34` card hover lift with Electric Cyan micro-glow (`rgba(6, 182, 212, 0.16)`).
  - Swapped generic green accents with Electric Cyan (`#06b6d4`), Sky Blue (`#38bdf8`), and Royal Blue (`#2563eb`) gradients for primary CTAs, active filters, and hero typography.
  - Reserved Emerald strictly for authentic trust indicators (`Direct ATS` verified tags and `Applied` tracking badges).
  - Reserved Warm Amber/Gold (`#f59e0b`) strictly for salaries, featured badges, and the high-converting "Post a Job ($49)" recruiter button.
  - Updated both static templates (`dashboard/index.html`) and dynamic JavaScript renderers (`dashboard/app.js`) including list rows, rich cards, pagination controls, in-feed alert triggers, category badges, and quick filter chips.

### [v2.5.0] — November 10, 2026: Impeccable GSAP & Anime.js Modern UI Makeover + Real Company Logos
- **Open-Source Animation Engines (Anime.js & GSAP)**:
  - Added Anime.js v3.2.2 and GSAP v3.12.5 via Cloudflare CDN with `defer` loading for 100% free, zero-cost, high-speed micro-interactions.
  - Added hardware acceleration (`will-change: transform, opacity`) and GPU-composited CSS transitions.
  - Implemented `prefers-reduced-motion` detection to automatically respect battery-saving and accessibility modes.
- **Hardware-Accelerated Staggered Card Feed Cascade**:
  - Cards cascade into view smoothly (`anime.stagger(22ms)`) on initial load, search filtering, category selection, and pagination.
- **Live Numbers Count-Up Ticker**:
  - Live animated number ticker counting from 0 up to 16,134+ on initial page load with `easeOutExpo` curve across navbar, hero, and tracker badges.
- **Authentic Company Brand Logos**:
  - Integrated Google's free global favicon service (`https://www.google.com/s2/favicons?domain=...&sz=128`) with company domain resolution.
  - Added `loading="lazy"` and instant automatic fallback to initials gradient badge on error.
- **Elastic Spring Physics on Popups & Modals**:
  - "Post a Job ($49)", "Instant Job Alerts", and Job Detail drawer now open with fluid elastic spring physics (`scale: [0.94, 1.0]`, `translateY: [16, 0]`).

### [v2.4.0] — November 10, 2026: Job Seeker & Provider Popups + Hero Headline Display Fix
- **Hero Headline Rendering Fix**:
  - Implemented fail-safe text coloring with `text-emerald-400` as the solid fallback along with explicit WebKit gradient clipping (`[-webkit-background-clip:text] [-webkit-text-fill-color:transparent]`). Even on browsers without hardware gradient acceleration, the text renders in bright vibrant emerald without clipping or becoming invisible.
  - Ensured `block` formatting and generous line-height (`leading-normal sm:leading-snug`) so titles never overlap.
- **Job Seeker Interactive Alert Prompts**:
  - **Persistent Floating Launcher**: Added an Obsidian glassmorphism floating button in the bottom-left corner with an active pulsing indicator (`🔔 Instant Job Alerts • Free & VIP`) that launches the 3-tier Job Alert modal on click.
  - **In-Feed Sponsor / Drop Card**: Embedded a high-converting candidate alert card directly into the job stream after the 5th job to capture active searchers.
- **Job Provider (Recruiter) Feature Enhancements**:
  - Upgraded the header button to a prominent `💼 Post a Job ($49)` CTA with vector Briefcase line icon and emerald highlight.
  - Added a dedicated Employer Callout Banner above the faceted filters (`Hiring remote tech talent? Reach 16,000+ candidates • Guaranteed 30-day top pinned placement`).
  - Enabled `employerPayment` and `jobAlerts` monetization flags in `affiliates-config.js`.

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
