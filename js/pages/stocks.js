/* pages/stocks.js — Stock Analysis (Anti-Slop, Dart-parity) */
import { $, on, createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';
import { StockAnalysis, StockListItem } from '../models/stocks.js';
import { StockSectorBadge, DelistedBadge, StockInfoCard, sectorColor } from '../ui/stock-widgets.js';
import Api from '../core/api.js';
import { toast } from '../ui/toast.js';

/* ─── Constants ─── */
const PERIODS = [30, 60, 90, 180, 365];
const COMPARE_COLORS = ['#00A86B', '#5B8FF9', '#F6903D', '#E86452', '#9270CA', '#5AD8A6', '#6DC8EC', '#F6C022'];

/* ─── Formatters ─── */
function fmtPrice(v) {
  if (v == null) return '-';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(v);
}

function fmtChange(c) {
  if (c == null) return '-';
  const cls = c >= 0 ? 'var(--c-accent)' : 'var(--c-danger)';
  return `<span style="color:${cls};font-weight:500;">${c >= 0 ? '+' : ''}${c.toFixed(1)}%</span>`;
}

function fmtS(v) {
  if (v == null) return '-';
  const n = Number(v);
  const s = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e12) return s + (a / 1e12).toFixed(1) + 'T';
  if (a >= 1e9) return s + (a / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return s + (a / 1e6).toFixed(1) + 'M';
  return s + a.toFixed(0);
}

function compact(v) {
  if (v == null) return '-';
  const n = Number(v);
  const s = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e12) return s + (a / 1e12).toFixed(1) + 'T';
  if (a >= 1e9) return s + (a / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return s + (a / 1e6).toFixed(1) + 'M';
  return s + a.toFixed(0);
}

function dateLabel(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function fullDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function priceAxisLabel(v) {
  return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : v.toFixed(0);
}

/* ─── Lightweight Charts lazy loader ─── */
let lwcPromise = null;
async function loadLWC() {
  if (lwcPromise) return lwcPromise;
  lwcPromise = (async () => {
    try {
      const mod = await import('https://esm.sh/lightweight-charts@4.2.0');
      return mod;
    } catch (_) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/lightweight-charts@4/dist/lightweight-charts.standalone.production.js';
        script.onload = () => resolve(window.LightweightCharts);
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
  })();
  return lwcPromise;
}

function getChartTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    bg: isDark ? '#0a0a0a' : '#ffffff',
    text: isDark ? '#a3a3a3' : '#616161',
    grid: isDark ? '#2a2a2a' : '#e0e0e0',
    border: isDark ? '#404040' : '#bdbdbd',
  };
}

/* ─── Chart builders ─── */
function makeChartOptions(container, height) {
  const t = getChartTheme();
  return {
    width: container.clientWidth,
    height,
    layout: { background: { type: 'solid', color: 'transparent' }, textColor: t.text },
    grid: { vertLines: { visible: false }, horzLines: { color: t.grid } },
    rightPriceScale: { borderColor: t.border },
    timeScale: { borderColor: t.border, timeVisible: false },
    crosshair: { mode: 0 }, // Normal
    handleScroll: { vertTouchDrag: false },
    handleScale: { axisPressedMouseMove: false },
  };
}

function buildPriceChart(container, data, lwc) {
  const chart = lwc.createChart(container, makeChartOptions(container, 270));
  const series = chart.addSeries(lwc.LineSeries, {
    color: '#00A86B', lineWidth: 2.5,
    lastValueVisible: false, priceLineVisible: false,
  });
  const chartData = data.map(d => ({ time: d.date, value: d.close }));
  series.setData(chartData);
  series.applyOptions({
    baseLineVisible: false,
  });
  // Area fill via custom plugin not available in LWC v4 easily, skip for now
  chart.timeScale().fitContent();
  return chart;
}

function buildValueChart(container, data, lwc) {
  const chart = lwc.createChart(container, makeChartOptions(container, 200));
  const series = chart.addSeries(lwc.HistogramSeries, {
    color: '#F6903D', priceLineVisible: false, lastValueVisible: false,
  });
  series.setData(data.map(d => ({ time: d.date, value: d.value })));
  chart.timeScale().fitContent();
  return chart;
}

function buildVolumeChart(container, data, lwc) {
  const chart = lwc.createChart(container, makeChartOptions(container, 200));
  const series = chart.addSeries(lwc.HistogramSeries, {
    color: '#6DC8EC', priceLineVisible: false, lastValueVisible: false,
  });
  series.setData(data.map(d => ({ time: d.date, value: d.volume })));
  chart.timeScale().fitContent();
  return chart;
}

