/* pages/saham/market-data.js — Market Data viewer (MD-2).
 * Commodity prices (WB/IMF) + FX rates (IMF ER) from /api/market-data.
 * Follows the market.js page pattern: loadEpoch, toast on error, cleanup
 * destroys charts. Future-dated periods (the 2027 Zimbabwe mislabels)
 * are excluded from the displayed latest, chart and table — frontend only,
 * the database and API are untouched. */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { loadApexCharts, buildLineChartApex, destroyChart, createChartPanel } from '../../ui/chart.js';
import { fmtPrice } from '../../utils/format.js';
import { spinnerCardHtml } from '../../ui/loading.js';

const chartPanel = createChartPanel('market-data-page');

/* ─── Priority quick-picks (default series per kind) ─── */
const PRIORITY = {
  commodity: [
    { label: 'Nickel', source: 'WB', series_code: 'Nickel', frequency: 'M' },
    { label: 'Coal, Australian', source: 'WB', series_code: 'Coal, Australian', frequency: 'M' },
    { label: 'Palm oil', source: 'WB', series_code: 'Palm oil', frequency: 'M' },
    { label: 'Crude oil, Brent', source: 'WB', series_code: 'Crude oil, Brent', frequency: 'M' },
    { label: 'Gold', source: 'WB', series_code: 'Gold', frequency: 'M' },
    { label: 'Tin', source: 'WB', series_code: 'Tin', frequency: 'M' },
  ],
  fx: [
    { label: 'USD/IDR', source: 'IMF', series_code: 'IDN.XDC_USD.PA_RT.M', frequency: 'M' },
  ],
};

const KIND_LABEL = { commodity: 'Commodity', fx: 'FX' };

const mdState = {
  kind: 'commodity', q: '', series: [], total: 0, offset: 0,
  selected: null, points: [], status: {}, loading: false,
  charts: [], statusEpoch: 0, seriesEpoch: 0, pricesEpoch: 0,
};

let mdRootEl = null;
let mdRefs = {};

/* ─── Period helpers ─── */

/* "2026-10" / "2026-M10" -> "2026-10-01"; "2026-Q3" -> "2026-07-01"
   (quarter start); "2026" -> "2026-01-01". Needed because
   new Date("2026-M10") and new Date("2026-Q3") are invalid. */
