/**
 * RemoteJobsHub - Global Remote Tech Jobs Web Application
 * Lightweight, zero-dependency, ultra-fast client-side search & filtering engine.
 * Features: Faceted filtering, Direct ATS indexer, View Mode Switcher, Application Tracker, Numbered Pagination.
 */

// ── State Management ──────────────────────────────────────────────────────────
let isArchiveHydrated = false;

const state = {
  allJobs: [],
  filteredJobs: [],
  pageSize: parseInt(localStorage.getItem('rjh_page_size') || '30', 10),
  currentPage: 1,
  savedJobIds: getSavedJobIds(),
  appliedJobs: getAppliedJobs(), // { [jobId]: { appliedAt, status, notes } }
  
  // Layout & Navigation Modes
  viewMode: localStorage.getItem('rjh_view_mode') || 'card', // 'card' | 'list'
  trackerTab: 'all', // 'all' | 'saved' | 'applied'

  // Filters
  category: 'all',
  scope: 'all',
  seniority: 'all',
  company: 'all',
  source: 'all',
  directAtsOnly: false,
  sortBy: 'newest',
  searchQuery: '',
  searchTarget: 'all', // 'all' | 'title'
};

// ── Role Category Job Counters & Classification Patterns ───────────────────
const ROLE_PATTERNS = {
  engineer: /\b(engineer|developer|architect|fullstack|frontend|backend|software|coder|programmer)\b/i,
  sales: /\b(account\s+executive|sales|bdr|sdr|business\s+development|commercial|revenue|partnership|partnerships|account\s+manager)\b/i,
  ai: /\b(ai|artificial\s+intelligence|machine\s+learning|ml|llm|data\s+scientist|nlp|deep\s+learning|computer\s+vision)\b/i,
  marketing: /\b(marketing|growth|seo|sem|content|social\s+media|copywriter|brand|communications|pr)\b/i,
  finance_hr: /\b(finance|accounting|accountant|payroll|tax|legal|compliance|counsel|recruiter|recruiting|talent|hr|people)\b/i,
  devops: /\b(devops|sre|reliability|cloud|infrastructure|platform|kubernetes|aws|sysadmin)\b/i,
  operations: /\b(operations|operations\s+manager|coo|chief\s+of\s+staff|bizops|process|procurement|logistics)\b/i,
  support: /\b(customer\s+success|support|customer\s+support|csm|client\s+success|help\s+desk|customer\s+experience|cx)\b/i,
  data: /\b(data\s+engineer|bi|analyst|analytics|database|etl|pipeline|sql)\b/i,
  product: /\b(product\s+manager|product\s+management|product\s+owner|head\s+of\s+product|director\s+of\s+product|vp\s+of\s+product|cpo)\b/i,
  design: /\b(designer|ui|ux|product\s+designer|graphic|creative|visual|art\s+director)\b/i,
  mobile: /\b(ios|android|mobile|flutter|react\s+native|swift|kotlin)\b/i,
  qa: /\b(qa|quality\s+assurance|tester|testing|sdet|test\s+engineer|automation)\b/i,
};

// ── Local Storage: Saved & Applied Jobs ───────────────────────────────────────
function getSavedJobIds() {
  try {
    const raw = localStorage.getItem('rjh_saved_jobs');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    return new Set();
  }
}

function persistSavedJobs() {
  try {
    localStorage.setItem('rjh_saved_jobs', JSON.stringify(Array.from(state.savedJobIds)));
    updateTrackerCounters();
  } catch (e) {
    console.error('Failed saving saved jobs to localStorage', e);
  }
}

function toggleSaveJob(jobId, e) {
  if (e) e.stopPropagation();
  if (state.savedJobIds.has(jobId)) {
    state.savedJobIds.delete(jobId);
  } else {
    state.savedJobIds.add(jobId);
  }
  persistSavedJobs();
  renderJobCards();
}

function getAppliedJobs() {
  try {
    const raw = localStorage.getItem('rjh_applied_jobs');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function persistAppliedJobs() {
  try {
    localStorage.setItem('rjh_applied_jobs', JSON.stringify(state.appliedJobs));
    updateTrackerCounters();
  } catch (e) {
    console.error('Failed saving applied jobs to localStorage', e);
  }
}

function isJobApplied(jobId) {
  return !!state.appliedJobs[jobId];
}

function toggleApplyJob(jobId, e) {
  if (e) e.stopPropagation();
  if (state.appliedJobs[jobId]) {
    delete state.appliedJobs[jobId];
  } else {
    state.appliedJobs[jobId] = {
      appliedAt: new Date().toISOString(),
      status: 'Applied'
    };
  }
  persistAppliedJobs();
  renderJobCards();
}

// ── Salary & Date Filter Helpers ──────────────────────────────────────────────
function parseMaxSalary(str) {
  if (!str) return 0;
  const matches = [...str.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k|kilo|thousand)?/gi)];
  let max = 0;
  for (const m of matches) {
    let val = parseFloat(m[1].replace(/,/g, ''));
    if (m[2] && m[2].toLowerCase().startsWith('k')) {
      val *= 1000;
    }
    if (val > max) max = val;
  }
  return max;
}

function checkDateFilter(postedDateStr, filterVal) {
  if (filterVal === 'all') return true;
  if (!postedDateStr) return false;
  try {
    const parts = postedDateStr.split('-');
    let posted;
    if (parts.length === 3 && parts[0].length === 4) {
      posted = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      posted = new Date(postedDateStr);
    }
    if (isNaN(posted.getTime())) return false;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfPosted = new Date(posted.getFullYear(), posted.getMonth(), posted.getDate());
    const diffDays = Math.round((startOfToday - startOfPosted) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return true;
    if (filterVal === '24h') return diffDays <= 1;
    if (filterVal === '3d') return diffDays <= 3;
    if (filterVal === '7d') return diffDays <= 7;
    if (filterVal === '14d') return diffDays <= 14;
    if (filterVal === '30d') return diffDays <= 30;
    return true;
  } catch (e) {
    return true;
  }
}

function updateTrackerCounters() {
  const savedCount = state.savedJobIds.size;
  const appliedCount = Object.keys(state.appliedJobs).length;
  const allCount = state.allJobs.length;

  // Header badges
  const navSaved = document.getElementById('nav-saved-count');
  if (navSaved) navSaved.textContent = savedCount.toLocaleString();

  const navApplied = document.getElementById('nav-applied-count');
  if (navApplied) navApplied.textContent = appliedCount.toLocaleString();

  // Tab badges
  const tabAll = document.getElementById('tab-all-count');
  if (tabAll) tabAll.textContent = allCount.toLocaleString();

  const tabSaved = document.getElementById('tab-saved-count');
  if (tabSaved) tabSaved.textContent = savedCount.toLocaleString();

  const tabApplied = document.getElementById('tab-applied-count');
  if (tabApplied) tabApplied.textContent = appliedCount.toLocaleString();
}

// ── Application Tracking Floating Toast ───────────────────────────────────────
let pendingToastJobId = null;

function handleExternalApply(jobId, e) {
  if (e) e.stopPropagation();
  pendingToastJobId = jobId;
  const targetJob = state.allJobs.find(j => j.job_id === jobId);
  const companyName = (targetJob && targetJob.company) ? targetJob.company : 'Company';
  const toast = document.getElementById('applied-toast');
  const toastTitle = document.getElementById('toast-title');

  if (toast && toastTitle) {
    toastTitle.textContent = `Applying to ${companyName}?`;
    toast.classList.remove('hidden');

    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 12000);
  }
}

// ── Common Tech Stack Tag Extractor ───────────────────────────────────────────
const TECH_TAGS = [
  'React', 'Python', 'TypeScript', 'JavaScript', 'Node.js', 'Go', 'Golang',
  'AWS', 'Kubernetes', 'Docker', 'PostgreSQL', 'SQL', 'GraphQL', 'Rust',
  'Java', 'Spring', 'C#', '.NET', 'C++', 'Ruby', 'Rails', 'PHP', 'Laravel',
  'Next.js', 'Vue', 'Angular', 'Tailwind', 'GCP', 'Azure', 'Terraform',
  'FastAPI', 'Django', 'Flask', 'Redis', 'Kafka', 'MongoDB', 'Elasticsearch',
  'CI/CD', 'GitHub Actions', 'Linux', 'Microservices', 'REST', 'GraphQL',
  'Machine Learning', 'AI', 'LLM', 'PyTorch', 'TensorFlow', 'NLP', 'Computer Vision',
  'QA', 'SDET', 'Selenium', 'Cypress', 'Playwright', 'Jest', 'Automation',
  'iOS', 'Android', 'Swift', 'Kotlin', 'Flutter', 'React Native', 'Mobile',
  'Figma', 'UI/UX', 'Product Design', 'DevOps', 'SRE'
];

function escapeRegex(str) {
  if (!str) return '';
  const specials = '-[]/{}()*+?.\\^$|';
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    out += specials.includes(c) ? '\\' + c : c;
  }
  return out;
}