function buildForeignChart(container, data, lwc) {
  const chart = lwc.createChart(container, { ...makeChartOptions(container, 210), autoSize: true });
  // LWC histogram doesn't support individual bar colors easily in v4 without setData per point
  // We'll use two series: positive and negative
  const buyData = data.filter(d => d.netForeign >= 0).map(d => ({ time: d.date, value: d.netForeign }));
  const sellData = data.filter(d => d.netForeign < 0).map(d => ({ time: d.date, value: Math.abs(d.netForeign) }));

  if (buyData.length) {
    const buySeries = chart.addSeries(lwc.HistogramSeries, {
      color: '#00A86B', priceLineVisible: false, lastValueVisible: false,
    });
    buySeries.setData(buyData);
  }
  if (sellData.length) {
    const sellSeries = chart.addSeries(lwc.HistogramSeries, {
      color: '#D94B4B', priceLineVisible: false, lastValueVisible: false,
    });
    sellSeries.setData(sellData);
  }
  chart.timeScale().fitContent();
  return chart;
}

function buildBiiChart(container, data, lwc) {
  const chart = lwc.createChart(container, makeChartOptions(container, 210));
  const series = chart.addSeries(lwc.LineSeries, {
    color: '#7B61FF', lineWidth: 2.5, priceLineVisible: false, lastValueVisible: false,
  });
  series.setData(data.map(d => ({ time: d.date, value: d.biiScore })));
  chart.timeScale().fitContent();
  return chart;
}

function buildAtvChart(container, data, lwc) {
  const chart = lwc.createChart(container, makeChartOptions(container, 200));
  const series = chart.addSeries(lwc.HistogramSeries, {
    color: '#9270CA', priceLineVisible: false, lastValueVisible: false,
  });
  series.setData(data.map(d => ({ time: d.date, value: d.atv })));
  chart.timeScale().fitContent();
  return chart;
}

function buildNegoValueChart(container, data, lwc) {
  const chart = lwc.createChart(container, makeChartOptions(container, 200));
  const series = chart.addSeries(lwc.HistogramSeries, {
    color: '#F6C022', priceLineVisible: false, lastValueVisible: false,
  });
  series.setData(data.map(d => ({ time: d.date, value: d.nonRegValue })));
  chart.timeScale().fitContent();
  return chart;
}

function buildNegoFreqChart(container, data, lwc) {
  const chart = lwc.createChart(container, makeChartOptions(container, 180));
  const series = chart.addSeries(lwc.HistogramSeries, {
    color: '#90A4AE', priceLineVisible: false, lastValueVisible: false,
  });
  series.setData(data.map(d => ({ time: d.date, value: d.nonRegFreq })));
  chart.timeScale().fitContent();
  return chart;
}

function buildCompareChart(container, primaryData, compareData, compareTickers, lwc) {
  const chart = lwc.createChart(container, makeChartOptions(container, 300));
  const allSeries = [];

  // Primary
  const base1 = primaryData[0]?.close || 1;
  const s1 = chart.addSeries(lwc.LineSeries, {
    color: COMPARE_COLORS[0], lineWidth: 2.5, priceLineVisible: false, lastValueVisible: false,
  });
  s1.setData(primaryData.map((d, i) => ({ time: d.date, value: ((d.close - base1) / base1) * 100 })));
  allSeries.push({ ticker: primaryData.ticker || 'Primary', series: s1, color: COMPARE_COLORS[0] });

  // Compared
  compareTickers.forEach((t, idx) => {
    const cd = compareData[t];
    if (!cd || !cd.length) return;
    const base = cd[0]?.close || 1;
    const s = chart.addSeries(lwc.LineSeries, {
      color: COMPARE_COLORS[(idx + 1) % COMPARE_COLORS.length],
      lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
    });
    s.setData(cd.map(d => ({ time: d.date, value: ((d.close - base) / base) * 100 })));
    allSeries.push({ ticker: t, series: s, color: COMPARE_COLORS[(idx + 1) % COMPARE_COLORS.length] });
  });

  chart.timeScale().fitContent();
  return chart;
}

/* ─── State ─── */
const state = {
  searchTerm: '', searchResults: [], searching: false,
  selectedTicker: '', days: 30, analysis: null, loading: false,
  compareMode: false, compareTickers: [], compareData: {}, compareLoading: false,
  charts: [],
};

/* ─── API ─── */
async function doSearch(q) {
  if (!q.trim()) { state.searchResults = []; return; }
  state.searching = true;
  renderSearchDropdown();
  try {
    const res = await Api.get('/idx/stocks/search', { q, limit: 8 });
    const data = res?.data || res || [];
    state.searchResults = data.map(d => new StockListItem(d));
  } catch (_) {
    state.searchResults = [];
  } finally {
    state.searching = false;
    renderSearchDropdown();
  }
}

