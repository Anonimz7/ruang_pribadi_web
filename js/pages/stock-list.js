/* pages/stock-list.js — Stock List with API integration */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';
import Api, { ApiError } from '../core/api.js';
import { toast } from '../ui/toast.js';

function formatPrice(v) {
  if (v == null) return '-';
  return new Intl.NumberFormat('id-ID').format(v);
}

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

  const container = createEl('div', {}, []);

  container.appendChild(createEl('h1', {}, ['Stock List']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Browse all IDX stocks with advanced filters.']));

  // Filters
  const filters = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-5)' } });
  container.appendChild(filters);

  // Table
  const tableWrap = createEl('div', { class: 'table-wrap' });
  container.appendChild(tableWrap);

  // Pagination
  const pagination = createEl('div', {
    style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--s-4)', flexWrap: 'wrap', gap: 'var(--s-3)' }
  });
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
    filters.innerHTML = '';
    filters.innerHTML = `
      <div style="display:flex;gap:var(--s-3);flex-wrap:wrap;align-items:flex-end;">
        <div class="search" style="flex:1;min-width:200px;">
          <span class="search__icon">${icons['search']}</span>
          <input type="text" class="search__input" placeholder="Search ticker or name..." value="${state.searchTerm}">
        </div>
        <div class="field" style="width:140px;min-width:140px;">
          <label class="field__label">Sector</label>
          <select class="field__select" id="filter-sector">
            <option value="">All</option>
            ${state.sectors.map(s => `<option value="${s}" ${s === state.sector ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="width:140px;min-width:140px;">
          <label class="field__label">Primary</label>
          <select class="field__select" id="filter-primary">
            <option value="">All</option>
            ${state.primaryOptions.map(s => `<option value="${s}" ${s === state.primary ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="width:140px;min-width:140px;">
          <label class="field__label">Sub Sector</label>
          <select class="field__select" id="filter-sub">
            <option value="">All</option>
            ${state.subOptions.map(s => `<option value="${s}" ${s === state.subSector ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn--primary" id="apply-filters">${icons['search']} Filter</button>
      </div>
    `;

    const searchInput = filters.querySelector('.search__input');
    let debounce;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        state.searchTerm = e.target.value;
        state.page = 1;
        loadStocks();
      }, 400);
    });

    const sectorSel = filters.querySelector('#filter-sector');
    sectorSel.addEventListener('change', (e) => {
      state.sector = e.target.value;
      state.primary = '';
      state.subSector = '';
      loadSubOptions();
    });

    const primarySel = filters.querySelector('#filter-primary');
    primarySel.addEventListener('change', (e) => {
      state.primary = e.target.value;
      state.subSector = '';
      loadSubOptions();
    });

    const subSel = filters.querySelector('#filter-sub');
    subSel.addEventListener('change', (e) => {
      state.subSector = e.target.value;
    });

    filters.querySelector('#apply-filters').addEventListener('click', () => {
      state.page = 1;
      loadStocks();
    });
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
        ${state.stocks.map(s => `
          <tr>
            <td><span class="badge badge--primary">${s.ticker}</span></td>
            <td style="font-weight:500;">${s.company_name}</td>
            <td><span class="badge badge--neutral">${s.sector || '-'}</span></td>
            <td style="font-size:var(--text-sm);color:var(--c-text-3);">${s.sub_sector || '-'}</td>
            <td>
              ${s.stock_status ? `<span class="badge badge--${s.stock_status === 'blacklist' ? 'danger' : 'success'}">${s.stock_status}</span>` : '<span class="badge badge--neutral">default</span>'}
            </td>
            <td class="table__actions">
              <button class="btn btn--ghost btn--sm" onclick="window.viewStockDetail('${s.ticker}')">${icons['eye']}</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    tableWrap.appendChild(table);
  }

  function renderPagination() {
    const totalPages = Math.ceil(state.total / state.perPage);
    if (state.total === 0) return;

    pagination.innerHTML = `
      <span style="font-size:var(--text-sm);color:var(--c-text-3);">
        Showing ${(state.page - 1) * state.perPage + 1}-${Math.min(state.page * state.perPage, state.total)} of ${state.total} stocks
      </span>
      <div style="display:flex;gap:var(--s-2);">
        <button class="btn btn--ghost btn--sm" ${state.page <= 1 ? 'disabled' : ''} onclick="window.stockListPrev()">Prev</button>
        <button class="btn btn--primary btn--sm">${state.page}</button>
        <button class="btn btn--ghost btn--sm" ${state.page >= totalPages ? 'disabled' : ''} onclick="window.stockListNext()">Next</button>
      </div>
    `;
  }

  window.viewStockDetail = (ticker) => {
    // Open stock analysis in a simple modal or navigate
    toast(`Menampilkan detail ${ticker}`, { type: 'info' });
  };

  window.stockListPrev = () => {
    if (state.page > 1) { state.page--; loadStocks(); }
  };
  window.stockListNext = () => {
    const totalPages = Math.ceil(state.total / state.perPage);
    if (state.page < totalPages) { state.page++; loadStocks(); }
  };

  container._cleanup = () => {
    delete window.viewStockDetail;
    delete window.stockListPrev;
    delete window.stockListNext;
  };

  // Init
  loadSectors();
  loadStocks();

  return container;
}