function extractTags(text) {
  if (!text) return [];
  const found = [];
  const lower = text.toLowerCase();
  for (const tag of TECH_TAGS) {
    const escaped = escapeRegex(tag.toLowerCase());
    try {
      const regex = /[+#]/.test(escaped)
        ? new RegExp("(?:^|[\\s,/])" + escaped + "(?:$|[\\s,/])", "i")
        : new RegExp("\\b" + escaped + "\\b", "i");
      if (regex.test(lower)) {
        found.push(tag);
        if (found.length >= 4) break;
      }
    } catch (e) {
      // ignore
    }
  }
  return found;
}

const GRADIENTS = [
  'from-emerald-500 to-teal-600',
  'from-cyan-500 to-blue-600',
  'from-indigo-500 to-purple-600',
  'from-violet-500 to-purple-700',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-teal-500 to-emerald-600',
  'from-blue-500 to-indigo-600'
];

function getGradient(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
}

function getInitials(name) {
  if (!name) return 'RJ';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getCompanyDomain(companyName, applyUrl) {
  if (!companyName) return 'google.com';
  // Try extracting direct company domain from applyUrl if not a generic ATS host
  if (applyUrl && applyUrl.includes('://')) {
    try {
      const parsed = new URL(applyUrl);
      const host = parsed.hostname.toLowerCase();
      const parts = host.split('.');
      if (parts.length >= 2) {
        const rootDomain = parts.slice(-2).join('.');
        const atsHosts = ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'workday.com', 'smartrecruiters.com', 'workable.com', 'breezy.hr', 'himalayas.app', 'remotive.com', 'remoteok.com'];
        if (!atsHosts.includes(rootDomain)) {
          return host.replace(/^www\./, '').replace(/^careers?\./, '').replace(/^jobs?\./, '');
        }
        // If it is Greenhouse, Lever, Ashby, path often contains company slug (e.g. boards.greenhouse.io/stripe)
        const pathSegments = parsed.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          const candidate = pathSegments[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          if (candidate.length >= 2 && !['job', 'jobs', 'detail', 'view', 'apply', 'posting'].includes(candidate)) {
            return `${candidate}.com`;
          }
        }
      }
    } catch (e) {}
  }
  // Sanitize company name into domain fallback
  const clean = companyName.toLowerCase().trim()
    .replace(/\s+(inc|llc|ltd|corp|co|gmbh|technologies|technology|software|international)\.?$/i, '')
    .replace(/[^a-z0-9]/g, '');
  return clean ? `${clean}.com` : 'remote.com';
}

function getCompanyLogoUrl(companyName, applyUrl) {
  const domain = getCompanyDomain(companyName, applyUrl);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Date & Time Utilities ─────────────────────────────────────────────────────
function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    let posted;
    if (parts.length === 3 && parts[0].length === 4) {
      posted = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      posted = new Date(dateStr);
    }
    if (isNaN(posted.getTime())) return '';
    
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfPosted = new Date(posted.getFullYear(), posted.getMonth(), posted.getDate());
    const diffDays = Math.round((startOfToday - startOfPosted) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return '⚡ Today';
    if (diffDays === 1) return '🕒 Yesterday';
    if (diffDays < 7) return `🕒 ${diffDays}d ago`;
    if (diffDays < 30) return `🕒 ${Math.floor(diffDays / 7)}w ago`;
    return `🕒 ${Math.floor(diffDays / 30)}mo ago`;
  } catch (e) {
    return '';
  }
}

function isEarlyApplicantWindow(dateStr) {
  if (!dateStr) return false;
  try {
    const parts = dateStr.split('-');
    let posted;
    if (parts.length === 3 && parts[0].length === 4) {
      posted = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      posted = new Date(dateStr);
    }
    if (isNaN(posted.getTime())) return false;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfPosted = new Date(posted.getFullYear(), posted.getMonth(), posted.getDate());
    const diffDays = Math.round((startOfToday - startOfPosted) / (1000 * 60 * 60 * 24));
    return diffDays <= 2; // Fresh posting: today, yesterday, or within 48h
  } catch (e) {
    return false;
  }
}

// ── Company Dropdown & Direct ATS Panel ────────────────────────────────────────
function updateDirectAtsPanelVisibility() {
  const isDirectAts = state.directAtsOnly || state.source === 'CompanyATS';
  const panel = document.getElementById('direct-ats-company-panel');
  if (panel) {
    if (isDirectAts) {
      panel.classList.remove('hidden');
      populateCompanyDropdown();
      renderTopCompanyChips();
    } else {
      panel.classList.add('hidden');
      state.company = 'all';
      const companySelect = document.getElementById('company-select');
      if (companySelect) companySelect.value = 'all';
    }
  }
}

function populateCompanyDropdown() {
  const companySelect = document.getElementById('company-select');
  const countBadge = document.getElementById('company-count-badge');
  if (!companySelect) return;

  const isDirectAtsActive = state.directAtsOnly || state.source === 'CompanyATS';
  const companyCounts = {};
  let totalMatchingJobs = 0;

  state.allJobs.forEach(job => {
    const isDirectAts = !!job.direct_apply_url || job.source === 'CompanyATS';
    if (isDirectAtsActive && !isDirectAts) return;

    const c = (job.company || '').trim();
    if (c) {
      companyCounts[c] = (companyCounts[c] || 0) + 1;
      totalMatchingJobs++;
    }
  });

  const sortedCompanies = Object.keys(companyCounts).sort((a, b) => {
    const diff = companyCounts[b] - companyCounts[a];
    if (diff !== 0) return diff;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });

  const totalCompanies = sortedCompanies.length;
  if (countBadge) {
    countBadge.textContent = totalCompanies.toLocaleString() + ' available';
  }

  const currentVal = (state.company || 'all').toLowerCase();

  companySelect.innerHTML = '<option value="all">🏢 All Companies (' + totalCompanies + ' employers • ' + totalMatchingJobs.toLocaleString() + ' jobs)</option>';

  sortedCompanies.forEach(comp => {
    const count = companyCounts[comp];
    const opt = document.createElement('option');
    opt.value = comp;
    opt.textContent = comp + ' (' + count.toLocaleString() + ' ' + (count === 1 ? 'job' : 'jobs') + ')';
    if (comp.toLowerCase() === currentVal) {
      opt.selected = true;
    }
    companySelect.appendChild(opt);
  });
}

function renderTopCompanyChips() {
  const container = document.getElementById('top-companies-chips');
  if (!container) return;

  const isDirectAtsActive = state.directAtsOnly || state.source === 'CompanyATS';
  const companyCounts = {};

  state.allJobs.forEach(job => {
    const isDirectAts = !!job.direct_apply_url || job.source === 'CompanyATS';
    if (isDirectAtsActive && !isDirectAts) return;

    const c = (job.company || '').trim();
    if (c) {
      companyCounts[c] = (companyCounts[c] || 0) + 1;
    }
  });

  const topCompanies = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const isAll = state.company === 'all';
  container.innerHTML =
    '<span class="text-[11px] font-medium text-slate-400 shrink-0 mr-1 flex items-center gap-1.5 font-mono">' +
    '<svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>' +
    '<span>Top Employers:</span>' +
    '</span>' +
    '<button type="button" onclick="selectCompany(\'all\')" class="company-chip px-2.5 py-1 rounded-lg text-xs font-medium font-mono ' +
    (isAll ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/20' : 'bg-[#0d1527] text-slate-300 hover:text-white border border-white/[0.08] hover:border-cyan-500/30') +
    ' transition shrink-0 cursor-pointer">All</button>';

  topCompanies.forEach(([comp, count]) => {
    const isSelected = state.company.toLowerCase() === comp.toLowerCase();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'company-chip px-2.5 py-1 rounded-lg text-xs font-mono ' +
      (isSelected ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/20' : 'bg-[#0d1527] text-slate-300 hover:text-cyan-300 border border-white/[0.08] hover:border-cyan-500/30') +
      ' transition shrink-0 cursor-pointer flex items-center gap-1.5';
    btn.innerHTML = '<span>' + escapeHtml(comp) + '</span><span class="' +
      (isSelected ? 'text-slate-950/80 font-bold' : 'text-cyan-400 font-medium') + '">(' + count + ')</span>';
    btn.onclick = () => selectCompany(comp);
    container.appendChild(btn);
  });
}

function selectCompany(compName) {
  state.company = compName;
  const companySelect = document.getElementById('company-select');
  if (companySelect) companySelect.value = compName;
  renderTopCompanyChips();
  state.currentPage = 1;
  applyFilters();
}

// ── Application Initialization ────────────────────────────────────────────────
function init() {
  loadJobsData();
  bindEventHandlers();
  updateTrackerCounters();
  syncViewModeUI();

  // Auto-prompt Job Alert popup once per session after 4 seconds to introduce candidates to alerts
  if (!sessionStorage.getItem('rjh_alerts_prompted')) {
    setTimeout(() => {
      const jobModal = document.getElementById('job-modal');
      const postModal = document.getElementById('post-job-modal');
      const alertsModal = document.getElementById('alerts-modal');
      if (jobModal?.classList.contains('hidden') && postModal?.classList.contains('hidden') && alertsModal?.classList.contains('hidden')) {
        sessionStorage.setItem('rjh_alerts_prompted', 'true');
        openAlertsModal('vip3mo');
      }
    }, 4000);
  }
}

function hydrateArchiveJobs() {
  if (isArchiveHydrated) return;
  isArchiveHydrated = true;

  fetch('jobs_archive.json')
    .then(res => res.json())
    .then(archiveData => {
      if (Array.isArray(archiveData) && archiveData.length > 0) {
        const existingIds = new Set(state.allJobs.map(j => j.job_id));
        const newJobs = archiveData.filter(j => !existingIds.has(j.job_id));
        if (newJobs.length > 0) {
          state.allJobs = state.allJobs.concat(newJobs);
          const headerCount = document.getElementById('header-count-badge');
          if (headerCount) {
            headerCount.textContent = state.allJobs.length.toLocaleString() + ' verified remote jobs';
          }
          const totalCountEl = document.getElementById('total-count');
          if (totalCountEl && state.filteredJobs.length === state.allJobs.length) {
            totalCountEl.textContent = state.allJobs.length.toLocaleString();
          }
          updateTrackerCounters();
          updateRoleCategoryBadges();
          populateCompanyDropdown();
          applyFilters(true);
        }
      }
    })
    .catch(err => {
      console.warn('Archive hydration skipped or failed:', err);
    });
}

function loadJobsData() {
  const headerCount = document.getElementById('header-count-badge');
  const resultsCount = document.getElementById('results-count-badge');

  if (window.JOBS_DATA && Array.isArray(window.JOBS_DATA) && window.JOBS_DATA.length > 0) {
    state.allJobs = window.JOBS_DATA;
    onJobsLoaded();
    return;
  }

  // Poll for window.JOBS_DATA if it is still loading, otherwise fetch JSON
  let attempts = 0;
  const pollTimer = setInterval(() => {
    attempts++;
    if (window.JOBS_DATA && Array.isArray(window.JOBS_DATA) && window.JOBS_DATA.length > 0) {
      clearInterval(pollTimer);
      state.allJobs = window.JOBS_DATA;
      onJobsLoaded();
    } else if (attempts >= 10) {
      clearInterval(pollTimer);
      // Try fast recent feed first, fallback to latest
      fetch('jobs_recent.json')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            state.allJobs = data;
            onJobsLoaded();
          } else {
            throw new Error('Empty recent feed');
          }
        })
        .catch(() => {
          return fetch('jobs_latest.json')
            .then(res => res.json())
            .then(data => {
              if (Array.isArray(data) && data.length > 0) {
                state.allJobs = data;
                onJobsLoaded();
              } else {
                showEmptyState('No remote jobs found in the feed.');
              }
            });
        })
        .catch(err => {
          console.error('Failed loading jobs feed:', err);
          showEmptyState('Could not load jobs feed. Please refresh.');
        });
    }
  }, 150);
}

// ── Role Category Job Counters ─────────────────────────────────────────────
function updateRoleCategoryBadges() {
  const counts = { all: state.allJobs.length };
  for (const key of Object.keys(ROLE_PATTERNS)) {
    counts[key] = 0;
  }

  let otherCount = 0;
  for (let i = 0; i < state.allJobs.length; i++) {
    const title = state.allJobs[i].title || '';
    let matchedAny = false;
    for (const [key, regex] of Object.entries(ROLE_PATTERNS)) {
      if (regex.test(title)) {
        counts[key]++;
        matchedAny = true;
      }
    }
    if (!matchedAny) {
      otherCount++;
    }
  }
  counts['other'] = otherCount;

  // Update pills badges
  document.querySelectorAll('.role-pill').forEach(pill => {
    const cat = pill.dataset.category || 'all';
    const badge = pill.querySelector('.role-count-badge');
    if (badge) {
      badge.textContent = (counts[cat] || 0).toLocaleString();
    }
  });

  // Update role select option labels
  const roleSelect = document.getElementById('role-select');
  if (roleSelect) {
    const labels = {
      all: 'All Roles & Domains',
      engineer: '💻 Software Engineering',
      sales: '📈 Sales & Account Execs',
      ai: '🤖 AI & Machine Learning',
      marketing: '📢 Marketing & Growth',
      finance_hr: '👥 People, HR & Finance',
      devops: '☁️ DevOps & Cloud',
      operations: '⚙️ Operations & BizOps',
      support: '🎧 Customer Success & Support',
      data: '📊 Data & Analytics',
      product: '🚀 Product Management',
      design: '🎨 Product & Design',
      mobile: '📱 Mobile Apps',
      qa: '🧪 QA & Testing',
      other: '💼 Other Remote Positions'
    };
    for (const opt of roleSelect.options) {
      const baseLabel = labels[opt.value];
      if (baseLabel) {
        opt.textContent = `${baseLabel} (${(counts[opt.value] || 0).toLocaleString()})`;
      }
    }
  }
}

function onJobsLoaded() {
  // Hydrate local featured jobs if any
  const featured = getStoredFeaturedJobs();
  if (featured.length > 0) {
    const existingIds = new Set(state.allJobs.map(j => j.job_id));
    const newFeatured = featured.filter(fj => !existingIds.has(fj.job_id));
    if (newFeatured.length > 0) {
      state.allJobs = [...newFeatured, ...state.allJobs];
    }
  }

  const count = state.allJobs.length;
  const headerCount = document.getElementById('header-count-badge');
  if (headerCount) {
    headerCount.textContent = count.toLocaleString() + ' verified remote jobs';
  }
  updateTrackerCounters();
  updateRoleCategoryBadges();
  populateCompanyDropdown();
  applyFilters();

  // ── High-Performance Live Number Ticker & Hero Entrance ──
  if (window.anime && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const countObj = { val: 0 };
    anime({
      targets: countObj,
      val: count,
      round: 1,
      easing: 'easeOutExpo',
      duration: 1400,
      update: function() {
        const formatted = countObj.val.toLocaleString();
        if (headerCount) headerCount.textContent = `${formatted} verified remote jobs`;
        const tabAllCount = document.getElementById('tab-all-count');
        if (tabAllCount) tabAllCount.textContent = formatted;
        const totalCountEl = document.getElementById('total-count');
        if (totalCountEl) totalCountEl.textContent = formatted;
        const resultsBadge = document.getElementById('results-count-badge');
        if (resultsBadge) resultsBadge.textContent = `${formatted} jobs`;
      }
    });

    // Staggered subtle reveal for navbar, hero, and main feed
    anime({
      targets: ['header', 'section.relative.overflow-hidden', '#main-content'],
      opacity: [0, 1],
      translateY: [8, 0],
      delay: anime.stagger(90),
      easing: 'easeOutQuad',
      duration: 400
    });
  }

  // Progressive background hydration: stream archive without blocking user interactions
  if (window.HAS_ARCHIVE_DATA || state.allJobs.length <= 600) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => hydrateArchiveJobs(), { timeout: 2500 });
    } else {
      setTimeout(hydrateArchiveJobs, 600);
    }
  }
}