async function loadAnalysis(ticker) {
  const t = ticker.toUpperCase();
  state.loading = true; state.searchResults = []; state.selectedTicker = t;
  state.analysis = null;
  renderLoading(); renderSearchDropdown();
  try {
    const res = await Api.get(`/idx/stocks/${t}/analysis`, { days: state.days });
    const data = res?.data || res;
    state.analysis = new StockAnalysis(data);
    // Refresh compare data with new period
    for (const ct of state.compareTickers) {
      await refreshCompare(ct);
    }
  } catch (e) {
    toast('Gagal memuat analisis: ' + (e.message || e), 'danger');
  } finally {
    state.loading = false;
    renderAnalysis();
  }
}

async function addCompare(ticker) {
  const t = ticker.toUpperCase();
  if (state.compareTickers.includes(t)) return;
  state.compareLoading = true;
  renderCompareBar();
  try {
    const res = await Api.get(`/idx/stocks/${t}/analysis`, { days: state.days });
    const data = res?.data || res;
    const analysis = new StockAnalysis(data);
    if (!analysis.data.length) {
      toast('Tidak ada data untuk ' + t, 'warn');
      state.compareLoading = false;
      renderCompareBar();
      return;
    }
    state.compareTickers.push(t);
    state.compareData[t] = analysis.data.map(d => d);
    state.compareMode = true;
  } catch (e) {
    toast('Gagal membandingkan: ' + (e.message || e), 'danger');
  } finally {
    state.compareLoading = false;
    renderCompareBar();
    renderCharts();
  }
}

async function refreshCompare(ticker) {
  const t = ticker.toUpperCase();
  if (!state.compareTickers.includes(t)) return;
  try {
    const res = await Api.get(`/idx/stocks/${t}/analysis`, { days: state.days });
    const data = res?.data || res;
    const analysis = new StockAnalysis(data);
    if (analysis.data.length) {
      state.compareData[t] = analysis.data.map(d => d);
    }
  } catch (_) {}
}

function removeCompare(ticker) {
  state.compareTickers = state.compareTickers.filter(t => t !== ticker);
  delete state.compareData[ticker];
  if (!state.compareTickers.length) state.compareMode = false;
  renderCompareBar();
  renderCharts();
}

/* ─── DOM ─── */
let rootEl = null;
let refs = {};

function clearCharts() {
  state.charts.forEach(c => { try { c.remove(); } catch (_) {} });
  state.charts = [];
}

/* ─── Render: Toolbar (once) ─── */
function renderToolbarOnce() {
  const toolbar = createEl('div', { class: 'stocks-page__toolbar' });

  // Search row
  const row = createEl('div', { style: { position: 'relative', flex: '1 1 300px' } });
  const searchWrap = createEl('div', { class: 'search', style: { width: '100%' } });
  searchWrap.innerHTML = `<span class="search__icon">${icons['search']}</span>`;
  const input = createEl('input', {
    type: 'text',
    class: 'search__input stocks-page__search-input',
    placeholder: 'Cari ticker (BBCA, GOTO...)',
    value: state.searchTerm,
    'aria-label': 'Cari saham',
    autocomplete: 'off',
  });
  on(input, 'input', (e) => {
    state.searchTerm = e.target.value;
    clearTimeout(state._searchDebounce);
    state._searchDebounce = setTimeout(() => doSearch(state.searchTerm), 300);
  });
  on(input, 'keydown', (e) => {
    if (e.key === 'Enter' && state.searchTerm.trim()) {
      loadAnalysis(state.searchTerm.trim());
    }
  });
  searchWrap.appendChild(input);
  row.appendChild(searchWrap);

  // Dropdown
  const dropdown = createEl('div', {
    class: 'stocks-page__dropdown',
    style: {
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      borderRadius: 'var(--radius)', zIndex: 50, maxHeight: '250px',
      overflow: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      display: 'none',
    }
  });
  row.appendChild(dropdown);
  refs.searchInput = input;
  refs.searchDropdown = dropdown;
  toolbar.appendChild(row);

  // Period chips
  const chips = createEl('div', {
    class: 'stocks-page__periods',
    style: { display: 'flex', gap: 'var(--s-1)', flexWrap: 'wrap', marginTop: 'var(--s-3)' }
  });
  PERIODS.forEach(d => {
    const chip = createEl('button', {
      class: `btn btn--sm stocks-page__chip ${state.days === d ? 'stocks-page__chip--active' : ''}`,
      style: {
        padding: 'var(--s-1) var(--s-3)', fontSize: 'var(--text-xs)', fontWeight: 600,
        borderRadius: '16px', border: '1px solid var(--c-border)',
        background: state.days === d ? 'var(--c-accent)' : 'transparent',
        color: state.days === d ? '#fff' : 'var(--c-text-2)',
      }
    });
    chip.textContent = d + 'H';
    on(chip, 'click', () => {
      state.days = d;
      updatePeriodChips();
      if (state.selectedTicker) loadAnalysis(state.selectedTicker);
    });
    chips.appendChild(chip);
  });
  refs.periodChips = chips;
  toolbar.appendChild(chips);

  rootEl.appendChild(toolbar);
}

