/**
 * JobsForIndia - Dashboard Application Logic
 * 
 * Features:
 * - Dynamic Job Data Loading from aggregator output
 * - Live Instant Search with Debouncing
 * - Role Category Filtering & Multi-attribute Toggles (Direct ATS, India, Remote)
 * - Accessible Dialog Modal & Focus Management (WCAG 2.1 AA)
 * - Schema.org JSON-LD Generation for Google Jobs Organic SEO
 */

// Application State
// ============================================================
// STATE MANAGEMENT & DATA PERSISTENCE
// ============================================================

const STORAGE_KEYS = {
  SAVED: 'jfi_saved_jobs',
  APPLIED: 'jfi_applied_jobs',
  REPORTED: 'jfi_reported_jobs',
  PRO_PASS: 'jfi_pro_pass',
};



function getSavedJobIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED) || '[]'));
  } catch { return new Set(); }
}

function getAppliedJobsMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APPLIED);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const map = {};
      const now = Date.now();
      parsed.forEach(id => { map[id] = now; });
      return map;
    } else if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
    return {};
  } catch { return {}; }
}

function saveAppliedJobsMap(map) {
  try {
    localStorage.setItem(STORAGE_KEYS.APPLIED, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save applied jobs map:', err);
  }
}

function getAppliedJobIds() {
  const map = getAppliedJobsMap();
  return new Set(Object.keys(map));
}

function isDateToday(timestamp) {
  if (!timestamp) return false;
  const d = new Date(timestamp);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth() === now.getMonth() &&
         d.getDate() === now.getDate();
}

function getTodayAppliedJobIds() {
  const map = getAppliedJobsMap();
  const todaySet = new Set();
  for (const [id, ts] of Object.entries(map)) {
    if (isDateToday(ts)) {
      todaySet.add(id);
    }
  }
  return todaySet;
}

function getTodayAppliedCount() {
  return getTodayAppliedJobIds().size;
}

function markJobApplied(jobId) {
  const map = getAppliedJobsMap();
  map[jobId] = Date.now();
  saveAppliedJobsMap(map);
  state.appliedJobIds.add(jobId);
}

function getReportedJobIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.REPORTED) || '[]'));
  } catch { return new Set(); }
}

function getProPass() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRO_PASS);
    if (!raw) return null;
    const pass = JSON.parse(raw);
    if (pass && pass.expiresAt && Date.now() < pass.expiresAt) {
      return pass;
    }
    return null;
  } catch { return null; }
}

function isUserSubscribed() {
  return getProPass() !== null;
}

const state = {
  allJobs: [],
  filteredJobs: [],
  scopeFilter: 'all', // 'india' | 'all'
  activeTrackerTab: 'all', // 'all' | 'saved' | 'applied'
  savedJobIds: getSavedJobIds(),
  appliedJobIds: getAppliedJobIds(),
  reportedJobIds: getReportedJobIds(),
  activeRoleFilter: 'all',
  searchQuery: '',
  directAtsOnly: false,
  indiaLocalOnly: false,
  remoteOnly: false,
  expFilter: 'all',
  levelFilter: 'all',
  typeFilter: 'all',
  sourceFilter: 'all',
  companyFilter: 'all',
  workplaceFilter: 'all',
  cityFilter: 'all',
  dateFilter: 'any',
  sortBy: 'newest',
  currentPage: 1,
  itemsPerPage: 18,
  selectedJob: null,
};

// DOM Elements
const elements = {
  jobGrid: document.getElementById('job-grid'),
  loadingState: document.getElementById('loading-state'),
  emptyState: document.getElementById('empty-state'),
  searchInput: document.getElementById('search-input'),
  clearSearchBtn: document.getElementById('clear-search-btn'),
  filterPills: document.querySelectorAll('.filter-pill'),
  roleSelect: document.getElementById('role-select'),
  directAtsCheckbox: document.getElementById('direct-ats-only'),
  indiaLocalCheckbox: document.getElementById('india-local-only'),
  remoteCheckbox: document.getElementById('remote-only'),
  sortSelect: document.getElementById('sort-select'),
  expSelect: document.getElementById('exp-select'),
  levelSelect: document.getElementById('level-select'),
  typeSelect: document.getElementById('type-select'),
  sourceSelect: document.getElementById('source-select'),
  companySelect: document.getElementById('company-select'),
  companyFilterCol: document.getElementById('company-filter-col'),
  workplaceSelect: document.getElementById('workplace-select'),
  citySelect: document.getElementById('city-select'),
  dateSelect: document.getElementById('date-select'),
  scopeIndiaBtn: document.getElementById('scope-india-btn'),
  scopeGlobalBtn: document.getElementById('scope-global-btn'),
  // Tracker Tabs
  trackerAllBtn: document.getElementById('tracker-all-btn'),
  trackerSavedBtn: document.getElementById('tracker-saved-btn'),
  trackerAppliedBtn: document.getElementById('tracker-applied-btn'),
  savedCountBadge: document.getElementById('saved-count-badge'),
  appliedCountBadge: document.getElementById('applied-count-badge'),
  resultsCountBadge: document.getElementById('results-count-badge'),
  headerCountBadge: document.getElementById('header-count-badge'),
  resetFiltersBtn: document.getElementById('reset-filters-btn'),
  refreshBtn: document.getElementById('refresh-btn'),
  // Pagination Elements
  paginationContainer: document.getElementById('pagination-container'),
  paginationInfo: document.getElementById('pagination-info'),
  pageStart: document.getElementById('page-start'),
  pageEnd: document.getElementById('page-end'),
  pageTotal: document.getElementById('page-total'),
  paginationButtons: document.getElementById('pagination-buttons'),
  itemsPerPageSelect: document.getElementById('items-per-page'),
  // Modal Elements
  jobModal: document.getElementById('job-modal'),
  modalCloseBtn: document.getElementById('modal-close-btn'),
  modalTitle: document.getElementById('modal-title'),
  modalCompany: document.getElementById('modal-company'),
  modalLocation: document.getElementById('modal-location'),
  modalPosted: document.getElementById('modal-posted'),
  modalSource: document.getElementById('modal-source'),
  modalBadgeAts: document.getElementById('modal-badge-ats'),
  modalContent: document.getElementById('modal-content'),
  modalSaveBtn: document.getElementById('modal-save-btn'),
  modalAppliedBtn: document.getElementById('modal-applied-btn'),
  modalReportBtn: document.getElementById('modal-report-btn'),
  modalSaveIcon: document.getElementById('modal-save-icon'),
  modalSaveText: document.getElementById('modal-save-text'),
  modalAppliedIcon: document.getElementById('modal-applied-icon'),
  modalAppliedText: document.getElementById('modal-applied-text'),
  modalApplyBtn: document.getElementById('modal-apply-btn'),
  modalCopyBtn: document.getElementById('modal-copy-btn'),
  modalPrepCompany: document.getElementById('modal-prep-company'),
  modalWhatsappBtn: document.getElementById('modal-whatsapp-btn'),
  modalSnapshotCard: document.getElementById('modal-snapshot-card'),
  modalSnapshotDomain: document.getElementById('modal-snapshot-domain'),
  modalSnapshotExp: document.getElementById('modal-snapshot-exp'),
  modalSnapshotWorkplace: document.getElementById('modal-snapshot-workplace'),
  modalSnapshotType: document.getElementById('modal-snapshot-type'),
  modalSnapshotApply: document.getElementById('modal-snapshot-apply'),
  modalSnapshotTechStack: document.getElementById('modal-snapshot-tech-stack'),
  // Employer Feature Selectors
  employerModal: document.getElementById('employer-modal'),
  employerPostBtn: document.getElementById('employer-post-btn'),
  employerModalCloseBtn: document.getElementById('employer-modal-close-btn'),
  employerJobForm: document.getElementById('employer-job-form'),
  // Toast
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message'),
  // Schema hook
  schemaScript: document.getElementById('job-posting-schema'),
};

// ============================================================
// DATA LOADING
// ============================================================

