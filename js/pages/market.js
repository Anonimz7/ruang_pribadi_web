/* pages/market.js — Market Overview (Anti-Slop, ApexCharts) */
import { $, on, createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';
import Api from '../core/api.js';
import { toast } from '../ui/toast.js';
import { StockSectorBadge, sectorColor } from '../ui/stock-widgets.js';
import { loadApexCharts, buildBaseOptions, renderChart, destroyChart, normalizeDate } from '../ui/chart.js';

/* ─── Helpers ─── */
function fmtPrice(v) {
  if (v == null) return '-';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(v);
}

function fmtS(v) {
  if (v == null) return '-';
  const n = Number(v), s = n < 0 ? '-' : '', a = Math.abs(n);
  if (a >= 1e12) return s + (a / 1e12).toFixed(1) + 'T';
  if (a >= 1e9) return s + (a / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return s + (a / 1e6).toFixed(1) + 'M';
  return s + a.toFixed(0);
}

function compact(v) {
  if (v == null) return '-';
  const n = Number(v), s = n < 0 ? '-' : '', a = Math.abs(n);
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

/* ─── ApexCharts helpers ─── */
function toTs(dateStr) {
  const d = new Date(normalizeDate(dateStr));
  return isNaN(d) ? 0 : d.getTime();
}

function buildLineChartApex(container, data, color) {
  const opts = buildBaseOptions({ height: 210, type: 'line' });
  opts.colors = [color];
  opts.stroke.width = 2.5;
  opts.series = [{
    name: 'Value',
    data: data.filter(d => d.date && d.close != null).map(d => ({ x: toTs(d.date), y: d.close })),
  }];
  return renderChart(container, opts);
}

function buildBarChartApex(container, data, color) {
  const opts = buildBaseOptions({ height: 200, type: 'bar' });
  opts.colors = [color];
  opts.plotOptions = { bar: { columnWidth: '60%', borderRadius: 2, borderRadiusApplication: 'end' } };
  opts.series = [{
    name: 'Value',
    data: data.filter(d => d.date && d.value != null).map(d => ({ x: toTs(d.date), y: d.value })),
  }];
  return renderChart(container, opts);
}

function buildForeignMarketChartApex(container, data) {
  const opts = buildBaseOptions({ height: 210, type: 'bar' });
  opts.plotOptions = {
    bar: {
      columnWidth: '55%',
      borderRadius: 0,
      colors: {
        ranges: [
          { from: -Infinity, to: -0.0001, color: '#D94B4B' },
          { from: 0, to: Infinity, color: '#00A86B' },
        ],
      },
    },
  };
  opts.series = [{
    name: 'Net Foreign',
    data: data.filter(d => d.date && d.net_foreign != null).map(d => ({ x: toTs(d.date), y: d.net_foreign })),
  }];
  opts.tooltip.y = { formatter: (v) => (v >= 0 ? '+' : '') + fmtS(v) };
  return renderChart(container, opts);
}

function buildEwiMciChartApex(container, ewiData, mciData) {
  const opts = buildBaseOptions({ height: 270, type: 'line' });
  opts.colors = ['#00A86B', '#F2B705'];
  opts.stroke.width = [2.5, 2.5];
  opts.series = [
    {
      name: 'EWI',
      data: ewiData.filter(d => d.date && d.close != null).map(d => ({ x: toTs(d.date), y: d.close })),
    },
    {
      name: 'MCI',
      data: mciData.filter(d => d.date && d.close != null).map(d => ({ x: toTs(d.date), y: d.close })),
    },
  ];
  return renderChart(container, opts);
}

/* ─── State ─── */
const state = {
  days: 30, loading: false, data: null, charts: [],
};

/* ─── API ─── */
async function loadMarket() {
  state.loading = true;
  renderLoading();
  try {
    const res = await Api.get('/idx/market/summary', { days: state.days });
    state.data = res?.data || res;
    state.loading = false;
    renderMarket();
  } catch (e) {
    state.loading = false;
    toast('Gagal memuat data pasar: ' + (e.message || e), 'danger');
    renderLoading();
  }
}

/* ─── DOM ─── */
let rootEl = null;
let refs = {};

function clearCharts() {
  state.charts.forEach(c => destroyChart(c));
  state.charts = [];
}

/* ─── Render: Header ─── */
function renderHeader() {
  const header = createEl('div', { style: { marginBottom: 'var(--s-5)' } });
  header.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--s-3);">
      <div>
        <h1 style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--s-1);">Ringkasan Pasar</h1>
        <p style="color:var(--c-text-2);font-size:var(--text-sm);">Analisis pasar saham Indonesia.</p>
      </div>
      <div style="display:flex;gap:var(--s-2);">
        <button class="btn btn--secondary btn--sm" id="market-refresh" aria-label="Refresh">${icons['refresh']} <span>Refresh</span></button>
        <a href="#/stocks" class="btn btn--ghost btn--sm">${icons['trending-up']} <span>Analisis</span></a>
      </div>
    </div>
  `;
  on(header.querySelector('#market-refresh'), 'click', loadMarket);
  rootEl.appendChild(header);
}

/* ─── Render: Loading ─── */
function renderLoading() {
  let el = refs.content;
  if (!el) {
    el = createEl('div', { class: 'market-page__content' });
    refs.content = el;
    rootEl.appendChild(el);
  }
  el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;">
    <div class="spinner" style="width:32px;height:32px;border:3px solid var(--c-border);border-top-color:var(--c-primary);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto var(--s-3);"></div>
    <div style="font-size:var(--text-sm);color:var(--c-text-2);">Memuat data pasar...</div>
  </div>`;
  clearCharts();
}

/* ─── Render: Market ─── */
function renderMarket() {
  let el = refs.content;
  if (!el) {
    el = createEl('div', { class: 'market-page__content' });
    refs.content = el;
    rootEl.appendChild(el);
  }

  if (!state.data) {
    el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;">
      <div style="font-size:var(--text-sm);color:var(--c-text-3);">Data pasar tidak tersedia</div>
    </div>`;
    return;
  }

  const d = state.data;
  // Backend returns { period_days, radar: { data: [], summary: {} }, top_accumulation, top_distribution, top_domination }
  const radar = d.radar || {};
  const radarData = radar.data || [];
  // Extract EWI & MCI series from radar data (each data point has ewi & mci fields when include_market_indexes=true)
  const ewi = radarData.map(point => ({ date: point.date, close: point.ewi, change: point.change || 0 }));
  const mci = radarData.map(point => ({ date: point.date, close: point.mci, change: point.change || 0 }));
  const marketData = radarData;
  const topAcc = d.top_accumulation || [];
  const topDist = d.top_distribution || [];
  const topDom = d.top_domination || [];
  const radarSummary = radar.summary || {};

  el.innerHTML = '';

  // ── KPI Tiles ──
  const kpiWrap = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginBottom: 'var(--s-5)' } });
  const latestEwi = ewi.length ? ewi[ewi.length - 1] : null;
  const latestMci = mci.length ? mci[mci.length - 1] : null;
  const ewiChange = radarSummary.ewi_change_pct || 0;
  const mciChange = 0;

  kpiWrap.innerHTML = `
    ${kpiTile('EWI (IDX Energy Weighted)', latestEwi ? fmtPrice(latestEwi.close) : '-', ewiChange, '#00A86B')}
    ${kpiTile('MCI (IDX Mining Composite)', latestMci ? fmtPrice(latestMci.close) : '-', mciChange, '#F2B705')}
    ${kpiTile('Total Value', radarSummary.total_reg_value ? fmtS(radarSummary.total_reg_value) : '-', 0, '#F6903D')}
    ${kpiTile('Total Volume', marketData.length ? fmtS(marketData.reduce((sum, p) => sum + (p.volume || 0), 0)) : '-', 0, '#6DC8EC')}
    ${kpiTile('Foreign Net', radarSummary.total_net_foreign ? fmtS(radarSummary.total_net_foreign) : '-', radarSummary.total_net_foreign || 0, '#00A86B')}
    ${kpiTile('Avg BII', marketData.length ? marketData[marketData.length - 1].bii_score.toFixed(1) : '-', 0, '#7B61FF')}
  `;
  el.appendChild(kpiWrap);

  // ── EWI vs MCI Chart ──
  if (ewi.length && mci.length) {
    const panel = chartPanel('EWI vs MCI', 'Indeks energi terhadap indeks pertambangan', [
      { label: 'EWI', color: '#00A86B' }, { label: 'MCI', color: '#F2B705' }
    ], 270);
    el.appendChild(panel);
  }

  // ── Market Charts ──
  if (marketData.length) {
    el.appendChild(chartPanel('Total Nilai Transaksi Pasar', 'Keseluruhan nilai transaksi harian', [{ label: 'Nilai', color: '#F6903D' }], 200));
    el.appendChild(chartPanel('Frekuensi Transaksi Pasar', 'Jumlah transaksi harian', [{ label: 'Frekuensi', color: '#5B8FF9' }], 200));
    el.appendChild(chartPanel('ATV Pasar', 'Ukuran transaksi rata-rata pasar', [{ label: 'ATV', color: '#9270CA' }], 200));
    el.appendChild(chartPanel('Arus Dana Asing Pasar', 'Net foreign buy/sell keseluruhan pasar', [{ label: 'Beli', color: '#00A86B' }, { label: 'Jual', color: '#D94B4B' }], 210));
    el.appendChild(chartPanel('BII Score Pasar', 'Skor akumulasi pasar', [{ label: 'BII', color: '#7B61FF' }], 210));
    el.appendChild(chartPanel('Nilai Nego Pasar', 'Transaksi non-regular pasar', [{ label: 'Nego Value', color: '#F6C022' }], 200));
    el.appendChild(chartPanel('Frekuensi Nego Pasar', 'Transaksi negosiasi pasar', [{ label: 'Nego Freq', color: '#90A4AE' }], 180));
  }

  // ── Tables ──
  if (topAcc.length) el.appendChild(buildTable('TOP ACCUMULATION', ['Ticker', 'Company', 'Net Foreign'], topAcc.map(r => ({
    ticker: r.ticker, company: r.company_name, netForeign: r.net_flow_val
  }))));

  if (topDist.length) el.appendChild(buildTable('TOP DISTRIBUTION', ['Ticker', 'Company', 'Net Foreign'], topDist.map(r => ({
    ticker: r.ticker, company: r.company_name, netForeign: r.net_flow_val
  }))));

  if (topDom.length) el.appendChild(buildTable('TOP 10 FOREIGN DOMINATION', ['Ticker', 'Company', 'Dom %'], topDom.map(r => ({
    ticker: r.ticker, company: r.company_name, dom: r.dom_pct
  }))));

  // Build market summary KPIs from radar summary
  const summaryKpi = [];
  if (radarSummary.total_reg_value != null) summaryKpi.push({ metric: 'Total Regular Value', value: fmtS(radarSummary.total_reg_value) });
  if (radarSummary.total_nego_value != null) summaryKpi.push({ metric: 'Total Nego Value', value: fmtS(radarSummary.total_nego_value) });
  if (radarSummary.total_net_foreign != null) summaryKpi.push({ metric: 'Total Net Foreign', value: fmtS(radarSummary.total_net_foreign) });
  if (radarSummary.ewi_latest != null) summaryKpi.push({ metric: 'EWI Latest', value: fmtPrice(radarSummary.ewi_latest) });
  if (radarSummary.mci_latest != null) summaryKpi.push({ metric: 'MCI Latest', value: fmtPrice(radarSummary.mci_latest) });

  if (summaryKpi.length) el.appendChild(buildTable('MARKET SUMMARY KPIs', ['Metric', 'Value'], summaryKpi));

  // Mount charts
  requestAnimationFrame(() => mountMarketCharts(ewi, mci, marketData));
}

function kpiTile(label, value, change, color) {
  const chgSign = change >= 0 ? '+' : '';
  const chgColor = change >= 0 ? 'var(--c-accent)' : 'var(--c-danger)';
  return `<div style="flex:1 1 140px;min-width:140px;padding:var(--s-3);background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);">
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-bottom:var(--s-1);">${label}</div>
    <div style="font-size:var(--text-lg);font-weight:700;color:${color};">${value}</div>
    ${change !== 0 ? `<div style="font-size:var(--text-xs);color:${chgColor};font-weight:500;">${chgSign}${Number(change).toFixed(1)}%</div>` : ''}
  </div>`;
}

function chartPanel(title, subtitle, legend, height) {
  const panel = createEl('div', { class: 'market-page__chart-panel', style: { marginBottom: 'var(--s-6)' } });
  const legendHtml = legend.map(l => `
    <span style="display:inline-flex;align-items:center;gap:4px;font-size:var(--text-xs);color:var(--c-text-3);">
      <span style="width:8px;height:8px;border-radius:50%;background:${l.color};display:inline-block;"></span>${l.label}
    </span>
  `).join('');
  panel.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--s-3);flex-wrap:wrap;margin-bottom:var(--s-3);">
      <div><div style="font-size:var(--text-md);font-weight:700;">${title}</div>
      <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:2px;">${subtitle}</div></div>
      <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;">${legendHtml}</div>
    </div>
    <div class="market-page__chart" style="height:${height}px;width:100%;" data-chart-type="${title}"></div>
  `;
  return panel;
}

async function mountMarketCharts(ewi, mci, marketData) {
  clearCharts();
  if (!marketData.length) return;
  try {
    await loadApexCharts();
  } catch (e) {
    console.error('[Market] Failed to load chart library:', e);
    rootEl.querySelectorAll('.market-page__chart').forEach(c => {
      c.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-3);font-size:var(--text-sm);">
        <span style="margin-right:var(--s-2);">${icons['alert-circle']}</span> Gagal memuat chart library
      </div>`;
    });
    return;
  }

  const containers = rootEl.querySelectorAll('.market-page__chart');
  containers.forEach(container => {
    const type = container.dataset.chartType;
    let chart;
    try {
      if (type === 'EWI vs MCI') chart = buildEwiMciChartApex(container, ewi, mci);
      else if (type === 'Total Nilai Transaksi Pasar') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.value })), '#F6903D');
      else if (type === 'Frekuensi Transaksi Pasar') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.frequency })), '#5B8FF9');
      else if (type === 'ATV Pasar') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.atv })), '#9270CA');
      else if (type === 'Arus Dana Asing Pasar') chart = buildForeignMarketChartApex(container, marketData);
      else if (type === 'BII Score Pasar') chart = buildLineChartApex(container, marketData.map(d => ({ date: d.date, close: d.bii_score })), '#7B61FF');
      else if (type === 'Nilai Nego Pasar') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.non_reg_value })), '#F6C022');
      else if (type === 'Frekuensi Nego Pasar') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.non_reg_freq })), '#90A4AE');
      if (chart) state.charts.push(chart);
    } catch (e) {
      console.error(`[Market] Chart "${type}" failed:`, e);
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-3);font-size:var(--text-sm);">
        <span style="margin-right:var(--s-2);">${icons['alert-circle']}</span> Chart error
      </div>`;
    }
  });
}

function buildTable(title, headers, rows) {
  const wrap = createEl('div', { style: { marginBottom: 'var(--s-6)' } });
  wrap.innerHTML = `
    <div style="font-size:var(--text-md);font-weight:700;margin-bottom:var(--s-3);">${title}</div>
    <div style="overflow-x:auto;">
      <table class="table">
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            ${Object.values(r).map((v, i) => {
              if (i === 0 && typeof v === 'string' && v.length <= 5) {
                return `<td style="font-weight:600;font-size:var(--text-sm);"><a href="#/stocks" style="color:var(--c-primary);" onclick="localStorage.setItem('stocks_initial_ticker','${v}')">${v}</a></td>`;
              }
              if (typeof v === 'number' && Math.abs(v) >= 1e6) return `<td style="font-size:var(--text-sm);">${fmtS(v)}</td>`;
              if (typeof v === 'number') return `<td style="font-size:var(--text-sm);">${v.toFixed(1)}</td>`;
              return `<td style="font-size:var(--text-sm);">${v || '-'}</td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
  return wrap;
}

/* ─── Cleanup ─── */
function cleanup() {
  clearCharts();
  rootEl = null; refs = {};
}

/* ─── Export render ─── */
export function render() {
  state.days = 30; state.loading = false; state.data = null; state.charts = [];
  rootEl = createEl('div', { class: 'market-page', style: { maxWidth: '900px', margin: '0 auto', padding: 'var(--s-4)' } });
  refs = {};

  if (!document.getElementById('market-page-keyframes')) {
    const style = createEl('style', { id: 'market-page-keyframes' });
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  renderHeader();
  renderLoading();
  loadMarket();

  rootEl._cleanup = cleanup;
  return rootEl;
}