function updatePeriodChips() {
  if (!refs.periodChips) return;
  Array.from(refs.periodChips.children).forEach((chip, i) => {
    const d = PERIODS[i];
    const active = state.days === d;
    chip.style.background = active ? 'var(--c-accent)' : 'transparent';
    chip.style.color = active ? '#fff' : 'var(--c-text-2)';
    chip.classList.toggle('stocks-page__chip--active', active);
  });
}

/* ─── Render: Search dropdown ─── */
function renderSearchDropdown() {
  const dd = refs.searchDropdown;
  if (!dd) return;
  if (state.searching) {
    dd.style.display = 'block';
    dd.innerHTML = `<div style="padding:var(--s-4);text-align:center;font-size:var(--text-sm);color:var(--c-text-3);">Mencari...</div>`;
    return;
  }
  if (!state.searchResults.length) {
    dd.style.display = 'none';
    dd.innerHTML = '';
    return;
  }
  dd.style.display = 'block';
  dd.innerHTML = state.searchResults.map(s => {
    const sectorBadge = s.sector ? StockSectorBadge(s.sector, true) : null;
    const delistedBadge = s.isDelisted || s.isBlacklisted
      ? DelistedBadge({ labelDelisted: s.labelDelisted, stockStatus: s.stockStatus, statusReason: s.statusReason, small: true })
      : null;
    return `
      <div class="stocks-page__result-item" data-ticker="${s.ticker}" style="padding:var(--s-2) var(--s-3);cursor:pointer;display:flex;align-items:center;gap:var(--s-2);border-bottom:1px solid var(--c-border);transition:background var(--dur-fast);" onmouseover="this.style.background='var(--c-surface-2)'" onmouseout="this.style.background='transparent'">
        <span style="color:var(--c-accent);flex-shrink:0;">${icons['trending-up']}</span>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:var(--s-1);flex-wrap:wrap;">
            <span style="font-weight:600;font-size:var(--text-sm);">${s.ticker}</span>
            ${sectorBadge ? sectorBadge.outerHTML : ''}
            ${delistedBadge ? delistedBadge.outerHTML : ''}
          </div>
          <div style="font-size:var(--text-xs);color:var(--c-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.companyName}</div>
        </div>
      </div>
    `;
  }).join('');

  dd.querySelectorAll('.stocks-page__result-item').forEach(item => {
    on(item, 'click', () => {
      const ticker = item.dataset.ticker;
      state.searchTerm = ticker;
      refs.searchInput.value = ticker;
      loadAnalysis(ticker);
    });
  });
}

/* ─── Render: Compare bar ─── */
function renderCompareBar() {
  let el = refs.compareBar;
  if (!state.analysis) {
    if (el) { el.remove(); refs.compareBar = null; }
    return;
  }
  if (!el) {
    el = createEl('div', { class: 'stocks-page__compare-bar', style: { marginTop: 'var(--s-3)' } });
    refs.compareBar = el;
    rootEl.insertBefore(el, refs.analysisContainer || null);
  }

  let html = `<div style="display:flex;align-items:center;gap:var(--s-2);flex-wrap:wrap;">
    <span style="font-size:var(--text-xs);font-weight:600;color:var(--c-text-3);display:flex;align-items:center;gap:var(--s-1);">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h3v3h-3zM8 3h3v3H8zM5 8h14v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8zM12 12v4"/></svg>
      Bandingkan
    </span>
    <button class="btn btn--secondary btn--sm stocks-page__add-compare" style="padding:var(--s-1) var(--s-2);font-size:var(--text-xs);">
      ${icons['plus']} Tambah
    </button>
  </div>`;

  if (state.compareTickers.length) {
    html += `<div style="display:flex;gap:var(--s-1);flex-wrap:wrap;margin-top:var(--s-2);">`;
    // Primary chip
    html += `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:${COMPARE_COLORS[0]}1A;border:1px solid ${COMPARE_COLORS[0]}66;border-radius:16px;font-size:var(--text-xs);font-weight:600;color:${COMPARE_COLORS[0]};">
      <span style="width:8px;height:8px;border-radius:50%;background:${COMPARE_COLORS[0]};display:inline-block;"></span>
      ${state.analysis.ticker}
    </span>`;
    state.compareTickers.forEach((t, i) => {
      const c = COMPARE_COLORS[(i + 1) % COMPARE_COLORS.length];
      html += `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:${c}1A;border:1px solid ${c}66;border-radius:16px;font-size:var(--text-xs);font-weight:600;color:${c};">
        <span style="width:8px;height:8px;border-radius:50%;background:${c};display:inline-block;"></span>
        ${t}
        <button class="btn btn--ghost btn--sm stocks-page__remove-compare" data-ticker="${t}" style="padding:0;width:16px;height:16px;min-width:16px;min-height:16px;color:var(--c-text-3);margin-left:2px;" aria-label="Hapus ${t}">${icons['x']}</button>
      </span>`;
    });
    html += `</div>`;
  }

  if (state.compareLoading) {
    html += `<div style="margin-top:var(--s-2);font-size:var(--text-xs);color:var(--c-text-3);">Memuat data perbandingan...</div>`;
  }

  el.innerHTML = html;

  const addBtn = el.querySelector('.stocks-page__add-compare');
  if (addBtn) on(addBtn, 'click', showCompareModal);

  el.querySelectorAll('.stocks-page__remove-compare').forEach(btn => {
    on(btn, 'click', (e) => { e.stopPropagation(); removeCompare(btn.dataset.ticker); });
  });
}

