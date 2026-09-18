/* pages/news.js — News Intelligence with API integration */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api, { ApiError } from '../../core/api.js';
import { toast } from '../../ui/toast.js';

const TIME_FILTERS = [
  { label: 'Last 24h', value: 24 },
  { label: 'Last 48h', value: 48 },
  { label: 'Last 7 days', value: 168 },
];

function formatTimeAgo(iso) {
  if (!iso) return '?';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return '<1h ago';
  if (diffH < 48) return `${diffH} hour${diffH > 1 ? 's' : ''} ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} day${diffD > 1 ? 's' : ''} ago`;
  return d.toLocaleDateString();
}

export function render() {
  const state = {
    articles: [],
    domains: [],
    total: 0,
    page: 1,
    perPage: 50,
    sinceHours: 24,
    filterDomain: '',
    searchTerm: '',
    viewMode: 'all',
    grouped: null,
  };

  const container = createEl('div', { class: 'news-page' }, []);

  // Header
  container.appendChild(createEl('h1', {}, ['News Intelligence']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Aggregated news from multiple sources.']));

  // Toolbar
  const toolbar = createEl('div', {
    style: { display: 'flex', gap: 'var(--s-3)', marginBottom: 'var(--s-5)', flexWrap: 'wrap', alignItems: 'center' }
  });
  toolbar.innerHTML = `
    <div class="search" style="flex:1;min-width:260px;">
      <span class="search__icon">${icons['search']}</span>
      <input type="text" class="search__input" placeholder="Search articles...">
    </div>
    <select class="field__select" id="time-filter" style="width:140px;min-width:140px;">
      ${TIME_FILTERS.map(t => `<option value="${t.value}" ${t.value === 24 ? 'selected' : ''}>${t.label}</option>`).join('')}
    </select>
    <select class="field__select" id="domain-filter" style="width:160px;min-width:160px;">
      <option value="">All Domains</option>
    </select>
    <button class="btn btn--secondary" id="refresh-btn">${icons['refresh']} Refresh</button>
  `;
  container.appendChild(toolbar);

  // Tabs
  const tabs = createEl('div', { class: 'tabs' });
  const tabAll = createEl('button', { class: 'tabs__item tabs__item--active' }, ['All Articles']);
  const tabGrouped = createEl('button', { class: 'tabs__item' }, ['By Topic']);
  tabs.appendChild(tabAll);
  tabs.appendChild(tabGrouped);
  container.appendChild(tabs);

  // Articles list container
  const listContainer = createEl('div', { id: 'news-list' });
  container.appendChild(listContainer);

  // Pagination
  const pagination = createEl('div', {
    style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--s-5)', flexWrap: 'wrap', gap: 'var(--s-3)' }
  });
  container.appendChild(pagination);

  // Wire up toolbar
  const searchInput = toolbar.querySelector('.search__input');
  const timeFilter = toolbar.querySelector('#time-filter');
  const domainFilter = toolbar.querySelector('#domain-filter');
  const refreshBtn = toolbar.querySelector('#refresh-btn');

  let searchDebounce;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.searchTerm = e.target.value;
      state.page = 1;
      loadArticles();
    }, 400);
  });

  timeFilter.addEventListener('change', (e) => {
    state.sinceHours = parseInt(e.target.value);
    state.page = 1;
    if (state.viewMode === 'grouped') loadGrouped();
    else loadArticles();
  });

  domainFilter.addEventListener('change', (e) => {
    state.filterDomain = e.target.value;
    state.page = 1;
    if (state.viewMode === 'all') loadArticles();
  });

  refreshBtn.addEventListener('click', () => {
    loadDomains();
    if (state.viewMode === 'grouped') loadGrouped();
    else loadArticles();
  });

  tabAll.addEventListener('click', () => {
    if (state.viewMode === 'all') return;
    state.viewMode = 'all';
    tabAll.classList.add('tabs__item--active');
    tabGrouped.classList.remove('tabs__item--active');
    loadArticles();
  });

  tabGrouped.addEventListener('click', () => {
    if (state.viewMode === 'grouped') return;
    state.viewMode = 'grouped';
    tabGrouped.classList.add('tabs__item--active');
    tabAll.classList.remove('tabs__item--active');
    loadGrouped();
  });

  // ---- Functions ----

  async function loadDomains() {
    try {
      const data = await Api.get('/news/domains');
      state.domains = data || [];
      domainFilter.innerHTML = '<option value="">All Domains</option>' +
        state.domains.map(d => `<option value="${d.domain}" ${d.domain === state.filterDomain ? 'selected' : ''}>${d.domain} (${d.article_count})</option>`).join('');
    } catch (e) {
      console.error('[News] Failed to load domains:', e);
      state.domains = [];
    }
  }

  async function loadArticles() {
    listContainer.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const row = createEl('div', { class: 'skeleton', style: { height: '72px', borderRadius: '6px', marginBottom: '12px' } });
      listContainer.appendChild(row);
    }

    try {
      const params = {
        since_hours: state.sinceHours,
        page: state.page,
        per_page: state.perPage,
      };
      if (state.filterDomain) params.domain = state.filterDomain;
      if (state.searchTerm) params.search = state.searchTerm;

      const data = await Api.get('/news/articles', params);
      state.articles = data.articles || [];
      state.total = data.total || 0;
    } catch (e) {
      state.articles = [];
      state.total = 0;
      toast('Gagal memuat berita: ' + (e.message || e), { type: 'error' });
    }

    renderArticles();
    renderPagination();
  }

  function renderArticles() {
    listContainer.innerHTML = '';

    if (state.articles.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--s-8);">
          <div style="font-size:48px;margin-bottom:var(--s-4);opacity:0.3;">${icons['newspaper']}</div>
          <p style="color:var(--c-text-2);">Tidak ada artikel ditemukan.</p>
        </div>
      `;
      return;
    }

    const list = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });

    state.articles.forEach(a => {
      const item = createEl('div', {
        class: 'card',
        style: { padding: 'var(--s-4)', display: 'flex', gap: 'var(--s-4)', alignItems: 'flex-start' }
      });
      item.innerHTML = `
        <div style="width:40px;height:40px;border-radius:var(--radius);background:var(--c-surface-2);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--c-text-3);">
          ${icons['newspaper']}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;margin-bottom:var(--s-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            <a href="${a.url || '#'}" target="_blank" rel="noopener">${a.title}</a>
          </div>
          <div style="display:flex;gap:var(--s-3);align-items:center;font-size:var(--text-xs);color:var(--c-text-3);flex-wrap:wrap;">
            <span class="badge badge--neutral">${a.domain || 'unknown'}</span>
            <span>${formatTimeAgo(a.pub_display)}</span>
            <span class="badge badge--primary">${a.language || 'en'}</span>
          </div>
        </div>
        <a href="${a.url || '#'}" target="_blank" rel="noopener" class="btn btn--ghost btn--sm" title="Open">${icons['chevron-right']}</a>
      `;
      list.appendChild(item);
    });
    listContainer.appendChild(list);
  }

  async function loadGrouped() {
    listContainer.innerHTML = '';
    pagination.innerHTML = '';

    const loading = createEl('div', { class: 'card', style: { padding: 'var(--s-8)', textAlign: 'center', color: 'var(--c-text-2)' } });
    loading.innerHTML = `
      <div style="font-size:36px;margin-bottom:var(--s-3);opacity:0.4;">${icons['layers']}</div>
      <div style="font-size:var(--text-sm);">Mengelompokkan artikel berdasarkan topik...</div>
      <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:var(--s-1);">Bisa butuh beberapa detik</div>
    `;
    listContainer.appendChild(loading);

    try {
      const data = await Api.get('/news/articles/grouped', { since_hours: state.sinceHours });
      state.grouped = data;
      renderGrouped(data);
    } catch (e) {
      listContainer.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--s-8);">
          <p style="color:var(--c-danger);">Gagal memuat: ${e.message || e}</p>
        </div>
      `;
    }
  }

  function renderGrouped(data) {
    listContainer.innerHTML = '';
    const groups = data.groups || [];

    if (!groups.length) {
      listContainer.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--s-8);">
          <div style="font-size:48px;margin-bottom:var(--s-4);opacity:0.3;">${icons['layers']}</div>
          <p style="color:var(--c-text-2);">Tidak ada artikel untuk dikelompokkan.</p>
        </div>
      `;
      return;
    }

    const multi = groups.filter(g => g.count > 1);
    const singles = groups.filter(g => g.count === 1);
    const list = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });

    multi.forEach(g => {
      const master = g.master;
      const related = g.related || [];
      const domains = new Set([master.domain, ...related.map(r => r.domain)]);
      const card = createEl('div', {
        class: 'card',
        style: { padding: 'var(--s-4)', borderLeft: '4px solid var(--c-accent)' }
      });
      card.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:var(--s-3);">
          <div style="width:44px;height:44px;border-radius:var(--radius);background:var(--c-accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:var(--text-md);flex-shrink:0;">${g.count}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:var(--text-xs);color:var(--c-text-3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--s-1);">Topik</div>
            <div style="font-weight:700;font-size:var(--text-md);margin-bottom:var(--s-2);">
              <a href="${master.url}" target="_blank" rel="noopener" style="color:var(--c-text-1);">${master.title}</a>
            </div>
            <div style="display:flex;gap:var(--s-2);align-items:center;flex-wrap:wrap;font-size:var(--text-xs);color:var(--c-text-3);margin-bottom:var(--s-2);">
              ${[...domains].map(d => `<span class="badge badge--neutral">${d}</span>`).join('')}
              <span>${formatTimeAgo(master.pub_display)}</span>
              ${domains.size > 1 ? `<span class="badge badge--primary">${domains.size} sumber</span>` : ''}
              <span class="badge badge--primary">${master.language || 'en'}</span>
            </div>
            ${related.length ? `
              <details>
                <summary style="cursor:pointer;font-size:var(--text-sm);color:var(--c-text-2);">${related.length} artikel terkait</summary>
                <div style="margin-top:var(--s-2);display:flex;flex-direction:column;gap:var(--s-2);">
                  ${related.map(r => `
                    <div style="display:flex;align-items:center;gap:var(--s-2);font-size:var(--text-xs);">
                      <span class="badge badge--neutral">${r.domain}</span>
                      <a href="${r.url}" target="_blank" rel="noopener" style="color:var(--c-text-2);text-decoration:none;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.title}</a>
                    </div>
                  `).join('')}
                </div>
              </details>
            ` : ''}
          </div>
        </div>
      `;
      list.appendChild(card);
    });

    if (singles.length) {
      const singleCard = createEl('div', { class: 'card', style: { padding: 'var(--s-4)' } });
      singleCard.innerHTML = `
        <div style="font-weight:700;font-size:var(--text-sm);margin-bottom:var(--s-3);color:var(--c-text-2);">Berita unik lainnya (${singles.length})</div>
        <div style="display:flex;flex-direction:column;gap:var(--s-2);">
          ${singles.map(g => {
            const a = g.master;
            return `
              <div style="display:flex;align-items:center;gap:var(--s-2);font-size:var(--text-sm);">
                <span class="badge badge--neutral">${a.domain}</span>
                <a href="${a.url}" target="_blank" rel="noopener" style="color:var(--c-text-1);text-decoration:none;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.title}</a>
                <span style="color:var(--c-text-3);font-size:var(--text-xs);flex-shrink:0;">${formatTimeAgo(a.pub_display)}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
      list.appendChild(singleCard);
    }

    listContainer.appendChild(list);
  }

  function renderPagination() {
    const totalPages = Math.ceil(state.total / state.perPage);
    pagination.innerHTML = `
      <span style="font-size:var(--text-sm);color:var(--c-text-3);">
        Showing ${(state.page - 1) * state.perPage + 1}-${Math.min(state.page * state.perPage, state.total)} of ${state.total} articles
      </span>
      <div style="display:flex;gap:var(--s-2);">
        <button class="btn btn--ghost btn--sm" ${state.page <= 1 ? 'disabled' : ''} onclick="window.newsPrev()">Prev</button>
        <button class="btn btn--primary btn--sm">${state.page}</button>
        <button class="btn btn--ghost btn--sm" ${state.page >= totalPages ? 'disabled' : ''} onclick="window.newsNext()">Next</button>
      </div>
    `;
  }

  window.newsPrev = () => {
    if (state.page > 1) { state.page--; loadArticles(); }
  };
  window.newsNext = () => {
    const totalPages = Math.ceil(state.total / state.perPage);
    if (state.page < totalPages) { state.page++; loadArticles(); }
  };

  container._cleanup = () => {
    delete window.newsPrev;
    delete window.newsNext;
  };

  // Init
  loadDomains();
  loadArticles();

  return container;
}
