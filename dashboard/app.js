/**
 * RemoteJobsHub - Global Remote Tech Jobs Web Application
 * Lightweight, zero-dependency, ultra-fast client-side search & filtering engine.
 */

// ── State Management ──────────────────────────────────────────────────────────
const state = {
  allJobs: [],
  filteredJobs: [],
  renderedCount: 0,
  pageSize: 30,
  savedJobIds: getSavedJobIds(),
  
  // Filters
  category: 'all',
  scope: 'all',
  seniority: 'all',
  source: 'all',
  directAtsOnly: false,
  sortBy: 'newest',
  searchQuery: '',
  trackerTab: 'all', // 'all' | 'saved'
};

// ── Local Storage for Saved Jobs ──────────────────────────────────────────────
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
    updateSavedCounters();
  } catch (e) {
    console.error('Failed saving to localStorage', e);
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
  renderJobCards(false);
}

function updateSavedCounters() {
  const count = state.savedJobIds.size;
  const navCount = document.getElementById('nav-saved-count');
  if (navCount) navCount.textContent = count;
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

function extractTags(text) {
  if (!text) return [];
  const found = [];
  const lower = text.toLowerCase();
  for (const tag of TECH_TAGS) {
    const tagLower = tag.toLowerCase();
    const regex = new RegExp(`\\b${tagLower.replace('.', '\\.')}\\b`, 'i');
    if (regex.test(lower)) {
      found.push(tag);
      if (found.length >= 4) break;
    }
  }
  return found;
}

// ── Deterministic Gradient Generator for Avatars ──────────────────────────────
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

// ── Application Initialization ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadJobsData();
  bindEventHandlers();
  updateSavedCounters();
});

function loadJobsData() {
  const headerCount = document.getElementById('header-count-badge');
  const resultsCount = document.getElementById('results-count-badge');

  if (window.JOBS_DATA && Array.isArray(window.JOBS_DATA) && window.JOBS_DATA.length > 0) {
    state.allJobs = window.JOBS_DATA;
    onJobsLoaded();
  } else {
    // Fallback: fetch JSON if jobs_latest.js was empty or pending
    fetch('jobs_latest.json')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          state.allJobs = data;
          onJobsLoaded();
        } else {
          showEmptyState('No remote jobs found in the feed.');
        }
      })
      .catch(err => {
        console.error('Failed loading jobs feed:', err);
        showEmptyState('Could not load jobs feed. Please refresh or trigger an update.');
      });
  }
}

function onJobsLoaded() {
  const count = state.allJobs.length;
  const headerCount = document.getElementById('header-count-badge');
  if (headerCount) {
    headerCount.textContent = `${count.toLocaleString()} verified remote jobs`;
  }
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
    // 1. Saved Tab Filter
    if (state.trackerTab === 'saved') {
      if (!state.savedJobIds.has(job.job_id)) return false;
    }

    // 2. Query Search (Title, Company, Location, Description)
    if (query) {
      const titleMatch = (job.title || '').toLowerCase().includes(query);
      const companyMatch = (job.company || '').toLowerCase().includes(query);
      const locMatch = (job.location || '').toLowerCase().includes(query);
      const descMatch = (job.description || '').toLowerCase().includes(query);
      if (!titleMatch && !companyMatch && !locMatch && !descMatch) return false;
    }

    // 3. Category Filter
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

    // 4. Remote Scope Filter
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

    // 5. Seniority Filter
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

    // 6. Source Filter
    if (src !== 'all') {
      if (job.source !== src) return false;
    }

    // 7. Direct ATS Only Filter
    if (atsOnly) {
      if (!job.direct_apply_url && job.source !== 'CompanyATS') return false;
    }

    return true;
  });

  // Sorting
  if (state.sortBy === 'company') {
    results.sort((a, b) => (a.company || '').localeCompare(b.company || ''));
  } else if (state.sortBy === 'title') {
    results.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else {
    // Newest first (default)
    results.sort((a, b) => {
      const dateA = a.posted_date || a.collected_date || '';
      const dateB = b.posted_date || b.collected_date || '';
      return dateB.localeCompare(dateA);
    });
  }

  state.filteredJobs = results;
  state.renderedCount = 0;
  
  // Update Results Badge
  const badge = document.getElementById('results-count-badge');
  if (badge) {
    badge.textContent = `${results.length.toLocaleString()} jobs`;
  }

  renderJobCards(true);
}