/* ─── Compare modal ─── */
function showCompareModal() {
  if (document.querySelector('.stocks-page__compare-modal')) return;

  const overlay = createEl('div', {
    class: 'stocks-page__compare-modal',
    style: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 100,
    }
  });

  const sheet = createEl('div', {
    style: {
      background: 'var(--c-surface)', width: '100%', maxWidth: '560px',
      borderRadius: '16px 16px 0 0', maxHeight: '70vh', overflow: 'auto',
      padding: 'var(--s-4)', animation: 'slideUp var(--dur-fast) var(--ease)',
    }
  });

  sheet.innerHTML = `
    <div style="width:40px;height:4px;background:var(--c-border);border-radius:2px;margin:0 auto var(--s-4);"></div>
    <h3 style="font-size:var(--text-md);font-weight:700;margin-bottom:var(--s-3);text-align:center;">Tambah Saham untuk Dibandingkan</h3>
    <div class="search" style="margin-bottom:var(--s-3);">
      <span class="search__icon">${icons['search']}</span>
      <input type="text" class="search__input stocks-page__compare-input" placeholder="Cari ticker (BBCA, GOTO...)" autofocus>
    </div>
    <div class="stocks-page__compare-results" style="max-height:250px;overflow:auto;"></div>
  `;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  const input = sheet.querySelector('.stocks-page__compare-input');
  const resultsEl = sheet.querySelector('.stocks-page__compare-results');

  on(input, 'input', (e) => {
    const q = e.target.value;
    if (!q.trim()) { resultsEl.innerHTML = ''; return; }
    resultsEl.innerHTML = '<div style="padding:var(--s-4);text-align:center;color:var(--c-text-3);font-size:var(--text-sm);">Mencari...</div>';
    clearTimeout(state._compareDebounce);
    state._compareDebounce = setTimeout(async () => {
      try {
        const res = await Api.get('/idx/stocks/search', { q, limit: 8 });
        const items = (res?.data || res || []).map(d => new StockListItem(d));
        if (!items.length) {
          resultsEl.innerHTML = '<div style="padding:var(--s-4);text-align:center;color:var(--c-text-3);font-size:var(--text-sm);">Tidak ada hasil</div>';
          return;
        }
        resultsEl.innerHTML = items.map(s => {
          const already = state.compareTickers.includes(s.ticker.toUpperCase());
          const sectorBadge = s.sector ? StockSectorBadge(s.sector, true) : null;
          return `
            <div class="stocks-page__compare-item" data-ticker="${s.ticker}" style="padding:var(--s-2) var(--s-3);cursor:pointer;display:flex;align-items:center;gap:var(--s-2);border-bottom:1px solid var(--c-border);opacity:${already ? 0.5 : 1};pointer-events:${already ? 'none' : 'auto'};" onmouseover="this.style.background='var(--c-surface-2)'" onmouseout="this.style.background='transparent'">
              <span style="color:${already ? 'var(--c-accent)' : 'var(--c-text-3)'};flex-shrink:0;">${already ? icons['check'] : icons['plus']}</span>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:var(--s-1);flex-wrap:wrap;">
                  <span style="font-weight:600;font-size:var(--text-sm);">${s.ticker}</span>
                  ${sectorBadge ? sectorBadge.outerHTML : ''}
                </div>
                <div style="font-size:var(--text-xs);color:var(--c-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.companyName}</div>
              </div>
            </div>
          `;
        }).join('');
        resultsEl.querySelectorAll('.stocks-page__compare-item').forEach(item => {
          on(item, 'click', () => {
            addCompare(item.dataset.ticker);
            close();
          });
        });
      } catch (_) {
        resultsEl.innerHTML = '<div style="padding:var(--s-4);text-align:center;color:var(--c-danger);font-size:var(--text-sm);">Gagal mencari</div>';
      }
    }, 300);
  });

  input.focus();
}