// ── View Mode & Tracker Tabs ──────────────────────────────────────────────────
function syncViewModeUI() {
  const cardBtn = document.getElementById('view-card-btn');
  const listBtn = document.getElementById('view-list-btn');

  if (cardBtn && listBtn) {
    if (state.viewMode === 'card') {
      cardBtn.className = 'view-mode-btn active px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-cyan-500/20';
      listBtn.className = 'view-mode-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer';
    } else {
      listBtn.className = 'view-mode-btn active px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-cyan-500/20';
      cardBtn.className = 'view-mode-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer';
    }
  }
}

function setViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem('rjh_view_mode', mode);
  syncViewModeUI();
  renderJobCards();
}

function setTrackerTab(tab) {
  state.trackerTab = tab;
  state.currentPage = 1;

  const tabs = [
    { id: 'tab-all-jobs-btn', tab: 'all' },
    { id: 'tab-saved-jobs-btn', tab: 'saved' },
    { id: 'tab-applied-jobs-btn', tab: 'applied' }
  ];

  tabs.forEach(t => {
    const el = document.getElementById(t.id);
    if (!el) return;
    if (t.tab === tab) {
      el.className = 'tracker-nav-tab active px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 transition cursor-pointer flex items-center gap-2 whitespace-nowrap shadow-sm shadow-cyan-500/20';
      const badge = el.querySelector('span:last-child');
      if (badge) badge.className = 'px-1.5 py-0.2 rounded text-[10px] font-mono bg-black/20 text-slate-950 font-bold';
    } else {
      el.className = 'tracker-nav-tab px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-[#0d1527] border border-white/[0.08] hover:border-cyan-500/30 transition cursor-pointer flex items-center gap-2 whitespace-nowrap';
      const badge = el.querySelector('span:last-child');
      if (badge) {
        if (t.tab === 'saved') badge.className = 'px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 font-medium border border-amber-500/20';
        else if (t.tab === 'applied') badge.className = 'px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 font-medium border border-emerald-500/20';
        else badge.className = 'px-1.5 py-0.2 rounded text-[10px] font-mono bg-white/[0.04] text-slate-400 font-medium';
      }
    }
  });

  applyFilters();
}

// ── Core Filtering Logic ───────────────────────────────────────────────────────
function applyFilters() {
  const query = state.searchQuery.toLowerCase().trim();
  const cat = state.category;
  const scope = state.scope;
  const sen = state.seniority;
  const src = state.source;
  const atsOnly = state.directAtsOnly;

  let results = state.allJobs.filter(job => {
    // 1. Tracker Tab Filter (All | Saved | Applied)
    if (state.trackerTab === 'saved') {
      if (!state.savedJobIds.has(job.job_id)) return false;
    } else if (state.trackerTab === 'applied') {
      if (!state.appliedJobs[job.job_id]) return false;
    }

    // 2. Company Filter
    if (state.company !== 'all') {
      if ((job.company || '').trim().toLowerCase() !== state.company.toLowerCase()) return false;
    }

    // 3. Query Search (Title Only vs Everywhere)
    if (query) {
      const titleMatch = (job.title || '').toLowerCase().includes(query);
      if (state.searchTarget === 'title') {
        if (!titleMatch) return false;
      } else {
        const companyMatch = (job.company || '').toLowerCase().includes(query);
        const locMatch = (job.location || '').toLowerCase().includes(query);
        const descMatch = (job.description || '').toLowerCase().includes(query);
        if (!titleMatch && !companyMatch && !locMatch && !descMatch) return false;
      }
    }

    // 4. Category / Job Role Filter
    if (cat !== 'all') {
      const title = (job.title || '').toLowerCase();
      if (cat === 'other') {
        // Must not match any of the defined patterns
        for (const regex of Object.values(ROLE_PATTERNS)) {
          if (regex.test(title)) return false;
        }
      } else if (ROLE_PATTERNS[cat]) {
        if (!ROLE_PATTERNS[cat].test(title)) return false;
      }
    }

    // 5. Remote Scope Filter
    if (scope !== 'all') {
      const rScope = (job.remote_scope || '').toLowerCase();
      const loc = (job.location || '').toLowerCase();

      if (scope === 'worldwide') {
        if (rScope !== 'worldwide' && !loc.includes('worldwide') && !loc.includes('anywhere')) {
          return false;
        }
      } else if (scope === 'americas') {
        if (!rScope.includes('americas') && !loc.includes('us') && !loc.includes('united states') && !loc.includes('canada')) {
          return false;
        }
      } else if (scope === 'europe') {
        if (!rScope.includes('europe') && !rScope.includes('emea') && !loc.includes('uk') && !loc.includes('europe')) {
          return false;
        }
      } else if (scope === 'apac') {
        if (!rScope.includes('apac') && !loc.includes('apac') && !loc.includes('asia') && !loc.includes('india')) {
          return false;
        }
      }
    }

    // 6. Worldwide Checkbox Filter
    if (state.worldwideOnly) {
      const rScope = (job.remote_scope || '').toLowerCase();
      const loc = (job.location || '').toLowerCase();
      if (rScope !== 'worldwide' && !loc.includes('worldwide') && !loc.includes('anywhere')) {
        return false;
      }
    }

    // 7. Seniority / Experience Filter
    if (sen !== 'all') {
      const title = (job.title || '').toLowerCase();
      if (sen === 'junior') {
        if (!/\b(junior|jr|entry|associate|intern|trainee)\b/i.test(title)) return false;
      } else if (sen === 'mid') {
        if (/\b(senior|sr|lead|staff|principal|director|head|vp)\b/i.test(title)) return false;
      } else if (sen === 'senior') {
        if (!/\b(senior|sr|lead)\b/i.test(title) || /\b(principal|staff|director)\b/i.test(title)) return false;
      } else if (sen === 'lead') {
        if (!/\b(lead|staff|principal|director|head|architect)\b/i.test(title)) return false;
      }
    }

    // 8. Employment Type Filter
    if (state.employmentType !== 'all') {
      const emp = (job.employment_type || '').toLowerCase();
      if (state.employmentType === 'full-time' && !emp.includes('full') && emp !== '') return false;
      if (state.employmentType === 'contract' && !emp.includes('contract') && !emp.includes('freelance')) return false;
      if (state.employmentType === 'internship' && !emp.includes('intern') && !emp.includes('trainee') && !emp.includes('graduate')) return false;
      if (state.employmentType === 'part-time' && !emp.includes('part')) return false;
    }

    // 9. Source / ATS Provider Filter
    if (src !== 'all') {
      const url = (job.direct_apply_url || job.apply_url || '').toLowerCase();
      if (src === 'ashby') {
        if (!url.includes('ashbyhq.com')) return false;
      } else if (src === 'greenhouse') {
        if (!url.includes('greenhouse.io')) return false;
      } else if (src === 'lever') {
        if (!url.includes('lever.co')) return false;
      } else if (src === 'workday') {
        if (!url.includes('myworkdayjobs.com') && !url.includes('workday')) return false;
      } else if (src === 'CompanyATS') {
        if (!job.direct_apply_url && job.source !== 'CompanyATS') return false;
      } else {
        if (job.source !== src) return false;
      }
    }

    // 10. Date Posted Filter
    if (state.datePosted !== 'all') {
      const d = job.posted_date || job.collected_date || '';
      if (!checkDateFilter(d, state.datePosted)) return false;
    }

    // 11. Direct ATS Only Filter
    if (atsOnly) {
      if (!job.direct_apply_url && job.source !== 'CompanyATS') return false;
    }

    // 12. Salary Disclosed Only Filter
    if (state.salaryOnly) {
      if (!job.salary) return false;
    }

    return true;
  });

  // Precompute hiring volume map for sorting
  const companyCounts = {};
  state.allJobs.forEach(j => {
    const c = j.company || '';
    companyCounts[c] = (companyCounts[c] || 0) + 1;
  });

  // Sorting
  if (state.sortBy === 'company') {
    results.sort((a, b) => (a.company || '').localeCompare(b.company || ''));
  } else if (state.sortBy === 'title') {
    results.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (state.sortBy === 'salary-high') {
    results.sort((a, b) => parseMaxSalary(b.salary) - parseMaxSalary(a.salary));
  } else if (state.sortBy === 'volume') {
    results.sort((a, b) => (companyCounts[b.company] || 0) - (companyCounts[a.company] || 0));
  } else {
    // Newest first (default)
    results.sort((a, b) => {
      const dateA = a.posted_date || a.collected_date || '';
      const dateB = b.posted_date || b.collected_date || '';
      return dateB.localeCompare(dateA);
    });
  }

  // Pinned placement: Always pin featured listings to the very top!
  results.sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return 0;
  });

  state.filteredJobs = results;
  
  // Update Results Badge
  const badge = document.getElementById('results-count-badge');
  if (badge) {
    if (state.trackerTab === 'applied') {
      badge.textContent = results.length.toLocaleString() + ' applied positions';
    } else if (state.trackerTab === 'saved') {
      badge.textContent = results.length.toLocaleString() + ' saved positions';
    } else if (state.company !== 'all') {
      badge.textContent = results.length.toLocaleString() + ' jobs at ' + state.company;
    } else {
      badge.textContent = results.length.toLocaleString() + ' jobs';
    }
  }

  renderJobCards();
}

// ── Render Job Listings (Cards vs List) & Numbered Pagination ─────────────────
function goToPage(page) {
  const totalPages = Math.ceil(state.filteredJobs.length / state.pageSize) || 1;
  state.currentPage = Math.max(1, Math.min(page, totalPages));
  renderJobCards();
  document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth' });
}

