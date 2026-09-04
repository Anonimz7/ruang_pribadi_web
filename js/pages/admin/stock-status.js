/* pages/admin/stock-status.js — Stock Status Management (Blacklist/Whitelist) */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api, { ApiError } from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { createModal } from '../../ui/modal.js';

export function render() {
  const state = {
    stocks: [],
    loading: true,
    searchTerm: '',
    statusFilter: '',
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
    <div class="search" style="flex:1;min-width:240px;">
      <span class="search__icon">${icons['search']}</span>
      <input type="text" class="search__input" placeholder="Search ticker or name...">
    </div>
    <select class="field__select" id="status-filter" style="width:140px;">
      <option value="">All Status</option>
      <option value="blacklist">Blacklisted</option>
      <option value="whitelist">Whitelisted</option>
    </select>
    <button class="btn btn--secondary" id="refresh-btn">${icons['refresh']} Refresh</button>
  `;
  container.appendChild(toolbar);

  // Table
  const tableWrap = createEl('div', { class: 'table-wrap' });
  container.appendChild(tableWrap);

  // Wire up toolbar
  const searchInput = toolbar.querySelector('.search__input');
  let searchDebounce;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.searchTerm = e.target.value;
      loadStocks();
    }, 400);
  });

  toolbar.querySelector('#status-filter').addEventListener('change', (e) => {
    state.statusFilter = e.target.value;
    loadStocks();
  });

  toolbar.querySelector('#refresh-btn').addEventListener('click', () => loadStocks());

  async function loadStocks() {
    state.loading = true;
    renderLoading();

    try {
      const params = {};
      if (state.searchTerm) params.q = state.searchTerm;
      if (state.statusFilter) params.status = state.statusFilter;

      const data = await Api.get('/admin/stocks/status', params);
      state.stocks = Array.isArray(data) ? data : [];
    } catch (e) {
      state.stocks = [];
      toast('Gagal memuat: ' + (e.message || e), { type: 'error' });
    }

    state.loading = false;
    renderTable();
  }

  function renderLoading() {
    tableWrap.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const row = createEl('div', { class: 'skeleton', style: { height: '48px', borderRadius: '6px', marginBottom: '8px' } });
      tableWrap.appendChild(row);
    }
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
        <th>Ticker</th><th>Company Name</th><th>Status</th><th>Reason</th><th>Set By</th><th>Set At</th><th></th>
      </tr></thead>
      <tbody>
        ${state.stocks.map(s => `
          <tr>
            <td><span class="badge badge--primary">${s.ticker}</span></td>
            <td style="font-weight:500;">${s.company_name || '-'}</td>
            <td>
              ${s.stock_status ? `<span class="badge badge--${s.stock_status === 'blacklist' ? 'danger' : 'success'}">${s.stock_status}</span>` : '<span class="badge badge--neutral">default</span>'}
            </td>
            <td style="font-size:var(--text-sm);color:var(--c-text-3);max-width:200px;">${s.status_reason || '-'}</td>
            <td style="font-size:var(--text-sm);color:var(--c-text-3);">${s.status_set_by || '-'}</td>
            <td style="font-size:var(--text-sm);color:var(--c-text-3);">${s.status_set_at || '-'}</td>
            <td class="table__actions">
              <button class="btn btn--ghost btn--sm" onclick="window.setStatus('${s.ticker}', 'blacklist')">Blacklist</button>
              <button class="btn btn--ghost btn--sm" onclick="window.setStatus('${s.ticker}', 'whitelist')">Whitelist</button>
              <button class="btn btn--ghost btn--sm" onclick="window.resetStatus('${s.ticker}')">Reset</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    tableWrap.appendChild(table);
  }

  window.setStatus = (ticker, status) => {
    const reason = prompt(`Reason for ${status} ${ticker}:`);
    if (!reason || !reason.trim()) return;
    setStockStatus(ticker, status, reason);
  };

  window.resetStatus = (ticker) => {
    if (!confirm(`Reset status for ${ticker}?`)) return;
    resetStockStatus(ticker);
  };

  async function setStockStatus(ticker, status, reason) {
    try {
      const res = await Api.post('/admin/stocks/status', {
        ticker,
        status,
        reason,
      });
      toast(`${ticker} status: ${res?.status || status}`, { type: 'success' });
      loadStocks();
    } catch (e) {
      toast('Error: ' + (e.message || e), { type: 'error' });
    }
  }

  async function resetStockStatus(ticker) {
    try {
      await Api.delete(`/admin/stocks/status/${ticker}`);
      toast(`${ticker} status reset`, { type: 'success' });
      loadStocks();
    } catch (e) {
      toast('Error: ' + (e.message || e), { type: 'error' });
    }
  }

  container._cleanup = () => {
    delete window.setStatus;
    delete window.resetStatus;
    if (state._searchDebounce) clearTimeout(state._searchDebounce);
  };

  // Init
  loadStocks();

  return container;
}
