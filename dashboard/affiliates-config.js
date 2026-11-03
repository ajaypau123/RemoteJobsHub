/**
 * JobsForIndia - Central Monetization & Affiliate Registry
 * 
 * Instructions:
 * - Update the URLs below with your own affiliate/referral links when you register.
 * - Toggle `enabled: true/false` to show or hide any monetization element across the UI.
 */

window.MONETIZATION_CONFIG = {
  // ============================================================
  // 1. ATS RESUME CHECKER (Highest converting inside Job Modal)
  // Register at: https://resumeworded.com/affiliates OR https://www.jobscan.co/affiliates
  // ============================================================
  resumeChecker: {
    enabled: true,
    title: "ATS Resume Matcher",
    buttonText: "📄 Check ATS Resume Score for this Role",
    badgeText: "85% fail ATS screening",
    // Replace with your affiliate link (e.g., https://resumeworded.com/?ref=YOUR_CODE)
    url: "https://resumeworded.com/?ref=jobsforindia",
    description: "Scan your resume against this job description to see if you match the required keywords.",
    partner: "Resume Worded"
  },

  // ============================================================
  // 2. EMPLOYER FEATURED JOB PAYMENT (Post a Job Button)
  // Create free Razorpay Payment Link at: https://dashboard.razorpay.com/app/payment-links
  // Or use your UPI ID / Google Form
  // ============================================================
  employerPayment: {
    enabled: true,
    priceInr: 1999,
    durationDays: 30,
    title: "Post a Featured Job",
    buttonText: "Pay ₹1,999 to Feature Job ⭐",
    // Replace with your real Razorpay Payment Link (e.g., https://rzp.io/l/YOUR_LINK)
    paymentUrl: "https://rzp.io/l/jobsforindia-featured",
    // Fallback direct WhatsApp recruiter contact
    whatsappContactUrl: "https://wa.me/919999999999?text=Hi%20JobsForIndia,%20I%20want%20to%20feature%20a%20job%20opening",
    perks: [
      "Pinned #1 at the top of JobsForIndia for 30 days",
      "Distinctive ⭐ Featured Employer golden badge",
      "Direct ATS portal application link (zero middlemen)",
      "Broadcasted to verified tech Telegram & WhatsApp channels"
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
    // Replace with your Educative / Coursera affiliate link
    url: "https://www.educative.io/explore?aff=jobsforindia",
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
    // Replace with your Topmate referral link
    url: "https://topmate.io/",
    partner: "Topmate"
  },

  // ============================================================
  // 5. COMMUNITY & TELEGRAM / WHATSAPP JOB ALERTS
  // Create your Telegram Channel & WhatsApp Community
  // ============================================================
  alertsCommunity: {
    enabled: true,
    // Replace with your Telegram Channel invite link
    telegramChannelUrl: "https://t.me/jobsforindia_alerts",
    // Replace with your WhatsApp Community invite link
    whatsappGroupUrl: "https://chat.whatsapp.com/invite_placeholder",
    title: "Instant Job Drop Alerts",
    subtitle: "Get notified the minute top tech openings go live in India"
  },

  // ============================================================
  // 6. VIP JOB ALERTS & SUBSCRIBER PASS (Micro-Subscription)
  // Direct ATS alerts to Email / Telegram / WhatsApp
  // Candidates pay ₹49 for 1 Month or ₹99 for 3 Months (Decoy Pricing)
  // Create free Razorpay Payment Links at: https://dashboard.razorpay.com/app/payment-links
  // ============================================================
  jobAlerts: {
    enabled: true,
    title: "Instant Tech Job Alerts",
    headline: "Never Miss a Job Drop Again",
    subtitle: "Get verified direct ATS roles matching your skills sent straight to your inbox.",
    pricing: {
      vip1MoInr: 49,
      vip3MoInr: 99,
      freeTierEnabled: true
    },
    // Replace with your Razorpay Payment Link for ₹49 (1 Month Starter)
    paymentUrl1Mo: "https://rzp.io/l/jobsforindia-alerts-1mo",
    // Replace with your Razorpay Payment Link for ₹99 (3 Months Sprint - Most Popular)
    paymentUrl3Mo: "https://rzp.io/l/jobsforindia-alerts-3mo",
    // Optional Webhook / Formspree / Google Form URL to store subscriber emails
    // (e.g., https://formspree.io/f/YOUR_FORM_ID or your Google Apps Script URL)
    subscriberWebhookUrl: "",
    perks: [
      "Daily email alerts matching your exact role, city & tech stack",
      "100% Direct ATS apply links (Greenhouse, Lever, Ashby, Workday)",
      "Early bird advantage: apply in the first 60 minutes before LinkedIn gets saturated",
      "Zero recruiter consultancy spam, 100% verified companies"
    ]
  },

  // ============================================================
  // 7. FOUNDER TRANSPARENCY, CONTACT & LEGAL DISCLAIMER
  // ============================================================
  transparency: {
    initiativeName: "The JobsForIndia Initiative",
    contactEmail: "techjobsforindia@gmail.com",
    disclaimer: "JobsForIndia is an independent aggregator. All job listings, brand names, and company logos belong to their respective owners. JobsForIndia is not affiliated with these employers and never charges candidates for job applications."
  }
};