function renderJobCards() {
  const container = document.getElementById('job-grid');
  const paginationBar = document.getElementById('pagination-bar');
  const rangeStartEl = document.getElementById('showing-range-start');
  const rangeEndEl = document.getElementById('showing-range-end');
  const totalCountEl = document.getElementById('total-count');

  if (!container) return;
  container.innerHTML = '';

  const totalJobs = state.filteredJobs.length;
  const totalPages = Math.ceil(totalJobs / state.pageSize) || 1;
  state.currentPage = Math.max(1, Math.min(state.currentPage, totalPages));

  if (totalJobs === 0) {
    let emptyTitle = 'No matching remote positions found';
    let emptyMsg = 'Try loosening your keywords, switching to "All Regions", or resetting your filters.';

    if (state.trackerTab === 'applied') {
      emptyTitle = 'No applied jobs recorded yet';
      emptyMsg = 'Click "Mark as Applied" on any job card when you submit your application to track your status here!';
    } else if (state.trackerTab === 'saved') {
      emptyTitle = 'No saved jobs in your list';
      emptyMsg = 'Bookmark interesting remote jobs by clicking the bookmark icon on any card.';
    }

    container.className = 'min-h-[300px] flex items-center justify-center';
    container.innerHTML = `
      <div class="p-10 sm:p-14 text-center bg-[#0d1527] border border-white/[0.08] rounded-2xl max-w-lg mx-auto shadow-2xl">
        <div class="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 mx-auto flex items-center justify-center mb-4">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35"/></svg>
        </div>
        <h3 class="text-base sm:text-lg font-bold text-white mb-2 tracking-tight">${emptyTitle}</h3>
        <p class="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6 font-normal">
          ${emptyMsg}
        </p>
        <button onclick="resetAllFilters()" class="px-4 py-2.5 text-xs font-bold bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 rounded-xl transition cursor-pointer active:scale-95 flex items-center gap-2 mx-auto shadow-md shadow-cyan-500/20">
          <span>Show All Remote Openings</span>
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </button>
      </div>
    `;
    if (paginationBar) paginationBar.classList.add('hidden');
    return;
  }

  if (paginationBar) paginationBar.classList.remove('hidden');

  const startIndex = (state.currentPage - 1) * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, totalJobs);
  const chunk = state.filteredJobs.slice(startIndex, endIndex);

  // Update Range and Total Numbers
  if (rangeStartEl) rangeStartEl.textContent = (startIndex + 1).toLocaleString();
  if (rangeEndEl) rangeEndEl.textContent = endIndex.toLocaleString();
  if (totalCountEl) totalCountEl.textContent = totalJobs.toLocaleString();

  // Set Container Layout class based on View Mode
  if (state.viewMode === 'list') {
    container.className = 'flex flex-col space-y-2 min-h-[400px]';
  } else {
    container.className = 'grid grid-cols-1 md:grid-cols-2 gap-3.5 min-h-[400px]';
  }

  const fragment = document.createDocumentFragment();

  chunk.forEach((job, index) => {
    const isSaved = state.savedJobIds.has(job.job_id);
    const isApplied = isJobApplied(job.job_id);
    const gradient = getGradient(job.company);
    const initials = getInitials(job.company);
    let jobTech = [];
    if (Array.isArray(job.tech_stack)) {
      jobTech = job.tech_stack;
    } else if (typeof job.tech_stack === 'string' && job.tech_stack) {
      try { jobTech = JSON.parse(job.tech_stack); } catch (e) { jobTech = job.tech_stack.split(',').map(s => s.trim()).filter(Boolean); }
    }
    const tags = jobTech.length > 0 ? jobTech.slice(0, 3) : extractTags(`${job.title} ${job.description}`).slice(0, 3);
    const applyLink = job.direct_apply_url || job.apply_url || '#';
    const isDirectAts = !!job.direct_apply_url || job.source === 'CompanyATS';
    const relDate = formatRelativeDate(job.posted_date || job.collected_date);
    const logoUrl = getCompanyLogoUrl(job.company, applyLink);
    const isEarly = isEarlyApplicantWindow(job.posted_date || job.collected_date);
    const earlyBadge = isEarly
      ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 inline-flex items-center gap-1" title="Freshly indexed from ATS: Early applicant advantage"><span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>Early Window (&lt;25)</span>'
      : '';

    // Format Scope Badge (JetBrains Mono)
    let scopeBadge = '';
    const scope = (job.remote_scope || '').toLowerCase();
    if (scope === 'worldwide') {
      scopeBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">Worldwide</span>';
    } else if (scope.includes('americas')) {
      scopeBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">Americas / US</span>';
    } else if (scope.includes('europe') || scope.includes('emea')) {
      scopeBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">Europe / EMEA</span>';
    } else if (scope.includes('apac')) {
      scopeBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">APAC</span>';
    } else {
      scopeBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-mono bg-white/[0.04] border border-white/[0.06] text-slate-300">' + escapeHtml(job.location || 'Remote') + '</span>';
    }

    if (state.viewMode === 'list') {
      // ── COMPACT LIST ROW ──
      const row = document.createElement('div');
      row.className = job.is_featured
        ? 'job-card-hover bg-[#0d1527] border border-amber-500/40 hover:border-amber-400/60 p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition cursor-pointer shadow-lg shadow-amber-500/5'
        : 'job-card-hover bg-[#0d1527] border border-white/[0.08] hover:border-cyan-500/40 hover:bg-[#111c34] p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition cursor-pointer';
      row.onclick = () => openJobModal(job);

      row.innerHTML = `
        <div class="flex items-center gap-3 min-w-0 flex-grow">
          <div class="relative w-10 h-10 shrink-0">
            <img 
              src="${logoUrl}" 
              alt="${escapeHtml(job.company || '')}" 
              loading="lazy" 
              class="w-10 h-10 rounded-xl object-contain bg-white/[0.04] p-1.5 border border-white/[0.08]"
              onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"
            />
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr ${gradient} hidden items-center justify-center text-white font-bold text-sm shrink-0">
              ${initials}
            </div>
          </div>
          <div class="min-w-0 flex-grow">
            <div class="flex items-center gap-2 flex-wrap mb-0.5">
              ${job.is_featured ? '<span class="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">Featured</span>' : ''}
              <span class="text-xs font-semibold text-slate-300 truncate max-w-[170px]">${escapeHtml(job.company || 'Company')}</span>
              ${isDirectAts ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Direct ATS</span>' : ''}
              ${earlyBadge}
              ${isApplied ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Applied</span>' : ''}
              ${relDate ? `<span class="text-[11px] font-mono text-slate-500">•</span><span class="text-[11px] font-mono text-cyan-400/90">${relDate}</span>` : ''}
            </div>
            <h3 class="text-sm sm:text-base font-semibold text-white hover:text-cyan-300 transition truncate tracking-tight">
              ${escapeHtml(job.title)}
            </h3>
          </div>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap shrink-0">
          ${job.experience_required ? `<span class="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">${escapeHtml(job.experience_required)}</span>` : ''}
          ${scopeBadge}
          ${job.salary ? `<span class="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">${escapeHtml(job.salary)}</span>` : ''}
        </div>

        <div class="flex items-center gap-1.5 shrink-0 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
          <!-- Bookmark -->
          <button 
            type="button" 
            onclick="toggleSaveJob('${job.job_id}', event)" 
            class="p-2 rounded-lg text-xs transition cursor-pointer ${isSaved ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.06]'}"
            title="${isSaved ? 'Saved' : 'Save'}"
          >
            <svg class="w-3.5 h-3.5" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
          </button>

          <!-- Apply Tracker -->
          <button 
            type="button" 
            onclick="toggleApplyJob('${job.job_id}', event)" 
            class="px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1 ${isApplied ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.06]'}"
            title="${isApplied ? 'Marked as Applied' : 'Track Application'}"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            <span>${isApplied ? 'Applied' : 'Track'}</span>
          </button>

          <!-- Details -->
          <button 
            type="button" 
            onclick="openJobModalById('${job.job_id}', event)" 
            class="p-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition cursor-pointer"
            title="View Details"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          </button>

          <!-- Direct Apply CTA -->
          <a 
            href="${escapeHtml(applyLink)}" 
            target="_blank" 
            rel="noopener noreferrer" 
            onclick="handleExternalApply('${job.job_id}', event)"
            class="px-3 py-1.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 rounded-lg shadow-sm shadow-cyan-500/20 active:scale-95 transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <span>Apply</span>
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </a>
        </div>
      `;

      fragment.appendChild(row);
    } else {
      // ── RICH CARD VIEW ──
      const card = document.createElement('div');
      card.className = job.is_featured
        ? 'job-card-hover bg-[#0d1527] border border-amber-500/40 hover:border-amber-400/60 p-4 sm:p-5 rounded-2xl flex flex-col justify-between gap-4 transition cursor-pointer shadow-lg shadow-amber-500/5'
        : 'job-card-hover bg-[#0d1527] border border-white/[0.08] hover:border-cyan-500/40 hover:bg-[#111c34] p-4 sm:p-5 rounded-2xl flex flex-col justify-between gap-4 transition cursor-pointer';
      card.onclick = () => openJobModal(job);

      card.innerHTML = `
        <div>
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="flex items-center gap-3 min-w-0">
              <div class="relative w-11 h-11 shrink-0">
                <img 
                  src="${logoUrl}" 
                  alt="${escapeHtml(job.company || '')}" 
                  loading="lazy" 
                  class="w-11 h-11 rounded-xl object-contain bg-white/[0.04] p-1.5 border border-white/[0.08]"
                  onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"
                />
                <div class="w-11 h-11 rounded-xl bg-gradient-to-tr ${gradient} hidden items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                  ${initials}
                </div>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  ${job.is_featured ? '<span class="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">Featured</span>' : ''}
                  <span class="text-xs font-semibold text-slate-300 truncate max-w-[160px]">${escapeHtml(job.company || 'Hiring Company')}</span>
                  ${isDirectAts ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Direct ATS</span>' : ''}
                  ${earlyBadge}
                  ${isApplied ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Applied</span>' : ''}
                </div>
                <div class="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 mt-0.5">
                  <span>${escapeHtml(job.source || 'RemoteFeed')}</span>
                  ${relDate ? `<span>•</span><span class="text-cyan-400/90 font-medium">${relDate}</span>` : ''}
                </div>
              </div>
            </div>

            <button 
              type="button" 
              onclick="toggleSaveJob('${job.job_id}', event)" 
              class="p-2 rounded-lg text-xs transition cursor-pointer shrink-0 ${isSaved ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.06]'}"
              title="${isSaved ? 'Remove Bookmark' : 'Save Job'}"
            >
              <svg class="w-4 h-4" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
            </button>
          </div>

          <!-- Job Title -->
          <h3 class="text-base font-semibold text-white hover:text-cyan-300 transition line-clamp-2 leading-snug my-2 tracking-tight">
            ${escapeHtml(job.title)}
          </h3>

          <!-- Scope & Tech Stack Tags -->
          <div class="flex items-center gap-1.5 flex-wrap mt-3">
            ${scopeBadge}
            ${job.experience_required ? `<span class="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">${escapeHtml(job.experience_required)}</span>` : ''}
            ${job.seniority_level ? `<span class="px-2 py-0.5 rounded text-[11px] font-mono bg-white/[0.04] border border-white/[0.06] text-slate-300">${escapeHtml(job.seniority_level)}</span>` : ''}
            ${job.salary ? `<span class="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">${escapeHtml(job.salary)}</span>` : ''}
            ${job.employment_type ? `<span class="px-2 py-0.5 rounded text-[11px] font-mono bg-white/[0.04] border border-white/[0.06] text-slate-300">${escapeHtml(job.employment_type)}</span>` : ''}
            ${tags.map(t => `<span class="px-2 py-0.5 rounded text-[11px] font-mono bg-white/[0.04] border border-white/[0.06] text-slate-400">${t}</span>`).join('')}
          </div>
        </div>

        <!-- Card Footer Action Buttons -->
        <div class="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.06]">
          <button 
            type="button" 
            onclick="toggleApplyJob('${job.job_id}', event)" 
            class="px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition cursor-pointer flex items-center gap-1.5 ${isApplied ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.06]'}"
            title="${isApplied ? 'Application tracked' : 'Track this application'}"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            <span>${isApplied ? 'Applied' : 'Track'}</span>
          </button>

          <div class="flex items-center gap-2">
            <!-- View Details Button -->
            <button 
              type="button" 
              onclick="openJobModalById('${job.job_id}', event)" 
              class="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="View full job details"
            >
              <span>Details</span>
              <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            </button>

            <!-- Direct Apply CTA -->
            <a 
              href="${escapeHtml(applyLink)}" 
              target="_blank" 
              rel="noopener noreferrer" 
              onclick="handleExternalApply('${job.job_id}', event)"
              class="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 rounded-lg shadow-sm shadow-cyan-500/20 active:scale-95 transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <span>Apply</span>
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </a>
          </div>
        </div>
      `;

      fragment.appendChild(card);
    }

    // In-Feed Job Seeker Alert Trigger Card (after the 5th job)
    if (index === 4 && state.trackerTab === 'all') {
      const alertCard = document.createElement('div');
      alertCard.className = state.viewMode === 'list'
        ? 'p-4 rounded-xl bg-gradient-to-r from-cyan-950/30 via-[#0d1527] to-[#0d1527] border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md my-1'
        : 'col-span-1 md:col-span-2 p-5 rounded-2xl bg-gradient-to-r from-cyan-950/30 via-[#0d1527] to-[#0d1527] border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg my-1';
      
      alertCard.innerHTML = `
        <div class="flex items-start sm:items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-0.5">
              <span class="text-sm font-bold text-white tracking-tight">Never miss a direct-ATS opening</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">Free & VIP</span>
            </div>
            <p class="text-xs text-slate-400">Get verified roles delivered to your inbox the moment they are indexed, before positions get saturated.</p>
          </div>
        </div>
        <button type="button" onclick="openAlertsModal('vip3mo')" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-sm shadow-cyan-500/20 active:scale-95">
          <span>Activate Alerts</span>
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </button>
      `;
      fragment.appendChild(alertCard);
    }
  });

  container.appendChild(fragment);
  renderPaginationControls(totalPages);

  // ── Hardware-Accelerated Staggered Card Cascade (Anime.js) ──
  if (window.anime && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    requestAnimationFrame(() => {
      anime({
        targets: '#job-grid > div',
        translateY: [14, 0],
        opacity: [0, 1],
        delay: anime.stagger(22, { start: 10 }),
        easing: 'easeOutCubic',
        duration: 320
      });
    });
  }
}