/* ─── Render: Loading ─── */
function renderLoading() {
  let el = refs.analysisContainer;
  if (!el) {
    el = createEl('div', { class: 'stocks-page__analysis' });
    refs.analysisContainer = el;
    rootEl.appendChild(el);
  }
  el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;margin-top:var(--s-4);">
    <div class="spinner" style="width:32px;height:32px;border:3px solid var(--c-border);border-top-color:var(--c-primary);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto var(--s-3);"></div>
    <div style="font-size:var(--text-sm);color:var(--c-text-2);">Memuat analisis...</div>
  </div>`;
  clearCharts();
}

/* ─── Render: Analysis ─── */
function renderAnalysis() {
  let el = refs.analysisContainer;
  if (!el) {
    el = createEl('div', { class: 'stocks-page__analysis' });
    refs.analysisContainer = el;
    rootEl.appendChild(el);
  }

  if (!state.analysis) {
    el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;margin-top:var(--s-4);">
      <div style="font-size:var(--text-sm);color:var(--c-text-3);">Cari saham untuk melihat analisis</div>
    </div>`;
    clearCharts();
    return;
  }

  const a = state.analysis;
  const s = a.summary;
  const data = a.data;
  const rawData = data.map(d => ({
    date: d.date, close: d.close, open: d.open, high: d.high, low: d.low,
    volume: d.volume, value: d.value, frequency: d.frequency,
    foreignBuy: d.foreignBuy, foreignSell: d.foreignSell,
    nonRegValue: d.nonRegValue, nonRegFreq: d.nonRegFreq,
    netForeign: d.netForeign, atv: d.atv, biiScore: d.biiScore,
    prevPrice: d.prevPrice, change: d.change,
  }));

  el.innerHTML = '';

  // ── Header ──
  const header = createEl('div', { class: 'card', style: { marginTop: 'var(--s-4)' } });
  const changeColor = s.priceChangePct >= 0 ? 'var(--c-accent)' : 'var(--c-danger)';
  const changeSign = s.priceChangePct >= 0 ? '+' : '';
  header.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--s-3);flex-wrap:wrap;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:var(--s-2);flex-wrap:wrap;margin-bottom:var(--s-1);">
          <span style="font-size:var(--text-xl);font-weight:700;">${a.ticker}</span>
          <span id="stock-header-badge"></span>
        </div>
        <div style="font-size:var(--text-sm);color:var(--c-text-2);">${a.companyName}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:var(--text-lg);font-weight:700;">Rp ${fmtPrice(s.latestPrice)}</div>
        <div style="color:${changeColor};font-weight:500;font-size:var(--text-sm);">${changeSign}${s.priceChangePct.toFixed(1)}%</div>
      </div>
    </div>
  `;
  const badgeSlot = header.querySelector('#stock-header-badge');
  const delistedBadge = DelistedBadge({
    labelDelisted: a.labelDelisted, stockStatus: a.stockStatus, statusReason: a.statusReason
  });
  if (delistedBadge && badgeSlot) badgeSlot.appendChild(delistedBadge);
  el.appendChild(header);

  // ── Stock Info Card ──
  const infoCard = StockInfoCard(a);
  if (infoCard) el.appendChild(infoCard);

  // ── Metrics ──
  const metrics = createEl('div', { style: { marginTop: 'var(--s-3)' } });
  metrics.innerHTML = `
    <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;margin-bottom:var(--s-2);">
      ${metricCard('BII Score', s.latestBiiScore.toFixed(1), '#9270CA')}
      ${metricCard('Foreign %', s.foreignDominationPct.toFixed(1) + '%', '#5B8FF9')}
      ${metricCard('Net Foreign', fmtS(s.totalNetForeign), '#00A86B')}
    </div>
    <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;">
      ${metricCard('Total Value', fmtS(s.totalValue), '#F6903D')}
      ${metricCard('Total Vol', fmtS(s.totalVolume), '#6DC8EC')}
      ${metricCard('Avg BII', s.avgBiiScore.toFixed(1), '#7B61FF')}
    </div>
  `;
  el.appendChild(metrics);

  // ── Charts ──
  if (rawData.length > 0) {
    const chartsWrap = createEl('div', { class: 'stocks-page__charts', style: { marginTop: 'var(--s-5)' } });

    if (state.compareMode && state.compareTickers.length > 0) {
      // Compare chart
      const panel = chartPanel('Perbandingan Harga (Normalisasi)', 'Persentase perubahan dari hari pertama', [
        { label: a.ticker, color: COMPARE_COLORS[0] },
        ...state.compareTickers.map((t, i) => ({ label: t, color: COMPARE_COLORS[(i + 1) % COMPARE_COLORS.length] }))
      ], 300);
      chartsWrap.appendChild(panel);
    } else {
      // Price chart
      const pricePanel = chartPanel('Pergerakan Harga', 'Harga penutupan harian', [{ label: 'Harga penutupan', color: '#00A86B' }], 270);
      chartsWrap.appendChild(pricePanel);
    }

    chartsWrap.appendChild(chartPanel('Total Nilai Transaksi', 'Regular value per hari', [{ label: 'Nilai transaksi', color: '#F6903D' }], 200));
    chartsWrap.appendChild(chartPanel('Volume Perdagangan', 'Jumlah lot yang diperdagangkan', [{ label: 'Volume', color: '#6DC8EC' }], 200));
    chartsWrap.appendChild(chartPanel('Arus Dana Asing', 'Net foreign buy / sell', [{ label: 'Beli bersih', color: '#00A86B' }, { label: 'Jual bersih', color: '#D94B4B' }], 210));
    chartsWrap.appendChild(chartPanel('BII Score (Buying Intensity Index)', 'Skor akumulasi — gabungan ATV & volatilitas', [{ label: 'BII Score', color: '#7B61FF' }], 210));
    chartsWrap.appendChild(chartPanel('ATV (Avg Transaction Value)', 'Ukuran transaksi rata-rata — indikator aktivitas institusional', [{ label: 'ATV', color: '#9270CA' }], 200));
    chartsWrap.appendChild(chartPanel('Nilai Nego (Non-Regular)', 'Transaksi negosiasi / luar pasar', [{ label: 'Nego Value', color: '#F6C022' }], 200));
    chartsWrap.appendChild(chartPanel('Frekuensi Nego', 'Jumlah transaksi negosiasi per hari', [{ label: 'Nego Freq', color: '#90A4AE' }], 180));

    // Summary table
    chartsWrap.appendChild(buildSummaryTable(rawData));

    el.appendChild(chartsWrap);

    // Mount charts after DOM insertion
    requestAnimationFrame(() => mountCharts(rawData));
  }
}

function metricCard(label, value, color) {
  return `<div style="flex:1 1 100px;min-width:100px;padding:var(--s-3);background:${color}1A;border:1px solid ${color}4D;border-radius:var(--radius);text-align:center;">
    <div style="color:${color};font-size:var(--text-md);font-weight:700;">${value}</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:2px;">${label}</div>
  </div>`;
}

function chartPanel(title, subtitle, legend, height) {
  const panel = createEl('div', { class: 'stocks-page__chart-panel', style: { marginBottom: 'var(--s-6)' } });
  const legendHtml = legend.map(l => `
    <span style="display:inline-flex;align-items:center;gap:4px;font-size:var(--text-xs);color:var(--c-text-3);">
      <span style="width:8px;height:8px;border-radius:50%;background:${l.color};display:inline-block;"></span>
      ${l.label}
    </span>
  `).join('');
  panel.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--s-3);flex-wrap:wrap;margin-bottom:var(--s-3);">
      <div>
        <div style="font-size:var(--text-md);font-weight:700;">${title}</div>
        <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:2px;">${subtitle}</div>
      </div>
      <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;">${legendHtml}</div>
    </div>
    <div class="stocks-page__chart" style="height:${height}px;width:100%;" data-chart-type="${title}"></div>
  `;
  return panel;
}

