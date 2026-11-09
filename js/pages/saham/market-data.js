/* pages/saham/market-data.js — Market Data viewer (MD-2).
 * Commodity prices (WB/IMF) + FX rates (IMF ER) from /api/market-data.
 * Follows the market.js page pattern: loadEpoch, toast on error, cleanup
 * destroys charts. Future-dated periods (the 2027 Zimbabwe mislabels)
 * are excluded from the displayed latest and chart — frontend only,
 * the database and API are untouched.
 * Layout (atas perintah user 2026-11-09): daftar ringkas komoditas /
 * mata uang — tiap baris HANYA menampilkan harga saat ini, tertinggi
 * dan terendah (Current/High/Low dari /series) — tanpa tabel riwayat
 * periode. Klik baris -> grafik seri itu di bawah daftar. */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { loadApexCharts, buildLineChartApex, destroyChart, createChartPanel } from '../../ui/chart.js';
import { fmtPrice } from '../../utils/format.js';
import { spinnerCardHtml } from '../../ui/loading.js';

const chartPanel = createChartPanel('market-data-page');

/* ─── Seri default saat halaman dibuka / pindah kind ─── */
const PRIORITY = {
  commodity: { source: 'WB', series_code: 'Gold', frequency: 'M' },
  fx: { source: 'IMF', series_code: 'IDN.XDC_USD.PA_RT.M', frequency: 'M' },
};

const KIND_LABEL = { commodity: 'Commodity', fx: 'FX' };

/* Baris daftar ringkas per halaman (Load more untuk sisanya). */
const LIST_LIMIT = 20;

const mdState = {
  kind: 'commodity', series: [], total: 0, offset: 0,
  selected: null, points: [], status: {}, loading: false,
  charts: [], statusEpoch: 0, seriesEpoch: 0, pricesEpoch: 0,
  chartRange: '5y',
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
  // Per kind, berurutan — header diperbarui begitu tiap kind tiba,
  // tidak menunggu keduanya (Promise.all membuat satu yang lambat
  // menahan header tetap "loading…").
  const epoch = ++mdState.statusEpoch;
  for (const kind of ['commodity', 'fx']) {
    try {
      const res = await Api.get('/market-data/status', { kind });
      if (epoch !== mdState.statusEpoch) return;
      if (res) {
        mdState.status[kind] = correctedCoverage(res);
        renderHeader();
      }
    } catch (e) {
      toast('Failed to load market data status: ' + (e.message || e), 'danger');
    }
  }
}