async function fetchJobs() {
  setLoading(true);
  try {
    let data = null;

    // 1. Check if jobs are preloaded via window.JOBS_DATA
    if (window.JOBS_DATA && Array.isArray(window.JOBS_DATA) && window.JOBS_DATA.length > 0) {
      data = window.JOBS_DATA;
    }

    // 2. If not preloaded, attempt fetch
    if (!data || data.length === 0) {
      const paths = [
        'jobs_latest.json',
        '/jobs_latest.json',
        '../output/jobs_latest.json',
        '/output/jobs_latest.json'
      ];

      for (const p of paths) {
        try {
          const res = await fetch(p);
          if (res.ok) {
            const fetched = await res.json();
            if (Array.isArray(fetched) && fetched.length > 0) {
              data = fetched;
              break;
            }
          }
        } catch (err) {
          // ignore network or CORS errors on fallback
        }
      }
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('Could not load jobs dataset.');
    }

    state.allJobs = data;
    elements.headerCountBadge.textContent = `${data.length} verified jobs`;
    updateTrackerCounters();
    updateQuotaUI();
    populateSourceDropdown(data);
    updateCompanyOptions();
    applyFilters();
    updateSchemaOrgJsonLd(state.allJobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    elements.jobGrid.innerHTML = `
      <div class="col-span-full p-8 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-center">
        <p class="font-bold text-lg mb-2">No jobs loaded yet</p>
        <p class="text-sm text-amber-700 max-w-md mx-auto mb-4">
          Please run the aggregator backend once to generate latest jobs:
        </p>
        <code class="px-3 py-1.5 bg-white rounded border border-amber-300 font-mono text-xs">
          python -m aggregator.main --india
        </code>
      </div>
    `;
    elements.resultsCountBadge.textContent = '0 jobs';
  } finally {
    setLoading(false);
  }
}

function populateSourceDropdown(jobs) {
  if (!elements.sourceSelect) return;
  const currentVal = elements.sourceSelect.value;
  const sources = Array.from(new Set(jobs.map(j => j.source).filter(Boolean))).sort();
  elements.sourceSelect.innerHTML = '<option value="all">All Sources</option>' +
    sources.map(s => {
      const label = s === 'CompanyATS' ? 'Direct Company ATS 🎯' : s;
      return `<option value="${escapeHtml(s)}">${escapeHtml(label)}</option>`;
    }).join('');
  if (sources.includes(currentVal)) {
    elements.sourceSelect.value = currentVal;
  }
}

function updateCompanyOptions() {
  if (!elements.companySelect) return;
  const currentVal = state.companyFilter;
  let relevantJobs = state.allJobs;

  if (state.sourceFilter !== 'all') {
    relevantJobs = state.allJobs.filter(j => (j.source || '').toLowerCase() === state.sourceFilter.toLowerCase());
  }

  const companies = Array.from(
    new Set(relevantJobs.map(j => (j.company || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  elements.companySelect.innerHTML = `<option value="all">All Companies (${companies.length})</option>` +
    companies.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  if (companies.includes(currentVal)) {
    elements.companySelect.value = currentVal;
  } else {
    state.companyFilter = 'all';
    elements.companySelect.value = 'all';
  }

  // Calculate job counts per company
  const companyCounts = {};
  relevantJobs.forEach(j => {
    const c = (j.company || '').trim();
    if (c) companyCounts[c] = (companyCounts[c] || 0) + 1;
  });

  // Populate floating searchable combobox list
  const comboboxList = document.getElementById('company-combobox-list');
  if (comboboxList) {
    const allSelected = state.companyFilter === 'all'
      ? 'bg-brand-50 text-brand-700 font-bold'
      : 'text-slate-700 hover:bg-slate-50';
    let html = `
      <li onclick="selectComboboxCompany('all')" class="px-3 py-2 flex items-center justify-between cursor-pointer rounded-xl font-medium transition ${allSelected}">
        <span>All Companies</span>
        <span class="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">${relevantJobs.length}</span>
      </li>
    `;

    html += companies.map(c => {
      const count = companyCounts[c] || 0;
      const isSel = state.companyFilter === c
        ? 'bg-brand-50 text-brand-700 font-bold'
        : 'text-slate-700 hover:bg-slate-50';
      return `
        <li onclick="selectComboboxCompany('${escapeHtml(c).replace(/'/g, "\\'")}')" data-company="${escapeHtml(c).toLowerCase()}" class="company-combobox-item px-3 py-2 flex items-center justify-between cursor-pointer rounded-xl font-medium transition ${isSel}">
          <span class="truncate">${escapeHtml(c)}</span>
          <span class="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full shrink-0 ml-2">${count}</span>
        </li>
      `;
    }).join('');

    comboboxList.innerHTML = html;
  }

  const comboboxSelected = document.getElementById('company-combobox-selected');
  if (comboboxSelected) {
    if (state.companyFilter === 'all') {
      comboboxSelected.textContent = 'All Companies';
      comboboxSelected.className = 'truncate font-semibold text-slate-700';
    } else {
      comboboxSelected.textContent = state.companyFilter;
      comboboxSelected.className = 'truncate font-bold text-brand-600';
    }
  }

  const countLabel = document.getElementById('company-count-label');
  if (countLabel) {
    countLabel.textContent = `${companies.length}+ available`;
  }

  // Highlight company dropdown when CompanyATS is selected
  if (elements.companyFilterCol) {
    if (state.sourceFilter === 'CompanyATS') {
      elements.companyFilterCol.classList.add('ring-2', 'ring-brand-500', 'bg-brand-50/50', 'rounded-xl', 'p-1', 'transition-all');
    } else {
      elements.companyFilterCol.classList.remove('ring-2', 'ring-brand-500', 'bg-brand-50/50', 'rounded-xl', 'p-1', 'transition-all');
    }
  }
}

function setLoading(isLoading) {
  if (isLoading) {
    elements.loadingState.classList.remove('hidden');
    elements.jobGrid.classList.add('hidden');
    elements.emptyState.classList.add('hidden');
  } else {
    elements.loadingState.classList.add('hidden');
    elements.jobGrid.classList.remove('hidden');
  }
}

// ============================================================
// FILTERING & SEARCH PIPELINE
// ============================================================

function applyFilters() {
  const query = state.searchQuery.toLowerCase().trim();
  const role = state.activeRoleFilter;

  let results = state.allJobs.filter(job => {
    // 0a. Exclude user-reported closed / expired jobs
    if (state.reportedJobIds.has(job.job_id)) {
      return false;
    }

    // 0b. Personal Tracker Tabs: Saved vs Applied vs All
    if (state.activeTrackerTab === 'saved') {
      if (!state.savedJobIds.has(job.job_id)) return false;
    } else if (state.activeTrackerTab === 'applied') {
      if (!state.appliedJobIds.has(job.job_id)) return false;
    }

    // 0c. Geographic Remote Scope Filter
    if (state.activeTrackerTab === 'all') {
      if (state.scopeFilter === 'worldwide') {
        const scope = (job.remote_scope || '').toLowerCase();
        if (scope !== 'worldwide' && !scope.includes('worldwide')) return false;
      } else if (state.scopeFilter === 'americas') {
        const scope = (job.remote_scope || '').toLowerCase();
        if (!scope.includes('americas') && !scope.includes('us')) return false;
      } else if (state.scopeFilter === 'europe') {
        const scope = (job.remote_scope || '').toLowerCase();
        if (!scope.includes('europe') && !scope.includes('emea')) return false;
      } else if (state.scopeFilter === 'apac') {
        const scope = (job.remote_scope || '').toLowerCase();
        if (!scope.includes('apac') && !scope.includes('asia')) return false;
      } else if (state.scopeFilter === 'india') {
        if (job.is_india_eligible === false) return false;
      }
    }

    // 1. Text Search across Title, Company, Description, Location
    if (query) {
      const titleMatch = (job.title || '').toLowerCase().includes(query);
      const companyMatch = (job.company || '').toLowerCase().includes(query);
      const locMatch = (job.location || '').toLowerCase().includes(query);
      const descMatch = (job.description || '').toLowerCase().includes(query);
      if (!titleMatch && !companyMatch && !locMatch && !descMatch) {
        return false;
      }
    }

    // 2. Role Category Quick Pills
    if (role !== 'all') {
      const title = (job.title || '').toLowerCase();
      if (role === 'qa') {
        const isQA = /\b(qa|quality\s+assurance|tester|testing|sdet|test\s+engineer|automation)\b/i.test(title);
        if (!isQA) return false;
      } else if (role === 'engineer') {
        const isDev = /\b(engineer|developer|frontend|backend|fullstack|software|programmer)\b/i.test(title);
        if (!isDev) return false;
      } else if (role === 'devops') {
        const isDevOps = /\b(devops|cloud|sre|reliability|infrastructure|aws|k8s|kubernetes|sysadmin)\b/i.test(title);
        if (!isDevOps) return false;
      } else if (role === 'data') {
        const isData = /\b(data|ai|machine\s+learning|ml|analyst|analytics|scientist)\b/i.test(title);
        if (!isData) return false;
      } else if (role === 'mobile') {
        const isMobile = /\b(mobile|android|ios|flutter|react\s+native|swift|kotlin)\b/i.test(title);
        if (!isMobile) return false;
      } else if (role === 'design') {
        const isDesign = /\b(design|designer|ui|ux|product\s+design|graphic)\b/i.test(title);
        if (!isDesign) return false;
      } else if (role === 'support') {
        const isSupport = /\b(support|service|operations|coordinator|success|specialist|ops)\b/i.test(title);
        if (!isSupport) return false;
      }
    }

    // 3. Dropdown: Experience
    if (state.expFilter !== 'all') {
      const text = `${job.title} ${job.description} ${job.experience || ''}`.toLowerCase();
      if (state.expFilter === 'entry') {
        const isEntry = /\b(0\s*[-–to]\s*1|0\s*\+\s*years?|1\s*year|entry|fresher|graduate|intern|junior)\b/i.test(text);
        if (!isEntry) return false;
      } else if (state.expFilter === 'junior') {
        const isJunior = /\b(1\s*[-–to]\s*3|2\s*\+?\s*years?|3\s*years?|junior|jr)\b/i.test(text);
        if (!isJunior) return false;
      } else if (state.expFilter === 'mid') {
        const isMid = /\b(3\s*[-–to]\s*5|4\s*\+?\s*years?|5\s*years?|mid[- ]level|intermediate)\b/i.test(text);
        if (!isMid) return false;
      } else if (state.expFilter === 'senior') {
        const isSenior = /\b(5\s*\+\s*years?|[6-9]\s*\+?\s*years?|1\d\s*\+?\s*years?|senior|sr|lead|principal|staff|architect)\b/i.test(text);
        if (!isSenior) return false;
      }
    }

    // 4. Dropdown: Job Level / Seniority
    if (state.levelFilter !== 'all') {
      const title = (job.title || '').toLowerCase();
      if (state.levelFilter === 'entry') {
        if (!/\b(entry|junior|jr|intern|graduate|associate|trainee)\b/i.test(title)) return false;
      } else if (state.levelFilter === 'mid') {
        const isHigh = /\b(senior|sr|lead|principal|staff|head|director|vp|manager|chief)\b/i.test(title);
        const isLow = /\b(entry|junior|jr|intern|graduate|associate)\b/i.test(title);
        if (isHigh || isLow) return false;
      } else if (state.levelFilter === 'senior') {
        if (!/\b(senior|sr|lead|principal|staff|architect)\b/i.test(title)) return false;
      } else if (state.levelFilter === 'manager') {
        if (!/\b(manager|director|head|vp|chief)\b/i.test(title)) return false;
      }
    }

    // 5. Dropdown: Job Type / Employment
    if (state.typeFilter !== 'all') {
      const emp = `${job.employment_type || ''} ${job.title || ''} ${job.description || ''}`.toLowerCase();
      if (state.typeFilter === 'full-time') {
        if (!emp.includes('full-time') && !emp.includes('full time')) return false;
      } else if (state.typeFilter === 'part-time') {
        if (!emp.includes('part-time') && !emp.includes('part time')) return false;
      } else if (state.typeFilter === 'contract') {
        if (!emp.includes('contract') && !emp.includes('freelance') && !emp.includes('contractor')) return false;
      } else if (state.typeFilter === 'internship') {
        if (!emp.includes('intern') && !emp.includes('internship')) return false;
      }
    }

    // 6. Dropdown: Source
    if (state.sourceFilter !== 'all') {
      if ((job.source || '').toLowerCase() !== state.sourceFilter.toLowerCase()) {
        return false;
      }
    }

    // 7. Dropdown: Company
    if (state.companyFilter !== 'all') {
      if ((job.company || '').toLowerCase() !== state.companyFilter.toLowerCase()) {
        return false;
      }
    }

    // 8. Dropdown: Workplace / Remote Type
    if (state.workplaceFilter !== 'all') {
      const remoteType = (job.remote_type || '').toLowerCase();
      const loc = (job.location || '').toLowerCase();
      if (state.workplaceFilter === 'remote') {
        if (remoteType !== 'remote' && !loc.includes('remote') && !loc.includes('worldwide') && !loc.includes('anywhere')) {
          return false;
        }
      } else if (state.workplaceFilter === 'hybrid') {
        if (remoteType !== 'hybrid' && !loc.includes('hybrid')) return false;
      } else if (state.workplaceFilter === 'onsite') {
        if (remoteType !== 'on-site' && remoteType !== 'onsite') return false;
      }
    }

    // 9. Direct ATS Only Toggle
    if (state.directAtsOnly && !job.is_direct_ats) {
      return false;
    }

    // 10. India Location Local Only Toggle
    if (state.indiaLocalOnly) {
      const loc = (job.location || '').toLowerCase();
      const country = (job.country || '').toLowerCase();
      const isIndiaCity = /\b(india|kerala|kochi|bengaluru|bangalore|pune|mumbai|delhi|hyderabad|noida|gurgaon|chennai)\b/i.test(loc);
      if (!isIndiaCity && country !== 'india') {
        return false;
      }
    }

    // 11. Remote Worldwide Only Toggle
    if (state.remoteOnly) {
      const loc = (job.location || '').toLowerCase();
      const isWorldwide = /\b(worldwide|anywhere|global|all locations|everywhere|remote)\b/i.test(loc);
      if (!isWorldwide && job.remote_type !== 'Remote') {
        return false;
      }
    }

    // 12. City / Location Dropdown
    if (state.cityFilter !== 'all') {
      const loc = (job.location || '').toLowerCase();
      const country = (job.country || '').toLowerCase();
      if (state.cityFilter === 'bengaluru') {
        if (!loc.includes('bengaluru') && !loc.includes('bangalore')) return false;
      } else if (state.cityFilter === 'pune') {
        if (!loc.includes('pune')) return false;
      } else if (state.cityFilter === 'hyderabad') {
        if (!loc.includes('hyderabad')) return false;
      } else if (state.cityFilter === 'mumbai') {
        if (!loc.includes('mumbai') && !loc.includes('navi mumbai') && !loc.includes('thane')) return false;
      } else if (state.cityFilter === 'delhi') {
        if (!loc.includes('delhi') && !loc.includes('noida') && !loc.includes('gurgaon') && !loc.includes('gurugram')) return false;
      } else if (state.cityFilter === 'chennai') {
        if (!loc.includes('chennai') && !loc.includes('madras')) return false;
      } else if (state.cityFilter === 'kerala') {
        if (!loc.includes('kochi') && !loc.includes('cochin') && !loc.includes('kerala') && !loc.includes('trivandrum')) return false;
      } else if (state.cityFilter === 'ahmedabad') {
        if (!loc.includes('ahmedabad') && !loc.includes('sanand') && !loc.includes('gj')) return false;
      } else if (state.cityFilter === 'coimbatore') {
        if (!loc.includes('coimbatore')) return false;
      } else if (state.cityFilter === 'worldwide') {
        if (!loc.includes('worldwide') && !loc.includes('anywhere') && job.remote_type !== 'Remote') return false;
      } else if (state.cityFilter === 'us') {
        if (country !== 'united states' && country !== 'us' && !loc.includes('united states') && !loc.includes(', us')) return false;
      } else if (state.cityFilter === 'europe') {
        if (country !== 'united kingdom' && country !== 'germany' && !loc.includes('uk') && !loc.includes('london') && !loc.includes('berlin')) return false;
      }
    }

    // 13. Date Posted ("Freshness") Dropdown (Prunes stale jobs > 21 days by default)
    if (state.dateFilter !== 'any') {
      const maxDays = parseInt(state.dateFilter, 10) || 21;
      if (job.posted_date) {
        try {
          const postedMs = new Date(job.posted_date).getTime();
          const nowMs = Date.now();
          const ageDays = (nowMs - postedMs) / (1000 * 3600 * 24);
          if (ageDays > maxDays) return false;
        } catch (e) {}
      }
    }

    return true;
  });

  // Sorting
  if (state.sortBy === 'newest') {
    results.sort((a, b) => new Date(b.posted_date || 0) - new Date(a.posted_date || 0));
  } else if (state.sortBy === 'title') {
    results.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (state.sortBy === 'company') {
    results.sort((a, b) => (a.company || '').localeCompare(b.company || ''));
  }

  state.filteredJobs = results;
  renderJobCards();

  // Update mobile active filters count badge
  const mobileActiveBadge = document.getElementById('mobile-filter-active-count');
  if (mobileActiveBadge) {
    let activeCount = 0;
    if (state.activeRoleFilter && state.activeRoleFilter !== 'all') activeCount++;
    if (state.expFilter && state.expFilter !== 'all') activeCount++;
    if (state.cityFilter && state.cityFilter !== 'all') activeCount++;
    if (state.workplaceFilter && state.workplaceFilter !== 'all') activeCount++;
    if (state.companyFilter && state.companyFilter !== 'all') activeCount++;
    if (state.directAtsOnly) activeCount++;
    if (state.indiaLocalOnly) activeCount++;
    if (state.remoteOnly) activeCount++;
    if (state.searchQuery) activeCount++;

    if (activeCount > 0) {
      mobileActiveBadge.textContent = activeCount;
      mobileActiveBadge.classList.remove('hidden');
    } else {
      mobileActiveBadge.classList.add('hidden');
    }
  }
}

// ============================================================
// ATS BRANDING & DATA FRESHNESS HELPERS
// ============================================================
function getAtsBadgeInfo(job) {
  const url = (job.direct_apply_url || job.apply_url || '').toLowerCase();
  const src = (job.source || '').toLowerCase();

  if (url.includes('greenhouse.io') || src.includes('greenhouse')) {
    return {
      text: '🟢 Direct Greenhouse ATS',
      className: 'bg-emerald-50 text-emerald-800 border border-emerald-200/90'
    };
  }
  if (url.includes('lever.co') || src.includes('lever')) {
    return {
      text: '🟣 Direct Lever ATS',
      className: 'bg-purple-50 text-purple-800 border border-purple-200/90'
    };
  }
  if (url.includes('workday') || url.includes('myworkdayjobs') || src.includes('workday')) {
    return {
      text: '🟠 Direct Workday ATS',
      className: 'bg-amber-50 text-amber-900 border border-amber-300/80'
    };
  }
  if (url.includes('ashby') || src.includes('ashby')) {
    return {
      text: '🔵 Direct Ashby ATS',
      className: 'bg-sky-50 text-sky-800 border border-sky-200/90'
    };
  }
  if (url.includes('smartrecruiters') || src.includes('smartrecruiters')) {
    return {
      text: '🔷 Direct SmartRecruiters ATS',
      className: 'bg-cyan-50 text-cyan-800 border border-cyan-200/90'
    };
  }
  if (url.includes('amazon.jobs') || src.includes('amazon')) {
    return {
      text: '🟡 Direct Amazon ATS',
      className: 'bg-yellow-50 text-yellow-900 border border-yellow-300/80'
    };
  }
  if (job.is_direct_ats) {
    return {
      text: '🎯 Direct Company ATS',
      className: 'bg-teal-50 text-teal-800 border border-teal-200/90'
    };
  }
  return {
    text: `📡 ${job.source || 'Aggregated'}`,
    className: 'bg-slate-100 text-slate-700 border border-slate-200/70'
  };
}

function formatFreshness(isoDate) {
  if (!isoDate) return 'Recently Verified';
  try {
    const postedTime = new Date(isoDate).getTime();
    const nowTime = Date.now();
    const diffMs = nowTime - postedTime;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      return '⚡ Verified today';
    } else if (diffHours < 24) {
      return `⚡ Verified ${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Verified yesterday';
    } else if (diffDays <= 7) {
      return `Posted ${diffDays} days ago`;
    } else if (diffDays <= 21) {
      return `Posted ${diffDays}d ago`;
    } else {
      const d = new Date(isoDate);
      return `Posted on ${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`;
    }
  } catch (e) {
    return 'Recently';
  }
}

// ============================================================
// UI RENDERING & PAGINATION
// ============================================================

function renderJobCards() {
  const jobs = state.filteredJobs;
  const total = jobs.length;
  elements.resultsCountBadge.textContent = `${total} ${total === 1 ? 'job' : 'jobs'}`;

  if (total === 0) {
    elements.jobGrid.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');
    if (elements.paginationContainer) elements.paginationContainer.classList.add('hidden');
    return;
  }

  elements.jobGrid.classList.remove('hidden');
  elements.emptyState.classList.add('hidden');

  let paginated = jobs;
  if (state.itemsPerPage !== 'all') {
    const limit = parseInt(state.itemsPerPage, 10);
    const totalPages = Math.ceil(total / limit) || 1;
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    const startIdx = (state.currentPage - 1) * limit;
    const endIdx = Math.min(startIdx + limit, total);
    paginated = jobs.slice(startIdx, endIdx);

    if (elements.paginationContainer) {
      elements.pageStart.textContent = startIdx + 1;
      elements.pageEnd.textContent = endIdx;
      elements.pageTotal.textContent = total;
      renderPaginationButtons(totalPages);
      elements.paginationContainer.classList.remove('hidden');
    }
  } else {
    if (elements.paginationContainer) elements.paginationContainer.classList.add('hidden');
  }

  elements.jobGrid.innerHTML = paginated.map((job, idx) => {
    const isDirectAts = job.is_direct_ats;
    const directUrl = job.direct_apply_url || job.apply_url;
    const location = job.location || 'Remote';
    const posted = formatFreshness(job.posted_date);
    const atsBadge = getAtsBadgeInfo(job);
    const cleanDesc = stripHtml(job.description || '');
    const snippet = cleanDesc.length > 160 ? cleanDesc.substring(0, 160) + '...' : cleanDesc;
    const isSaved = state.savedJobIds.has(job.job_id);
    const isApplied = state.appliedJobIds.has(job.job_id);
    const formattedSalary = formatSalaryWithLPA(job.salary);

    const companyInitial = (job.company || 'C').charAt(0).toUpperCase();
    const companyClean = (job.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const logoUrl = `https://www.google.com/s2/favicons?domain=${companyClean}.com&sz=64`;
    const colorGradients = [
      'from-indigo-500 to-purple-600',
      'from-blue-500 to-cyan-600',
      'from-emerald-500 to-teal-600',
      'from-violet-500 to-fuchsia-600',
      'from-rose-500 to-pink-600',
      'from-amber-500 to-orange-600',
    ];
    const gradIndex = Math.abs((job.company || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colorGradients.length;
    const avatarGrad = colorGradients[gradIndex];

    let sponsoredCard = '';
    if (idx > 0 && idx % 6 === 0) {
      sponsoredCard = `
        <article class="bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80 rounded-2xl border-2 border-indigo-200 p-6 flex flex-col justify-between shadow-2xs relative">
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs">
                🚀 CAREER ACCELERATOR
              </span>
              <span class="text-xs text-indigo-500 font-semibold">Recommended</span>
            </div>
            <h3 class="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              Is Your Resume Ready for Greenhouse & Lever ATS?
            </h3>
            <p class="text-xs font-semibold text-indigo-700 mt-1">Match keywords with top Indian tech employers</p>
            <p class="mt-4 text-xs sm:text-sm text-slate-500 leading-relaxed">
              75% of Indian tech resumes get filtered before HR ever sees them. Optimize your resume formatting to pass ATS screens automatically.
            </p>
          </div>
          <div class="mt-6 pt-4 border-t border-indigo-100 flex items-center justify-between gap-2">
            <span class="text-[11px] text-slate-400">Sponsored • Resume.io</span>
            <a href="https://resume.io/" target="_blank" rel="sponsored nofollow" class="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition">
              Free ATS Scan ↗
            </a>
          </div>
        </article>
      `;
    }

    const jobCard = `
      <article 
        class="bg-white rounded-3xl border border-slate-200/90 hover:border-brand-400 p-6 flex flex-col justify-between shadow-2xs hover:shadow-xl hover:shadow-brand-500/5 hover:-translate-y-1 transition-all duration-300 group relative"
        aria-labelledby="job-title-${idx}"
      >
        <div>
          <!-- Header Badges & Actions -->
          <div class="flex items-center justify-between gap-2 mb-3.5">
            <span class="text-xs font-bold px-3 py-1 rounded-full ${atsBadge.className}">
              ${atsBadge.text}
            </span>

            <div class="flex items-center gap-1.5">
              <button 
                type="button" 
                onclick="toggleSaveJob('${job.job_id}', event)" 
                class="p-1.5 rounded-xl text-sm transition cursor-pointer ${
                  isSaved 
                    ? 'text-amber-500 hover:text-amber-600 bg-amber-50 border border-amber-200' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }" 
                title="${isSaved ? 'Bookmarked (Click to remove)' : 'Save Job'}"
                aria-label="${isSaved ? 'Remove bookmark' : 'Bookmark job'}"
              >
                ${isSaved ? '⭐' : '☆'}
              </button>
              <span class="text-xs text-slate-400 font-medium">
                ${posted}
              </span>
            </div>
          </div>

          <!-- Company Avatar & Job Title -->
          <div class="flex items-start gap-3.5 mt-1">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr ${avatarGrad} flex items-center justify-center text-white font-extrabold text-base shrink-0 shadow-xs mt-0.5 relative overflow-hidden group-hover:scale-105 transition-transform border border-slate-200/60 bg-white">
              <span class="text-base font-black text-white select-none">${companyInitial}</span>
              <img 
                src="${logoUrl}" 
                alt="${escapeHtml(job.company)}" 
                class="absolute inset-0 w-full h-full object-contain p-2 bg-white transition-opacity" 
                loading="lazy" 
                onerror="this.remove();"
              >
            </div>
            <div class="flex-grow min-w-0">
              <h3 id="job-title-${idx}" class="text-base sm:text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors leading-snug line-clamp-2">
                ${escapeHtml(job.title)}
              </h3>
              <p class="text-sm font-semibold text-slate-500 mt-0.5 flex items-center gap-1.5">
                <span>${escapeHtml(job.company)}</span>
              </p>
            </div>
          </div>

          <!-- Badges Pill Row -->
          <div class="flex flex-wrap items-center gap-1.5 mt-3">
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
              📍 ${escapeHtml(location)}
            </span>
            ${job.remote_type ? `
              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">
                🌐 ${escapeHtml(job.remote_type)}
              </span>
            ` : ''}
            ${formattedSalary ? `
              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/60 font-medium">
                💰 ${escapeHtml(formattedSalary)}
              </span>
            ` : ''}
          </div>

          <!-- Snippet Description -->
          <p class="mt-4 text-xs sm:text-sm text-slate-500 line-clamp-3 leading-relaxed">
            ${escapeHtml(snippet)}
          </p>
        </div>

        <!-- Action CTAs (Mobile Responsive Layout) -->
        <div class="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-1.5 sm:gap-2">
          <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button 
              type="button" 
              onclick="openJobModal('${job.job_id}')"
              class="text-xs font-semibold text-slate-700 hover:text-brand-600 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer"
              aria-label="View details for ${escapeHtml(job.title)}"
            >
              Details
            </button>
            <button
              type="button"
              onclick="toggleAppliedJob('${job.job_id}', event)"
              class="text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                isApplied 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold' 
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
              }"
              title="${isApplied ? 'Application marked as submitted' : 'Mark as applied'}"
            >
              ${isApplied ? '✓ Done' : '+ Applied'}
            </button>
            <button
              type="button"
              onclick="shareOnWhatsApp('${escapeHtml(job.title).replace(/'/g, "\\'")}', '${escapeHtml(job.company).replace(/'/g, "\\'")}', '${escapeHtml(directUrl).replace(/'/g, "\\'")}', event)"
              class="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 border border-emerald-200/70 transition cursor-pointer flex items-center justify-center text-xs"
              title="Share job directly to WhatsApp"
              aria-label="Share on WhatsApp"
            >
              💬
            </button>
          </div>

          <button 
            type="button" 
            onclick="handleApplyClick('${job.job_id}', '${escapeHtml(directUrl)}', event)"
            class="inline-flex items-center justify-center px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white shrink-0 ${
              isApplied ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-brand-600 hover:bg-brand-700'
            } rounded-xl shadow-xs transition hover:shadow focus:ring-2 focus:ring-brand-500 cursor-pointer whitespace-nowrap"
            aria-label="${isApplied ? 'Revisit application for' : 'Apply directly for'} ${escapeHtml(job.title)} at ${escapeHtml(job.company)}"
          >
            ${isApplied ? '✓ Applied ↗' : 'Apply ↗'}
          </button>
        </div>

      </article>
    `;

    return sponsoredCard + jobCard;
  }).join('');
}

function renderPaginationButtons(totalPages) {
  if (!elements.paginationButtons) return;
  if (totalPages <= 1) {
    elements.paginationButtons.innerHTML = '';
    return;
  }

  const current = state.currentPage;
  const buttons = [];

  // Prev Button
  const prevDisabled = current === 1;
  buttons.push(`
    <button 
      type="button" 
      onclick="goToPage(${current - 1})" 
      ${prevDisabled ? 'disabled' : ''} 
      class="px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-semibold transition ${
        prevDisabled 
          ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed' 
          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-brand-600 cursor-pointer'
      }"
      aria-label="Previous page"
    >
      ‹ Prev
    </button>
  `);

  // Calculate page number list
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');
    
    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    if (current < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  pages.forEach(p => {
    if (p === '...') {
      buttons.push(`<span class="px-2 py-1 text-slate-400 text-xs">...</span>`);
    } else {
      const isActive = p === current;
      buttons.push(`
        <button 
          type="button" 
          onclick="goToPage(${p})" 
          class="min-w-[32px] px-2.5 py-1.5 rounded-lg border text-xs sm:text-sm font-bold transition cursor-pointer ${
            isActive 
              ? 'bg-brand-600 border-brand-600 text-white shadow-xs' 
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-brand-600'
          }"
          aria-label="Page ${p}"
          ${isActive ? 'aria-current="page"' : ''}
        >
          ${p}
        </button>
      `);
    }
  });

  // Next Button
  const nextDisabled = current === totalPages;
  buttons.push(`
    <button 
      type="button" 
      onclick="goToPage(${current + 1})" 
      ${nextDisabled ? 'disabled' : ''} 
      class="px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-semibold transition ${
        nextDisabled 
          ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed' 
          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-brand-600 cursor-pointer'
      }"
      aria-label="Next page"
    >
      Next ›
    </button>
  `);

  elements.paginationButtons.innerHTML = buttons.join('');
}

window.goToPage = function(page) {
  state.currentPage = page;
  renderJobCards();
  const target = document.getElementById('results-heading') || elements.jobGrid;
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ============================================================
// MODAL / DETAILS DRAWER
// ============================================================

// ============================================================
// ESSENTIAL ROLE HIGHLIGHTS EXTRACTOR (TECH STACK & EXP)
// ============================================================

function extractJobHighlights(job) {
  const title = job.title || '';
  const desc = job.description || '';
  const fullText = `${title} ${desc}`.toLowerCase();

  // 1. Role Domain Track
  let domain = 'Technology';
  let domainColor = 'bg-brand-50 text-brand-700 border-brand-200';
  if (/qa|quality|sdet|test|automation|cypress|selenium|playwright/.test(fullText)) {
    domain = 'QA & Test Automation';
    domainColor = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (/frontend|react|next\.js|angular|vue|ui developer/.test(fullText)) {
    domain = 'Frontend Engineering';
    domainColor = 'bg-sky-50 text-sky-700 border-sky-200';
  } else if (/backend|node|python|golang|java|c\+\+|c#|\.net|spring/.test(fullText)) {
    domain = 'Backend Engineering';
    domainColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (/fullstack|full-stack|full stack/.test(fullText)) {
    domain = 'Full-Stack Engineering';
    domainColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  } else if (/devops|sre|cloud|aws|kubernetes|k8s|infra|terraform/.test(fullText)) {
    domain = 'Cloud & DevOps / SRE';
    domainColor = 'bg-purple-50 text-purple-700 border-purple-200';
  } else if (/data|analytics|bi developer|data engineer|sql/.test(fullText)) {
    domain = 'Data & Analytics';
    domainColor = 'bg-cyan-50 text-cyan-800 border-cyan-200';
  } else if (/ai|ml|machine learning|deep learning|llm|genai/.test(fullText)) {
    domain = 'AI & Machine Learning';
    domainColor = 'bg-rose-50 text-rose-800 border-rose-200';
  } else if (/mobile|android|ios|flutter|swift|kotlin/.test(fullText)) {
    domain = 'Mobile App Development';
    domainColor = 'bg-teal-50 text-teal-800 border-teal-200';
  } else if (/product|design|ux|ui\/ux/.test(fullText)) {
    domain = 'Product & Design';
    domainColor = 'bg-violet-50 text-violet-800 border-violet-200';
  }

  // 2. Experience Level
  let exp = 'Not Specified';
  const expMatchRange = fullText.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*(?:years?|yrs?)/i);
  const expMatchMin = fullText.match(/(\d+)\+?\s*(?:years?|yrs?)(?:\s*(?:of)?\s*exp(?:erience)?)?/i);
  
  if (expMatchRange) {
    exp = `${expMatchRange[1]}–${expMatchRange[2]} Years`;
  } else if (expMatchMin && parseInt(expMatchMin[1], 10) <= 25) {
    exp = `${expMatchMin[1]}+ Years`;
  } else if (/\bintern\b|\binternship\b/i.test(fullText)) {
    exp = 'Internship';
  } else if (/\bfresher\b|\bentry[\s-]level\b|\bgraduate\b|\bcampus\b/i.test(fullText)) {
    exp = 'Fresher / 0-1 Yr';
  } else if (/\blead\b|\bprincipal\b|\bstaff\b|\bdirector\b|\barchitect\b/i.test(title)) {
    exp = 'Lead / 7+ Yrs';
  } else if (/\bsenior\b|\bsr\./i.test(title)) {
    exp = 'Senior / 4+ Yrs';
  } else if (/\bjunior\b|\bjr\./i.test(title)) {
    exp = 'Junior / 1-3 Yrs';
  } else if (job.experience) {
    exp = job.experience;
  }

  // 3. Workplace & Position Type
  const workplace = job.remote_type || (fullText.includes('remote') ? 'Remote' : (fullText.includes('hybrid') ? 'Hybrid' : 'On-site / Office'));
  const positionType = job.employment_type || (fullText.includes('part-time') ? 'Part-time' : (fullText.includes('contract') ? 'Contract' : (fullText.includes('intern') ? 'Internship' : 'Full-time')));

  // 4. Tech Stack Dictionary
  const techKeywords = [
    // Languages
    { name: 'Python', regex: /\bpython\b/i, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { name: 'Java', regex: /\bjava\b(?!script)/i, color: 'bg-orange-50 text-orange-800 border-orange-200' },
    { name: 'JavaScript', regex: /\bjavascript\b|\bjs\b/i, color: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
    { name: 'TypeScript', regex: /\btypescript\b|\bts\b/i, color: 'bg-blue-50 text-blue-800 border-blue-200' },
    { name: 'Go / Golang', regex: /\bgolang\b|\bgo\s+language\b/i, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    { name: 'C++', regex: /\bc\+\+\b/i, color: 'bg-slate-100 text-slate-800 border-slate-300' },
    { name: 'C# / .NET', regex: /\bc#\b|\b\.net\b/i, color: 'bg-purple-50 text-purple-800 border-purple-200' },
    { name: 'Rust', regex: /\brust\b/i, color: 'bg-amber-50 text-amber-900 border-amber-200' },
    { name: 'SQL', regex: /\bsql\b|\bmysql\b/i, color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    { name: 'PostgreSQL', regex: /\bpostgres(?:ql)?\b/i, color: 'bg-sky-50 text-sky-800 border-sky-200' },
    
    // Web & Frameworks
    { name: 'React', regex: /\breact(?:\.js)?\b/i, color: 'bg-sky-50 text-sky-700 border-sky-200' },
    { name: 'Next.js', regex: /\bnext(?:\.js)?\b/i, color: 'bg-slate-100 text-slate-900 border-slate-300' },
    { name: 'Node.js', regex: /\bnode(?:\.js)?\b/i, color: 'bg-green-50 text-green-700 border-green-200' },
    { name: 'Angular', regex: /\bangular\b/i, color: 'bg-red-50 text-red-700 border-red-200' },
    { name: 'Vue.js', regex: /\bvue(?:\.js)?\b/i, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { name: 'Spring Boot', regex: /\bspring\s*boot\b|\bspring\b/i, color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    { name: 'Django / FastAPI', regex: /\bdjango\b|\bfastapi\b/i, color: 'bg-teal-50 text-teal-800 border-teal-200' },

    // QA & Automation
    { name: 'Selenium', regex: /\bselenium\b/i, color: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' },
    { name: 'Playwright', regex: /\bplaywright\b/i, color: 'bg-green-50 text-green-800 border-green-300 font-bold' },
    { name: 'Cypress', regex: /\bcypress\b/i, color: 'bg-teal-50 text-teal-800 border-teal-300 font-bold' },
    { name: 'Appium', regex: /\bappium\b/i, color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
    { name: 'API / Postman', regex: /\bpostman\b|\brest\s*api\b|\bapi testing\b/i, color: 'bg-orange-50 text-orange-800 border-orange-200' },
    { name: 'SDET / Automation', regex: /\bsdet\b|\btest automation\b|\btest cases\b/i, color: 'bg-amber-50 text-amber-900 border-amber-300 font-bold' },
    { name: 'CI/CD Pipelines', regex: /\bci\/cd\b|\bjenkins\b|\bgithub actions\b/i, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },

    // Cloud & DevOps
    { name: 'AWS', regex: /\baws\b|\bamazon web services\b/i, color: 'bg-amber-50 text-amber-800 border-amber-200 font-bold' },
    { name: 'Docker', regex: /\bdocker\b/i, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { name: 'Kubernetes', regex: /\bkubernetes\b|\bk8s\b/i, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { name: 'Azure', regex: /\bazure\b/i, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { name: 'GCP', regex: /\bgcp\b|\bgoogle cloud\b/i, color: 'bg-red-50 text-red-700 border-red-200' },
    { name: 'Terraform', regex: /\bterraform\b/i, color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { name: 'Linux', regex: /\blinux\b/i, color: 'bg-slate-100 text-slate-800 border-slate-300' },

    // Data, AI & Big Data
    { name: 'MongoDB', regex: /\bmongodb\b/i, color: 'bg-green-50 text-green-700 border-green-200' },
    { name: 'Redis', regex: /\bredis\b/i, color: 'bg-rose-50 text-rose-700 border-rose-200' },
    { name: 'Kafka', regex: /\bkafka\b/i, color: 'bg-slate-100 text-slate-800 border-slate-300' },
    { name: 'AI / LLM / GenAI', regex: /\bllm\b|\bgenai\b|\bgenerative ai\b|\brag\b|\blangchain\b/i, color: 'bg-purple-50 text-purple-800 border-purple-300 font-bold' },
    { name: 'PyTorch / ML', regex: /\bpytorch\b|\btensorflow\b|\bmachine learning\b/i, color: 'bg-red-50 text-red-800 border-red-200' },
    { name: 'Spark / Snowflake', regex: /\bspark\b|\bsnowflake\b/i, color: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
    { name: 'Mobile / Flutter', regex: /\bflutter\b|\breact native\b|\bswift\b|\bkotlin\b/i, color: 'bg-teal-50 text-teal-800 border-teal-200' },
  ];

  const matchedTech = [];
  for (const tech of techKeywords) {
    if (tech.regex.test(fullText)) {
      matchedTech.push(tech);
      if (matchedTech.length >= 8) break;
    }
  }

  return {
    domain,
    domainColor,
    exp,
    workplace,
    positionType,
    matchedTech
  };
}

window.openJobModal = function(jobId) {
  const job = state.allJobs.find(j => j.job_id === jobId);
  if (!job) return;

  state.selectedJob = job;
  const isDirectAts = job.is_direct_ats;
  const directUrl = job.direct_apply_url || job.apply_url;

  elements.modalTitle.textContent = job.title || 'Untitled Role';
  elements.modalCompany.textContent = job.company || 'Company';
  elements.modalLocation.textContent = `📍 ${job.location || 'Remote'}`;
  elements.modalPosted.textContent = `📅 ${formatFreshness(job.posted_date)}`;
  elements.modalSource.textContent = job.source || 'Aggregator';
  elements.modalApplyBtn.href = directUrl;
  elements.modalApplyBtn.onclick = (e) => {
    e.preventDefault();
    handleApplyClick(job.job_id, directUrl, e);
  };

  const modalAtsBadge = getAtsBadgeInfo(job);
  elements.modalBadgeAts.className = `inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${modalAtsBadge.className} mb-2`;
  elements.modalBadgeAts.textContent = modalAtsBadge.text;
  if (isDirectAts) {
    elements.modalApplyBtn.textContent = 'Apply on Company Site ↗';
  } else {
    elements.modalApplyBtn.textContent = 'Apply via Listing ↗';
  }

  // Populate Essential Role Snapshot Card
  const highlights = extractJobHighlights(job);
  if (elements.modalSnapshotDomain) {
    elements.modalSnapshotDomain.textContent = highlights.domain;
    elements.modalSnapshotDomain.className = `text-[11px] font-bold px-2.5 py-0.5 rounded-full ${highlights.domainColor}`;
  }
  if (elements.modalSnapshotExp) elements.modalSnapshotExp.textContent = highlights.exp;
  if (elements.modalSnapshotWorkplace) elements.modalSnapshotWorkplace.textContent = highlights.workplace;
  if (elements.modalSnapshotType) elements.modalSnapshotType.textContent = highlights.positionType;
  if (elements.modalSnapshotApply) {
    elements.modalSnapshotApply.textContent = isDirectAts ? 'Direct ATS ✓' : 'Aggregated';
    elements.modalSnapshotApply.className = isDirectAts ? 'font-bold text-emerald-700 truncate block mt-0.5' : 'font-bold text-slate-700 truncate block mt-0.5';
  }
  if (elements.modalSnapshotTechStack) {
    if (highlights.matchedTech.length > 0) {
      elements.modalSnapshotTechStack.innerHTML = highlights.matchedTech.map(t => 
        `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${t.color}">${escapeHtml(t.name)}</span>`
      ).join('');
    } else {
      elements.modalSnapshotTechStack.innerHTML = `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">${escapeHtml(highlights.domain)} Competencies</span>`;
    }
  }

  // Render Description HTML safely with entity decoding & rich formatting
  elements.modalContent.innerHTML = formatJobDescription(job.description);

  if (elements.modalPrepCompany) {
    elements.modalPrepCompany.textContent = job.company || 'this company';
  }
  if (elements.modalWhatsappBtn) {
    elements.modalWhatsappBtn.onclick = (e) => {
      e.stopPropagation();
      window.shareOnWhatsApp(job.title, job.company, directUrl);
    };
  }

  updateModalTrackerButtons();

  elements.jobModal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  elements.modalCloseBtn.focus();

  // Mobile Back Button Support
  if (!window.__modalHistoryPushed) {
    window.__modalHistoryPushed = true;
    history.pushState({ modalOpen: 'jobModal' }, '');
  }
};

function closeJobModal(fromPopState = false) {
  if (!elements.jobModal || elements.jobModal.classList.contains('hidden')) return;
  elements.jobModal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  state.selectedJob = null;

  if (!fromPopState && window.__modalHistoryPushed) {
    window.__modalHistoryPushed = false;
    if (history.state && history.state.modalOpen) {
      history.back();
    }
  } else if (fromPopState) {
    window.__modalHistoryPushed = false;
  }
}

function updateModalTrackerButtons() {
  if (!state.selectedJob) return;
  const jobId = state.selectedJob.job_id;
  const isSaved = state.savedJobIds.has(jobId);
  const isApplied = state.appliedJobIds.has(jobId);

  if (elements.modalSaveIcon) elements.modalSaveIcon.textContent = isSaved ? '⭐' : '☆';
  if (elements.modalSaveText) elements.modalSaveText.textContent = isSaved ? 'Saved' : 'Save';
  if (elements.modalSaveBtn) {
    elements.modalSaveBtn.className = isSaved 
      ? 'p-2 sm:px-3.5 sm:py-2 bg-amber-50 border border-amber-300 rounded-xl text-xs sm:text-sm font-semibold text-amber-800 hover:bg-amber-100 transition shadow-2xs focus:ring-2 focus:ring-amber-500 flex items-center justify-center gap-1 cursor-pointer shrink-0'
      : 'p-2 sm:px-3.5 sm:py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs focus:ring-2 focus:ring-brand-500 flex items-center justify-center gap-1 cursor-pointer shrink-0';
  }

  if (elements.modalAppliedIcon) elements.modalAppliedIcon.textContent = isApplied ? '✓' : '+';
  if (elements.modalAppliedText) elements.modalAppliedText.textContent = isApplied ? 'Applied' : 'Mark Applied';
  if (elements.modalAppliedBtn) {
    elements.modalAppliedBtn.className = isApplied 
      ? 'p-2 sm:px-3.5 sm:py-2 bg-emerald-50 border border-emerald-300 rounded-xl text-xs sm:text-sm font-semibold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs focus:ring-2 focus:ring-emerald-500 flex items-center justify-center gap-1 cursor-pointer shrink-0'
      : 'p-2 sm:px-3.5 sm:py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs focus:ring-2 focus:ring-brand-500 flex items-center justify-center gap-1 cursor-pointer shrink-0';
    elements.modalAppliedBtn.title = isApplied ? 'Application marked as submitted (permanent)' : 'Mark as applied';
  }

  // Update modal apply CTA button
  if (elements.modalApplyBtn) {
    if (isApplied) {
      elements.modalApplyBtn.className = 'flex-1 px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-md hover:shadow-lg focus:ring-2 focus:ring-emerald-500 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap text-center';
      elements.modalApplyBtn.textContent = '✓ Applied (Reopen ATS) ↗';
    } else {
      elements.modalApplyBtn.className = 'flex-1 px-4 py-2.5 sm:py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-md hover:shadow-lg focus:ring-2 focus:ring-brand-500 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap text-center';
      elements.modalApplyBtn.textContent = state.selectedJob.is_direct_ats ? 'Apply on Official Site ↗' : 'Apply via Listing ↗';
    }
  }
}

function updateTrackerCounters() {
  const savedCount = state.savedJobIds.size;
  const appliedCount = state.appliedJobIds.size;
  if (elements.savedCountBadge) elements.savedCountBadge.textContent = savedCount;
  if (elements.appliedCountBadge) elements.appliedCountBadge.textContent = appliedCount;
}

function updateQuotaUI() {
  // Paywall removed: all features are free
}

function openUpgradeModal() {
  // Paywall removed: upgrade modal no longer exists
}

function closeUpgradeModal() {
  // Paywall removed
}

function updatePlanSelectionUI() {
  // Paywall removed
}

window.handleApplyClick = function(jobId, directUrl, event) {
  if (event) event.stopPropagation();

  const alreadyApplied = state.appliedJobIds.has(jobId);

  // Record application if new
  if (!alreadyApplied) {
    markJobApplied(jobId);
    updateTrackerCounters();
    renderJobCards();
    updateModalTrackerButtons();
    showToast('🎉 Direct ATS application launched and saved in tracker! ✓');
  } else {
    showToast('Opening official ATS portal (already marked as applied)... ↗');
  }

  // Open the official ATS portal in a new window/tab
  window.open(directUrl, '_blank', 'noopener,noreferrer');
};

function setTrackerTab(tab) {
  state.activeTrackerTab = tab;

  if (elements.trackerAllBtn) {
    elements.trackerAllBtn.className = tab === 'all' 
      ? 'px-2.5 py-1 rounded-lg bg-white text-slate-900 font-bold shadow-2xs transition' 
      : 'px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 transition cursor-pointer';
  }
  if (elements.trackerSavedBtn) {
    elements.trackerSavedBtn.className = tab === 'saved'
      ? 'px-2.5 py-1 rounded-lg bg-white text-amber-800 font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer'
      : 'px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5 cursor-pointer';
  }
  if (elements.trackerAppliedBtn) {
    elements.trackerAppliedBtn.className = tab === 'applied'
      ? 'px-2.5 py-1 rounded-lg bg-white text-emerald-800 font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer'
      : 'px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5 cursor-pointer';
  }

  state.currentPage = 1;
  applyFilters();
}

window.toggleSaveJob = function(jobId, event) {
  if (event) event.stopPropagation();
  if (state.savedJobIds.has(jobId)) {
    state.savedJobIds.delete(jobId);
    showToast('Removed from saved bookmarks');
  } else {
    state.savedJobIds.add(jobId);
    showToast('Saved to your bookmarks! ⭐');
  }
  localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify([...state.savedJobIds]));
  updateTrackerCounters();
  if (state.activeTrackerTab === 'saved') {
    applyFilters(false);
  } else {
    renderJobCards();
  }
  updateModalTrackerButtons();
};

window.toggleAppliedJob = function(jobId, event) {
  if (event) event.stopPropagation();

  // Once marked as applied, status permanently stays applied (cannot revert back)
  if (state.appliedJobIds.has(jobId)) {
    showToast('✓ This job is already marked as applied in your tracker!');
    return;
  }

  markJobApplied(jobId);
  updateTrackerCounters();

  if (state.activeTrackerTab === 'applied') {
    applyFilters(false);
  } else {
    renderJobCards();
  }
  updateModalTrackerButtons();
  showToast('🎉 Marked as Applied! ✓');
};

window.reportJobClosed = function(jobId, event) {
  if (event) event.stopPropagation();
  if (!confirm('Report this job posting as closed or expired? It will be immediately hidden from your feed.')) return;
  state.reportedJobIds.add(jobId);
  try {
    localStorage.setItem(STORAGE_KEYS.REPORTED, JSON.stringify([...state.reportedJobIds]));
  } catch (e) {}
  showToast('🚩 Thank you! Job flagged as expired and hidden.');
  closeJobModal();
  applyFilters(false);
};

function formatSalaryWithLPA(salaryStr) {
  if (!salaryStr) return null;
  const s = String(salaryStr).trim();
  if (!s) return null;

  // Already in LPA / INR
  if (/\b(lpa|inr|₹|lakhs?)\b/i.test(s)) {
    return s;
  }

  // USD Conversion (1 USD ≈ 84 INR)
  if (/\$|\busd\b/i.test(s)) {
    const isHourly = /\/(hr|hour)\b/i.test(s);
    const matches = [];
    const numRegex = /(\d+(?:[.,]\d+)?)\s*(k|thousand|m|million)?/gi;
    let match;
    while ((match = numRegex.exec(s)) !== null) {
      let val = parseFloat(match[1].replace(/,/g, ''));
      const unit = (match[2] || '').toLowerCase();
      if (unit === 'k' || unit === 'thousand') val *= 1000;
      else if (unit === 'm' || unit === 'million') val *= 1000000;
      if (isHourly) val *= 2000;
      if (val >= 10000) {
        const lpa = Math.round((val * 84) / 100000);
        matches.push(lpa);
      }
    }
    if (matches.length === 1) {
      return `${s} (≈ ₹${matches[0]} LPA)`;
    } else if (matches.length >= 2) {
      return `${s} (≈ ₹${Math.min(matches[0], matches[1])} - ${Math.max(matches[0], matches[1])} LPA)`;
    }
  }

  // EUR Conversion (1 EUR ≈ 91 INR)
  if (/€|\beur\b/i.test(s)) {
    const matches = [];
    const numRegex = /(\d+(?:[.,]\d+)?)\s*(k|thousand)?/gi;
    let match;
    while ((match = numRegex.exec(s)) !== null) {
      let val = parseFloat(match[1].replace(/,/g, ''));
      const unit = (match[2] || '').toLowerCase();
      if (unit === 'k' || unit === 'thousand') val *= 1000;
      if (val >= 10000) {
        const lpa = Math.round((val * 91) / 100000);
        matches.push(lpa);
      }
    }
    if (matches.length === 1) {
      return `${s} (≈ ₹${matches[0]} LPA)`;
    } else if (matches.length >= 2) {
      return `${s} (≈ ₹${Math.min(matches[0], matches[1])} - ${Math.max(matches[0], matches[1])} LPA)`;
    }
  }

  return s;
}

// ============================================================
// SCHEMA.ORG GOOGLE JOBS ORGANIC SEO MICRODATA
// ============================================================

function updateSchemaOrgJsonLd(jobs) {
  if (!jobs || jobs.length === 0) return;

  // Generate Google Jobs schema microdata for top 20 indexed jobs
  const jobPostings = jobs.slice(0, 20).map(job => ({
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    "title": job.title,
    "description": stripHtml(job.description || '').substring(0, 500),
    "identifier": {
      "@type": "PropertyValue",
      "name": job.company,
      "value": job.job_id
    },
    "datePosted": job.posted_date || new Date().toISOString().split('T')[0],
    "employmentType": job.employment_type ? job.employment_type.toUpperCase().replace('-', '_') : "FULL_TIME",
    "hiringOrganization": {
      "@type": "Organization",
      "name": job.company
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "IN"
      }
    },
    "jobLocationType": job.remote_type === "Remote" ? "TELECOMMUTE" : undefined,
    "applicantLocationRequirements": {
      "@type": "Country",
      "name": "India"
    },
    "directApply": Boolean(job.is_direct_ats)
  }));

  elements.schemaScript.textContent = JSON.stringify(jobPostings);
}

// ============================================================
// HELPERS & UTILITIES
// ============================================================

function formatJobDescription(desc) {
  if (!desc) return '<p class="text-slate-500 italic">No description provided.</p>';

  let formatted = String(desc);
  // Decode HTML entities if present (e.g. &lt;h1&gt; -> <h1>, &amp; -> &)
  if (formatted.includes('&lt;') || formatted.includes('&gt;') || formatted.includes('&amp;') || formatted.includes('&quot;')) {
    const txt = document.createElement('textarea');
    txt.innerHTML = formatted;
    formatted = txt.value;
  }

  // If plain text with newlines (e.g. from Workday, Lever or Amazon), format bullets & paragraphs
  const hasHtml = /<[a-z][\s\S]*>/i.test(formatted);
  if (!hasHtml) {
    const paragraphs = formatted.split(/\n\s*\n/);
    return paragraphs.map(p => {
      const lines = p.split('\n').map(l => l.trim()).filter(Boolean);
      const bulletLines = lines.filter(l => /^[-*•]\s+/.test(l));
      if (bulletLines.length >= 2 || (lines.length > 0 && bulletLines.length === lines.length)) {
        const lis = lines.map(l => {
          const cleanText = l.replace(/^[-*•]\s+/, '');
          return `<li class="mb-1">${escapeHtml(cleanText)}</li>`;
        }).join('');
        return `<ul class="list-disc pl-5 mb-3 text-slate-700 leading-relaxed">${lis}</ul>`;
      }
      return `<p class="mb-3 text-slate-700 leading-relaxed">${escapeHtml(lines.join(' '))}</p>`;
    }).join('');
  }

  // Remove excessive repetitive break tags: <p><br><br></p>
  formatted = formatted.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
  formatted = formatted.replace(/<p>(\s*<br\s*\/?>\s*)+<\/p>/gi, '');

  return formatted;
}

function stripHtml(html) {
  if (!html) return '';
  let str = String(html);
  if (str.includes('&lt;') || str.includes('&gt;') || str.includes('&amp;')) {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    str = txt.value;
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = str;
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoDate) {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch {
    return isoDate;
  }
}

function showToast(msg) {
  elements.toastMessage.textContent = msg;
  elements.toast.classList.remove('hidden');
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3000);
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// Debounced Search
let debounceTimer;
elements.searchInput.addEventListener('input', e => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    state.searchQuery = e.target.value;
    elements.clearSearchBtn.classList.toggle('hidden', !state.searchQuery);
    applyFilters();
  }, 250);
});

elements.clearSearchBtn.addEventListener('click', () => {
  elements.searchInput.value = '';
  state.searchQuery = '';
  elements.clearSearchBtn.classList.add('hidden');
  applyFilters();
});

// Category Filter Pills
elements.filterPills.forEach(pill => {
  pill.addEventListener('click', () => {
    elements.filterPills.forEach(p => {
      p.className = 'filter-pill shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition bg-white text-slate-600 hover:text-brand-600 hover:bg-brand-50/60 border border-slate-200/90 shadow-2xs hover:-translate-y-0.5 cursor-pointer';
    });
    pill.className = 'filter-pill active shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition bg-brand-600 text-white shadow-xs hover:shadow hover:-translate-y-0.5 cursor-pointer';
    state.activeRoleFilter = pill.dataset.filter;
    if (elements.roleSelect) {
      elements.roleSelect.value = state.activeRoleFilter;
    }
    applyFilters();
  });
});

// Primary Job Role Dropdown Listener
if (elements.roleSelect) {
  elements.roleSelect.addEventListener('change', e => {
    state.activeRoleFilter = e.target.value;
    elements.filterPills.forEach(p => {
      if (p.dataset.filter === state.activeRoleFilter) {
        p.className = 'filter-pill active shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition bg-brand-600 text-white shadow-xs hover:shadow hover:-translate-y-0.5 cursor-pointer';
      } else {
        p.className = 'filter-pill shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition bg-white text-slate-600 hover:text-brand-600 hover:bg-brand-50/60 border border-slate-200/90 shadow-2xs hover:-translate-y-0.5 cursor-pointer';
      }
    });
    applyFilters();
  });
}

// Global Quick Trending Search Helper
window.setQuickSearch = function(term) {
  if (elements.searchInput) {
    elements.searchInput.value = term;
    state.searchQuery = term.toLowerCase().trim();
    if (elements.clearSearchBtn) elements.clearSearchBtn.classList.remove('hidden');
    applyFilters();
    const heading = document.getElementById('results-heading');
    if (heading) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// Attribute Toggles
elements.directAtsCheckbox.addEventListener('change', e => {
  state.directAtsOnly = e.target.checked;
  applyFilters();
});

elements.indiaLocalCheckbox.addEventListener('change', e => {
  state.indiaLocalOnly = e.target.checked;
  applyFilters();
});

elements.remoteCheckbox.addEventListener('change', e => {
  state.remoteOnly = e.target.checked;
  applyFilters();
});

// Dropdown Selectors
elements.expSelect.addEventListener('change', e => {
  state.expFilter = e.target.value;
  applyFilters();
});

elements.levelSelect.addEventListener('change', e => {
  state.levelFilter = e.target.value;
  applyFilters();
});

elements.typeSelect.addEventListener('change', e => {
  state.typeFilter = e.target.value;
  applyFilters();
});

elements.sourceSelect.addEventListener('change', e => {
  state.sourceFilter = e.target.value;
  state.companyFilter = 'all';
  updateCompanyOptions();
  applyFilters();
});

if (elements.companySelect) {
  elements.companySelect.addEventListener('change', e => {
    state.companyFilter = e.target.value;
    applyFilters();
  });
}

elements.workplaceSelect.addEventListener('change', e => {
  state.workplaceFilter = e.target.value;
  applyFilters();
});

if (elements.citySelect) {
  elements.citySelect.addEventListener('change', e => {
    state.cityFilter = e.target.value;
    applyFilters();
  });
}

if (elements.dateSelect) {
  elements.dateSelect.addEventListener('change', e => {
    state.dateFilter = e.target.value;
    applyFilters();
  });
}

function setScope(scope) {
  state.scopeFilter = scope;
  const buttons = [
    { el: elements.scopeAllBtn || document.getElementById('scope-all-btn'), id: 'all' },
    { el: elements.scopeWorldwideBtn || document.getElementById('scope-worldwide-btn'), id: 'worldwide' },
    { el: elements.scopeAmericasBtn || document.getElementById('scope-americas-btn'), id: 'americas' },
    { el: elements.scopeEuropeBtn || document.getElementById('scope-europe-btn'), id: 'europe' },
    { el: elements.scopeApacBtn || document.getElementById('scope-apac-btn'), id: 'apac' },
  ];
  buttons.forEach(b => {
    if (!b.el) return;
    if (b.id === scope) {
      b.el.className = 'px-2.5 py-1 rounded-lg bg-white text-brand-700 font-bold shadow-2xs transition whitespace-nowrap cursor-pointer';
    } else {
      b.el.className = 'px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 transition whitespace-nowrap cursor-pointer';
    }
  });
  applyFilters();
}

if (elements.scopeIndiaBtn) {
  elements.scopeIndiaBtn.addEventListener('click', () => setScope('india'));
}
if (elements.scopeGlobalBtn) {
  elements.scopeGlobalBtn.addEventListener('click', () => setScope('global'));
}

// Personal Tracker Tab Listeners
if (elements.trackerAllBtn) {
  elements.trackerAllBtn.addEventListener('click', () => setTrackerTab('all'));
}
if (elements.trackerSavedBtn) {
  elements.trackerSavedBtn.addEventListener('click', () => setTrackerTab('saved'));
}
if (elements.trackerAppliedBtn) {
  elements.trackerAppliedBtn.addEventListener('click', () => setTrackerTab('applied'));
}

// Pagination Items Per Page
if (elements.itemsPerPageSelect) {
  elements.itemsPerPageSelect.addEventListener('change', e => {
    state.itemsPerPage = e.target.value;
    state.currentPage = 1;
    renderJobCards();
  });
}

// Sort Select
elements.sortSelect.addEventListener('change', e => {
  state.sortBy = e.target.value;
  applyFilters(false);
});

// Global Searchable Combobox Selection Handler
window.selectComboboxCompany = function(company) {
  state.companyFilter = company;
  if (elements.companySelect) elements.companySelect.value = company;

  const comboboxSelected = document.getElementById('company-combobox-selected');
  if (comboboxSelected) {
    if (company === 'all') {
      comboboxSelected.textContent = 'All Companies';
      comboboxSelected.className = 'truncate font-semibold text-slate-700';
    } else {
      comboboxSelected.textContent = company;
      comboboxSelected.className = 'truncate font-bold text-brand-600';
    }
  }

  // Close menu and reset chevron
  const menu = document.getElementById('company-combobox-menu');
  const chevron = document.getElementById('company-combobox-chevron');
  if (menu) menu.classList.add('hidden');
  if (chevron) chevron.style.transform = 'rotate(0deg)';

  // Update item styling in list
  const list = document.getElementById('company-combobox-list');
  if (list) {
    const items = list.querySelectorAll('li');
    items.forEach(li => {
      const isAll = li.textContent.includes('All Companies');
      if ((company === 'all' && isAll) || (!isAll && li.getAttribute('data-company') === company.toLowerCase())) {
        li.className = 'company-combobox-item px-3 py-2 flex items-center justify-between cursor-pointer rounded-xl font-bold transition bg-brand-50 text-brand-700';
      } else {
        li.className = 'company-combobox-item px-3 py-2 flex items-center justify-between cursor-pointer rounded-xl font-medium transition text-slate-700 hover:bg-slate-50';
      }
    });
  }

  applyFilters();
};

// Combobox Trigger Button & Floating Menu
const comboboxBtn = document.getElementById('company-combobox-btn');
const comboboxMenu = document.getElementById('company-combobox-menu');
const comboboxChevron = document.getElementById('company-combobox-chevron');
const comboboxSearch = document.getElementById('company-combobox-search');
const comboboxClear = document.getElementById('company-combobox-clear');

if (comboboxBtn && comboboxMenu) {
  comboboxBtn.addEventListener('click', e => {
    e.stopPropagation();
    const isHidden = comboboxMenu.classList.contains('hidden');
    if (isHidden) {
      comboboxMenu.classList.remove('hidden');
      if (comboboxChevron) comboboxChevron.style.transform = 'rotate(180deg)';
      if (comboboxSearch) {
        comboboxSearch.value = '';
        comboboxSearch.focus();
        const items = document.querySelectorAll('.company-combobox-item');
        items.forEach(it => it.classList.remove('hidden'));
        if (comboboxClear) comboboxClear.classList.add('hidden');
      }
    } else {
      comboboxMenu.classList.add('hidden');
      if (comboboxChevron) comboboxChevron.style.transform = 'rotate(0deg)';
    }
  });

  // Close when clicking outside anywhere on document
  document.addEventListener('click', e => {
    if (!comboboxMenu.contains(e.target) && !comboboxBtn.contains(e.target)) {
      comboboxMenu.classList.add('hidden');
      if (comboboxChevron) comboboxChevron.style.transform = 'rotate(0deg)';
    }
  });
}

// Combobox Live Search Filtering
if (comboboxSearch) {
  comboboxSearch.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    if (comboboxClear) {
      if (q) comboboxClear.classList.remove('hidden');
      else comboboxClear.classList.add('hidden');
    }
    const items = document.querySelectorAll('.company-combobox-item');
    items.forEach(item => {
      const compName = item.getAttribute('data-company') || '';
      if (!q || compName.includes(q)) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });
  });
}

if (comboboxClear) {
  comboboxClear.addEventListener('click', () => {
    if (comboboxSearch) {
      comboboxSearch.value = '';
      comboboxSearch.focus();
    }
    comboboxClear.classList.add('hidden');
    const items = document.querySelectorAll('.company-combobox-item');
    items.forEach(it => it.classList.remove('hidden'));
  });
}

// More Filters Collapsible Accordion
const toggleMoreBtn = document.getElementById('toggle-more-filters-btn');
const moreFiltersPanel = document.getElementById('more-filters-panel');
const moreFiltersChevron = document.getElementById('more-filters-chevron');

if (toggleMoreBtn && moreFiltersPanel) {
  toggleMoreBtn.addEventListener('click', () => {
    const isHidden = moreFiltersPanel.classList.contains('hidden');
    if (isHidden) {
      moreFiltersPanel.classList.remove('hidden');
      moreFiltersPanel.classList.add('grid');
      if (moreFiltersChevron) moreFiltersChevron.textContent = '▴';
      toggleMoreBtn.classList.add('bg-brand-50', 'text-brand-700', 'border-brand-300');
    } else {
      moreFiltersPanel.classList.add('hidden');
      moreFiltersPanel.classList.remove('grid');
      if (moreFiltersChevron) moreFiltersChevron.textContent = '▾';
      toggleMoreBtn.classList.remove('bg-brand-50', 'text-brand-700', 'border-brand-300');
    }
  });
}

// Reset Button
elements.resetFiltersBtn.addEventListener('click', () => {
  state.searchQuery = '';
  elements.searchInput.value = '';
  state.activeRoleFilter = 'all';
  state.expFilter = 'all';
  state.levelFilter = 'all';
  state.typeFilter = 'all';
  state.sourceFilter = 'all';
  state.companyFilter = 'all';
  state.workplaceFilter = 'all';
  state.cityFilter = 'all';
  state.dateFilter = 'any';
  state.directAtsOnly = false;
  state.indiaLocalOnly = false;
  state.remoteOnly = false;
  state.currentPage = 1;
  state.itemsPerPage = 18;

  if (elements.roleSelect) elements.roleSelect.value = 'all';

  elements.expSelect.value = 'all';
  elements.levelSelect.value = 'all';
  elements.typeSelect.value = 'all';
  elements.sourceSelect.value = 'all';
  if (elements.companySelect) elements.companySelect.value = 'all';
  elements.workplaceSelect.value = 'all';
  if (elements.citySelect) elements.citySelect.value = 'all';
  if (elements.dateSelect) elements.dateSelect.value = 'any';
  if (elements.itemsPerPageSelect) elements.itemsPerPageSelect.value = '18';
  elements.directAtsCheckbox.checked = false;
  elements.indiaLocalCheckbox.checked = false;
  elements.remoteCheckbox.checked = false;

  setScope('india');
  setTrackerTab('all');
  updateCompanyOptions();

  elements.filterPills.forEach((p, idx) => {
    p.className = idx === 0 
      ? 'filter-pill active shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition bg-brand-600 text-white shadow-xs hover:shadow hover:-translate-y-0.5 cursor-pointer'
      : 'filter-pill shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition bg-white text-slate-600 hover:text-brand-600 hover:bg-brand-50/60 border border-slate-200/90 shadow-2xs hover:-translate-y-0.5 cursor-pointer';
  });
  applyFilters();
});

// Mobile Filter Toggle Button Listener
const mobileFilterToggleBtn = document.getElementById('mobile-filter-toggle-btn');
const filtersGridWrapper = document.getElementById('filters-grid-wrapper');
const mobileFilterChevron = document.getElementById('mobile-filter-chevron');
if (mobileFilterToggleBtn && filtersGridWrapper) {
  mobileFilterToggleBtn.addEventListener('click', () => {
    const isHidden = filtersGridWrapper.classList.toggle('hidden');
    if (mobileFilterChevron) {
      mobileFilterChevron.textContent = isHidden ? '▼ Show' : '▲ Hide';
    }
  });
}

// Mobile Reset Button Listener
const resetFiltersBtnMobile = document.getElementById('reset-filters-btn-mobile');
if (resetFiltersBtnMobile) {
  resetFiltersBtnMobile.addEventListener('click', () => {
    if (elements.resetFiltersBtn) elements.resetFiltersBtn.click();
  });
}

// Mobile Employer Post Job Icon Button
const employerPostBtnMobile = document.getElementById('employer-post-btn-mobile');
if (employerPostBtnMobile) {
  employerPostBtnMobile.addEventListener('click', () => openEmployerModal());
}

// Refresh Button
elements.refreshBtn.addEventListener('click', () => {
  initMonetization();
fetchJobs();
});

// Modal Events
if (elements.modalCloseBtn) {
  elements.modalCloseBtn.addEventListener('click', closeJobModal);
}
if (elements.jobModal) {
  elements.jobModal.addEventListener('click', e => {
    if (e.target === elements.jobModal) closeJobModal();
  });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && elements.jobModal && !elements.jobModal.classList.contains('hidden')) {
    closeJobModal();
  }
});

if (elements.modalSaveBtn) {
  elements.modalSaveBtn.addEventListener('click', () => {
    if (state.selectedJob) toggleSaveJob(state.selectedJob.job_id);
  });
}

if (elements.modalAppliedBtn) {
  elements.modalAppliedBtn.addEventListener('click', () => {
    if (state.selectedJob) toggleAppliedJob(state.selectedJob.job_id);
  });
}

if (elements.modalReportBtn) {
  elements.modalReportBtn.addEventListener('click', () => {
    if (state.selectedJob) reportJobClosed(state.selectedJob.job_id);
  });
}

// Copy Application Link
elements.modalCopyBtn.addEventListener('click', () => {
  if (!state.selectedJob) return;
  const url = state.selectedJob.direct_apply_url || state.selectedJob.apply_url;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Direct application link copied to clipboard!');
  }).catch(() => {
    showToast('Failed to copy link.');
  });
});

// Paywall removed: all features are free and unlimited

// ============================================================
// VIRAL WHATSAPP SHARING
// ============================================================

window.shareOnWhatsApp = function(title, company, url, event) {
  if (event) event.stopPropagation();
  const text = `🚨 *Direct Tech Opening (No Middlemen)*\n\n🎯 *Role:* ${title}\n🏢 *Company:* ${company}\n\n👉 Apply directly on company ATS portal:\n${url}\n\nFound via JobsForIndia — verified tech jobs for Indian candidates! 🇮🇳`;
  const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(shareUrl, '_blank', 'noopener,noreferrer');
  showToast('Opening WhatsApp to share job... 💬');
};

// ============================================================
// EMPLOYER FEATURED JOB SUBMISSION
// ============================================================

function openEmployerModal() {
  if (!elements.employerModal) return;
  elements.employerModal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  const compInput = document.getElementById('emp-company-name');
  if (compInput) compInput.focus();
};

function closeEmployerModal() {
  if (!elements.employerModal) return;
  elements.employerModal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
};

function submitEmployerJob() {
  const companyEl = document.getElementById('emp-company-name');
  const titleEl = document.getElementById('emp-job-title');
  const locEl = document.getElementById('emp-location');
  const salaryEl = document.getElementById('emp-salary');
  const urlEl = document.getElementById('emp-apply-url');
  const emailEl = document.getElementById('emp-email');

  const company = companyEl ? companyEl.value.trim() : '';
  const title = titleEl ? titleEl.value.trim() : '';
  const location = locEl ? locEl.value.trim() : 'India / Remote';
  const salary = salaryEl ? salaryEl.value.trim() : null;
  const applyUrl = urlEl ? urlEl.value.trim() : '';
  const email = emailEl ? emailEl.value.trim() : '';

  if (!company || !title || !applyUrl) {
    showToast('Please fill in Company Name, Job Title, and Apply URL.');
    return;
  }

  const newFeaturedJob = {
    job_id: 'featured_' + Date.now(),
    title: title,
    company: company,
    location: location,
    salary: salary || null,
    apply_url: applyUrl,
    direct_apply_url: applyUrl,
    source: 'Featured Employer ⭐',
    posted_date: new Date().toISOString().split('T')[0],
    is_direct_ats: true,
    is_india_eligible: true,
    description: `<h3>Featured Position by ${escapeHtml(company)}</h3><p>Verified hiring priority opening. Recruiter contact: ${escapeHtml(email)}.</p><p>Apply directly on official careers site.</p>`
  };

  // Prepend to allJobs so it sits at the very top of the board!
  state.allJobs.unshift(newFeaturedJob);
  closeEmployerModal();
  if (elements.employerJobForm) elements.employerJobForm.reset();
  applyFilters();
  // Open Razorpay / UPI payment link in new window if configured
  if (window.MONETIZATION_CONFIG && window.MONETIZATION_CONFIG.employerPayment && window.MONETIZATION_CONFIG.employerPayment.paymentUrl) {
    window.open(window.MONETIZATION_CONFIG.employerPayment.paymentUrl, '_blank', 'noopener,noreferrer');
    showToast('🎉 Opening checkout! Once paid, job is verified as #1 Featured Opening.');
  } else {
    showToast('🎉 Job submitted! Pinned as #1 Featured Job on JobsForIndia.');
  }
};

// Employer Modal Listeners
if (elements.employerPostBtn) {
  elements.employerPostBtn.addEventListener('click', openEmployerModal);
}
if (elements.employerModalCloseBtn) {
  elements.employerModalCloseBtn.addEventListener('click', closeEmployerModal);
}
if (elements.employerModal) {
  elements.employerModal.addEventListener('click', e => {
    if (e.target === elements.employerModal) closeEmployerModal();
  });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && elements.employerModal && !elements.employerModal.classList.contains('hidden')) {
    closeEmployerModal();
  }
});



// ============================================================
// VIP JOB ALERTS & SUBSCRIBER ENGINE
// ============================================================
const jobAlertsModal = document.getElementById('job-alerts-modal');
const jobAlertsCloseBtn = document.getElementById('job-alerts-close-btn');
const headerAlertsBtn = document.getElementById('header-job-alerts-btn');
const bannerAlertsBtn = document.getElementById('banner-job-alerts-btn');
const modalAlertRoleBtn = document.getElementById('modal-alert-role-btn');
const alertForm = document.getElementById('job-alerts-form');
const alertRoleSelect = document.getElementById('alert-role-category');
const alertKeywordsInput = document.getElementById('alert-keywords');
const alertSubmitBtn = document.getElementById('alert-submit-btn');
const alertPhoneWrapper = document.getElementById('alert-phone-wrapper');
const alertFreeDigestBtn = document.getElementById('alert-free-digest-btn');

window.openJobAlertsModal = function(prefillCategory = null, prefillKeyword = null) {
  if (!jobAlertsModal) return;
  if (prefillCategory && alertRoleSelect) {
    alertRoleSelect.value = prefillCategory;
  }
  if (prefillKeyword && alertKeywordsInput) {
    alertKeywordsInput.value = prefillKeyword;
  }
  jobAlertsModal.classList.remove('hidden');
  const emailInput = document.getElementById('alert-email');
  if (emailInput) setTimeout(() => emailInput.focus(), 100);
};

window.closeJobAlertsModal = function() {
  if (jobAlertsModal) jobAlertsModal.classList.add('hidden');
};

// Toggle Phone input when Telegram or WhatsApp channel is selected
document.querySelectorAll('input[name="alert_channel"]').forEach(radio => {
  radio.addEventListener('change', e => {
    if (!alertPhoneWrapper) return;
    if (e.target.value === 'telegram' || e.target.value === 'whatsapp') {
      alertPhoneWrapper.classList.remove('hidden');
    } else {
      alertPhoneWrapper.classList.add('hidden');
    }
  });
});

// Update Submit Button Text based on Plan Selection
function updateAlertSubmitBtnText() {
  if (!alertSubmitBtn) return;
  const selectedPlan = document.querySelector('input[name="alert_plan"]:checked');
  const planVal = selectedPlan ? selectedPlan.value : 'vip3mo';
  if (planVal === 'vip1mo') {
    alertSubmitBtn.textContent = 'Activate 1-Month Starter • ₹49 ⚡';
  } else if (planVal === 'vip3mo') {
    alertSubmitBtn.textContent = 'Activate 3-Month VIP Sprint • ₹99 ⚡ (Save 33%)';
  } else {
    alertSubmitBtn.textContent = 'Subscribe to Free Weekly Digest ✉️';
  }
}

document.querySelectorAll('input[name="alert_plan"]').forEach(radio => {
  radio.addEventListener('change', updateAlertSubmitBtnText);
});

if (alertFreeDigestBtn) {
  alertFreeDigestBtn.addEventListener('click', () => {
    // Uncheck radio plans and set to free
    const checked = document.querySelector('input[name="alert_plan"]:checked');
    if (checked) checked.checked = false;
    if (alertSubmitBtn) alertSubmitBtn.textContent = 'Subscribe to Free Weekly Digest ✉️';
    showToast('Switched to Free Weekly Digest mode.');
  });
}

window.submitJobAlerts = function() {
  const email = (document.getElementById('alert-email')?.value || '').trim();
  const roleCategory = document.getElementById('alert-role-category')?.value || 'all';
  const keywords = (document.getElementById('alert-keywords')?.value || '').trim();
  const location = document.getElementById('alert-location')?.value || 'any';
  const exp = document.getElementById('alert-exp')?.value || 'all';
  const channel = document.querySelector('input[name="alert_channel"]:checked')?.value || 'email';
  const phone = (document.getElementById('alert-phone')?.value || '').trim();
  const selectedPlanEl = document.querySelector('input[name="alert_plan"]:checked');
  const plan = selectedPlanEl ? selectedPlanEl.value : 'free_digest';

  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email address.');
    return;
  }

  const subscriberProfile = {
    email: email,
    phone: phone,
    roleCategory: roleCategory,
    keywords: keywords,
    location: location,
    experience: exp,
    channel: channel,
    plan: plan,
    subscribedAt: new Date().toISOString()
  };

  // 1. Save to local storage for fast client-side recall
  try {
    localStorage.setItem('techjobs_alert_subscriber', JSON.stringify(subscriberProfile));
  } catch (e) {}

  // 2. Post to Webhook / Google Form if configured in MONETIZATION_CONFIG
  const cfg = window.MONETIZATION_CONFIG && window.MONETIZATION_CONFIG.jobAlerts;
  if (cfg && cfg.subscriberWebhookUrl) {
    try {
      fetch(cfg.subscriberWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriberProfile),
        mode: 'no-cors'
      }).catch(() => {});
    } catch (err) {}
  }

  closeJobAlertsModal();

  // 3. Trigger Payment for VIP or Confirmation for Free
  if (plan === 'vip1mo') {
    const payUrl = (cfg && cfg.paymentUrl1Mo) ? cfg.paymentUrl1Mo : 'https://rzp.io/l/jobsforindia-alerts-1mo';
    window.open(payUrl, '_blank', 'noopener,noreferrer');
    showToast('🎉 Preferences saved! Opening ₹49 Razorpay 1-Month Starter checkout.');
  } else if (plan === 'vip3mo') {
    const payUrl = (cfg && cfg.paymentUrl3Mo) ? cfg.paymentUrl3Mo : 'https://rzp.io/l/jobsforindia-alerts-3mo';
    window.open(payUrl, '_blank', 'noopener,noreferrer');
    showToast('🎉 Preferences saved! Opening ₹99 Razorpay 3-Month VIP Sprint checkout.');
  } else {
    showToast('🎉 Subscribed to Free Weekly Digest! Check your inbox.');
  }
};

// Bind Alert Buttons
if (headerAlertsBtn) headerAlertsBtn.addEventListener('click', () => openJobAlertsModal());
if (bannerAlertsBtn) bannerAlertsBtn.addEventListener('click', () => openJobAlertsModal());
if (jobAlertsCloseBtn) jobAlertsCloseBtn.addEventListener('click', closeJobAlertsModal);
if (jobAlertsModal) {
  jobAlertsModal.addEventListener('click', e => {
    if (e.target === jobAlertsModal) closeJobAlertsModal();
  });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && jobAlertsModal && !jobAlertsModal.classList.contains('hidden')) {
    closeJobAlertsModal();
  }
});

// Modal "Alert Similar Roles" Button
if (modalAlertRoleBtn) {
  modalAlertRoleBtn.addEventListener('click', () => {
    const jobTitle = document.getElementById('modal-title')?.textContent || '';
    const jobComp = document.getElementById('modal-company')?.textContent || '';
    closeModal();
    
    // Auto-detect role category
    const t = jobTitle.toLowerCase();
    let cat = 'all';
    if (/qa|test|quality|automation|sdet/.test(t)) cat = 'qa';
    else if (/react|frontend|front-end|vue|angular|ui/.test(t)) cat = 'frontend';
    else if (/backend|back-end|node|python|java|golang|go|rust|c\+\+|spring/.test(t)) cat = 'backend';
    else if (/fullstack|full-stack|full stack/.test(t)) cat = 'fullstack';
    else if (/devops|sre|cloud|aws|kubernetes|k8s|infra/.test(t)) cat = 'devops';
    else if (/data|ml|ai|machine learning|analytics|bi/.test(t)) cat = 'data';
    else if (/mobile|ios|android|flutter|react native/.test(t)) cat = 'mobile';
    else if (/product|design|ui\/ux|ux/.test(t)) cat = 'product';

    openJobAlertsModal(cat, jobTitle);
  });
}


// ============================================================
// DYNAMIC MONETIZATION & AFFILIATE WIRING
// ============================================================
function initMonetization() {
  if (!window.MONETIZATION_CONFIG) return;
  const cfg = window.MONETIZATION_CONFIG;

  // Footer Contact & Community Wiring
  const footerEmail = document.getElementById('footer-contact-email');
  if (footerEmail && cfg.transparency && cfg.transparency.contactEmail) {
    footerEmail.href = `mailto:${cfg.transparency.contactEmail}`;
    const spanText = footerEmail.querySelector('span:last-child');
    if (spanText) spanText.textContent = cfg.transparency.contactEmail;
  }
  const footerTg = document.getElementById('footer-tg-link');
  if (footerTg && cfg.alertsCommunity && cfg.alertsCommunity.telegramChannelUrl) {
    footerTg.href = cfg.alertsCommunity.telegramChannelUrl;
  }
  const footerWa = document.getElementById('footer-wa-link');
  if (footerWa && cfg.alertsCommunity && cfg.alertsCommunity.whatsappGroupUrl) {
    footerWa.href = cfg.alertsCommunity.whatsappGroupUrl;
  }

  // Header Telegram Link
  const tgBtn = document.getElementById('header-telegram-btn');
  if (tgBtn && cfg.alertsCommunity && cfg.alertsCommunity.telegramChannelUrl) {
    tgBtn.href = cfg.alertsCommunity.telegramChannelUrl;
  }

  // Resume Affiliate Link in Modal
  const resumeBtn = document.getElementById('modal-resume-affiliate');
  if (resumeBtn && cfg.resumeChecker) {
    if (cfg.resumeChecker.enabled) {
      resumeBtn.href = cfg.resumeChecker.url;
      resumeBtn.classList.remove('hidden');
    } else {
      resumeBtn.classList.add('hidden');
    }
  }

  // Mentorship Affiliate Link in Modal
  const topmateBtn = document.getElementById('modal-topmate-affiliate');
  if (topmateBtn && cfg.mentorship) {
    if (cfg.mentorship.enabled) {
      topmateBtn.href = cfg.mentorship.url;
      topmateBtn.classList.remove('hidden');
    } else {
      topmateBtn.classList.add('hidden');
    }
  }
}

// Boot App
fetchJobs();


window.openEmployerModal = openEmployerModal;
window.closeEmployerModal = closeEmployerModal;
window.submitEmployerJob = submitEmployerJob;

// Native Mobile & Browser Back Button (popstate) Handler
window.addEventListener('popstate', (e) => {
  if (elements.jobModal && !elements.jobModal.classList.contains('hidden')) {
    closeJobModal(true);
  }
  if (elements.employerModal && !elements.employerModal.classList.contains('hidden')) {
    closeEmployerModal(true);
  }
  if (elements.jobAlertsModal && !elements.jobAlertsModal.classList.contains('hidden')) {
    closeJobAlertsModal(true);
  }
});