async function mountCharts(rawData) {
  clearCharts();
  const lwc = await loadLWC();
  const containers = rootEl.querySelectorAll('.stocks-page__chart');
  containers.forEach(container => {
    const type = container.dataset.chartType;
    let chart;
    if (type === 'Pergerakan Harga' || type === 'Perbandingan Harga (Normalisasi)') {
      if (state.compareMode && state.compareTickers.length) {
        chart = buildCompareChart(container, rawData, state.compareData, state.compareTickers, lwc);
      } else {
        chart = buildPriceChart(container, rawData, lwc);
      }
    } else if (type === 'Total Nilai Transaksi') chart = buildValueChart(container, rawData, lwc);
    else if (type === 'Volume Perdagangan') chart = buildVolumeChart(container, rawData, lwc);
    else if (type === 'Arus Dana Asing') chart = buildForeignChart(container, rawData, lwc);
    else if (type === 'BII Score (Buying Intensity Index)') chart = buildBiiChart(container, rawData, lwc);
    else if (type === 'ATV (Avg Transaction Value)') chart = buildAtvChart(container, rawData, lwc);
    else if (type === 'Nilai Nego (Non-Regular)') chart = buildNegoValueChart(container, rawData, lwc);
    else if (type === 'Frekuensi Nego') chart = buildNegoFreqChart(container, rawData, lwc);
    if (chart) state.charts.push(chart);
  });
}