async function loadSeries(reset) {
  const epoch = ++mdState.seriesEpoch;
  if (reset) { mdState.offset = 0; mdState.series = []; }
  mdState.loading = true;
  renderSeriesList();
  try {
    const params = { kind: mdState.kind, limit: LIST_LIMIT, offset: mdState.offset };
    const res = await Api.get('/market-data/series', params);
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
  // Nama tampilan (display_name) dari daftar kurasi, bila ada.
  const listed = mdState.series.find((s) => s.source === identity.source
    && s.series_code === identity.series_code
    && s.frequency === identity.frequency);
  mdState.selected = { ...identity,
    display_name: listed?.display_name || identity.display_name || null };
  mdState.points = [];
  renderSeriesList();
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

/* Titik untuk grafik, dipotong menurut rentang yang dipilih (default 5y —
   grafik penuh 1960–2026 membuat gerakan terbaru nyaris garis datar). */
function chartPoints() {
  const pts = mdState.points;
  if (mdState.chartRange === 'all' || pts.length === 0) return pts;
  const years = mdState.chartRange === '1y' ? 1 : 5;
  const cut = new Date(periodToDate(pts[pts.length - 1].period));
  cut.setFullYear(cut.getFullYear() - years);
  const cutStr = cut.toISOString().slice(0, 10);
  return pts.filter((p) => periodToDate(p.period) >= cutStr);
}

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
    const data = chartPoints().map((p) => ({ date: periodToDate(p.period), close: p.value }));
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
    <button type="button" class="btn btn--sm market-data-page__chip ${mdState.kind === k ? 'market-data-page__chip--active' : ''}" data-kind="${k}">${KIND_LABEL[k]}</button>
  `).join('');
  el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    if (mdState.kind === b.dataset.kind) return;
    mdState.kind = b.dataset.kind;
    mdState.selected = null;
    mdState.points = [];
    renderTabs();
    renderDetail();
    loadSeries(true);
    selectSeries(PRIORITY[mdState.kind]);
  }));
}

/* Daftar ringkas: satu baris per seri, HANYA Current / High / Low.
   Klik baris -> grafik seri itu di bawah daftar. */
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
  const rows = mdState.series.map((s) => {
    const active = mdState.selected && mdState.selected.source === s.source
      && mdState.selected.series_code === s.series_code
      && mdState.selected.frequency === s.frequency;
    return `
    <tr class="market-data-page__summary-row ${active ? 'market-data-page__summary-row--active' : ''}" data-source="${s.source}" data-code="${s.series_code}" data-freq="${s.frequency}">
      <td>
        <div style="font-weight:600;">${s.display_name || s.indicator || s.series_code}</div>
        <div style="color:var(--c-text-3);font-size:var(--text-xs);">${s.source} · ${s.series_code} · ${s.frequency}${s.unit ? ` · ${s.unit}` : ''}</div>
      </td>
      <td style="text-align:right;">${fmtValue(s.current)}</td>
      <td style="text-align:right;">${fmtValue(s.high)}</td>
      <td style="text-align:right;">${fmtValue(s.low)}</td>
    </tr>`;
  }).join('');
  const more = (mdState.offset + mdState.series.length < mdState.total)
    ? `<button type="button" class="btn btn--sm market-data-page__more">Load more (${fmtPrice(mdState.total - mdState.offset - mdState.series.length)} remaining)</button>`
    : '';
  el.innerHTML = `
    <div class="card" style="overflow-x:auto;">
      <table class="table">
        <thead><tr><th>Series</th><th style="text-align:right;">Current</th><th style="text-align:right;">High</th><th style="text-align:right;">Low</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>${more}`;
  el.querySelectorAll('.market-data-page__summary-row').forEach((r) => r.addEventListener('click', () => {
    selectSeries({ source: r.dataset.source, series_code: r.dataset.code, frequency: r.dataset.freq });
  }));
  const moreBtn = el.querySelector('.market-data-page__more');
  if (moreBtn) moreBtn.addEventListener('click', () => {
    mdState.offset += mdState.series.length;
    loadSeries(false);
  });
}

/* Detail seri terpilih: HANYA Current / High / Low + grafik.
   Tabel riwayat periode DIHAPUS (atas perintah user: daftar periode
   terlalu panjang & tidak estetik — diganti daftar ringkas di atas). */
function renderDetail() {
  if (!mdRootEl) return;
  const el = mdRootEl.querySelector('.market-data-page__detail');
  if (!el) return;
  if (!mdState.selected) {
    el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;">
      <div style="font-size:var(--text-sm);color:var(--c-text-3);">Select a series to view its chart.</div></div>`;
    return;
  }
  const meta = mdState.meta || {};
  const pts = mdState.points;
  if (mdState.selected && pts.length === 0) {
    el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;">
      <div style="font-size:var(--text-sm);color:var(--c-text-3);">Loading prices…</div></div>`;
    return;
  }
  const last = pts[pts.length - 1];
  const vals = pts.map((p) => p.value).filter((v) => v != null);
  const high = vals.length ? Math.max(...vals) : null;
  const low = vals.length ? Math.min(...vals) : null;
  const stat = (label, value, sub) => `
    <div>
      <div style="font-size:var(--text-xs);color:var(--c-text-3);">${label}</div>
      <div style="font-size:var(--text-lg);font-weight:700;">${fmtValue(value)}</div>
      ${sub ? `<div style="font-size:var(--text-xs);color:var(--c-text-3);">${sub}</div>` : ''}
    </div>`;
  const panel = chartPanel(mdState.selected.display_name || meta.indicator || mdState.selected.series_code,
    `${meta.source || ''} · ${meta.frequency || ''}${meta.unit ? ` · ${meta.unit}` : ''}${meta.currency ? ` · ${meta.currency}` : ''}`,
    [], 260);
  el.innerHTML = '';
  const head = createEl('div', { class: 'market-data-page__detail-head' });
  head.innerHTML = `
    <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:var(--s-3);margin-bottom:var(--s-4);">
      <div>
        <div style="font-size:var(--text-lg);font-weight:700;">${mdState.selected.display_name || meta.indicator || mdState.selected.series_code}</div>
        <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:2px;">${meta.source || ''} · ${meta.series_code || mdState.selected.series_code} · ${meta.frequency || ''}${meta.unit ? ` · ${meta.unit}` : ''}</div>
      </div>
      <div style="display:flex;gap:var(--s-5);text-align:right;">
        ${stat('Current', last.value, last.period)}
        ${stat('High', high, '')}
        ${stat('Low', low, '')}
      </div>
    </div>`;
  el.appendChild(head);
  const rangeRow = createEl('div', { class: 'market-data-page__range', style: { display: 'flex', gap: 'var(--s-2)', alignItems: 'center', marginBottom: 'var(--s-3)' } });
  rangeRow.innerHTML = `<span style="color:var(--c-text-3);font-size:var(--text-xs);">Chart range:</span>` + ['1y', '5y', 'all'].map((v) => `
    <button type="button" class="btn btn--sm market-data-page__chip ${mdState.chartRange === v ? 'market-data-page__chip--active' : ''}" data-range="${v}">${v === '1y' ? '1Y' : v === '5y' ? '5Y' : 'All'}</button>`).join('');
  rangeRow.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => {
    mdState.chartRange = b.dataset.range;
    renderDetail();
    mountChart();
  }));
  el.appendChild(rangeRow);
  el.appendChild(panel);
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

  const series = createEl('div', { class: 'market-data-page__series', style: { marginBottom: 'var(--s-5)' } });
  page.appendChild(series);

  const detail = createEl('div', { class: 'market-data-page__detail' });
  page.appendChild(detail);

  mdRootEl = page;
  mdRefs = { head, tabs, series, detail };

  renderHeader();
  renderTabs();
  renderDetail();
  loadStatus();
  loadSeries(true);
  selectSeries(PRIORITY.commodity);

  page._cleanup = () => {
    cleanup();
    mdRootEl = null;
    mdRefs = {};
  };

  return page;
}