function renderPaginationControls(totalPages) {
  const container = document.getElementById('pagination-controls');
  if (!container) return;
  container.innerHTML = '';

  if (totalPages <= 1) return;

  const current = state.currentPage;

  // Previous Button
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.disabled = current === 1;
  prevBtn.className = `px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition flex items-center gap-1 ${
    current === 1 
      ? 'bg-[#0d1527] text-slate-600 border border-white/[0.04] cursor-not-allowed' 
      : 'bg-[#0d1527] text-slate-300 hover:text-white hover:bg-[#111c34] border border-white/[0.08] cursor-pointer shadow-sm active:scale-95'
  }`;
  prevBtn.innerHTML = '‹ Prev';
  prevBtn.onclick = () => goToPage(current - 1);
  container.appendChild(prevBtn);

  // Pagination Window Calculator
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    let start = Math.max(2, current - 1);
    let end = Math.min(totalPages - 1, current + 1);

    if (current <= 3) {
      end = 4;
    } else if (current >= totalPages - 2) {
      start = totalPages - 3;
    }

    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  pages.forEach(p => {
    if (p === '...') {
      const dots = document.createElement('span');
      dots.className = 'px-1.5 py-1 text-slate-600 text-xs font-mono';
      dots.textContent = '...';
      container.appendChild(dots);
    } else {
      const pageBtn = document.createElement('button');
      pageBtn.type = 'button';
      const isActive = p === current;
      pageBtn.className = `min-w-[34px] px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
        isActive 
          ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/20' 
          : 'bg-[#0d1527] text-slate-400 hover:text-white hover:bg-[#111c34] border border-white/[0.08]'
      }`;
      pageBtn.textContent = p;
      pageBtn.onclick = () => goToPage(p);
      container.appendChild(pageBtn);
    }
  });

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.disabled = current === totalPages;
  nextBtn.className = `px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition flex items-center gap-1 ${
    current === totalPages 
      ? 'bg-[#0d1527] text-slate-600 border border-white/[0.04] cursor-not-allowed' 
      : 'bg-[#0d1527] text-slate-300 hover:text-white hover:bg-[#111c34] border border-white/[0.08] cursor-pointer shadow-sm active:scale-95'
  }`;
  nextBtn.innerHTML = 'Next ›';
  nextBtn.onclick = () => goToPage(current + 1);
  container.appendChild(nextBtn);
}

