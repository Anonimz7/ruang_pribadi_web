/* pages/market.js — Market Overview (Anti-Slop, Dart-parity) */
import { $, on, createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';
import Api from '../core/api.js';
import { toast } from '../ui/toast.js';
import { StockSectorBadge, sectorColor } from '../ui/stock-widgets.js';

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
    text: isDark ? '#a3a3a3' : '#616161',
    grid: isDark ? '#2a2a2a' : '#e0e0e0',
    border: isDark ? '#404040' : '#bdbdbd',
  };
}

function makeChartOptions(container, height) {
  const t = getChartTheme();
  return {
    width: container.clientWidth, height,
    layout: { background: { type: 'solid', color: 'transparent' }, textColor: t.text },
    grid: { vertLines: { visible: false }, horzLines: { color: t.grid } },
    rightPriceScale: { borderColor: t.border },
    timeScale: { borderColor: t.border, timeVisible: false },
    crosshair: { mode: 0 },
    handleScroll: { vertTouchDrag: false },
    handleScale: { axisPressedMouseMove: false },
  };
}

/* ─── Chart builders ─── */
function buildLineChart(container, data, color, lwc) {
  const chart = lwc.createChart(container, makeChartOptions(container, 210));
  const series = chart.addSeries(lwc.LineSeries, {
    color, lineWidth: 2.5, priceLineVisible: false, lastValueVisible: false,
  });
  series.setData(data.map(d => ({ time: d.date, value: d.close })));
  chart.timeScale().fitContent();
  return chart;
}

function buildBarChart(container, data, color, lwc) {
  const chart = lwc.createChart(container, makeChartOptions(container, 200));
  const series = chart.addSeries(lwc.HistogramSeries, {
    color, priceLineVisible: false, lastValueVisible: false,
  });
  series.setData(data.map(d => ({ time: d.date, value: d.value })));
  chart.timeScale().fitContent();
  return chart;
}

function buildForeignMarketChart(container, data, lwc) {
  const chart = lwc.createChart(container, makeChartOptions(container, 210));
  const buyData = data.filter(d => d.netForeign >= 0).map(d => ({ time: d.date, value: d.netForeign }));
  const sellData = data.filter(d => d.netForeign < 0).map(d => ({ time: d.date, value: Math.abs(d.netForeign) }));
  if (buyData.length) {
    const s = chart.addSeries(lwc.HistogramSeries, { color: '#00A86B', priceLineVisible: false, lastValueVisible: false });
    s.setData(buyData);
  }
  if (sellData.length) {
    const s = chart.addSeries(lwc.HistogramSeries, { color: '#D94B4B', priceLineVisible: false, lastValueVisible: false });
    s.setData(sellData);
  }
  chart.timeScale().fitContent();
  return chart;
}

