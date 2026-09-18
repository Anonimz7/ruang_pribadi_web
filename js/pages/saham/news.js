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
    singles: [],
    singlesTotal: 0,
    singlesPage: 1,
    singlesPerPage: 50,
  };

  const container = createEl('div', { class: 'news-page' }, []);

  // Scoped styles for the By Topic accordion
  const topicStyle = createEl('style', {}, []);
  topicStyle.textContent = `
    .news-topic details > summary { list-style: none; cursor: pointer; }
    .news-topic details > summary::-webkit-details-marker { display: none; }
    .news-topic details > summary:hover { background: var(--c-surface-2); }
    .news-topic details[open] > summary { background: var(--c-surface-2); }
    .news-topic details[open] .news-topic__chevron { transform: rotate(180deg); }
    .news-topic__chevron { transition: transform 0.15s ease; flex-shrink: 0; color: var(--c-text-3); }
    .news-topic__badge { min-width: 30px; height: 30px; border-radius: 8px; background: var(--c-accent); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: var(--text-xs); font-weight: 700; flex-shrink: 0; }
    .news-topic__badge--single { background: var(--c-surface-2); color: var(--c-text-3); }
    .news-topic__title { font-weight: 500; font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .news-topic__title a { color: var(--c-text-1); text-decoration: none; }
    .news-topic__title a:hover { color: var(--c-accent); }
    .news-topic__meta { display: flex; align-items: center; gap: var(--s-2); font-size: var(--text-xs); color: var(--c-text-3); margin-top: 4px; flex-wrap: wrap; }
    .news-topic__avatar { width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0; }
    .news-topic__avatar--sm { width: 16px; height: 16px; font-size: 8px; }
    .news-topic__lang { border: 1px solid var(--c-border); border-radius: 4px; padding: 0 4px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.03em; }
    .news-topic__related { display: flex; align-items: center; gap: var(--s-2); padding: var(--s-2); border-radius: var(--radius); text-decoration: none; transition: background 0.15s ease; }
    .news-topic__related:hover { background: var(--c-surface-2); }
    .news-topic__related-title { font-size: var(--text-xs); color: var(--c-text-2); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .news-topic__related:hover .news-topic__related-title { color: var(--c-accent); }
    .news-topic__dot { width: 5px; height: 5px; border-radius: 50%; background: var(--c-border); flex-shrink: 0; }
    .news-topic__dot--single { width: 8px; height: 8px; border-radius: 50%; background: var(--c-accent); opacity: 0.45; flex-shrink: 0; }
    .news-topic > details:last-child { border-bottom: none; }
    .news-topic__single:last-child { border-bottom: none; }
  `;
  container.appendChild(topicStyle);

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
      const data = await Api.get('/news/articles/grouped', {
        since_hours: state.sinceHours,
        singles_page: 1,
        singles_per_page: state.singlesPerPage,
      });
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