// ── Job Modal (Detail Slide-Over Drawer) ───────────────────────────────────────
function openJobModal(job) {
  const modal = document.getElementById('job-modal');
  const title = document.getElementById('modal-title');
  const company = document.getElementById('modal-company');
  const avatar = document.getElementById('modal-company-avatar');
  const body = document.getElementById('modal-body');
  const applyBtn = document.getElementById('modal-apply-btn');
  const saveBtn = document.getElementById('modal-save-btn');
  const trackBtn = document.getElementById('modal-apply-track-btn');
  const scopeBadge = document.getElementById('modal-scope-badge');
  const locBadge = document.getElementById('modal-location-badge');
  const srcBadge = document.getElementById('modal-source-badge');

  if (!modal) return;

  title.textContent = job.title;
  company.textContent = job.company;
  const link = job.direct_apply_url || job.apply_url || '#';
  const logoUrl = getCompanyLogoUrl(job.company, link);
  avatar.className = `w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] p-1.5 shrink-0 flex items-center justify-center relative overflow-hidden`;
  avatar.innerHTML = `
    <img src="${logoUrl}" alt="${escapeHtml(job.company || '')}" class="w-full h-full object-contain" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
    <div class="w-full h-full bg-gradient-to-tr ${getGradient(job.company)} hidden items-center justify-center text-white font-bold text-base rounded-xl">
      ${getInitials(job.company)}
    </div>
  `;

  // Bookmark Button in Modal
  const isSaved = state.savedJobIds.has(job.job_id);
  saveBtn.innerHTML = isSaved 
    ? '<span class="text-amber-300 flex items-center gap-1.5"><svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>Saved</span>'
    : '<span class="flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>Save Job</span>';
  saveBtn.onclick = () => {
    toggleSaveJob(job.job_id);
    const nowSaved = state.savedJobIds.has(job.job_id);
    saveBtn.innerHTML = nowSaved 
      ? '<span class="text-amber-300 flex items-center gap-1.5"><svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>Saved</span>'
      : '<span class="flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>Save Job</span>';
  };

  // Applied Tracker Button in Modal
  if (trackBtn) {
    const isApplied = isJobApplied(job.job_id);
    trackBtn.innerHTML = isApplied 
      ? '<span class="flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Marked Applied</span>'
      : '<span class="flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>Mark as Applied</span>';
    trackBtn.className = `px-3.5 py-2 text-xs font-mono font-medium rounded-xl transition cursor-pointer ${
      isApplied 
        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
        : 'bg-[#111c34] hover:bg-white/[0.06] text-slate-300 hover:text-white border border-white/[0.08]'
    }`;
    trackBtn.onclick = () => {
      toggleApplyJob(job.job_id);
      const appliedNow = isJobApplied(job.job_id);
      trackBtn.innerHTML = appliedNow 
        ? '<span class="flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Marked Applied</span>'
        : '<span class="flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>Mark as Applied</span>';
      trackBtn.className = `px-3.5 py-2 text-xs font-mono font-medium rounded-xl transition cursor-pointer ${
        appliedNow 
          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
          : 'bg-[#111c34] hover:bg-white/[0.06] text-slate-300 hover:text-white border border-white/[0.08]'
      }`;
    };
  }

  applyBtn.href = link;
  applyBtn.onclick = (e) => handleExternalApply(job.job_id, job.company, e);

  scopeBadge.textContent = job.remote_scope ? job.remote_scope : 'Worldwide';
  locBadge.textContent = job.location || 'Anywhere';
  srcBadge.textContent = job.source || 'Company ATS';

  const salaryBadge = document.getElementById('modal-salary-badge');
  if (salaryBadge) {
    if (job.salary) {
      salaryBadge.textContent = job.salary;
      salaryBadge.classList.remove('hidden');
    } else {
      salaryBadge.classList.add('hidden');
    }
  }

  // ATS Resume Matcher Affiliate Hook
  const resumeCard = document.getElementById('modal-resume-affiliate-card');
  const resumeBtn = document.getElementById('modal-resume-btn');
  if (resumeCard && resumeBtn) {
    const config = window.MONETIZATION_CONFIG?.resumeChecker;
    if (config && config.enabled !== false) {
      resumeCard.classList.remove('hidden');
      if (config.url) resumeBtn.href = config.url;
    }
  }

  // 1-Click Find Hiring Manager on LinkedIn
  const linkedinBtn = document.getElementById('modal-linkedin-btn');
  if (linkedinBtn) {
    const companyClean = (job.company || '').trim();
    if (companyClean) {
      const q = encodeURIComponent(`recruiter OR "talent acquisition" OR "engineering manager" "${companyClean}"`);
      linkedinBtn.href = `https://www.linkedin.com/search/results/people/?keywords=${q}`;
      linkedinBtn.classList.remove('hidden');
    } else {
      linkedinBtn.classList.add('hidden');
    }
  }

  const dateBadge = document.getElementById('modal-date-badge');
  if (dateBadge) {
    const rel = formatRelativeDate(job.posted_date || job.collected_date);
    if (rel) {
      dateBadge.textContent = rel;
      dateBadge.classList.remove('hidden');
    } else {
      dateBadge.classList.add('hidden');
    }
  }

  let techList = [];
  if (Array.isArray(job.tech_stack)) {
    techList = job.tech_stack;
  } else if (typeof job.tech_stack === 'string' && job.tech_stack.trim()) {
    try {
      techList = JSON.parse(job.tech_stack);
    } catch (e) {
      techList = job.tech_stack.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  const expText = job.experience_required 
    ? escapeHtml(job.experience_required)
    : 'Not explicitly specified by employer';
  const expSub = job.experience_required
    ? 'Verified requirement from posting'
    : 'No strict year cutoff specified';

  const seniorityText = job.seniority_level || 'Mid-Level';
  const seniorityRationale = job.seniority_rationale || 'Deliver core features autonomously, collaborate across disciplines, and uphold clean code principles.';

  const scopeText = job.remote_scope ? escapeHtml(job.remote_scope) : (job.is_remote ? '100% Remote' : 'Location Dependent');
  const salaryText = job.salary ? escapeHtml(job.salary) : 'Competitive / Unstated';

  const techChipsHtml = techList.length > 0
    ? techList.map(t => `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono bg-white/[0.04] text-slate-300 border border-white/[0.08]">${escapeHtml(t)}</span>`).join(' ')
    : '<span class="text-xs text-slate-400 italic">General engineering & cross-functional skills. See description below for complete context.</span>';

  // Description format
  const cleanDesc = (job.description || 'No description provided. Please click Apply to view complete job details on the hiring company website.')
    .replace(/\n\n+/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  body.innerHTML = `
    <!-- Candidate Fast Decision Grid (Experience, Seniority, Scope, Salary) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 font-mono">
      
      <!-- Experience Required -->
      <div class="p-3.5 rounded-xl bg-[#111c34] border border-white/[0.08] flex items-start gap-3">
        <div class="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <div class="min-w-0">
          <div class="text-[10px] uppercase tracking-wider text-slate-500">Experience</div>
          <div class="text-sm font-semibold text-white mt-0.5 truncate">${expText}</div>
          <div class="text-[10px] text-slate-400 mt-0.5 font-sans">${expSub}</div>
        </div>
      </div>

      <!-- Seniority Tier -->
      <div class="p-3.5 rounded-xl bg-[#111c34] border border-white/[0.08] flex items-start gap-3">
        <div class="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        </div>
        <div class="min-w-0">
          <div class="text-[10px] uppercase tracking-wider text-slate-500">Seniority</div>
          <div class="text-sm font-semibold text-white mt-0.5 truncate">${escapeHtml(seniorityText)}</div>
          <div class="text-[10px] text-slate-400 mt-0.5 font-sans">Ownership expectations</div>
        </div>
      </div>

      <!-- Remote Work Scope -->
      <div class="p-3.5 rounded-xl bg-[#111c34] border border-white/[0.08] flex items-start gap-3">
        <div class="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
        </div>
        <div class="min-w-0">
          <div class="text-[10px] uppercase tracking-wider text-slate-500">Scope</div>
          <div class="text-sm font-semibold text-white mt-0.5 truncate">${scopeText}</div>
          <div class="text-[10px] text-slate-400 mt-0.5 font-sans truncate">${escapeHtml(job.location || 'Anywhere')}</div>
        </div>
      </div>

      <!-- Compensation -->
      <div class="p-3.5 rounded-xl bg-[#111c34] border border-white/[0.08] flex items-start gap-3">
        <div class="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <div class="min-w-0">
          <div class="text-[10px] uppercase tracking-wider text-slate-500">Compensation</div>
          <div class="text-sm font-semibold text-amber-300 mt-0.5 truncate">${salaryText}</div>
          <div class="text-[10px] text-slate-400 mt-0.5 font-sans truncate">${job.employment_type || 'Full-time'}</div>
        </div>
      </div>

    </div>

    <!-- Why This Level & Role Expectations Callout Banner -->
    <div class="p-4 rounded-xl bg-[#111c34]/70 border border-white/[0.08] mb-4">
      <div class="flex items-center gap-2 mb-1.5 text-xs font-mono uppercase tracking-wider text-cyan-400 font-medium">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <span>Role Expectations & Ownership</span>
      </div>
      <p class="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
        ${escapeHtml(seniorityRationale)}
      </p>
    </div>

    <!-- Verified Tech Stack & Skills -->
    <div class="p-4 rounded-xl bg-[#111c34] border border-white/[0.08] mb-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400 font-medium">
          <svg class="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
          <span>Verified Tech Stack</span>
        </div>
        <span class="text-[11px] font-mono text-slate-500">${techList.length} skills</span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        ${techChipsHtml}
      </div>
    </div>

    <!-- Role Overview & Full Description -->
    <div class="pt-2">
      <div class="flex items-center justify-between mb-2.5">
        <div class="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400 font-medium">
          <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>Job Description & Requirements</span>
        </div>
        <span class="text-[11px] font-mono text-zinc-500">Official Posting</span>
      </div>
      <div class="text-sm text-zinc-300 leading-relaxed font-normal bg-[#18181d] p-4 sm:p-5 rounded-xl border border-white/[0.08] max-h-[320px] overflow-y-auto space-y-3">
        ${cleanDesc}
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const modalBox = modal.querySelector('.relative.w-full');
  if (window.anime && modalBox && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    anime({
      targets: modalBox,
      scale: [0.94, 1],
      opacity: [0, 1],
      translateY: [16, 0],
      easing: 'easeOutElastic(1, .85)',
      duration: 420
    });
  }
}

function openJobModalById(jobId, e) {
  if (e) e.stopPropagation();
  const job = state.allJobs.find(j => j.job_id === jobId);
  if (job) {
    openJobModal(job);
  }
}

function closeJobModal() {
  const modal = document.getElementById('job-modal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// ── Alerts & Newsletter Modal Functions ─────────────────────────────────────────
// Google Sheets Webhook endpoint for Option 1 Subscriber data collection
// Replace or configure via window.REMOTE_JOBS_HUB_WEBHOOK_URL
const GOOGLE_SHEET_WEBHOOK_URL = window.REMOTE_JOBS_HUB_WEBHOOK_URL || '';

// Optional Stripe Checkout Links (Create in dashboard.stripe.com/payment-links)
const STRIPE_CHECKOUT_LINKS = window.STRIPE_CHECKOUT_LINKS || {
  vip1mo: window.MONETIZATION_CONFIG?.jobAlerts?.paymentUrl1Mo || '',
  vip3mo: window.MONETIZATION_CONFIG?.jobAlerts?.paymentUrl3Mo || '',
  postJob: window.MONETIZATION_CONFIG?.employerPayment?.paymentUrl || ''
};

function openAlertsModal(defaultPlan = 'vip3mo') {
  const modal = document.getElementById('alerts-modal');
  if (!modal) return;
  
  const form = document.getElementById('alerts-form');
  const success = document.getElementById('alerts-success');
  if (form) form.classList.remove('hidden');
  if (success) success.classList.add('hidden');

  setAlertPlan(defaultPlan);
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const modalBox = modal.querySelector('.relative.w-full');
  if (window.anime && modalBox && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    anime({
      targets: modalBox,
      scale: [0.94, 1],
      opacity: [0, 1],
      translateY: [16, 0],
      easing: 'easeOutElastic(1, .85)',
      duration: 420
    });
  }
}

function closeAlertsModal() {
  const modal = document.getElementById('alerts-modal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function setAlertPlan(plan) {
  const freeRadio = document.querySelector('input[name="alert-plan"][value="free"]');
  const vip1moRadio = document.querySelector('input[name="alert-plan"][value="vip1mo"]');
  const vip3moRadio = document.querySelector('input[name="alert-plan"][value="vip3mo"]');
  
  const freeCard = document.getElementById('plan-free-card');
  const vip1moCard = document.getElementById('plan-vip1mo-card');
  const vip3moCard = document.getElementById('plan-vip3mo-card');
  const submitBtn = document.getElementById('alerts-submit-btn');

  // Reset all cards to default inactive styling in Midnight Slate Navy
  const inactiveClass = 'alert-plan-card relative p-3 rounded-2xl border border-white/[0.08] bg-[#090e1c] hover:border-cyan-500/40 cursor-pointer transition flex flex-col justify-between';
  if (freeCard) freeCard.className = inactiveClass;
  if (vip1moCard) vip1moCard.className = inactiveClass;
  if (vip3moCard) vip3moCard.className = inactiveClass;

  if (plan === 'vip3mo') {
    if (vip3moRadio) vip3moRadio.checked = true;
    if (vip3moCard) vip3moCard.className = 'alert-plan-card active relative p-3 rounded-2xl border-2 border-amber-500 bg-amber-500/10 cursor-pointer transition flex flex-col justify-between shadow-lg shadow-amber-500/10';
    if (submitBtn) {
      submitBtn.innerHTML = '<span>⚡ Activate 3-Month Sprint Pass ($10) • Save 33%</span>';
      submitBtn.className = 'w-full py-3 px-4 rounded-xl font-bold font-mono text-xs sm:text-sm text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20';
    }
  } else if (plan === 'vip1mo') {
    if (vip1moRadio) vip1moRadio.checked = true;
    if (vip1moCard) vip1moCard.className = 'alert-plan-card active relative p-3 rounded-2xl border-2 border-sky-500 bg-sky-500/10 cursor-pointer transition flex flex-col justify-between shadow-lg shadow-sky-500/10';
    if (submitBtn) {
      submitBtn.innerHTML = '<span>⚡ Activate 1-Month VIP Drops ($5/mo)</span>';
      submitBtn.className = 'w-full py-3 px-4 rounded-xl font-bold font-mono text-xs sm:text-sm text-slate-950 bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20';
    }
  } else {
    if (freeRadio) freeRadio.checked = true;
    if (freeCard) freeCard.className = 'alert-plan-card active relative p-3 rounded-2xl border-2 border-cyan-500 bg-cyan-500/10 cursor-pointer transition flex flex-col justify-between shadow-lg shadow-cyan-500/10';
    if (submitBtn) {
      submitBtn.innerHTML = '<span>Subscribe to Free Weekly Digest</span>';
      submitBtn.className = 'w-full py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 transition shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center justify-center';
    }
  }
}

// ── Recruiter Post a Job Modal Functions ────────────────────────────────────────
function openPostJobModal() {
  const modal = document.getElementById('post-job-modal');
  if (!modal) return;
  const form = document.getElementById('post-job-form');
  const success = document.getElementById('post-job-success');
  if (form) form.classList.remove('hidden');
  if (success) success.classList.add('hidden');

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const modalBox = modal.querySelector('.relative.w-full');
  if (window.anime && modalBox && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    anime({
      targets: modalBox,
      scale: [0.94, 1],
      opacity: [0, 1],
      translateY: [16, 0],
      easing: 'easeOutElastic(1, .85)',
      duration: 420
    });
  }
}

function closePostJobModal() {
  const modal = document.getElementById('post-job-modal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// ── Featured Jobs Local Persistence ──────────────────────────────────────────
function getStoredFeaturedJobs() {
  try {
    const raw = localStorage.getItem('rjh_featured_jobs');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function persistFeaturedJob(job) {
  try {
    const jobs = getStoredFeaturedJobs();
    jobs.unshift(job);
    localStorage.setItem('rjh_featured_jobs', JSON.stringify(jobs.slice(0, 50)));
  } catch (e) {
    console.error('Failed saving featured job', e);
  }
}

// ── Search & Filter Event Handlers ─────────────────────────────────────────────
function bindEventHandlers() {
  // 0. Search Target Radio Toggle (All Content vs Title Only)
  document.querySelectorAll('input[name="search-target"]').forEach(radio => {
    radio.addEventListener('change', e => {
      state.searchTarget = e.target.value;
      state.currentPage = 1;
      applyFilters();
    });
  });

  // 1. Omni-Search Form & Input
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search-btn');

  let searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      state.searchQuery = e.target.value;
      if (clearBtn) clearBtn.classList.toggle('hidden', !state.searchQuery);
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.currentPage = 1;
        applyFilters();
      }, 250);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      state.searchQuery = '';
      state.currentPage = 1;
      clearBtn.classList.add('hidden');
      applyFilters();
    });
  }

  // Header Nav Search Button (Quick Jump & Focus)
  const navSearchBtn = document.getElementById('nav-search-btn');
  if (navSearchBtn) {
    navSearchBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => searchInput.focus(), 300);
      }
    });
  }

  // 2. Category Pills & Role Select Sync
  const roleSelect = document.getElementById('role-select');
  const rolePills = document.querySelectorAll('.role-pill');
  
  if (roleSelect) {
    roleSelect.addEventListener('change', e => {
      state.category = e.target.value;
      rolePills.forEach(p => {
        const isMatch = (p.dataset.category || 'all') === state.category;
        const b = p.querySelector('.role-count-badge');
        if (isMatch) {
          p.className = 'role-pill active shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20 cursor-pointer flex items-center gap-2';
          if (b) b.className = 'role-count-badge px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/30 text-cyan-200';
        } else {
          p.className = 'role-pill shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition bg-[#0d1527] text-slate-400 hover:text-cyan-300 hover:bg-[#111c34] border border-white/[0.08] cursor-pointer flex items-center gap-2';
          if (b) b.className = 'role-count-badge px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] text-slate-400';
        }
      });
      state.currentPage = 1;
      applyFilters();
    });
  }

  rolePills.forEach(pill => {
    pill.addEventListener('click', () => {
      rolePills.forEach(p => {
        p.className = 'role-pill shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition bg-[#0d1527] text-slate-400 hover:text-cyan-300 hover:bg-[#111c34] border border-white/[0.08] cursor-pointer flex items-center gap-2';
        const b = p.querySelector('.role-count-badge');
        if (b) b.className = 'role-count-badge px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] text-slate-400';
      });
      pill.className = 'role-pill active shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20 cursor-pointer flex items-center gap-2';
      const activeBadge = pill.querySelector('.role-count-badge');
      if (activeBadge) activeBadge.className = 'role-count-badge px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/30 text-cyan-200';

      state.category = pill.dataset.category || 'all';
      if (roleSelect) roleSelect.value = state.category;
      state.currentPage = 1;
      applyFilters();
    });
  });

  // 3. Scope Tabs (All vs Worldwide vs Americas vs Europe vs APAC)
  const scopeTabs = [
    { id: 'scope-all-btn', scope: 'all' },
    { id: 'scope-worldwide-btn', scope: 'worldwide' },
    { id: 'scope-americas-btn', scope: 'americas' },
    { id: 'scope-europe-btn', scope: 'europe' },
    { id: 'scope-apac-btn', scope: 'apac' },
  ];

  scopeTabs.forEach(tab => {
    const el = document.getElementById(tab.id);
    if (!el) return;
    el.addEventListener('click', () => {
      scopeTabs.forEach(t => {
        const other = document.getElementById(t.id);
        if (other) {
          other.className = 'scope-tab px-3 py-1 rounded-lg text-xs font-mono text-slate-400 hover:text-white bg-[#0d1527] border border-white/[0.08] hover:border-cyan-500/30 transition cursor-pointer';
        }
      });
      el.className = 'scope-tab active px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 transition cursor-pointer shadow-sm shadow-cyan-500/20';
      state.scope = tab.scope;
      state.currentPage = 1;
      applyFilters();
    });
  });

  // 4. Experience & Seniority Level Dropdowns
  const expSelect = document.getElementById('exp-select');
  const senioritySelect = document.getElementById('seniority-select');

  if (expSelect) {
    expSelect.addEventListener('change', e => {
      state.seniority = e.target.value;
      if (senioritySelect) senioritySelect.value = e.target.value;
      state.currentPage = 1;
      applyFilters();
    });
  }

  if (senioritySelect) {
    senioritySelect.addEventListener('change', e => {
      state.seniority = e.target.value;
      if (expSelect) expSelect.value = e.target.value;
      state.currentPage = 1;
      applyFilters();
    });
  }

  // 5. Company Dropdown
  const compSelect = document.getElementById('company-select');
  if (compSelect) {
    compSelect.addEventListener('change', e => {
      state.company = e.target.value;
      renderTopCompanyChips();
      state.currentPage = 1;
      applyFilters();
    });
  }

  // 6. Employment Type Dropdown
  const empSelect = document.getElementById('employment-select');
  if (empSelect) {
    empSelect.addEventListener('change', e => {
      state.employmentType = e.target.value;
      state.currentPage = 1;
      applyFilters();
    });
  }

  // 7. ATS & Source Platform Dropdown
  const srcSelect = document.getElementById('source-select');
  if (srcSelect) {
    srcSelect.addEventListener('change', e => {
      state.source = e.target.value;
      if (state.source === 'CompanyATS' || state.source === 'ashby' || state.source === 'greenhouse' || state.source === 'lever') {
        state.directAtsOnly = true;
        const directAtsCheck = document.getElementById('direct-ats-checkbox');
        if (directAtsCheck) directAtsCheck.checked = true;
      }
      populateCompanyDropdown();
      renderTopCompanyChips();
      state.currentPage = 1;
      applyFilters();
    });
  }

  // 8. Date Posted Dropdown
  const dateSelect = document.getElementById('date-posted-select');
  if (dateSelect) {
    dateSelect.addEventListener('change', e => {
      state.datePosted = e.target.value;
      state.currentPage = 1;
      applyFilters();
    });
  }

  // 9. Checkboxes
  const directAtsCheck = document.getElementById('direct-ats-checkbox');
  if (directAtsCheck) {
    directAtsCheck.addEventListener('change', e => {
      state.directAtsOnly = e.target.checked;
      populateCompanyDropdown();
      renderTopCompanyChips();
      state.currentPage = 1;
      applyFilters();
    });
  }

  const worldwideCheck = document.getElementById('worldwide-checkbox');
  if (worldwideCheck) {
    worldwideCheck.addEventListener('change', e => {
      state.worldwideOnly = e.target.checked;
      state.currentPage = 1;
      applyFilters();
    });
  }

  const salaryCheck = document.getElementById('salary-checkbox');
  if (salaryCheck) {
    salaryCheck.addEventListener('change', e => {
      state.salaryOnly = e.target.checked;
      state.currentPage = 1;
      applyFilters();
    });
  }

  // 10. Sort By Dropdown
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', e => {
      state.sortBy = e.target.value;
      applyFilters();
    });
  }

  // 11. Page Size Selector
  const pageSizeSelect = document.getElementById('page-size-select');
  if (pageSizeSelect) {
    pageSizeSelect.value = state.pageSize.toString();
    pageSizeSelect.addEventListener('change', e => {
      state.pageSize = parseInt(e.target.value, 10);
      localStorage.setItem('rjh_page_size', state.pageSize.toString());
      state.currentPage = 1;
      renderJobCards();
    });
  }

  // 12. View Mode Switchers
  const cardBtn = document.getElementById('view-card-btn');
  const listBtn = document.getElementById('view-list-btn');
  if (cardBtn) cardBtn.addEventListener('click', () => setViewMode('card'));
  if (listBtn) listBtn.addEventListener('click', () => setViewMode('list'));

  // 13. Tracker Tabs
  const tabAllBtn = document.getElementById('tab-all-jobs-btn');
  const tabSavedBtn = document.getElementById('tab-saved-jobs-btn');
  const tabAppliedBtn = document.getElementById('tab-applied-jobs-btn');

  if (tabAllBtn) tabAllBtn.addEventListener('click', () => setTrackerTab('all'));
  if (tabSavedBtn) tabSavedBtn.addEventListener('click', () => setTrackerTab('saved'));
  if (tabAppliedBtn) tabAppliedBtn.addEventListener('click', () => setTrackerTab('applied'));

  // Header Nav Tracker buttons
  const navSavedBtn = document.getElementById('tracker-saved-nav-btn');
  if (navSavedBtn) navSavedBtn.addEventListener('click', () => setTrackerTab('saved'));

  const navAppliedBtn = document.getElementById('tracker-applied-nav-btn');
  if (navAppliedBtn) navAppliedBtn.addEventListener('click', () => setTrackerTab('applied'));

  // Quick pills in filter toolbar
  const quickSavedBtn = document.getElementById('quick-saved-btn');
  if (quickSavedBtn) quickSavedBtn.addEventListener('click', () => setTrackerTab('saved'));

  const quickAppliedBtn = document.getElementById('quick-applied-btn');
  if (quickAppliedBtn) quickAppliedBtn.addEventListener('click', () => setTrackerTab('applied'));

  // 14. Toast Confirmation & Dismiss
  const toastConfirmBtn = document.getElementById('toast-confirm-btn');
  const toastDismissBtn = document.getElementById('toast-dismiss-btn');
  const toast = document.getElementById('applied-toast');

  if (toastConfirmBtn) {
    toastConfirmBtn.addEventListener('click', () => {
      if (pendingToastJobId) {
        state.appliedJobs[pendingToastJobId] = {
          appliedAt: new Date().toISOString(),
          status: 'Applied'
        };
        persistAppliedJobs();
        renderJobCards();
      }
      if (toast) toast.classList.add('hidden');
    });
  }

  if (toastDismissBtn) {
    toastDismissBtn.addEventListener('click', () => {
      if (toast) toast.classList.add('hidden');
    });
  }

  // 15. Reset Filters
  const resetBtn = document.getElementById('reset-filters-btn');
  if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);

  // 15b. Toggle Advanced Filters (Mobile & Responsive)
  const toggleAdvBtn = document.getElementById('toggle-advanced-filters-btn');
  const advRow = document.getElementById('advanced-filters-row');
  const toggleText = document.getElementById('toggle-filter-text');
  const toggleIcon = document.getElementById('toggle-filter-icon');
  if (toggleAdvBtn && advRow) {
    toggleAdvBtn.addEventListener('click', () => {
      const isHidden = advRow.classList.contains('hidden');
      if (isHidden) {
        advRow.classList.remove('hidden');
        if (toggleText) toggleText.textContent = 'Fewer Filters';
        if (toggleIcon) toggleIcon.textContent = '▲';
        toggleAdvBtn.classList.add('bg-white/[0.08]', 'text-cyan-400');
      } else {
        advRow.classList.add('hidden');
        if (toggleText) toggleText.textContent = 'More Filters';
        if (toggleIcon) toggleIcon.textContent = '⚙';
        toggleAdvBtn.classList.remove('bg-white/[0.08]', 'text-cyan-400');
      }
    });
  }

  // 16. Modal Closing & Global Keyboard Shortcuts (Cmd+K / Ctrl+K and Escape)
  const closeBtn = document.getElementById('modal-close-btn');
  const backdrop = document.getElementById('modal-backdrop');
  if (closeBtn) closeBtn.addEventListener('click', closeJobModal);
  if (backdrop) backdrop.addEventListener('click', closeJobModal);
  window.addEventListener('keydown', e => {
    // Cmd+K / Ctrl+K global search focus
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const sInput = document.getElementById('search-input');
      if (sInput) {
        sInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => sInput.focus(), 150);
      }
      return;
    }

    // Escape closes modals or blurs search
    if (e.key === 'Escape') {
      closeJobModal();
      closeAlertsModal();
      closePostJobModal();
      const sInput = document.getElementById('search-input');
      if (sInput && document.activeElement === sInput) {
        sInput.blur();
      }
    }
  });

  // 17. Candidate Alerts & Newsletter Modal Handlers
  const navAlertsBtn = document.getElementById('nav-alerts-btn');
  const heroAlertsBtn = document.getElementById('hero-alerts-btn');
  const floatingAlertsBtn = document.getElementById('floating-alerts-btn');
  const alertsCloseBtn = document.getElementById('alerts-modal-close-btn');
  const alertsBackdrop = document.getElementById('alerts-modal-backdrop');
  const alertsSuccessCloseBtn = document.getElementById('alerts-success-close-btn');
  const alertsForm = document.getElementById('alerts-form');

  if (navAlertsBtn) navAlertsBtn.addEventListener('click', () => openAlertsModal('vip3mo'));
  if (heroAlertsBtn) heroAlertsBtn.addEventListener('click', () => openAlertsModal('vip3mo'));
  if (floatingAlertsBtn) floatingAlertsBtn.addEventListener('click', () => openAlertsModal('vip3mo'));
  if (alertsCloseBtn) alertsCloseBtn.addEventListener('click', closeAlertsModal);
  if (alertsBackdrop) alertsBackdrop.addEventListener('click', closeAlertsModal);
  if (alertsSuccessCloseBtn) alertsSuccessCloseBtn.addEventListener('click', closeAlertsModal);

  const planFreeCard = document.getElementById('plan-free-card');
  const planVip1moCard = document.getElementById('plan-vip1mo-card');
  const planVip3moCard = document.getElementById('plan-vip3mo-card');
  if (planFreeCard) planFreeCard.addEventListener('click', () => setAlertPlan('free'));
  if (planVip1moCard) planVip1moCard.addEventListener('click', () => setAlertPlan('vip1mo'));
  if (planVip3moCard) planVip3moCard.addEventListener('click', () => setAlertPlan('vip3mo'));
  document.querySelectorAll('input[name="alert-plan"]').forEach(r => {
    r.addEventListener('change', e => setAlertPlan(e.target.value));
  });

  if (alertsForm) {
    alertsForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = (document.getElementById('alerts-email')?.value || '').trim();
      const role = document.getElementById('alerts-role')?.value || 'all';
      const scope = document.getElementById('alerts-scope')?.value || 'worldwide';
      const keywords = (document.getElementById('alerts-keywords')?.value || '').trim();
      const plan = document.querySelector('input[name="alert-plan"]:checked')?.value || 'vip3mo';

      if (!email) return;

      // Expiration date calculation
      let expiresAt = null;
      const now = new Date();
      if (plan === 'vip3mo') {
        const exp = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        expiresAt = exp.toISOString();
      } else if (plan === 'vip1mo') {
        const exp = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        expiresAt = exp.toISOString();
      }

      const subData = {
        email,
        roleCategory: role,
        location: scope,
        keywords,
        plan,
        expiresAt,
        status: 'active',
        subscribedAt: now.toISOString()
      };

      // 1. Local backup persistence
      try {
        const stored = JSON.parse(localStorage.getItem('rjh_alert_subscribers') || '[]');
        stored.push(subData);
        localStorage.setItem('rjh_alert_subscribers', JSON.stringify(stored));
      } catch (err) {
        console.error('Failed saving subscriber locally', err);
      }

      // 2. Google Sheets Webhook Dispatch (Option 1)
      const webhookUrl = GOOGLE_SHEET_WEBHOOK_URL || window.REMOTE_JOBS_HUB_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subData)
          }).catch(err => console.warn('Google Sheets Webhook non-fatal warning:', err));
        } catch (fetchErr) {
          console.warn('Google Sheets Webhook dispatch error:', fetchErr);
        }
      }

      // 3. Paid Stripe Checkout Redirection (if configured)
      if ((plan === 'vip3mo' || plan === 'vip1mo') && STRIPE_CHECKOUT_LINKS[plan]) {
        try {
          const stripeUrl = new URL(STRIPE_CHECKOUT_LINKS[plan]);
          stripeUrl.searchParams.set('prefilled_email', email);
          stripeUrl.searchParams.set('client_reference_id', plan);
          window.location.href = stripeUrl.toString();
          return;
        } catch (urlErr) {
          console.warn('Stripe URL format warning:', urlErr);
        }
      }

      const form = document.getElementById('alerts-form');
      const success = document.getElementById('alerts-success');
      const titleEl = document.getElementById('alerts-success-title');
      const descEl = document.getElementById('alerts-success-desc');

      if (form) form.classList.add('hidden');
      if (success) success.classList.remove('hidden');

      if (plan === 'vip3mo') {
        if (titleEl) titleEl.textContent = '⭐ 3-Month Job Search Sprint Pass Activated!';
        const expFormatted = new Date(expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        if (descEl) descEl.textContent = `You're covered for your entire job search through ${expFormatted}! Instant direct-ATS alerts for ${role.toUpperCase()} roles will be dispatched directly to ${email}.`;
      } else if (plan === 'vip1mo') {
        if (titleEl) titleEl.textContent = '⚡ 1-Month VIP Alerts Activated!';
        if (descEl) descEl.textContent = `You're all set for 30 days! Instant direct-ATS alerts for ${role.toUpperCase()} roles will be dispatched directly to ${email}.`;
      } else {
        if (titleEl) titleEl.textContent = "You're Subscribed to the Monday Digest!";
        if (descEl) descEl.textContent = `Every Monday morning, we will deliver the top 20 verified remote jobs directly to ${email}.`;
      }
    });
  }

  // 18. Recruiter Post a Job Modal Handlers ($49)
  const navPostJobBtn = document.getElementById('nav-post-job-btn');
  const heroPostJobBtn = document.getElementById('hero-post-job-btn');
  const toolbarPostJobBtn = document.getElementById('toolbar-post-job-btn');
  const postJobCloseBtn = document.getElementById('post-job-modal-close-btn');
  const postJobBackdrop = document.getElementById('post-job-modal-backdrop');
  const postJobSuccessCloseBtn = document.getElementById('post-job-success-close-btn');
  const postJobForm = document.getElementById('post-job-form');

  if (navPostJobBtn) navPostJobBtn.addEventListener('click', openPostJobModal);
  if (heroPostJobBtn) heroPostJobBtn.addEventListener('click', openPostJobModal);
  if (toolbarPostJobBtn) toolbarPostJobBtn.addEventListener('click', openPostJobModal);
  if (postJobCloseBtn) postJobCloseBtn.addEventListener('click', closePostJobModal);
  if (postJobBackdrop) postJobBackdrop.addEventListener('click', closePostJobModal);
  if (postJobSuccessCloseBtn) {
    postJobSuccessCloseBtn.addEventListener('click', () => {
      closePostJobModal();
      document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (postJobForm) {
    postJobForm.addEventListener('submit', e => {
      e.preventDefault();
      const title = (document.getElementById('post-job-role-title')?.value || '').trim();
      const company = (document.getElementById('post-job-company')?.value || '').trim();
      const domain = document.getElementById('post-job-domain')?.value || 'engineer';
      const scope = document.getElementById('post-job-scope')?.value || 'Worldwide';
      const salary = (document.getElementById('post-job-salary')?.value || '').trim();
      const applyUrl = (document.getElementById('post-job-apply-url')?.value || '').trim();
      const email = (document.getElementById('post-job-email')?.value || '').trim();
      const description = (document.getElementById('post-job-description')?.value || '').trim();

      if (!title || !company || !applyUrl) return;

      const featuredJob = {
        job_id: 'featured_' + Date.now(),
        title,
        company,
        role_category: domain,
        remote_scope: scope,
        salary,
        direct_apply_url: applyUrl,
        apply_url: applyUrl,
        source: 'CompanyATS',
        description: description || `Featured remote position at ${company}. Direct application via official portal.`,
        posted_date: new Date().toISOString(),
        collected_date: new Date().toISOString(),
        is_featured: true,
        contact_email: email
      };

      persistFeaturedJob(featuredJob);
      state.allJobs.unshift(featuredJob);
      applyFilters();

      // Recruiter Stripe Checkout Redirection (if configured)
      if (STRIPE_CHECKOUT_LINKS.postJob) {
        try {
          const stripeUrl = new URL(STRIPE_CHECKOUT_LINKS.postJob);
          if (email) stripeUrl.searchParams.set('prefilled_email', email);
          window.location.href = stripeUrl.toString();
          return;
        } catch (urlErr) {
          console.warn('Stripe URL format warning:', urlErr);
        }
      }

      const form = document.getElementById('post-job-form');
      const success = document.getElementById('post-job-success');
      if (form) form.classList.add('hidden');
      if (success) success.classList.remove('hidden');
    });
  }

  // 17. Refresh Button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.classList.add('animate-spin');
      setTimeout(() => {
        refreshBtn.classList.remove('animate-spin');
        loadJobsData();
      }, 700);
    });
  }
}