function buildEwiMciChart(container, ewiData, mciData, lwc) {
  const chart = lwc.createChart(container, makeChartOptions(container, 270));
  const s1 = chart.addSeries(lwc.LineSeries, {
    color: '#00A86B', lineWidth: 2.5, priceLineVisible: false, lastValueVisible: false,
  });
  s1.setData(ewiData.map(d => ({ time: d.date, value: d.close })));
  const s2 = chart.addSeries(lwc.LineSeries, {
    color: '#F2B705', lineWidth: 2.5, priceLineVisible: false, lastValueVisible: false,
  });
  s2.setData(mciData.map(d => ({ time: d.date, value: d.close })));
  chart.timeScale().fitContent();
  return chart;
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
  state.charts.forEach(c => { try { c.remove(); } catch (_) {} });
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
  const ewi = d.ewi || [];
  const mci = d.mci || [];
  const marketData = d.market_data || [];
  const topAcc = d.top_accumulation || [];
  const topDist = d.top_distribution || [];
  const topDom = d.top_domination || [];
  const summaryKpi = d.summary_kpis || [];

  el.innerHTML = '';

  // ── KPI Tiles ──
  const kpiWrap = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginBottom: 'var(--s-5)' } });
  const latestEwi = ewi.length ? ewi[ewi.length - 1] : null;
  const latestMci = mci.length ? mci[mci.length - 1] : null;
  const ewiChange = latestEwi ? (latestEwi.change || 0) : 0;
  const mciChange = latestMci ? (latestMci.change || 0) : 0;

  kpiWrap.innerHTML = `
    ${kpiTile('EWI (IDX Energy Weighted)', latestEwi ? fmtPrice(latestEwi.close) : '-', ewiChange, '#00A86B')}
    ${kpiTile('MCI (IDX Mining Composite)', latestMci ? fmtPrice(latestMci.close) : '-', mciChange, '#F2B705')}
    ${kpiTile('Total Value', d.total_value ? fmtS(d.total_value) : '-', 0, '#F6903D')}
    ${kpiTile('Total Volume', d.total_volume ? fmtS(d.total_volume) : '-', 0, '#6DC8EC')}
    ${kpiTile('Foreign Net', d.total_net_foreign ? fmtS(d.total_net_foreign) : '-', d.total_net_foreign || 0, '#00A86B')}
    ${kpiTile('Avg BII', d.avg_bii ? d.avg_bii.toFixed(1) : '-', 0, '#7B61FF')}
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
  if (topAcc.length) el.appendChild(buildTable('TOP ACCUMULATION', ['Ticker', 'Company', 'Net Foreign', 'BII', 'Sector'], topAcc.map(r => ({
    ticker: r.ticker, company: r.company_name, netForeign: r.net_foreign, bii: r.bii_score, sector: r.sector
  }))));

  if (topDist.length) el.appendChild(buildTable('TOP DISTRIBUTION', ['Ticker', 'Company', 'Net Foreign', 'BII', 'Sector'], topDist.map(r => ({
    ticker: r.ticker, company: r.company_name, netForeign: r.net_foreign, bii: r.bii_score, sector: r.sector
  }))));

  if (topDom.length) el.appendChild(buildTable('TOP 10 FOREIGN DOMINATION', ['Ticker', 'Company', 'Dom %', 'Sector'], topDom.map(r => ({
    ticker: r.ticker, company: r.company_name, dom: r.domination_pct, sector: r.sector
  }))));

  if (summaryKpi.length) el.appendChild(buildTable('MARKET SUMMARY KPIs', ['Metric', 'Value'], summaryKpi.map(r => ({
    metric: r.metric, value: r.value
  }))));

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
  const lwc = await loadLWC();
  const containers = rootEl.querySelectorAll('.market-page__chart');
  containers.forEach(container => {
    const type = container.dataset.chartType;
    let chart;
    if (type === 'EWI vs MCI') chart = buildEwiMciChart(container, ewi, mci, lwc);
    else if (type === 'Total Nilai Transaksi Pasar') chart = buildBarChart(container, marketData.map(d => ({ date: d.date, value: d.value })), '#F6903D', lwc);
    else if (type === 'Frekuensi Transaksi Pasar') chart = buildBarChart(container, marketData.map(d => ({ date: d.date, value: d.frequency })), '#5B8FF9', lwc);
    else if (type === 'ATV Pasar') chart = buildBarChart(container, marketData.map(d => ({ date: d.date, value: d.atv })), '#9270CA', lwc);
    else if (type === 'Arus Dana Asing Pasar') chart = buildForeignMarketChart(container, marketData, lwc);
    else if (type === 'BII Score Pasar') chart = buildLineChart(container, marketData.map(d => ({ date: d.date, close: d.bii_score })), '#7B61FF', lwc);
    else if (type === 'Nilai Nego Pasar') chart = buildBarChart(container, marketData.map(d => ({ date: d.date, value: d.non_reg_value })), '#F6C022', lwc);
    else if (type === 'Frekuensi Nego Pasar') chart = buildBarChart(container, marketData.map(d => ({ date: d.date, value: d.non_reg_freq })), '#90A4AE', lwc);
    if (chart) state.charts.push(chart);
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
