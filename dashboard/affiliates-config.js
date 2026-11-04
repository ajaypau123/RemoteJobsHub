/**
 * RemoteJobsHub - Central Monetization & Affiliate Registry
 * 
 * Instructions:
 * - Update the URLs below with your own affiliate/referral links when you register.
 * - Toggle `enabled: true/false` to show or hide any monetization element across the UI.
 */

window.MONETIZATION_CONFIG = {
  // ============================================================
  // 1. ATS RESUME CHECKER (Inside Job Modal)
  // Register at: https://resumeworded.com/affiliates OR https://www.jobscan.co/affiliates
  // ============================================================
  resumeChecker: {
    enabled: true,
    title: "ATS Resume Matcher",
    buttonText: "📄 Check ATS Resume Score for this Role",
    badgeText: "85% fail ATS screening",
    url: "https://resumeworded.com/",
    description: "Scan your resume against this job description to see if you match the required keywords.",
    partner: "Resume Worded"
  },

  // ============================================================
  // 2. EMPLOYER FEATURED JOB PAYMENT (Post a Job Button)
  // Set enabled: true once you configure your payment provider or recruiter contact link
  // ============================================================
  employerPayment: {
    enabled: false,
    priceInr: 1999,
    durationDays: 30,
    title: "Post a Featured Job",
    buttonText: "Feature a Remote Job ⭐",
    paymentUrl: "",
    whatsappContactUrl: "",
    perks: [
      "Pinned #1 at the top of RemoteJobsHub for 30 days",
      "Distinctive ⭐ Featured Employer golden badge",
      "Direct ATS portal application link (zero middlemen)",
      "Broadcasted to verified tech Telegram & email channels"
    ]
  },

  // ============================================================
  // 3. TECH INTERVIEW & SYSTEM DESIGN PREP
  // Register at: https://www.educative.io/affiliates
  // ============================================================
  interviewPrep: {
    enabled: true,
    title: "Interview Prep Course",
    buttonText: "⚡ Master Interview Topics for this Role",
    url: "https://www.educative.io/explore",
    partner: "Educative.io"
  },

  // ============================================================
  // 4. 1-ON-1 MOCK INTERVIEWS & MENTORSHIP
  // Register at: https://topmate.io/ (Refer & Earn tab)
  // ============================================================
  mentorship: {
    enabled: true,
    title: "1-on-1 Mock Interview",
    buttonText: "🎯 Book Mock Interview with Tech Mentors",
    url: "https://topmate.io/",
    partner: "Topmate"
  },

  // ============================================================
  // 5. COMMUNITY & TELEGRAM / WHATSAPP JOB ALERTS
  // ============================================================
  alertsCommunity: {
    enabled: true,
    telegramChannelUrl: "https://t.me/RemoteJobsHub",
    whatsappGroupUrl: "",
    title: "Instant Job Drop Alerts",
    subtitle: "Get notified the minute top worldwide remote openings go live"
  },

  // ============================================================
  // 6. VIP JOB ALERTS & SUBSCRIBER PASS
  // Set enabled: true once you plug in your webhook or payment link
  // ============================================================
  jobAlerts: {
    enabled: false,
    title: "Instant Tech Job Alerts",
    headline: "Never Miss a Job Drop Again",
    subtitle: "Get verified direct ATS roles matching your skills sent straight to your inbox.",
    pricing: {
      vip1MoInr: 49,
      vip3MoInr: 99,
      freeTierEnabled: true
    },
    paymentUrl1Mo: "",
    paymentUrl3Mo: "",
    subscriberWebhookUrl: "",
    perks: [
      "Daily email alerts matching your exact role, timezone & tech stack",
      "100% Direct ATS apply links (Greenhouse, Lever, Ashby, Workday)",
      "Early bird advantage: apply before listings get saturated",
      "Zero recruiter consultancy spam, 100% verified companies"
    ]
  },

  // ============================================================
  // 7. FOUNDER TRANSPARENCY, CONTACT & LEGAL DISCLAIMER
  // ============================================================
  transparency: {
    initiativeName: "RemoteJobsHub",
    contactEmail: "support@remotejobshub.com",
    disclaimer: "RemoteJobsHub is an independent aggregator. All job listings, brand names, and company logos belong to their respective owners. RemoteJobsHub is not affiliated with these employers and never charges candidates for job applications."
  }
};

