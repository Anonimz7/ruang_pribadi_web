/* pages/stocks.js — IDX Stocks Analysis with API integration */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';
import Api, { ApiError } from '../core/api.js';
import { toast } from '../ui/toast.js';

function formatPrice(v) {
  if (v == null) return '-';
  return new Intl.NumberFormat('id-ID').format(v);
}

function fmtChange(c) {
  if (c == null) return '-';
  const cls = c >= 0 ? 'var(--c-accent)' : 'var(--c-danger)';
  return `<span style="color:${cls};font-weight:500;">${c >= 0 ? '+' : ''}${c}%</span>`;
}

export function render() {
  const state = {
    searchTerm: '',
    selectedTicker: '',
    chartDays: 90,
    searchResult: null,
    stockData: null,
    marketSummary: null,
  };

  const container = createEl('div', {}, []);

  // Header
  container.appendChild(createEl('h1', {}, ['IDX Stocks']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Real-time stock analysis and market overview.']));

  // Market summary cards (dynamic)
  const summary = createEl('div', { class: 'grid grid--4', style: { marginBottom: 'var(--s-5)' } });
  container.appendChild(summary);

  // Stock detail card
  const detailCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-5)' } });
  container.appendChild(detailCard);

  // Top movers table
  const tableCard = createEl('div', { class: 'card' });
  container.appendChild(tableCard);

  // ---- Functions ----

  async function loadMarketSummary() {
    try {
      const data = await Api.get('/idx/market/summary', { days: state.chartDays });
      state.marketSummary = data;

      summary.innerHTML = '';
      const radar = data.radar || {};
      const summaryData = [
        { label: 'IHSG', value: radar.avg_price ? `${Number(radar.avg_price).toLocaleString('id-ID')}` : '-', change: '+' + (data.radar?.pct_change !== undefined ? data.radar.pct_change.toFixed(2) + '%' : '-') },
        { label: 'LQ45', value: '-', change: '-' },
        { label: 'Foreign Flow', value: data.top_accumulation?.length ? data.top_accumulation[0].ticker : '-', change: '-' },
        { label: 'Total Records', value: data.total || 0, change: '-' },
      ];

      summaryData.forEach(s => {
        const card = createEl('div', { class: 'stat-card' });
        const isUp = typeof s.change === 'string' && s.change.startsWith('+');
        card.innerHTML = `
          <div class="stat-card__label">${s.label}</div>
          <div class="stat-card__value">${s.value}</div>
          <div class="stat-card__change stat-card__change--${isUp ? 'up' : 'down'}">
            ${s.change}
          </div>
        `;
        summary.appendChild(card);
      });
    } catch (e) {
      console.error('[Stocks] Failed to load market summary:', e);
      summary.innerHTML = '<div class="empty" style="padding:var(--s-4);"><p>Gagal memuat ringkasan pasar.</p></div>';
    }
  }

  async function searchStock() {
    if (!state.searchTerm.trim()) {
      state.searchResult = null;
      renderDetailCard();
      return;
    }

    detailCard.innerHTML = `<div class="skeleton" style="height:200px;width:100%;border-radius:6px;"></div>`;

    try {
      // Use the idx list endpoint with search query
      const data = await Api.get('/idx/stocks', { q: state.searchTerm, limit: 5 });
      state.searchResult = data.stocks?.[0] || null;
      renderDetailCard();
    } catch (e) {
      state.searchResult = null;
      renderDetailCard();
    }
  }

  async function loadStockAnalysis(ticker) {
    if (!ticker) return;

    state.stockData = null;
    detailCard.innerHTML = `<div class="skeleton" style="height:280px;width:100%;border-radius:6px;"></div>`;

    try {
      const data = await Api.get(`/idx/stocks/${ticker}/analysis`, { days: state.chartDays });
      state.stockData = data;
      renderDetailCard();
    } catch (e) {
      toast('Gagal memuat data saham: ' + (e.message || e), { type: 'error' });
      state.stockData = null;
      renderDetailCard();
    }
  }

  function renderDetailCard() {
    detailCard.innerHTML = '';
    detailCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    const cardHead = detailCard.querySelector('.card__head');
    cardHead.innerHTML = `<div class="card__title">Stock Detail</div>`;

    // Search bar
    cardHead.innerHTML += `
      <div class="search" style="flex:1;min-width:200px;max-width:320px;">
        <span class="search__icon">${icons['search']}</span>
        <input type="text" class="search__input" placeholder="Search ticker (e.g. BBCA)..." value="${state.searchTerm}">
      </div>
      <select class="field__select" style="width:120px;">
        <option value="90" ${state.chartDays === 90 ? 'selected' : ''}>90 Days</option>
        <option value="30" ${state.chartDays === 30 ? 'selected' : ''}>30 Days</option>
        <option value="7" ${state.chartDays === 7 ? 'selected' : ''}>7 Days</option>
      </select>
    `;

    const searchInput = cardHead.querySelector('.search__input');
    searchInput.addEventListener('input', (e) => {
      clearTimeout(state._searchDebounce);
      state.searchTerm = e.target.value;
      state._searchDebounce = setTimeout(() => searchStock(), 400);
    });

    const periodSelect = cardHead.querySelector('select');
    periodSelect.addEventListener('change', (e) => {
      state.chartDays = parseInt(e.target.value);
      if (state.selectedTicker) loadStockAnalysis(state.selectedTicker);
      loadMarketSummary();
    });

    // Chart + info area
    const body = document.createElement('div');
    body.style.padding = 'var(--s-4)';
    body.style.paddingTop = '0';

    if (state.stockData) {
      const d = state.stockData;
      const profile = d;
      body.innerHTML = `
        <div style="font-weight:600;margin-bottom:var(--s-2);">${profile.ticker} — ${profile.company_name}</div>
        <div style="font-size:var(--text-sm);color:var(--c-text-2);margin-bottom:var(--s-3);">
          Sector: ${profile.sector || '-'} | Status: ${profile.stock_status || '-'}
        </div>
        <div style="height:200px;background:var(--c-surface-2);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;color:var(--c-text-3);font-size:var(--text-sm);">
          Chart area (${d.data?.length || 0} data points)
        </div>
        <div style="margin-top:var(--s-3);font-size:var(--text-sm);color:var(--c-text-2);">
          ${d.summary ? `Last: ${formatPrice(d.summary.latest_price)} | Change: ${fmtChange(d.summary.price_change_pct)} | Volume: ${d.summary.total_volume || 0}` : 'No summary data'}
        </div>
      `;
    } else if (state.searchResult) {
      const s = state.searchResult;
      body.innerHTML = `
        <div style="font-weight:600;margin-bottom:var(--s-2);">${s.ticker} — ${s.company_name}</div>
        <div style="font-size:var(--text-sm);color:var(--c-text-2);margin-bottom:var(--s-3);">
          Sector: ${s.sector || '-'} | Primary: ${s.primary_sector || '-'} | Status: ${s.stock_status || '-'}
        </div>
        <div style="height:200px;background:var(--c-surface-2);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;color:var(--c-text-3);font-size:var(--text-sm);">
          Click "Load Analysis" to view chart
        </div>
        <div style="margin-top:var(--s-3);">
          <button class="btn btn--primary btn--sm" onclick="window.loadAnalysis('${s.ticker}')">${icons['trending-up']} Load Analysis</button>
        </div>
      `;
      state.selectedTicker = s.ticker;
    } else if (state.searchTerm) {
      body.innerHTML = `<p style="color:var(--c-text-3);font-size:var(--text-sm);">Cari ticker untuk melihat detail.</p>`;
    } else {
      body.innerHTML = `<p style="color:var(--c-text-3);font-size:var(--text-sm);">Masukkan ticker di kolom pencarian untuk melihat detail saham.</p>`;
    }

    detailCard.appendChild(body);
  }

  async function loadTopMovers() {
    tableCard.innerHTML = '<div class="skeleton" style="height:300px;width:100%;border-radius:6px;"></div>';

    try {
      // Use market summary data for top movers — includes top_accumulation
      // which contains ticker + company_name + net_flow
      const data = state.marketSummary || await Api.get('/idx/market/summary', { days: state.chartDays });
      state.marketSummary = data;

      // Build top movers from accumulation flow
      const accumulation = data.top_accumulation || [];
      const stocks = accumulation.slice(0, 10);

      if (stocks.length === 0) {
        // Fallback: try fetching first page of stocks
        const stockData = await Api.get('/idx/stocks', { limit: 10 });
        const fallbackStocks = stockData.stocks || [];
        if (fallbackStocks.length === 0) {
          tableCard.innerHTML = '<div class="empty" style="padding:var(--s-4);"><p>Tidak ada data saham.</p></div>';
          return;
          }
        }

      tableCard.innerHTML = '';
      const head = createEl('div', { class: 'card__head' });
      head.innerHTML = '<div class="card__title">Top Movers (Foreign Flow Accumulation)</div>';
      tableCard.appendChild(head);

      const tableWrap = createEl('div', { class: 'table-wrap' });
      const table = createEl('table', { class: 'table' });

      if (stocks.length > 0) {
        table.innerHTML = `
          <thead><tr>
            <th>Ticker</th><th>Name</th><th>Net Flow (IDR)</th><th></th>
          </tr></thead>
          <tbody>
            ${stocks.map(s => `
              <tr>
                <td><span class="badge badge--primary">${s.ticker}</span></td>
                <td style="font-weight:500;">${s.company_name}</td>
                <td style="font-family:var(--font-mono);font-weight:600;">${formatPrice(s.net_flow_val)}</td>
                <td class="table__actions">
                  <button class="btn btn--ghost btn--sm" onclick="window.viewStock('${s.ticker}')">${icons['eye']}</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        `;
      } else {
        // Fallback table
        const fallbackStocks = stocks;
        table.innerHTML = `
          <thead><tr>
            <th>Ticker</th><th>Name</th><th>Sector</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            ${fallbackStocks.map(s => `
              <tr>
                <td><span class="badge badge--primary">${s.ticker}</span></td>
                <td style="font-weight:500;">${s.company_name}</td>
                <td style="color:var(--c-text-3);font-size:var(--text-sm);">${s.sector || '-'}</td>
                <td>${s.stock_status ? `<span class="badge badge--${s.stock_status === 'blacklist' ? 'danger' : 'success'}">${s.stock_status}</span>` : '<span class="badge badge--neutral">default</span>'}</td>
                <td class="table__actions">
                  <button class="btn btn--ghost btn--sm" onclick="window.viewStock('${s.ticker}')">${icons['eye']}</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        `;
      }
      tableWrap.appendChild(table);
      tableCard.appendChild(tableWrap);
    } catch (e) {
      tableCard.innerHTML = '<div class="empty" style="padding:var(--s-4);color:var(--c-danger);"><p>Gagal memuat data: ' + (e.message || e) + '</p></div>';
    }
  }

  // Expose for inline onclick
  window.viewStock = (ticker) => {
    state.searchTerm = ticker;
    loadStockAnalysis(ticker);
  };

  window.loadAnalysis = (ticker) => {
    loadStockAnalysis(ticker);
  };

  // Cleanup
  container._cleanup = () => {
    delete window.viewStock;
    delete window.loadAnalysis;
    if (state._searchDebounce) clearTimeout(state._searchDebounce);
  };

  // Init
  loadMarketSummary();
  renderDetailCard();
  loadTopMovers();

  return container;
}