/* ─── Summary Table ─── */
function buildSummaryTable(rawData) {
  const rows = rawData.length > 15 ? rawData.slice(rawData.length - 15) : rawData;
  const wrap = createEl('div', { style: { marginTop: 'var(--s-6)' } });
  wrap.innerHTML = `
    <div style="font-size:var(--text-md);font-weight:700;margin-bottom:2px;">Ringkasan Data</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-bottom:var(--s-3);">${rows.length} hari terakhir</div>
    <div style="overflow-x:auto;">
      <table class="table">
        <thead><tr>
          <th>Tanggal</th><th>Harga</th><th>Chg%</th><th>Net For.</th><th>ATV</th><th>BII</th><th>F:R</th>
        </tr></thead>
        <tbody>
          ${rows.slice().reverse().map(r => {
            const close = r.close || 0;
            const prev = r.prevPrice || close;
            const chg = prev > 0 ? ((close - prev) / prev * 100) : 0;
            const netF = r.netForeign || 0;
            const atv = r.atv || 0;
            const bii = r.biiScore || 0;
            const fb = r.foreignBuy || 0;
            const fs = r.foreignSell || 0;
            const vol = r.volume || 0;
            const frRatio = vol > 0 ? ((fb + fs) / (vol * 2) * 100) : 0;
            const chgColor = chg >= 0 ? 'var(--c-accent)' : 'var(--c-danger)';
            const netColor = netF >= 0 ? 'var(--c-accent)' : 'var(--c-danger)';
            return `<tr>
              <td style="font-size:var(--text-xs);">${dateLabel(r.date)}</td>
              <td style="font-weight:600;font-size:var(--text-xs);">Rp ${fmtPrice(close)}</td>
              <td style="color:${chgColor};font-size:var(--text-xs);">${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%</td>
              <td style="color:${netColor};font-size:var(--text-xs);">${fmtS(netF)}</td>
              <td style="font-size:var(--text-xs);">${compact(atv)}</td>
              <td style="color:#7B61FF;font-weight:600;font-size:var(--text-xs);">${bii.toFixed(1)}</td>
              <td style="font-size:var(--text-xs);">${frRatio.toFixed(1)}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  return wrap;
}

/* ─── Cleanup ─── */
function cleanup() {
  clearCharts();
  if (state._searchDebounce) clearTimeout(state._searchDebounce);
  if (state._compareDebounce) clearTimeout(state._compareDebounce);
  rootEl = null; refs = {};
}

/* ─── Export render ─── */
export function render() {
  // Reset state
  Object.assign(state, {
    searchTerm: '', searchResults: [], searching: false,
    selectedTicker: '', days: 30, analysis: null, loading: false,
    compareMode: false, compareTickers: [], compareData: {}, compareLoading: false,
    charts: [],
  });

  rootEl = createEl('div', { class: 'stocks-page', style: { maxWidth: '900px', margin: '0 auto', padding: 'var(--s-4)' } });
  refs = {};

  // Keyframe
  if (!document.getElementById('stocks-page-keyframes')) {
    const style = createEl('style', { id: 'stocks-page-keyframes' });
    style.textContent = `
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    `;
    document.head.appendChild(style);
  }

  // Header
  const header = createEl('div', { style: { marginBottom: 'var(--s-5)' } });
  header.innerHTML = `
    <h1 style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--s-1);">Analisis Saham</h1>
    <p style="color:var(--c-text-2);font-size:var(--text-sm);">Analisis teknikal dan fundamental saham IDX.</p>
  `;
  rootEl.appendChild(header);

  renderToolbarOnce();
  renderAnalysis();
  renderCompareBar();

  // Close dropdown on outside click
  const outsideClick = (e) => {
    if (refs.searchDropdown && !refs.searchDropdown.contains(e.target) && !refs.searchInput.contains(e.target)) {
      refs.searchDropdown.style.display = 'none';
    }
  };
  document.addEventListener('click', outsideClick);
  rootEl._outsideClick = outsideClick;

  rootEl._cleanup = () => {
    document.removeEventListener('click', outsideClick);
    cleanup();
  };
  return rootEl;
}
