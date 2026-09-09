/* pages/admin/stock-status.js — Stock Status (Blacklist/Whitelist) — Flutter parity */
import { createEl } from '../../../utils/dom.js';
import { icons } from '../../../ui/icons.js';
import Api from '../../../core/api.js';
import { toast } from '../../../ui/toast.js';
import { createModal } from '../../../ui/modal.js';
import { StockSectorBadge, DelistedBadge } from '../../../ui/stock-widgets.js';

const FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'unset', label: 'Belum di-set' },
  { value: 'whitelist', label: 'Whitelist' },
  { value: 'blacklist', label: 'Blacklist' },
];

export function render() {
  const state = {
    stocks: [],
    loading: true,
    searchTerm: '',
    statusFilter: '',
    searchDebounce: null,
    page: 1,
    perPage: 20,
    total: 0,
  };

  const container = createEl('div', { class: 'admin-stock-status' }, []);

  container.appendChild(createEl('h1', {}, ['Stock Status']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Manage stock blacklist/whitelist status.']));

  // Toolbar
  const toolbar = createEl('div', {
    style: { display: 'flex', gap: 'var(--s-3)', marginBottom: 'var(--s-4)', flexWrap: 'wrap', alignItems: 'center' }
  });
  toolbar.innerHTML = `
    <div class="search" style="flex:1;min-width:220px;">
      <span class="search__icon">${icons['search']}</span>
      <input type="text" class="search__input" placeholder="Cari ticker / nama...">
      <button type="button" class="search__clear" aria-label="Bersihkan pencarian">${icons['x']}</button>
    </div>
    <button class="btn btn--secondary" id="refresh-btn">${icons['refresh']} Refresh</button>
  `;
  container.appendChild(toolbar);

  // Filter chips
  const chips = createEl('div', { class: 'admin-stock-status__chips', style: { marginBottom: 'var(--s-3)' } });
  container.appendChild(chips);

  // Table
  const tableWrap = createEl('div', { class: 'table-wrap' });
  container.appendChild(tableWrap);

  // Pagination
  const pagination = createEl('div', { class: 'admin-stock-status__pagination' });
  container.appendChild(pagination);

  // ---- Toolbar wiring ----
  const searchWrap = toolbar.querySelector('.search');
  const searchInput = searchWrap.querySelector('.search__input');
  const clearBtn = searchWrap.querySelector('.search__clear');

  searchInput.addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    state.page = 1;
    searchWrap.classList.toggle('has-clear', state.searchTerm !== '');
    clearTimeout(state.searchDebounce);
    state.searchDebounce = setTimeout(loadStocks, 400);
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchTerm = '';
    state.page = 1;
    searchWrap.classList.remove('has-clear');
    loadStocks();
    searchInput.focus();
  });

  toolbar.querySelector('#refresh-btn').addEventListener('click', loadStocks);

  function renderChips() {
    chips.innerHTML = '';
    FILTERS.forEach(f => {
      const btn = createEl('button', {
        class: 'admin-stock-status__chip' + (state.statusFilter === f.value ? ' admin-stock-status__chip--active' : ''),
      }, [f.label]);
      btn.addEventListener('click', () => {
        state.statusFilter = f.value;
        state.page = 1;
        renderChips();
        loadStocks();
      });
      chips.appendChild(btn);
    });
  }

  // ---- Data ----
  async function loadStocks() {
    state.loading = true;
    renderLoading();
    pagination.innerHTML = '';

    try {
      const params = {};
      if (state.searchTerm) params.q = state.searchTerm;
      if (state.statusFilter) params.status = state.statusFilter;

      const data = await Api.get('/admin/stocks/status', params);
      const all = Array.isArray(data) ? data : [];
      state.total = all.length;
      const start = (state.page - 1) * state.perPage;
      state.stocks = all.slice(start, start + state.perPage);

      // Kalau halaman aktif melebihi total (mis. hasil filter berubah),
      // lompat balik ke halaman terakhir yang valid.
      if (state.stocks.length === 0 && state.page > 1 && state.total > 0) {
        state.page = Math.ceil(state.total / state.perPage);
        const s = (state.page - 1) * state.perPage;
        state.stocks = all.slice(s, s + state.perPage);
      }
    } catch (e) {
      state.stocks = [];
      state.total = 0;
      toast('Gagal memuat: ' + (e.message || e), { type: 'error' });
    }

    state.loading = false;
    renderTable();
    renderPagination();
  }

  function renderLoading() {
    tableWrap.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const row = createEl('div', { class: 'skeleton', style: { height: '48px', borderRadius: '6px', marginBottom: '8px' } });
      tableWrap.appendChild(row);
    }
  }

  // ---- Table ----
  function renderTable() {
    tableWrap.innerHTML = '';

    if (state.stocks.length === 0) {
      const empty = createEl('div', { class: 'admin-stock-status__empty' }, []);
      empty.innerHTML = `
        <div class="admin-stock-status__empty-icon">${icons['shield']}</div>
        <p style="color:var(--c-text-2);font-size:var(--text-sm);">Tidak ada saham ditemukan.</p>
      `;
      tableWrap.appendChild(empty);
      return;
    }

    const table = createEl('table', { class: 'table' });
    table.innerHTML = `
      <thead><tr>
        <th>Ticker</th><th>Company</th><th>Sektor</th><th>Status</th><th>Alasan</th><th>Set By</th><th>Set At</th><th></th>
      </tr></thead>
    `;
    const tbody = createEl('tbody');
    state.stocks.forEach(s => tbody.appendChild(buildRow(s)));
    table.appendChild(tbody);
    tableWrap.appendChild(table);
  }

  function buildRow(s) {
    const delisted = s.label_delisted === 1;
    const tr = createEl('tr', {});

    const goAnalysis = () => {
      localStorage.setItem('stocks_initial_ticker', s.ticker);
      location.hash = '#/saham/stocks';
    };

    // Ticker — link ke analisis (kecuali delisted, pola stock-list)
    const tdTicker = createEl('td');
    if (delisted) {
      const tickerEl = createEl('span', { class: 'badge badge--primary' }, [s.ticker]);
      tickerEl.style.opacity = 0.5;
      tdTicker.appendChild(tickerEl);
    } else {
      const tickerLink = createEl('a', { class: 'badge badge--primary admin-stock-status__ticker' }, [s.ticker]);
      tickerLink.href = '#/saham/stocks';
      tickerLink.addEventListener('click', (e) => {
        e.preventDefault();
        goAnalysis();
      });
      tdTicker.appendChild(tickerLink);
    }
    tr.appendChild(tdTicker);

    // Company — link ke analisis (kecuali delisted)
    const tdCompany = createEl('td');
    if (delisted) {
      const companyEl = createEl('div', {
        class: 'admin-stock-status__company admin-stock-status__company--muted',
      }, [s.company_name || '-']);
      tdCompany.appendChild(companyEl);
    } else {
      const companyLink = createEl('a', { class: 'admin-stock-status__company admin-stock-status__company-link' }, [s.company_name || '-']);
      companyLink.href = '#/saham/stocks';
      companyLink.addEventListener('click', (e) => {
        e.preventDefault();
        goAnalysis();
      });
      tdCompany.appendChild(companyLink);
    }
    tr.appendChild(tdCompany);

    // Sector badges
    const tdSector = createEl('td');
    const sectorsWrap = createEl('div', { class: 'admin-stock-status__sectors' });
    const sb1 = StockSectorBadge(s.sector, true);
    const sb2 = StockSectorBadge(s.primary_sector, true);
    if (sb1) sectorsWrap.appendChild(sb1);
    if (sb2) sectorsWrap.appendChild(sb2);
    if (!sb1 && !sb2) sectorsWrap.appendChild(createEl('span', { style: { color: 'var(--c-text-3)' } }, ['-']));
    tdSector.appendChild(sectorsWrap);
    tr.appendChild(tdSector);

    // Status badge
    const tdStatus = createEl('td');
    const db = DelistedBadge({
      labelDelisted: s.label_delisted,
      stockStatus: s.stock_status,
      statusReason: s.status_reason,
      small: true,
      nowrap: true,
    });
    if (db) tdStatus.appendChild(db);
    else tdStatus.appendChild(createEl('span', {}, ['-']));
    tr.appendChild(tdStatus);

    // Reason
    const tdReason = createEl('td');
    if (s.status_reason) {
      tdReason.appendChild(createEl('div', { class: 'admin-stock-status__reason', title: s.status_reason }, [s.status_reason]));
    } else {
      tdReason.appendChild(createEl('span', { class: 'admin-stock-status__meta' }, ['-']));
    }
    tr.appendChild(tdReason);

    // Set By / Set At
    const tdBy = createEl('td');
    tdBy.appendChild(createEl('span', { class: 'admin-stock-status__meta' }, [s.status_set_by || '-']));
    tr.appendChild(tdBy);

    const tdAt = createEl('td');
    tdAt.appendChild(createEl('span', { class: 'admin-stock-status__meta' }, [s.status_set_at || '-']));
    tr.appendChild(tdAt);

    // Action — bungkus div agar td tetap table-cell (garis tabel tidak patah)
    const tdAction = createEl('td');
    const actionsWrap = createEl('div', { class: 'table__actions' });
    if (delisted) {
      const lock = createEl('span', {
        class: 'btn btn--ghost btn--sm',
        title: 'Saham delisted',
        style: { color: 'var(--c-text-3)', opacity: 0.45, pointerEvents: 'none' },
      }, []);
      lock.innerHTML = icons['lock'];
      actionsWrap.appendChild(lock);
    } else {
      const editBtn = createEl('button', { class: 'btn btn--ghost btn--sm', title: 'Set Status' }, []);
      editBtn.innerHTML = icons['edit'];
      editBtn.addEventListener('click', () => openStatusModal(s));
      actionsWrap.appendChild(editBtn);
    }
    tdAction.appendChild(actionsWrap);
    tr.appendChild(tdAction);

    return tr;
  }

  // ---- Status editor modal (parity Flutter bottom sheet) ----
  function openStatusModal(stock) {
    if (stock.label_delisted === 1) {
      toast('Saham delisted tidak bisa di-set status', { type: 'error' });
      return;
    }

    const select = createEl('select', { class: 'field__select' });
    [['whitelist', 'Whitelist'], ['blacklist', 'Blacklist']].forEach(([v, l]) => {
      select.appendChild(createEl('option', { value: v }, [l]));
    });
    select.value = stock.stock_status || 'whitelist';

    const reasonInput = createEl('textarea', {
      class: 'field__textarea',
      rows: 4,
      placeholder: 'Masukkan alasan perubahan status...',
    }, []);
    reasonInput.value = stock.status_reason || '';
    reasonInput.style.resize = 'vertical';

    const content = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });

    content.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', fontSize: 'var(--text-sm)' } }, [stock.company_name]));

    const statusWrap = createEl('div');
    statusWrap.innerHTML = '<label class="field__label">Status</label>';
    statusWrap.appendChild(select);

    const reasonWrap = createEl('div');
    reasonWrap.innerHTML = '<label class="field__label">Alasan *</label>';
    reasonWrap.appendChild(reasonInput);

    content.append(statusWrap, reasonWrap);

    const modal = createModal({ title: `Set Status: ${stock.ticker}`, content, width: '420px' });

    // Footer: [Reset (jika ada status)] [spacer] [Batal] [Simpan]
    const footer = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', marginTop: 'var(--s-2)', alignItems: 'center' } });

    if (stock.stock_status) {
      const resetBtn = createEl('button', { class: 'btn btn--danger btn--sm' }, ['Reset']);
      resetBtn.addEventListener('click', () => handleReset(stock, modal));
      footer.appendChild(resetBtn);
    }
    footer.appendChild(createEl('span', { style: { flex: '1' } }, []));

    const cancelBtn = createEl('button', { class: 'btn btn--secondary' }, ['Batal']);
    cancelBtn.addEventListener('click', () => modal.close());

    const saveBtn = createEl('button', { class: 'btn btn--primary' }, ['Simpan']);
    saveBtn.addEventListener('click', () => handleSave(stock, modal, select, reasonInput));

    footer.append(cancelBtn, saveBtn);
    content.appendChild(footer);
  }

  async function handleSave(stock, modal, select, reasonInput) {
    const reason = reasonInput.value.trim();
    if (!reason) {
      toast('Alasan harus diisi', { type: 'error' });
      return;
    }
    try {
      await Api.post('/admin/stocks/status', {
        ticker: stock.ticker,
        status: select.value,
        reason,
      });
      toast(`Status ${stock.ticker} berhasil di-set`, { type: 'success' });
      modal.close();
      loadStocks();
    } catch (e) {
      toast('Error: ' + (e.message || e), { type: 'error' });
    }
  }

  async function handleReset(stock, modal) {
    try {
      await Api.delete(`/admin/stocks/status/${stock.ticker}`);
      toast(`Status ${stock.ticker} berhasil di-reset`, { type: 'success' });
      modal.close();
      loadStocks();
    } catch (e) {
      toast('Error: ' + (e.message || e), { type: 'error' });
    }
  }

  function renderPagination() {
    pagination.innerHTML = '';
    const totalPages = Math.ceil(state.total / state.perPage);
    if (state.total === 0 || totalPages <= 1) return;

    const first = (state.page - 1) * state.perPage + 1;
    const last = Math.min(state.page * state.perPage, state.total);
    const filterActive = state.searchTerm || state.statusFilter;

    const info = createEl('span', { class: 'admin-stock-status__page-info' }, []);
    info.textContent = `Menampilkan ${first}–${last} dari ${state.total} saham${filterActive ? ' (filter aktif)' : ''}`;

    const controls = createEl('div', { class: 'admin-stock-status__page-controls' }, []);

    const prevBtn = createEl('button', {
      class: 'btn btn--ghost btn--sm',
      ...(state.page <= 1 ? { disabled: true } : {}),
    }, ['Prev']);
    prevBtn.addEventListener('click', () => {
      if (state.page > 1) { state.page--; loadStocks(); }
    });

    const indicator = createEl('span', { class: 'admin-stock-status__page-indicator' }, [`${state.page} / ${totalPages}`]);

    const nextBtn = createEl('button', {
      class: 'btn btn--ghost btn--sm',
      ...(state.page >= totalPages ? { disabled: true } : {}),
    }, ['Next']);
    nextBtn.addEventListener('click', () => {
      if (state.page < totalPages) { state.page++; loadStocks(); }
    });

    controls.append(prevBtn, indicator, nextBtn);
    pagination.append(info, controls);
  }

  container._cleanup = () => {
    clearTimeout(state.searchDebounce);
  };

  // Init
  renderChips();
  loadStocks();

  return container;
}