function periodToDate(period) {
  const p = String(period);
  let m = p.match(/^(\d{4})-M(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-01`;
  m = p.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-01`;
  m = p.match(/^(\d{4})-Q([1-4])$/);
  if (m) return `${m[1]}-${String((+m[2] - 1) * 3 + 1).padStart(2, '0')}-01`;
  m = p.match(/^(\d{4})$/);
  if (m) return `${m[1]}-01-01`;
  return p;
}

function isFuturePeriod(period) {
  return periodToDate(period) > new Date().toISOString().slice(0, 10);
}

/* Corrected coverage from a /status response: drop future-dated periods,
   take the lexicographic max as latest and sum the remaining rows. */
function correctedCoverage(statusRes) {
  const periods = (statusRes?.periods || []).filter((x) => !isFuturePeriod(x.period));
  const latest = periods.length ? periods.map((x) => x.period).sort().pop() : null;
  const total = periods.reduce((s, x) => s + (x.rows || 0), 0);
  return { latest, total };
}

/* Value formatter: thousands separator, up to 2 decimals for large values
   (an FX rate like 17983.82 keeps its cents) and up to 4 for small ones
   (0.0394 stays readable). */
function fmtValue(v) {
  if (v == null) return '-';
  const n = Number(v);
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function clearCharts() {
  mdState.charts.forEach((c) => destroyChart(c));
  mdState.charts = [];
}

/* ─── API ─── */

async function loadStatus() {
  const epoch = ++mdState.statusEpoch;
  try {
    const [com, fx] = await Promise.all([
      Api.get('/market-data/status', { kind: 'commodity' }),
      Api.get('/market-data/status', { kind: 'fx' }),
    ]);
    if (epoch !== mdState.statusEpoch) return;
    if (com) mdState.status.commodity = correctedCoverage(com);
    if (fx) mdState.status.fx = correctedCoverage(fx);
    renderHeader();
  } catch (e) {
    toast('Failed to load market data status: ' + (e.message || e), 'danger');
  }
}

async function loadSeries(reset) {
  const epoch = ++mdState.seriesEpoch;
  if (reset) { mdState.offset = 0; mdState.series = []; }
  mdState.loading = true;
  renderSeriesList();
  try {
    const res = await Api.get('/market-data/series', {
      kind: mdState.kind, q: mdState.q || undefined,
      limit: 50, offset: mdState.offset,
    });
    if (epoch !== mdState.seriesEpoch) return;
    if (!res) { mdState.loading = false; return; } // 401 -> auto-logout
    mdState.total = res.total || 0;
    mdState.series = reset ? (res.items || []) : mdState.series.concat(res.items || []);
    mdState.loading = false;
    renderSeriesList();
  } catch (e) {
    mdState.loading = false;
    toast('Failed to load series: ' + (e.message || e), 'danger');
    renderSeriesList();
  }
}

async function selectSeries(identity) {
  const epoch = ++mdState.pricesEpoch;
  mdState.selected = identity;
  mdState.points = [];
  renderDetail();
  try {
    const res = await Api.get('/market-data/prices', {
      kind: mdState.kind, source: identity.source,
      series_code: identity.series_code, frequency: identity.frequency,
      limit: 2000,
    });
    if (epoch !== mdState.pricesEpoch) return;
    if (!res) return; // 401 -> auto-logout
    // Drop future-dated points (2027 Zimbabwe mislabels, exact duplicates).
    mdState.points = (res.points || []).filter((p) => !isFuturePeriod(p.period));
    mdState.meta = {
      indicator: res.indicator, unit: res.unit, currency: res.currency,
      frequency: res.frequency, source: res.source, series_code: res.series_code,
    };
    renderDetail();
    await mountChart();
  } catch (e) {
    toast('Failed to load prices: ' + (e.message || e), 'danger');
    renderDetail();
  }
}

/* ─── Charts ─── */

async function mountChart() {
  if (!mdRootEl || !mdState.points.length) return;
  const container = mdRootEl.querySelector('.market-data-page__chart');
  if (!container) return;
  clearCharts();
  try {
    await loadApexCharts();
  } catch (e) {
    console.error('[MarketData] Failed to load chart library:', e);
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-3);font-size:var(--text-sm);">
      <span style="margin-right:var(--s-2);">${icons['alert-circle']}</span> Failed to load chart library
    </div>`;
    return;
  }
  try {
    const data = mdState.points.map((p) => ({ date: periodToDate(p.period), close: p.value }));
    const chart = buildLineChartApex(container, data, '#0EA5A4', {
      height: 260, name: mdState.meta?.indicator || mdState.selected?.series_code || 'Value',
    });
    if (chart) mdState.charts.push(chart);
  } catch (e) {
    console.error('[MarketData] Chart failed:', e);
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-3);font-size:var(--text-sm);">
      <span style="margin-right:var(--s-2);">${icons['alert-circle']}</span> Chart error
    </div>`;
  }
}

/* ─── DOM ─── */

function renderHeader() {
  if (!mdRootEl) return;
  const el = mdRootEl.querySelector('.market-data-page__head');
  if (!el) return;
  const com = mdState.status.commodity;
  const fx = mdState.status.fx;
  const cov = (c, label) => c
    ? `${label}: latest ${c.latest || '-'} · ${fmtPrice(c.total)} rows`
    : `${label}: loading…`;
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--s-3);">
      <div>
        <h1 style="margin:0;">Market Data</h1>
        <div style="font-size:var(--text-sm);color:var(--c-text-3);margin-top:4px;">${cov(com, 'Commodity')} &nbsp;·&nbsp; ${cov(fx, 'FX')}</div>
      </div>
    </div>`;
}

function renderTabs() {
  if (!mdRootEl) return;
  const el = mdRootEl.querySelector('.market-data-page__tabs');
  if (!el) return;
  el.innerHTML = Object.keys(KIND_LABEL).map((k) => `
    <button type="button" class="chip ${mdState.kind === k ? 'chip--active' : ''}" data-kind="${k}">${KIND_LABEL[k]}</button>
  `).join('');
  el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    if (mdState.kind === b.dataset.kind) return;
    mdState.kind = b.dataset.kind;
    mdState.q = '';
    mdState.selected = null;
    mdState.points = [];
    const input = mdRootEl.querySelector('.market-data-page__search');
    if (input) input.value = '';
    renderTabs();
    renderQuickPicks();
    renderDetail();
    loadSeries(true);
    selectSeries(PRIORITY[mdState.kind][0]);
  }));
}

function renderQuickPicks() {
  if (!mdRootEl) return;
  const el = mdRootEl.querySelector('.market-data-page__picks');
  if (!el) return;
  el.innerHTML = PRIORITY[mdState.kind].map((p) => `
    <button type="button" class="chip" data-source="${p.source}" data-code="${p.series_code}" data-freq="${p.frequency}">${p.label}</button>
  `).join('');
  el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    selectSeries({ source: b.dataset.source, series_code: b.dataset.code, frequency: b.dataset.freq });
  }));
}

function renderSeriesList() {
  if (!mdRootEl) return;
  const el = mdRootEl.querySelector('.market-data-page__series');
  if (!el) return;
  if (mdState.loading && mdState.series.length === 0) {
    el.innerHTML = spinnerCardHtml('Loading series…');
    return;
  }
  if (mdState.series.length === 0) {
    el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;">
      <div style="font-size:var(--text-sm);color:var(--c-text-3);">No series found</div></div>`;
    return;
  }
  const rows = mdState.series.map((s) => `
    <button type="button" class="market-data-page__row" data-source="${s.source}" data-code="${s.series_code}" data-freq="${s.frequency}">
      <span style="font-weight:600;">${s.series_code}</span>
      <span style="color:var(--c-text-3);font-size:var(--text-xs);">${s.indicator || ''}${s.unit ? ` · ${s.unit}` : ''}</span>
      <span style="color:var(--c-text-3);font-size:var(--text-xs);">${s.frequency} · ${s.first_period || ''}–${s.last_period || ''} · ${fmtPrice(s.n)} pts</span>
    </button>
  `).join('');
  const more = (mdState.offset + mdState.series.length < mdState.total)
    ? `<button type="button" class="market-data-page__more">Load more (${fmtPrice(mdState.total - mdState.offset - mdState.series.length)} remaining)</button>`
    : '';
  el.innerHTML = rows + more;
  el.querySelectorAll('.market-data-page__row').forEach((b) => b.addEventListener('click', () => {
    selectSeries({ source: b.dataset.source, series_code: b.dataset.code, frequency: b.dataset.freq });
  }));
  const moreBtn = el.querySelector('.market-data-page__more');
  if (moreBtn) moreBtn.addEventListener('click', () => {
    mdState.offset += mdState.series.length;
    loadSeries(false);
  });
}

