/**
 * RemoteJobsHub - Global Remote Tech Jobs Web Application
 * Lightweight, zero-dependency, ultra-fast client-side search & filtering engine.
 * Features: Faceted filtering, Direct ATS indexer, View Mode Switcher, Application Tracker, Numbered Pagination.
 */

// ── State Management ──────────────────────────────────────────────────────────
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

function handleExternalApply(jobId, companyName, e) {
  if (e) e.stopPropagation();
  pendingToastJobId = jobId;
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
    '<span class="text-[11px] font-bold text-slate-400 shrink-0 mr-1 flex items-center gap-1">' +
    '<span>🏢 Top Employers:</span>' +
    '</span>' +
    '<button type="button" onclick="selectCompany(\'all\')" class="company-chip px-2.5 py-1 rounded-lg text-xs font-bold ' +
    (isAll ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800') +
    ' transition shrink-0 cursor-pointer">All Employers</button>';

  topCompanies.forEach(([comp, count]) => {
    const isSelected = state.company.toLowerCase() === comp.toLowerCase();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'company-chip px-2.5 py-1 rounded-lg text-xs font-semibold ' +
      (isSelected ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20' : 'bg-slate-950 text-slate-300 hover:text-emerald-400 border border-slate-800') +
      ' transition shrink-0 cursor-pointer flex items-center gap-1';
    btn.innerHTML = '<span>' + escapeHtml(comp) + '</span><span class="' +
      (isSelected ? 'text-slate-950 font-black' : 'text-emerald-400 font-bold') + '">(' + count + ')</span>';
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

let isArchiveHydrated = false;

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
          updateTrackerCounters();
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

function onJobsLoaded() {
  const count = state.allJobs.length;
  const headerCount = document.getElementById('header-count-badge');
  if (headerCount) {
    headerCount.textContent = count.toLocaleString() + ' verified remote jobs';
  }
  updateTrackerCounters();
  populateCompanyDropdown();
  applyFilters();

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
      cardBtn.className = 'view-mode-btn active px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 transition flex items-center gap-1.5 cursor-pointer shadow-sm';
      listBtn.className = 'view-mode-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer';
    } else {
      listBtn.className = 'view-mode-btn active px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 transition flex items-center gap-1.5 cursor-pointer shadow-sm';
      cardBtn.className = 'view-mode-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer';
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
      el.className = 'tracker-nav-tab active px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 transition cursor-pointer flex items-center gap-2 whitespace-nowrap shadow-md shadow-emerald-500/20';
      const badge = el.querySelector('span:last-child');
      if (badge) badge.className = 'px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/20 text-slate-950 font-black';
    } else {
      el.className = 'tracker-nav-tab px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-950 border border-slate-800 transition cursor-pointer flex items-center gap-2 whitespace-nowrap';
      const badge = el.querySelector('span:last-child');
      if (badge) {
        if (t.tab === 'saved') badge.className = 'px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold';
        else if (t.tab === 'applied') badge.className = 'px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold';
        else badge.className = 'px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-400 font-bold';
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

    // 3. Query Search (Title, Company, Location, Description)
    if (query) {
      const titleMatch = (job.title || '').toLowerCase().includes(query);
      const companyMatch = (job.company || '').toLowerCase().includes(query);
      const locMatch = (job.location || '').toLowerCase().includes(query);
      const descMatch = (job.description || '').toLowerCase().includes(query);
      if (!titleMatch && !companyMatch && !locMatch && !descMatch) return false;
    }

    // 4. Category / Job Role Filter
    if (cat !== 'all') {
      const title = (job.title || '').toLowerCase();
      if (cat === 'engineer') {
        const isEng = /\b(engineer|developer|architect|fullstack|frontend|backend|software)\b/i.test(title);
        if (!isEng) return false;
      } else if (cat === 'qa') {
        const isQA = /\b(qa|quality\s+assurance|tester|testing|sdet|test\s+engineer|automation)\b/i.test(title);
        if (!isQA) return false;
      } else if (cat === 'ai') {
        const isAI = /\b(ai|artificial\s+intelligence|machine\s+learning|ml|llm|data\s+scientist|nlp|deep\s+learning)\b/i.test(title);
        if (!isAI) return false;
      } else if (cat === 'devops') {
        const isDevOps = /\b(devops|sre|reliability|cloud|infrastructure|platform|kubernetes|aws)\b/i.test(title);
        if (!isDevOps) return false;
      } else if (cat === 'data') {
        const isData = /\b(data\s+engineer|bi|analyst|analytics|database|etl|pipeline)\b/i.test(title);
        if (!isData) return false;
      } else if (cat === 'mobile') {
        const isMobile = /\b(ios|android|mobile|flutter|react\s+native|swift|kotlin)\b/i.test(title);
        if (!isMobile) return false;
      } else if (cat === 'design') {
        const isDesign = /\b(designer|ui|ux|product\s+designer|graphic|creative)\b/i.test(title);
        if (!isDesign) return false;
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
      emptyMsg = 'Click "✅ Mark as Applied" on any job card when you submit your application to track your status here!';
    } else if (state.trackerTab === 'saved') {
      emptyTitle = 'No saved jobs in your list';
      emptyMsg = 'Bookmark interesting remote jobs by clicking the ⭐ icon on any card.';
    }

    container.className = 'min-h-[300px] flex items-center justify-center';
    container.innerHTML = `
      <div class="p-10 sm:p-14 text-center bg-slate-900 border border-slate-800 rounded-3xl max-w-lg mx-auto shadow-2xl">
        <div class="text-5xl mb-4">🔍</div>
        <h3 class="text-lg font-bold text-white mb-2">${emptyTitle}</h3>
        <p class="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
          ${emptyMsg}
        </p>
        <button onclick="resetAllFilters()" class="px-5 py-2.5 text-xs font-bold bg-emerald-500 text-slate-950 rounded-xl hover:bg-emerald-400 transition cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95">
          Show All Remote Openings ➔
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

  chunk.forEach(job => {
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

    // Format Scope Badge
    let scopeBadge = '';
    const scope = (job.remote_scope || '').toLowerCase();
    if (scope === 'worldwide') {
      scopeBadge = '<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">🌐 Worldwide</span>';
    } else if (scope.includes('americas')) {
      scopeBadge = '<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">🇺🇸 Americas / US</span>';
    } else if (scope.includes('europe') || scope.includes('emea')) {
      scopeBadge = '<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">🇪🇺 Europe / EMEA</span>';
    } else if (scope.includes('apac')) {
      scopeBadge = '<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">🌏 APAC</span>';
    } else {
      scopeBadge = '<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-800 text-slate-300">📍 ' + escapeHtml(job.location || 'Remote') + '</span>';
    }

    if (state.viewMode === 'list') {
      // ── COMPACT LIST ROW ──
      const row = document.createElement('div');
      row.className = 'job-card-hover bg-slate-900/90 border border-slate-800/90 hover:border-emerald-500/50 p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition cursor-pointer';
      row.onclick = () => openJobModal(job);

      row.innerHTML = `
        <div class="flex items-center gap-3 min-w-0 flex-grow">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr ${gradient} flex items-center justify-center text-white font-black text-sm shrink-0">
            ${initials}
          </div>
          <div class="min-w-0 flex-grow">
            <div class="flex items-center gap-2 flex-wrap mb-0.5">
              <span class="text-xs font-bold text-slate-300 truncate max-w-[170px]">${escapeHtml(job.company || 'Company')}</span>
              ${isDirectAts ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">⚡ Direct ATS</span>' : ''}
              ${isApplied ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ Applied</span>' : ''}
              ${relDate ? `<span class="text-[11px] text-slate-500">•</span><span class="text-[11px] font-semibold text-emerald-400/90">${relDate}</span>` : ''}
            </div>
            <h3 class="text-sm sm:text-base font-bold text-white hover:text-emerald-400 transition truncate">
              ${escapeHtml(job.title)}
            </h3>
          </div>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap shrink-0">
          ${job.experience_required ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">🎯 ${escapeHtml(job.experience_required)}</span>` : ''}
          ${scopeBadge}
          ${job.salary ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">💰 ${escapeHtml(job.salary)}</span>` : ''}
        </div>

        <div class="flex items-center gap-1.5 shrink-0 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
          <!-- Bookmark -->
          <button 
            type="button" 
            onclick="toggleSaveJob('${job.job_id}', event)" 
            class="p-2 rounded-xl text-xs font-bold ${isSaved ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700'} transition cursor-pointer"
            title="${isSaved ? 'Saved' : 'Save'}"
          >
            ${isSaved ? '⭐' : '☆'}
          </button>

          <!-- Apply Tracker -->
          <button 
            type="button" 
            onclick="toggleApplyJob('${job.job_id}', event)" 
            class="px-2.5 py-2 rounded-xl text-xs font-bold ${isApplied ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700'} transition cursor-pointer"
            title="${isApplied ? 'Marked as Applied' : 'Track Application'}"
          >
            ${isApplied ? '✅ Applied' : '○ Apply'}
          </button>

          <!-- Details -->
          <button 
            type="button" 
            onclick="openJobModalById('${job.job_id}', event)" 
            class="p-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
            title="View Details"
          >
            👁️
          </button>

          <!-- Direct Apply CTA -->
          <a 
            href="${escapeHtml(applyLink)}" 
            target="_blank" 
            rel="noopener noreferrer" 
            onclick="handleExternalApply('${job.job_id}', '${escapeHtml(job.company)}', event)"
            class="px-3.5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 rounded-xl shadow-md shadow-emerald-500/10 active:scale-95 transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <span>Apply</span>
            <span>↗</span>
          </a>
        </div>
      `;

      fragment.appendChild(row);
    } else {
      // ── RICH CARD VIEW ──
      const card = document.createElement('div');
      card.className = 'job-card-hover bg-slate-900/90 border border-slate-800/90 hover:border-emerald-500/50 p-4 sm:p-5 rounded-2xl flex flex-col justify-between gap-4 transition cursor-pointer';
      card.onclick = () => openJobModal(job);

      card.innerHTML = `
        <div>
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-tr ${gradient} flex items-center justify-center text-white font-black text-base shadow-sm shrink-0">
                ${initials}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs font-bold text-slate-300 truncate max-w-[160px]">${escapeHtml(job.company || 'Hiring Company')}</span>
                  ${isDirectAts ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">⚡ Direct ATS</span>' : ''}
                  ${isApplied ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ Applied</span>' : ''}
                </div>
                <div class="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                  <span>${escapeHtml(job.source || 'RemoteFeed')}</span>
                  ${relDate ? `<span>•</span><span class="font-semibold text-emerald-400/90">${relDate}</span>` : ''}
                </div>
              </div>
            </div>

            <button 
              type="button" 
              onclick="toggleSaveJob('${job.job_id}', event)" 
              class="p-2 rounded-xl text-xs font-bold ${isSaved ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700'} transition cursor-pointer shrink-0"
              title="${isSaved ? 'Remove Bookmark' : 'Save Job'}"
            >
              ${isSaved ? '⭐' : '☆'}
            </button>
          </div>

          <!-- Job Title -->
          <h3 class="text-base sm:text-lg font-bold text-white hover:text-emerald-400 transition line-clamp-2 leading-snug my-2">
            ${escapeHtml(job.title)}
          </h3>

          <!-- Scope & Tech Stack Tags -->
          <div class="flex items-center gap-1.5 flex-wrap mt-3">
            ${scopeBadge}
            ${job.experience_required ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">🎯 ${escapeHtml(job.experience_required)}</span>` : ''}
            ${job.seniority_level ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300">⚡ ${escapeHtml(job.seniority_level)}</span>` : ''}
            ${job.salary ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">💰 ${escapeHtml(job.salary)}</span>` : ''}
            ${job.employment_type ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300">${escapeHtml(job.employment_type)}</span>` : ''}
            ${tags.map(t => `<span class="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300">${t}</span>`).join('')}
          </div>
        </div>

        <!-- Card Footer Action Buttons -->
        <div class="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
          <button 
            type="button" 
            onclick="toggleApplyJob('${job.job_id}', event)" 
            class="px-3 py-2 text-xs font-bold rounded-xl ${isApplied ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'} transition cursor-pointer flex items-center gap-1.5"
            title="${isApplied ? 'Application tracked' : 'Track this application'}"
          >
            <span>${isApplied ? '✅ Applied' : '○ Mark Applied'}</span>
          </button>

          <div class="flex items-center gap-2">
            <!-- View Details Button -->
            <button 
              type="button" 
              onclick="openJobModalById('${job.job_id}', event)" 
              class="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="View full job details"
            >
              <span>Details</span>
              <span>👁️</span>
            </button>

            <!-- Direct Apply CTA -->
            <a 
              href="${escapeHtml(applyLink)}" 
              target="_blank" 
              rel="noopener noreferrer" 
              onclick="handleExternalApply('${job.job_id}', '${escapeHtml(job.company)}', event)"
              class="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 rounded-xl shadow-md shadow-emerald-500/10 active:scale-95 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>Apply</span>
              <span>↗</span>
            </a>
          </div>
        </div>
      `;

      fragment.appendChild(card);
    }
  });

  container.appendChild(fragment);
  renderPaginationControls(totalPages);
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
  prevBtn.className = `px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
    current === 1 
      ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed' 
      : 'bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700 cursor-pointer shadow-sm active:scale-95'
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
      dots.className = 'px-1.5 py-1 text-slate-600 text-xs font-bold';
      dots.textContent = '...';
      container.appendChild(dots);
    } else {
      const pageBtn = document.createElement('button');
      pageBtn.type = 'button';
      const isActive = p === current;
      pageBtn.className = `min-w-[34px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
        isActive 
          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' 
          : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
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
  nextBtn.className = `px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
    current === totalPages 
      ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed' 
      : 'bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700 cursor-pointer shadow-sm active:scale-95'
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
  avatar.textContent = getInitials(job.company);
  avatar.className = `w-12 h-12 rounded-2xl bg-gradient-to-tr ${getGradient(job.company)} flex items-center justify-center text-white font-black text-xl shrink-0`;

  // Bookmark Button in Modal
  const isSaved = state.savedJobIds.has(job.job_id);
  saveBtn.textContent = isSaved ? '⭐ Saved' : '☆ Save Job';
  saveBtn.onclick = () => {
    toggleSaveJob(job.job_id);
    saveBtn.textContent = state.savedJobIds.has(job.job_id) ? '⭐ Saved' : '☆ Save Job';
  };

  // Applied Tracker Button in Modal
  if (trackBtn) {
    const isApplied = isJobApplied(job.job_id);
    trackBtn.textContent = isApplied ? '✅ Marked Applied' : '○ Mark as Applied';
    trackBtn.className = `px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${
      isApplied 
        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
    }`;
    trackBtn.onclick = () => {
      toggleApplyJob(job.job_id);
      const appliedNow = isJobApplied(job.job_id);
      trackBtn.textContent = appliedNow ? '✅ Marked Applied' : '○ Mark as Applied';
      trackBtn.className = `px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${
        appliedNow 
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
      }`;
    };
  }

  const link = job.direct_apply_url || job.apply_url || '#';
  applyBtn.href = link;
  applyBtn.onclick = (e) => handleExternalApply(job.job_id, job.company, e);

  scopeBadge.textContent = job.remote_scope ? `🌐 ${job.remote_scope}` : '🌐 100% Remote';
  locBadge.textContent = `📍 ${job.location || 'Anywhere'}`;
  srcBadge.textContent = `🎯 ${job.source || 'Company ATS'}`;

  const salaryBadge = document.getElementById('modal-salary-badge');
  if (salaryBadge) {
    if (job.salary) {
      salaryBadge.textContent = `💰 ${job.salary}`;
      salaryBadge.classList.remove('hidden');
    } else {
      salaryBadge.classList.add('hidden');
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
    : 'No strict year cutoff specified by employer';
  const expIcon = job.experience_required ? '🎯' : '📋';

  const seniorityText = job.seniority_level || 'Mid-Level';
  const seniorityRationale = job.seniority_rationale || 'Deliver core features autonomously, collaborate across disciplines, and uphold clean code principles.';

  const scopeText = job.remote_scope ? escapeHtml(job.remote_scope) : (job.is_remote ? '100% Remote' : 'Location Dependent');
  const salaryText = job.salary ? escapeHtml(job.salary) : 'Competitive / Unstated';

  const techChipsHtml = techList.length > 0
    ? techList.map(t => `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/20 transition cursor-default shadow-xs"><span>⚡</span>${escapeHtml(t)}</span>`).join(' ')
    : '<span class="text-xs text-slate-400 italic">General engineering & cross-functional skills. See description below for complete context.</span>';

  // Description format
  const cleanDesc = (job.description || 'No description provided. Please click Apply to view complete job details on the hiring company website.')
    .replace(/\n\n+/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  body.innerHTML = `
    <!-- Candidate Fast Decision Grid (Experience, Seniority, Scope, Salary) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      
      <!-- Experience Required -->
      <div class="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start gap-3.5 shadow-sm">
        <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg shrink-0">
          ${expIcon}
        </div>
        <div class="min-w-0">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Experience Required</div>
          <div class="text-base font-extrabold text-white mt-0.5 truncate">${expText}</div>
          <div class="text-[11px] text-slate-400 mt-0.5">${expSub}</div>
        </div>
      </div>

      <!-- Seniority Tier -->
      <div class="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start gap-3.5 shadow-sm">
        <div class="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center text-lg shrink-0">
          ⚡
        </div>
        <div class="min-w-0">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Seniority Level</div>
          <div class="text-base font-extrabold text-white mt-0.5 truncate">${escapeHtml(seniorityText)}</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Autonomy & ownership expectations</div>
        </div>
      </div>

      <!-- Remote Work Scope -->
      <div class="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start gap-3.5 shadow-sm">
        <div class="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center text-lg shrink-0">
          🌐
        </div>
        <div class="min-w-0">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Geographic Scope</div>
          <div class="text-base font-extrabold text-white mt-0.5 truncate">${scopeText}</div>
          <div class="text-[11px] text-slate-400 mt-0.5">${escapeHtml(job.location || 'Anywhere / Worldwide')}</div>
        </div>
      </div>

      <!-- Compensation -->
      <div class="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-start gap-3.5 shadow-sm">
        <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-lg shrink-0">
          💰
        </div>
        <div class="min-w-0">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Compensation</div>
          <div class="text-base font-extrabold text-white mt-0.5 truncate">${salaryText}</div>
          <div class="text-[11px] text-slate-400 mt-0.5">${job.employment_type || 'Full-time / Permanent'}</div>
        </div>
      </div>

    </div>

    <!-- Why This Level & Role Expectations Callout Banner -->
    <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/30 via-slate-950/70 to-teal-950/20 border border-emerald-500/20 mb-4 shadow-sm">
      <div class="flex items-center gap-2 mb-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
        <span>💡</span>
        <span>Why This Level & Role Expectations</span>
      </div>
      <p class="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
        ${escapeHtml(seniorityRationale)}
      </p>
    </div>

    <!-- Verified Tech Stack & Skills -->
    <div class="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 mb-4 shadow-sm">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
          <span>🛠️</span>
          <span>Verified Tech Stack & Key Skills</span>
        </div>
        <span class="text-[11px] text-slate-500 font-semibold">${techList.length} skills identified</span>
      </div>
      <div class="flex flex-wrap gap-2">
        ${techChipsHtml}
      </div>
    </div>

    <!-- Role Overview & Full Description -->
    <div class="pt-2">
      <div class="flex items-center justify-between mb-2.5">
        <div class="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <span>📄</span>
          <span>Job Description & Requirements</span>
        </div>
        <span class="text-[11px] text-slate-500">Official ATS Posting</span>
      </div>
      <div class="text-sm text-slate-300 leading-relaxed font-normal bg-slate-950/60 p-4 sm:p-5 rounded-2xl border border-slate-800/80 max-h-[320px] overflow-y-auto space-y-3">
        ${cleanDesc}
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
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

// ── Search & Filter Event Handlers ─────────────────────────────────────────────
function bindEventHandlers() {
  // 1. Omni-Search Form & Input
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search-btn');

  if (searchInput) {
    let timeout = null;
    searchInput.addEventListener('input', e => {
      state.searchQuery = e.target.value;
      if (clearBtn) {
        clearBtn.classList.toggle('hidden', !state.searchQuery);
      }
      clearTimeout(timeout);
      timeout = setTimeout(() => {
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

  // 2. Category Pills & Role Select Sync
  const roleSelect = document.getElementById('role-select');
  const rolePills = document.querySelectorAll('.role-pill');
  
  if (roleSelect) {
    roleSelect.addEventListener('change', e => {
      state.category = e.target.value;
      rolePills.forEach(p => {
        const isMatch = (p.dataset.category || 'all') === state.category;
        if (isMatch) {
          p.className = 'role-pill active shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 cursor-pointer';
        } else {
          p.className = 'role-pill shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition bg-slate-900 text-slate-400 hover:text-emerald-400 hover:bg-slate-850 border border-slate-800 cursor-pointer';
        }
      });
      state.currentPage = 1;
      applyFilters();
    });
  }

  rolePills.forEach(pill => {
    pill.addEventListener('click', () => {
      rolePills.forEach(p => {
        p.classList.remove('active', 'bg-emerald-500', 'text-slate-950', 'shadow-md', 'shadow-emerald-500/20');
        p.classList.add('bg-slate-900', 'text-slate-400');
      });
      pill.classList.add('active', 'bg-emerald-500', 'text-slate-950', 'shadow-md', 'shadow-emerald-500/20');
      pill.classList.remove('bg-slate-900', 'text-slate-400');

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
          other.className = 'scope-tab px-3 py-1 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-950 border border-slate-800 transition cursor-pointer';
        }
      });
      el.className = 'scope-tab active px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 transition cursor-pointer';
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

  // 16. Modal Closing
  const closeBtn = document.getElementById('modal-close-btn');
  const backdrop = document.getElementById('modal-backdrop');
  if (closeBtn) closeBtn.addEventListener('click', closeJobModal);
  if (backdrop) backdrop.addEventListener('click', closeJobModal);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeJobModal();
  });

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
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = keyword;
    state.searchQuery = keyword;
    state.currentPage = 1;
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) clearBtn.classList.remove('hidden');
    applyFilters();
    document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth' });
  }
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
  state.trackerTab = 'all';
  state.currentPage = 1;

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) clearBtn.classList.add('hidden');

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
    if (idx === 0) {
      p.className = 'role-pill active shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 cursor-pointer';
    } else {
      p.className = 'role-pill shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition bg-slate-900 text-slate-400 hover:text-emerald-400 hover:bg-slate-850 border border-slate-800 cursor-pointer';
    }
  });

  // Reset Scope Tabs
  const scopeTabs = ['scope-all-btn', 'scope-worldwide-btn', 'scope-americas-btn', 'scope-europe-btn', 'scope-apac-btn'];
  scopeTabs.forEach((id, idx) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (idx === 0) {
      el.className = 'scope-tab active px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 transition cursor-pointer';
    } else {
      el.className = 'scope-tab px-3 py-1 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-950 border border-slate-800 transition cursor-pointer';
    }
  });

  // Reset Tracker Tabs
  setTrackerTab('all');
}

function showEmptyState(msg) {
  const container = document.getElementById('job-grid');
  if (container) {
    container.innerHTML = `
      <div class="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <div class="text-4xl mb-3">📡</div>
        <h3 class="text-lg font-bold text-white mb-1">${escapeHtml(msg)}</h3>
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