// ── Quick Helpers ─────────────────────────────────────────────────────────────
function setQuickSearch(keyword) {
  state.searchQuery = keyword;
  state.currentPage = 1;

  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search-btn');

  if (searchInput) searchInput.value = keyword;
  if (clearBtn) clearBtn.classList.remove('hidden');

  applyFilters();
  document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth' });
}

function resetAllFilters() {
  state.category = 'all';
  state.scope = 'all';
  state.seniority = 'all';
  state.company = 'all';
  state.employmentType = 'all';
  state.source = 'all';
  state.datePosted = 'all';
  state.directAtsOnly = false;
  state.worldwideOnly = false;
  state.salaryOnly = false;
  state.sortBy = 'newest';
  state.searchQuery = '';
  state.searchTarget = 'all';
  state.trackerTab = 'all';
  state.currentPage = 1;

  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search-btn');

  if (searchInput) searchInput.value = '';
  if (clearBtn) clearBtn.classList.add('hidden');

  document.querySelectorAll('input[name="search-target"]').forEach(r => {
    r.checked = (r.value === 'all');
  });

  const roleSelect = document.getElementById('role-select');
  if (roleSelect) roleSelect.value = 'all';

  const expSelect = document.getElementById('exp-select');
  if (expSelect) expSelect.value = 'all';

  const senioritySelect = document.getElementById('seniority-select');
  if (senioritySelect) senioritySelect.value = 'all';

  const compSelect = document.getElementById('company-select');
  if (compSelect) compSelect.value = 'all';

  const empSelect = document.getElementById('employment-select');
  if (empSelect) empSelect.value = 'all';

  const srcSelect = document.getElementById('source-select');
  if (srcSelect) srcSelect.value = 'all';

  const dateSelect = document.getElementById('date-posted-select');
  if (dateSelect) dateSelect.value = 'all';

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = 'newest';

  const directAtsCheck = document.getElementById('direct-ats-checkbox');
  if (directAtsCheck) directAtsCheck.checked = false;

  const worldwideCheck = document.getElementById('worldwide-checkbox');
  if (worldwideCheck) worldwideCheck.checked = false;

  const salaryCheck = document.getElementById('salary-checkbox');
  if (salaryCheck) salaryCheck.checked = false;

  populateCompanyDropdown();
  renderTopCompanyChips();

  // Reset Role Pills
  const rolePills = document.querySelectorAll('.role-pill');
  rolePills.forEach((p, idx) => {
    const b = p.querySelector('.role-count-badge');
    if (idx === 0) {
      p.className = 'role-pill active shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20 cursor-pointer flex items-center gap-2';
      if (b) b.className = 'role-count-badge px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/30 text-cyan-200';
    } else {
      p.className = 'role-pill shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition bg-[#0d1527] text-slate-400 hover:text-cyan-300 hover:bg-[#111c34] border border-white/[0.08] cursor-pointer flex items-center gap-2';
      if (b) b.className = 'role-count-badge px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] text-slate-400';
    }
  });

  // Reset Scope Tabs
  const scopeTabs = ['scope-all-btn', 'scope-worldwide-btn', 'scope-americas-btn', 'scope-europe-btn', 'scope-apac-btn'];
  scopeTabs.forEach((id, idx) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (idx === 0) {
      el.className = 'scope-tab active px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 transition cursor-pointer shadow-sm shadow-cyan-500/20';
    } else {
      el.className = 'scope-tab px-3 py-1 rounded-lg text-xs font-mono text-slate-400 hover:text-white bg-[#0d1527] border border-white/[0.08] hover:border-cyan-500/30 transition cursor-pointer';
    }
  });

  // Reset Tracker Tabs
  setTrackerTab('all');
}

