/* pages/stock-list.js — Stock List with API integration */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';
import Api from '../core/api.js';
import { DelistedBadge, StockSectorBadge } from '../ui/stock-widgets.js';

export function render() {
  const state = {
    searchTerm: '',
    sector: '',
    primary: '',
    subSector: '',
    page: 1,
    perPage: 20,
    total: 0,
    stocks: [],
    sectors: [],
    primaryOptions: [],
    subOptions: [],
  };

  const container = createEl('div', {
    class: 'stock-list-page',
    style: { maxWidth: '900px', margin: '0 auto', padding: 'var(--s-4)' },
  });

  container.appendChild(createEl('h1', {}, ['Stock List']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Browse all IDX stocks with advanced filters.']));

  // Filters
  const filters = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-4)' } });
  container.appendChild(filters);

  // Table
  const tableWrap = createEl('div', { class: 'table-wrap' });
  container.appendChild(tableWrap);

  // Pagination
  const pagination = createEl('div', { class: 'stock-list-page__pagination' });
  container.appendChild(pagination);

  // ---- Functions ----

  async function loadSectors() {
    try {
      const sectors = await Api.get('/idx/sectors');
      state.sectors = sectors || [];
      renderFilters();
    } catch (e) {
      console.error('[StockList] Failed to load sectors:', e);
      state.sectors = [];
      renderFilters();
    }
  }

  function renderFilters() {
    filters.innerHTML = `
      <div style="display:flex;gap:var(--s-3);flex-wrap:wrap;align-items:flex-end;">
        <div class="search${state.searchTerm ? ' has-clear' : ''}" style="flex:1;min-width:200px;">
          <span class="search__icon">${icons['search']}</span>
          <input type="text" class="search__input" placeholder="Search ticker or name..." value="${state.searchTerm}">
          <button type="button" class="search__clear" aria-label="Bersihkan pencarian">${icons['x']}</button>
        </div>
        <div class="field" style="width:140px;min-width:140px;">
          <label class="field__label">Sector</label>
          <select class="field__select" id="filter-sector">
            <option value="">All</option>
            ${state.sectors.map(s => `<option value="${s}" ${s === state.sector ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="width:150px;min-width:150px;">
          <label class="field__label">Primary</label>
          <select class="field__select" id="filter-primary" ${state.sector ? '' : 'disabled'}>
            <option value="">All</option>
            ${state.primaryOptions.map(s => `<option value="${s}" ${s === state.primary ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="width:150px;min-width:150px;">
          <label class="field__label">Sub Sector</label>
          <select class="field__select" id="filter-sub" ${(state.sector && state.primary) ? '' : 'disabled'}>
            <option value="">All</option>
            ${state.subOptions.map(s => `<option value="${s}" ${s === state.subSector ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        ${(state.sector || state.primary || state.subSector)
          ? `<button class="btn btn--ghost btn--sm" id="reset-filters" aria-label="Reset filter sektor">${icons['x']} Reset</button>`
          : ''}
      </div>
    `;

    const searchWrap = filters.querySelector('.search');
    const searchInput = searchWrap.querySelector('.search__input');
    const clearBtn = searchWrap.querySelector('.search__clear');
    let debounce;

    // Sync state langsung per ketikan (selamat dari re-render filter),
    // reload jaringan di-debounce.
    searchInput.addEventListener('input', (e) => {
      state.searchTerm = e.target.value;
      searchWrap.classList.toggle('has-clear', state.searchTerm !== '');
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        state.page = 1;
        loadStocks();
      }, 400);
    });

    clearBtn.addEventListener('click', () => {
      state.searchTerm = '';
      searchInput.value = '';
      searchWrap.classList.remove('has-clear');
      state.page = 1;
      loadStocks();
      searchInput.focus();
    });

    const sectorSel = filters.querySelector('#filter-sector');
    sectorSel.addEventListener('change', (e) => {
      state.sector = e.target.value;
      state.primary = '';
      state.subSector = '';
      state.page = 1;
      loadSubOptions().then(loadStocks);
    });

    const primarySel = filters.querySelector('#filter-primary');
    primarySel.addEventListener('change', (e) => {
      state.primary = e.target.value;
      state.subSector = '';
      state.page = 1;
      loadSubOptions().then(loadStocks);
    });

    const subSel = filters.querySelector('#filter-sub');
    subSel.addEventListener('change', (e) => {
      state.subSector = e.target.value;
      state.page = 1;
      loadStocks();
    });

    const resetBtn = filters.querySelector('#reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.sector = '';
        state.primary = '';
        state.subSector = '';
        state.page = 1;
        loadSubOptions().then(loadStocks);
      });
    }
  }

  async function loadSubOptions() {
    if (state.sector) {
      try {
        const options = await Api.get('/idx/sectors', { sector: state.sector });
        state.primaryOptions = options || [];
      } catch (e) {
        state.primaryOptions = [];
      }
    } else {
      state.primaryOptions = [];
    }

    if (state.sector && state.primary) {
      try {
        const options = await Api.get('/idx/sectors', { sector: state.sector, primary_sector: state.primary });
        state.subOptions = options || [];
      } catch (e) {
        state.subOptions = [];
      }
    } else {
      state.subOptions = [];
    }

    renderFilters();
  }

  async function loadStocks() {
    tableWrap.innerHTML = '<div class="skeleton" style="height:200px;width:100%;border-radius:6px;"></div>';
    pagination.innerHTML = '';

    try {
      const params = {
        limit: state.perPage,
        offset: (state.page - 1) * state.perPage,
        q: state.searchTerm,
        sector: state.sector,
        primary_sector: state.primary,
        sub_sector: state.subSector,
      };
      const data = await Api.get('/idx/stocks', params);
      state.stocks = data.stocks || [];
      state.total = data.total || 0;
    } catch (e) {
      state.stocks = [];
      state.total = 0;
      tableWrap.innerHTML = `<div class="empty" style="padding:var(--s-4);color:var(--c-danger);"><p>Gagal memuat: ${e.message || e}</p></div>`;
    }

    renderTable();
    renderPagination();
  }

  function renderTable() {
    tableWrap.innerHTML = '';

    if (state.stocks.length === 0) {
      tableWrap.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--s-6);">
          <div style="font-size:48px;margin-bottom:var(--s-4);opacity:0.3;">${icons['trending-up']}</div>
          <p style="color:var(--c-text-2);">Tidak ada saham ditemukan.</p>
        </div>
      `;
      return;
    }

    const table = createEl('table', { class: 'table' });
    table.innerHTML = `
      <thead><tr>
        <th>Ticker</th><th>Name</th><th>Sector</th><th>Sub Sector</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>
        ${state.stocks.map(s => {
          const delisted = s.label_delisted === 1;
          const statusBadge = DelistedBadge({
            labelDelisted: s.label_delisted,
            stockStatus: s.stock_status,
            statusReason: s.status_reason,
            small: true,
            nowrap: true
          });
          const sectorBadge = StockSectorBadge(s.sector, true);
          const eyeTitle = delisted ? 'Saham telah delisted' : `Analisis ${s.ticker}`;
          return `
            <tr class="stock-list-page__row${delisted ? ' stock-list-page__row--delisted' : ''}" data-ticker="${s.ticker}"${delisted ? '' : ' data-open="1"'}>
              <td>${delisted
                ? `<span class="stock-list-page__ticker stock-list-page__ticker--delisted">${s.ticker}</span>`
                : `<a href="#/stocks" class="stock-list-page__ticker" onclick="localStorage.setItem('stocks_initial_ticker','${s.ticker}')">${s.ticker}</a>`}
              </td>
              <td style="font-weight:500;">${s.company_name}</td>
              <td>${sectorBadge ? sectorBadge.outerHTML : '<span class="badge badge--neutral">-</span>'}</td>
              <td style="font-size:var(--text-sm);color:var(--c-text-3);">${s.sub_sector || '-'}</td>
              <td style="white-space:nowrap;">${statusBadge.outerHTML}</td>
              <td class="table__actions">
                <button class="btn btn--ghost btn--sm" ${delisted ? 'disabled' : ''} title="${eyeTitle}" aria-label="${eyeTitle}">${icons['eye']}</button>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    `;
    tableWrap.appendChild(table);

    // Klik baris → buka analisis saham (kecuali sudah delisted).
    // Ticker juga link langsung (pola sama dengan halaman Market).
    table.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-open]');
      if (!tr) return;
      localStorage.setItem('stocks_initial_ticker', tr.dataset.ticker);
      location.hash = '#/stocks';
    });
  }

  function renderPagination() {
    const totalPages = Math.ceil(state.total / state.perPage);
    if (state.total === 0) return;

    const first = (state.page - 1) * state.perPage + 1;
    const last = Math.min(state.page * state.perPage, state.total);
    const filterActive = state.searchTerm || state.sector || state.primary || state.subSector;
    const badges = [state.sector, state.primary, state.subSector]
      .filter(Boolean)
      .map(l => { const b = StockSectorBadge(l, true); return b ? b.outerHTML : ''; })
      .join('');

    pagination.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:var(--s-2);flex-wrap:wrap;font-size:var(--text-sm);color:var(--c-text-3);">
        Menampilkan ${first}–${last} dari ${state.total} saham${filterActive ? ' (filter aktif)' : ''}${badges ? ' ' + badges : ''}
      </span>
      <div style="display:flex;gap:var(--s-2);align-items:center;">
        <button class="btn btn--ghost btn--sm" ${state.page <= 1 ? 'disabled' : ''} onclick="window.stockListPrev()">Prev</button>
        <span class="stock-list-page__page-indicator" aria-label="Halaman ${state.page} dari ${totalPages}">${state.page} / ${totalPages}</span>
        <button class="btn btn--ghost btn--sm" ${state.page >= totalPages ? 'disabled' : ''} onclick="window.stockListNext()">Next</button>
      </div>
    `;
  }

  window.stockListPrev = () => {
    if (state.page > 1) { state.page--; loadStocks(); }
  };
  window.stockListNext = () => {
    const totalPages = Math.ceil(state.total / state.perPage);
    if (state.page < totalPages) { state.page++; loadStocks(); }
  };

  container._cleanup = () => {
    delete window.stockListPrev;
    delete window.stockListNext;
  };

  // Init
  loadSectors();
  loadStocks();

  return container;
}