const AVATAR_COLORS = ['#5B8DEF', '#E07B54', '#4CAF7D', '#9B6FE0', '#D9A13B', '#E05B8A', '#3BA8C9', '#8A9A5B'];

  function avatarColor(domain) {
    let h = 0;
    for (let i = 0; i < domain.length; i++) h = (h * 31 + domain.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function renderGrouped(data) {
    listContainer.innerHTML = '';
    const groups = data.groups || [];

    if (!groups.length) {
      listContainer.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--s-8);">
          <p style="color:var(--c-text-3);">Tidak ada artikel untuk dikelompokkan.</p>
        </div>
      `;
      return;
    }

    const multi = data.groups || [];
    const singles = data.singles || [];
    state.singles = singles;
    state.singlesTotal = data.singles_total || 0;
    state.singlesPage = data.singles_page || 1;
    state.singlesPerPage = data.singles_per_page || state.singlesPerPage;
    const list = createEl('div', { class: 'news-topic', style: { display: 'flex', flexDirection: 'column' } });

    multi.forEach(g => {
      const master = g.master;
      const related = g.related || [];
      const domains = [...new Set([master.domain, ...related.map(r => r.domain)])];

      const row = createEl('details');
      row.style.cssText = 'border-bottom:1px solid var(--c-border);';

      const summary = createEl('summary');
      summary.style.cssText = 'display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3) var(--s-2);border-radius:var(--radius);transition:background 0.15s ease;user-select:none;';

      summary.innerHTML = `
        <span class="news-topic__badge">${g.count}</span>
        <span style="flex:1;min-width:0;">
          <div class="news-topic__title">
            <a href="${master.url}" target="_blank" rel="noopener">${master.title}</a>
          </div>
          <div class="news-topic__meta">
            ${domains.map(d => `<span class="news-topic__avatar" data-domain="${d}">${d.substring(0, 1).toUpperCase()}</span>`).join('')}
            <span>${formatTimeAgo(master.pub_display)}</span>
            <span class="news-topic__lang">${master.language || 'en'}</span>
          </div>
        </span>
        <span class="news-topic__chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      `;

      const relatedBox = createEl('div');
      relatedBox.style.cssText = 'padding:0 0 var(--s-3) 44px;display:flex;flex-direction:column;';

      related.forEach(r => {
        const item = createEl('a');
        item.href = r.url;
        item.target = '_blank';
        item.rel = 'noopener';
        item.className = 'news-topic__related';
        item.innerHTML = `
          <span class="news-topic__dot"></span>
          <span class="news-topic__avatar news-topic__avatar--sm" data-domain="${r.domain}">${r.domain.substring(0, 1).toUpperCase()}</span>
          <span class="news-topic__related-title">${r.title}</span>
        `;
        relatedBox.appendChild(item);
      });

      row.appendChild(summary);
      row.appendChild(relatedBox);
      list.appendChild(row);
    });

    if (singles.length || state.singlesTotal) {
      const section = createEl('details');
      section.style.cssText = 'margin-top:var(--s-4);';

      const summary = createEl('summary');
      summary.style.cssText = 'display:flex;align-items:center;gap:var(--s-2);padding:var(--s-2);border-radius:var(--radius);cursor:pointer;user-select:none;font-size:var(--text-xs);color:var(--c-text-3);text-transform:uppercase;letter-spacing:0.05em;';
      summary.innerHTML = `
        <span>Berita unik lainnya · ${state.singlesTotal}</span>
        <span class="news-topic__chevron">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      `;
      section.appendChild(summary);

      const body = createEl('div');
      body.style.cssText = 'display:flex;flex-direction:column;';
      section.appendChild(body);

      renderSinglesPage(body);
      list.appendChild(section);
    }

    list.querySelectorAll('.news-topic__avatar').forEach(el => {
      el.style.background = avatarColor(el.dataset.domain);
    });

    listContainer.appendChild(list);
  }

  function renderSinglesPage(body) {
    const singles = state.singles || [];
    const perPage = state.singlesPerPage;
    const total = state.singlesTotal || singles.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const page = state.singlesPage;
    const start = (page - 1) * perPage;

    body.innerHTML = '';

    const rows = createEl('div', { style: { display: 'flex', flexDirection: 'column' } });
    singles.forEach(g => {
      const master = g.master;
      const row = createEl('div');
      row.className = 'news-topic__single';
      row.style.cssText = 'border-bottom:1px solid var(--c-border);padding:var(--s-3) var(--s-2);display:flex;align-items:center;gap:var(--s-3);border-radius:var(--radius);transition:background 0.15s ease;';
      row.innerHTML = `
        <span class="news-topic__dot--single"></span>
        <span style="flex:1;min-width:0;">
          <div class="news-topic__title">
            <a href="${master.url}" target="_blank" rel="noopener">${master.title}</a>
          </div>
          <div class="news-topic__meta">
            <span class="news-topic__avatar" data-domain="${master.domain}">${master.domain.substring(0, 1).toUpperCase()}</span>
            <span>${formatTimeAgo(master.pub_display)}</span>
            <span class="news-topic__lang">${master.language || 'en'}</span>
          </div>
        </span>
      `;
      rows.appendChild(row);
    });
    body.appendChild(rows);

    rows.querySelectorAll('.news-topic__avatar').forEach(el => {
      el.style.background = avatarColor(el.dataset.domain);
    });

    if (totalPages > 1) {
      const pager = createEl('div');
      pager.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:var(--s-2);padding:var(--s-3) var(--s-2);';
      pager.innerHTML = `
        <span style="font-size:var(--text-xs);color:var(--c-text-3);">${start + 1}-${Math.min(start + perPage, total)} dari ${total}</span>
        <div style="display:flex;gap:var(--s-2);">
          <button class="btn btn--ghost btn--sm" ${page <= 1 ? 'disabled' : ''}>Prev</button>
          <button class="btn btn--primary btn--sm">${page}</button>
          <button class="btn btn--ghost btn--sm" ${page >= totalPages ? 'disabled' : ''}>Next</button>
        </div>
      `;
      const prevBtn = pager.querySelector('button:first-of-type');
      const nextBtn = pager.querySelector('button:last-of-type');
      prevBtn.addEventListener('click', () => {
        if (state.singlesPage > 1) loadSinglesPage(body, state.singlesPage - 1);
      });
      nextBtn.addEventListener('click', () => {
        if (state.singlesPage < totalPages) loadSinglesPage(body, state.singlesPage + 1);
      });
      body.appendChild(pager);
    }
  }

  async function loadSinglesPage(body, page) {
    state.singlesPage = page;
    body.innerHTML = '<div style="padding:var(--s-4);text-align:center;color:var(--c-text-3);font-size:var(--text-xs);">Memuat...</div>';
    try {
      const data = await Api.get('/news/articles/grouped', {
        since_hours: state.sinceHours,
        singles_page: page,
        singles_per_page: state.singlesPerPage,
      });
      state.singles = data.singles || [];
      state.singlesTotal = data.singles_total || 0;
      state.singlesPerPage = data.singles_per_page || state.singlesPerPage;
      renderSinglesPage(body);
    } catch (e) {
      body.innerHTML = `<div style="padding:var(--s-4);text-align:center;color:var(--c-danger);font-size:var(--text-xs);">Gagal memuat: ${e.message || e}</div>`;
    }
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