// ── Render Job Cards to DOM ────────────────────────────────────────────────────
function renderJobCards(reset = false) {
  const container = document.getElementById('job-grid');
  const paginationBar = document.getElementById('pagination-bar');
  const showingEl = document.getElementById('showing-count');
  const totalEl = document.getElementById('total-count');

  if (reset) {
    container.innerHTML = '';
    state.renderedCount = 0;
  }

  if (state.filteredJobs.length === 0) {
    container.innerHTML = `
      <div class="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <div class="text-4xl mb-3">🔍</div>
        <h3 class="text-lg font-bold text-white mb-1">No matching remote positions found</h3>
        <p class="text-xs text-slate-400 max-w-sm mx-auto mb-4">
          Try loosening your keywords, switching to "All Regions", or resetting your filters.
        </p>
        <button onclick="resetAllFilters()" class="px-4 py-2 text-xs font-bold bg-emerald-500 text-slate-950 rounded-xl hover:bg-emerald-400 transition cursor-pointer">
          Reset All Filters
        </button>
      </div>
    `;
    if (paginationBar) paginationBar.classList.add('hidden');
    return;
  }

  if (paginationBar) paginationBar.classList.remove('hidden');

  const start = state.renderedCount;
  const end = Math.min(start + state.pageSize, state.filteredJobs.length);
  const chunk = state.filteredJobs.slice(start, end);

  const fragment = document.createDocumentFragment();

  chunk.forEach(job => {
    const card = document.createElement('div');
    card.className = 'job-card-hover bg-slate-900/90 border border-slate-800/90 hover:border-emerald-500/50 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition cursor-pointer';
    card.onclick = () => openJobModal(job);

    const isSaved = state.savedJobIds.has(job.job_id);
    const gradient = getGradient(job.company);
    const initials = getInitials(job.company);
    const tags = extractTags(`${job.title} ${job.description}`);
    const applyLink = job.direct_apply_url || job.apply_url || '#';
    const isDirectAts = !!job.direct_apply_url || job.source === 'CompanyATS';

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

    card.innerHTML = `
      <div class="flex items-start gap-3.5 sm:gap-4 flex-grow min-w-0">
        <!-- Company Monogram / Avatar -->
        <div class="w-12 h-12 rounded-xl bg-gradient-to-tr ${gradient} flex items-center justify-center text-white font-black text-base shadow-sm shrink-0">
          ${initials}
        </div>

        <div class="flex-grow min-w-0">
          <!-- Company Name, Source & ATS Pill -->
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <span class="text-xs font-bold text-slate-300 truncate max-w-[180px]">${escapeHtml(job.company || 'Hiring Company')}</span>
            ${isDirectAts ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">⚡ Direct ATS</span>' : ''}
            <span class="text-[11px] text-slate-500">•</span>
            <span class="text-[11px] text-slate-400">${escapeHtml(job.source || 'RemoteFeed')}</span>
          </div>

          <!-- Job Title -->
          <h3 class="text-base sm:text-lg font-bold text-white hover:text-emerald-400 transition truncate leading-snug">
            ${escapeHtml(job.title)}
          </h3>

          <!-- Scope & Tech Stack Tags -->
          <div class="flex items-center gap-1.5 flex-wrap mt-2">
            ${scopeBadge}
            ${job.employment_type ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300">${escapeHtml(job.employment_type)}</span>` : ''}
            ${tags.map(t => `<span class="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300">${t}</span>`).join('')}
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
        <!-- Bookmark Button -->
        <button 
          type="button" 
          onclick="toggleSaveJob('${job.job_id}', event)" 
          class="p-2 rounded-xl text-xs font-bold ${isSaved ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700'} transition cursor-pointer"
          title="${isSaved ? 'Remove Bookmark' : 'Save Job'}"
        >
          ${isSaved ? '⭐' : '☆'}
        </button>

        <!-- Direct Apply CTA -->
        <a 
          href="${escapeHtml(applyLink)}" 
          target="_blank" 
          rel="noopener noreferrer" 
          onclick="event.stopPropagation();"
          class="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 rounded-xl shadow-md shadow-emerald-500/10 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
        >
          <span>Apply</span>
          <span>↗</span>
        </a>
      </div>
    `;

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
  state.renderedCount = end;

  // Update Pagination Indicators
  if (showingEl) showingEl.textContent = state.renderedCount.toLocaleString();
  if (totalEl) totalEl.textContent = state.filteredJobs.length.toLocaleString();

  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    if (state.renderedCount >= state.filteredJobs.length) {
      loadMoreBtn.classList.add('hidden');
    } else {
      loadMoreBtn.classList.remove('hidden');
    }
  }
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
  const scopeBadge = document.getElementById('modal-scope-badge');
  const locBadge = document.getElementById('modal-location-badge');
  const srcBadge = document.getElementById('modal-source-badge');

  if (!modal) return;

  title.textContent = job.title;
  company.textContent = job.company;
  avatar.textContent = getInitials(job.company);
  avatar.className = `w-12 h-12 rounded-2xl bg-gradient-to-tr ${getGradient(job.company)} flex items-center justify-center text-white font-black text-xl shrink-0`;

  const isSaved = state.savedJobIds.has(job.job_id);
  saveBtn.textContent = isSaved ? '⭐ Saved' : '☆ Save Job';
  saveBtn.onclick = () => {
    toggleSaveJob(job.job_id);
    saveBtn.textContent = state.savedJobIds.has(job.job_id) ? '⭐ Saved' : '☆ Save Job';
  };

  const link = job.direct_apply_url || job.apply_url || '#';
  applyBtn.href = link;

  scopeBadge.textContent = job.remote_scope ? `🌐 ${job.remote_scope}` : '🌐 100% Remote';
  locBadge.textContent = `📍 ${job.location || 'Anywhere'}`;
  srcBadge.textContent = `🎯 ${job.source || 'Company ATS'}`;

  // Description format
  const cleanDesc = (job.description || 'No description provided. Please click Apply to view complete job details on the hiring company website.')
    .replace(/\n\n+/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  body.innerHTML = `
    <div class="prose prose-invert max-w-none text-slate-300">
      ${cleanDesc}
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
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
      timeout = setTimeout(() => applyFilters(), 250);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      state.searchQuery = '';
      clearBtn.classList.add('hidden');
      applyFilters();
    });
  }

  // 2. Category Pills
  const rolePills = document.querySelectorAll('.role-pill');
  rolePills.forEach(pill => {
    pill.addEventListener('click', () => {
      rolePills.forEach(p => {
        p.classList.remove('active', 'bg-emerald-500', 'text-slate-950', 'shadow-md', 'shadow-emerald-500/20');
        p.classList.add('bg-slate-900', 'text-slate-400');
      });
      pill.classList.add('active', 'bg-emerald-500', 'text-slate-950', 'shadow-md', 'shadow-emerald-500/20');
      pill.classList.remove('bg-slate-900', 'text-slate-400');

      state.category = pill.dataset.category || 'all';
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
          other.className = 'scope-tab px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition whitespace-nowrap cursor-pointer';
        }
      });
      el.className = 'scope-tab active px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 transition whitespace-nowrap cursor-pointer';
      state.scope = tab.scope;
      applyFilters();
    });
  });

  // 4. Dropdowns
  const expSelect = document.getElementById('exp-select');
  if (expSelect) {
    expSelect.addEventListener('change', e => {
      state.seniority = e.target.value;
      applyFilters();
    });
  }

  const srcSelect = document.getElementById('source-select');
  if (srcSelect) {
    srcSelect.addEventListener('change', e => {
      state.source = e.target.value;
      applyFilters();
    });
  }

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', e => {
      state.sortBy = e.target.value;
      applyFilters();
    });
  }

  const directAtsCheck = document.getElementById('direct-ats-checkbox');
  if (directAtsCheck) {
    directAtsCheck.addEventListener('change', e => {
      state.directAtsOnly = e.target.checked;
      applyFilters();
    });
  }

  // 5. Reset Filters
  const resetBtn = document.getElementById('reset-filters-btn');
  if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);

  // 6. Pagination Load More
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => renderJobCards(false));
  }

  // 7. Modal Closing
  const closeBtn = document.getElementById('modal-close-btn');
  const backdrop = document.getElementById('modal-backdrop');
  if (closeBtn) closeBtn.addEventListener('click', closeJobModal);
  if (backdrop) backdrop.addEventListener('click', closeJobModal);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeJobModal();
  });

  // 8. Saved Nav Tracker Toggle
  const savedNavBtn = document.getElementById('tracker-saved-nav-btn');
  if (savedNavBtn) {
    savedNavBtn.addEventListener('click', () => {
      state.trackerTab = state.trackerTab === 'saved' ? 'all' : 'saved';
      savedNavBtn.classList.toggle('border-emerald-500', state.trackerTab === 'saved');
      applyFilters();
    });
  }

  // 9. Refresh Button
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
window.setQuickSearch = function(keyword) {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = keyword;
    state.searchQuery = keyword;
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) clearBtn.classList.remove('hidden');
    applyFilters();
    document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth' });
  }
};

window.resetAllFilters = function() {
  state.category = 'all';
  state.scope = 'all';
  state.seniority = 'all';
  state.source = 'all';
  state.directAtsOnly = false;
  state.sortBy = 'newest';
  state.searchQuery = '';
  state.trackerTab = 'all';

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) clearBtn.classList.add('hidden');

  const expSelect = document.getElementById('exp-select');
  if (expSelect) expSelect.value = 'all';

  const srcSelect = document.getElementById('source-select');
  if (srcSelect) srcSelect.value = 'all';

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = 'newest';

  const directAtsCheck = document.getElementById('direct-ats-checkbox');
  if (directAtsCheck) directAtsCheck.checked = false;

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
      el.className = 'scope-tab active px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 transition whitespace-nowrap cursor-pointer';
    } else {
      el.className = 'scope-tab px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition whitespace-nowrap cursor-pointer';
    }
  });

  applyFilters();
};

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