function showEmptyState(msg) {
  const container = document.getElementById('job-grid');
  if (container) {
    container.innerHTML = `
      <div class="p-12 text-center bg-[#0d1527] border border-white/[0.08] rounded-2xl max-w-lg mx-auto shadow-2xl">
        <div class="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 mx-auto flex items-center justify-center mb-3">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35"/></svg>
        </div>
        <h3 class="text-base sm:text-lg font-bold text-white mb-1 tracking-tight">${escapeHtml(msg)}</h3>
      </div>
    `;
  }
}

// ── Global Window Exports ─────────────────────────────────────────────────────
window.resetAllFilters = resetAllFilters;
window.setQuickSearch = setQuickSearch;
window.toggleSaveJob = toggleSaveJob;
window.toggleApplyJob = toggleApplyJob;
window.handleExternalApply = handleExternalApply;
window.setViewMode = setViewMode;
window.setTrackerTab = setTrackerTab;
window.goToPage = goToPage;
window.openJobModal = openJobModal;
window.openJobModalById = openJobModalById;
window.selectCompany = selectCompany;
window.updateDirectAtsPanelVisibility = updateDirectAtsPanelVisibility;
window.closeJobModal = closeJobModal;
window.openAlertsModal = openAlertsModal;
window.closeAlertsModal = closeAlertsModal;
window.setAlertPlan = setAlertPlan;
window.openPostJobModal = openPostJobModal;
window.closePostJobModal = closePostJobModal;
window.state = state;

// ── Application Bootstrap ─────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