function renderDetail() {
  if (!mdRootEl) return;
  const el = mdRootEl.querySelector('.market-data-page__detail');
  if (!el) return;
  if (!mdState.selected) {
    el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;">
      <div style="font-size:var(--text-sm);color:var(--c-text-3);">Select a series to view its history.</div></div>`;
    return;
  }
  const meta = mdState.meta || {};
  const pts = mdState.points;
  if (mdState.selected && pts.length === 0) {
    el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;">
      <div style="font-size:var(--text-sm);color:var(--c-text-3);">Loading prices…</div></div>`;
    return;
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  const prev = pts.length > 1 ? pts[pts.length - 2] : null;
  let change = '-';
  if (prev && prev.value != null && last.value != null && prev.value !== 0) {
    const pct = ((last.value - prev.value) / Math.abs(prev.value)) * 100;
    change = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs previous period`;
  }
  const panel = chartPanel(meta.indicator || mdState.selected.series_code,
    `${meta.source || ''} · ${meta.frequency || ''}${meta.unit ? ` · ${meta.unit}` : ''}${meta.currency ? ` · ${meta.currency}` : ''}`,
    [], 260);
  const rows = pts.slice().reverse().map((p) => `
    <tr><td>${p.period}</td><td style="text-align:right;">${fmtValue(p.value)}</td></tr>
  `).join('');
  el.innerHTML = '';
  const head = createEl('div', { class: 'market-data-page__detail-head' });
  head.innerHTML = `
    <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:var(--s-3);margin-bottom:var(--s-4);">
      <div>
        <div style="font-size:var(--text-lg);font-weight:700;">${meta.indicator || mdState.selected.series_code}</div>
        <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:2px;">${meta.source || ''} · ${meta.series_code || mdState.selected.series_code} · ${meta.frequency || ''}${meta.unit ? ` · ${meta.unit}` : ''}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:var(--text-lg);font-weight:700;">${fmtValue(last.value)}</div>
        <div style="font-size:var(--text-xs);color:var(--c-text-3);">${last.period} · ${change}</div>
        <div style="font-size:var(--text-xs);color:var(--c-text-3);">${first.period} – ${last.period} · ${fmtPrice(pts.length)} points</div>
      </div>
    </div>`;
  el.appendChild(head);
  el.appendChild(panel);
  const tableWrap = createEl('div', { class: 'card', style: { marginTop: 'var(--s-5)', overflowX: 'auto' } });
  tableWrap.innerHTML = `<table class="table"><thead><tr><th>Period</th><th style="text-align:right;">Value</th></tr></thead><tbody>${rows}</tbody></table>`;
  el.appendChild(tableWrap);
}

function cleanup() {
  mdState.statusEpoch += 1;
  mdState.seriesEpoch += 1;
  mdState.pricesEpoch += 1;
  clearCharts();
}

/* ─── Export render ─── */
export function render() {
  const page = createEl('div', { class: 'market-data-page' });

  const head = createEl('div', { class: 'market-data-page__head' });
  page.appendChild(head);

  const tabs = createEl('div', { class: 'market-data-page__tabs', style: { display: 'flex', gap: 'var(--s-2)', margin: 'var(--s-4) 0' } });
  page.appendChild(tabs);

  const picks = createEl('div', { class: 'market-data-page__picks', style: { display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginBottom: 'var(--s-4)' } });
  page.appendChild(picks);

  const search = createEl('input', {
    class: 'market-data-page__search', type: 'search',
    placeholder: 'Search series…', autocomplete: 'off',
    style: { width: '100%', marginBottom: 'var(--s-4)' },
  });
  page.appendChild(search);

  const series = createEl('div', { class: 'market-data-page__series', style: { marginBottom: 'var(--s-5)' } });
  page.appendChild(series);

  const detail = createEl('div', { class: 'market-data-page__detail' });
  page.appendChild(detail);

  mdRootEl = page;
  mdRefs = { head, tabs, picks, search, series, detail };

  let debounce = null;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      mdState.q = search.value.trim();
      loadSeries(true);
    }, 300);
  });

  renderHeader();
  renderTabs();
  renderQuickPicks();
  renderDetail();
  loadStatus();
  loadSeries(true);
  selectSeries(PRIORITY.commodity[0]);

  page._cleanup = () => {
    cleanup();
    mdRootEl = null;
    mdRefs = {};
  };

  return page;
}
