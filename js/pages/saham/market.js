/* pages/market.js — Market Overview (Anti-Slop, ApexCharts) */
import { $, on, createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { StockSectorBadge, sectorColor } from '../../ui/stock-widgets.js';
import { loadApexCharts, buildBaseOptions, renderChart, destroyChart, normalizeDate, toTs, buildLineChartApex, buildBarChartApex, createChartPanel } from '../../ui/chart.js';
const chartPanel = createChartPanel('market-page');
import { fmtPrice, formatNilaiSingkat, dateLabel } from '../../utils/format.js';
import { spinnerCardHtml } from '../../ui/loading.js';

/* ─── Helpers ─── */

/* ─── ApexCharts helpers ─── */

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
  opts.tooltip.y = { formatter: (v) => (v >= 0 ? '+' : '') + formatNilaiSingkat(v) };
  return renderChart(container, opts);
}

function buildAspMwiChartApex(container, aspData, mwiData) {
  const opts = buildBaseOptions({ height: 270, type: 'line' });
  opts.colors = ['#00A86B', '#F2B705'];
  opts.stroke.width = [2.5, 2.5];
  opts.series = [
    {
      name: 'ASP',
      data: aspData.filter(d => d.date && d.close != null).map(d => ({ x: toTs(d.date), y: d.close })),
    },
    {
      name: 'MWI',
      data: mwiData.filter(d => d.date && d.close != null).map(d => ({ x: toTs(d.date), y: d.close })),
    },
  ];
  return renderChart(container, opts);
}

/* ─── Constants ─── */
const PERIODS = [30, 60, 90, 180, 365];

/* ─── State ─── */
const marketState = {
  days: 30, loading: false, data: null, charts: [],
};

/* ─── API ─── */
async function loadMarket() {
  marketState.loading = true;
  renderLoading();
  try {
    const [res, daily, tfo] = await Promise.all([
      Api.get('/idx/market/summary', { days: marketState.days }),
      Api.get('/idx/market/top-foreign-flow', { days: 1 }).catch(() => null),
      Api.get('/idx/market/top-foreign-ownership').catch(() => null),
    ]);
    marketState.data = res?.data || res;
    const tf = tfo?.data || tfo;
    if (tf) marketState.data.top_foreign_own = tf;
    const dd = daily?.data || daily;
    if (dd) {
      marketState.data.top_daily_acc = dd.accumulation || [];
      marketState.data.top_daily_dist = dd.distribution || [];
    }
    marketState.loading = false;
    renderMarket();
  } catch (e) {
    marketState.loading = false;
    toast('Gagal memuat data pasar: ' + (e.message || e), 'danger');
    renderLoading();
  }
}

/* ─── DOM ─── */
let marketRootEl = null;
let marketRefs = {};

function clearCharts() {
  marketState.charts.forEach(c => destroyChart(c));
  marketState.charts = [];
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
        <a href="#/saham/stocks" class="btn btn--ghost btn--sm">${icons['trending-up']} <span>Analisis</span></a>
      </div>
    </div>
  `;
  on(header.querySelector('#market-refresh'), 'click', loadMarket);
  marketRootEl.appendChild(header);
}

function renderPeriodChips() {
  let el = marketRefs.periodChips;
  if (!el) {
    el = createEl('div', {
      style: {
        display: 'flex', gap: 'var(--s-1)', flexWrap: 'wrap',
        marginTop: 'var(--s-3)', marginBottom: 'var(--s-4)',
      }
    });
    marketRefs.periodChips = el;
    marketRootEl.appendChild(el);
  }
  el.innerHTML = '';
  PERIODS.forEach(d => {
    const chip = createEl('button', {
      class: `btn btn--sm ${marketState.days === d ? 'btn--primary' : 'btn--secondary'}`,
      style: {
        padding: 'var(--s-1) var(--s-3)', fontSize: 'var(--text-xs)', fontWeight: 600,
        borderRadius: '16px',
      }
    });
    chip.textContent = d + 'H';
    on(chip, 'click', () => {
      if (marketState.days === d) return;
      marketState.days = d;
      renderPeriodChips();
      loadMarket();
    });
    el.appendChild(chip);
  });
}

/* ─── Render: Loading ─── */
function renderLoading() {
  let el = marketRefs.content;
  if (!el) {
    el = createEl('div', { class: 'market-page__content' });
    marketRefs.content = el;
    marketRootEl.appendChild(el);
  }
  el.innerHTML = spinnerCardHtml('Memuat data pasar...');
  clearCharts();
}

/* ─── Render: Market ─── */
function renderMarket() {
  let el = marketRefs.content;
  if (!el) {
    el = createEl('div', { class: 'market-page__content' });
    marketRefs.content = el;
    marketRootEl.appendChild(el);
  }

  if (!marketState.data) {
    el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;">
      <div style="font-size:var(--text-sm);color:var(--c-text-3);">Data pasar tidak tersedia</div>
    </div>`;
    return;
  }

  const d = marketState.data;
  // Backend returns { period_days, radar: { data: [], summary: {} }, top_accumulation, top_distribution } + top_foreign_own (endpoint tersendiri)
  const radar = d.radar || {};
  const radarData = radar.data || [];
  // Extract ASP & MWI series from radar data (each data point has asp & mwi fields when include_market_indexes=true)
  const asp = radarData.map(point => ({ date: point.date, close: point.asp }));
  const mwi = radarData.map(point => ({ date: point.date, close: point.mwi }));
  const marketData = radarData;
  const topAcc = d.top_accumulation || [];
  const topDist = d.top_distribution || [];
  const topForeignOwn = (d.top_foreign_own && d.top_foreign_own.items) || [];
  const topDailyAcc = d.top_daily_acc || [];
  const topDailyDist = d.top_daily_dist || [];
  const latestDate = marketData.length ? marketData[marketData.length - 1].date : null;
  const radarSummary = radar.summary || {};

  el.innerHTML = '';

  // ── KPI Tiles ──
  const kpiWrap = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginBottom: 'var(--s-5)' } });
  const latestAsp = asp.length ? asp[asp.length - 1] : null;
  const latestMwi = mwi.length ? mwi[mwi.length - 1] : null;
  const aspChange = radarSummary.asp_change_pct || 0;
  const mwiChange = radarSummary.mwi_change_pct || 0;

  kpiWrap.innerHTML = `
    ${kpiTile('ASP (Average Stock Price) · base 100', latestAsp ? fmtPrice(latestAsp.close) : '-', aspChange, '#00A86B')}
    ${kpiTile('MWI (Market-cap Weighted Index) · base 100', latestMwi ? fmtPrice(latestMwi.close) : '-', mwiChange, '#F2B705')}
    ${kpiTile('Total Value', radarSummary.total_reg_value ? formatNilaiSingkat(radarSummary.total_reg_value) : '-', 0, '#F6903D')}
    ${kpiTile('Total Volume', marketData.length ? formatNilaiSingkat(marketData.reduce((sum, p) => sum + (p.volume || 0), 0)) : '-', 0, '#6DC8EC')}
    ${kpiTile('Foreign Net', radarSummary.total_net_foreign ? formatNilaiSingkat(radarSummary.total_net_foreign) : '-', 0, radarSummary.total_net_foreign >= 0 ? '#00A86B' : '#D94B4B')}
    ${kpiTile('Avg BII', marketData.length ? marketData[marketData.length - 1].bii_score.toFixed(1) : '-', 0, '#7B61FF')}
  `;
  el.appendChild(kpiWrap);

  // ── ASP vs MWI Chart ──
  if (asp.length && mwi.length) {
    const panel = chartPanel('ASP vs MWI', 'Rata-rata harga pasar terhadap kapitalisasi pasar tertimbang (base 100)', [
      { label: 'ASP', color: '#00A86B' }, { label: 'MWI', color: '#F2B705' }
    ], 270);
    el.appendChild(panel);
  }

  // ── Market Charts ──
  if (marketData.length) {
    el.appendChild(chartPanel('Total Nilai Transaksi Pasar', 'Keseluruhan nilai transaksi harian', [{ label: 'Nilai', color: '#F6903D' }], 200));
    el.appendChild(chartPanel('Frekuensi Transaksi Pasar', 'Jumlah transaksi harian', [{ label: 'Frekuensi', color: '#5B8FF9' }], 200));
    el.appendChild(chartPanel('ATV Pasar', 'Ukuran transaksi rata-rata pasar', [{ label: 'ATV', color: '#9270CA' }], 200));
    el.appendChild(chartPanel('Arus Dana Asing Pasar', 'Net foreign buy/sell keseluruhan pasar', [{ label: 'Beli', color: '#00A86B' }, { label: 'Jual', color: '#D94B4B' }], 210));
    // ── Top 10 Net Foreign harian terakhir (breakdown bar terakhir chart di atas) ──
    if (topDailyAcc.length || topDailyDist.length) el.appendChild(buildDailyFlowSection(topDailyAcc, topDailyDist, latestDate));
    el.appendChild(chartPanel('BII Score Pasar', 'Skor akumulasi pasar', [{ label: 'BII', color: '#7B61FF' }], 210));
    el.appendChild(chartPanel('Nilai Nego Pasar', 'Transaksi non-regular pasar', [{ label: 'Nego Value', color: '#F6C022' }], 200));
    el.appendChild(chartPanel('Frekuensi Nego Pasar', 'Transaksi negosiasi pasar', [{ label: 'Nego Freq', color: '#90A4AE' }], 180));
  }

  // ── Tables ──
  const fundHeaders = ['Ticker', 'Company', 'Net Foreign', 'ROE', 'Laba YoY', 'PER', 'Kualitas'];
  const fundRow = r => ({
    ticker: r.ticker, company: r.company_name, netForeign: r.net_flow_val,
    roe: fmtPctFrac(r.roe), profitYoy: fmtSignedPctFrac(r.profit_yoy),
    per: fmtPer(r.per), quality: qualityChip(r.quality)
  });
  if (topAcc.length) el.appendChild(buildTable('TOP ACCUMULATION', fundHeaders, topAcc.map(fundRow)));

  if (topDist.length) el.appendChild(buildTable('TOP DISTRIBUTION', fundHeaders, topDist.map(fundRow)));

  if (topAcc.length || topDist.length) {
    const note = createEl('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'calc(var(--s-6) * -1 + var(--s-2))', marginBottom: 'var(--s-6)' } });
    note.textContent = 'ROE, Laba YoY & PER berbasis laporan keuangan terakhir per emiten (TTM bila lengkap). Kualitas: Sehat / Waspada (laba turun >20%) / Bermasalah (rugi / EPS negatif / ekuitas negatif).';
    el.appendChild(note);
  }

  if (topForeignOwn.length) el.appendChild(buildTable('TOP 10 FOREIGN OWNERSHIP', ['Ticker', 'Company', 'Nilai Asing', '% Saham'], topForeignOwn.map(r => ({
    ticker: r.ticker, company: r.company_name, nilaiAsing: r.foreign_value,
    pct: r.foreign_pct_total != null ? r.foreign_pct_total.toFixed(1) + '%' : '-'
  }))));

  // Build market summary KPIs from radar summary
  const summaryKpi = [];
  if (radarSummary.total_reg_value != null) summaryKpi.push({ metric: 'Total Regular Value', value: formatNilaiSingkat(radarSummary.total_reg_value) });
  if (radarSummary.total_nego_value != null) summaryKpi.push({ metric: 'Total Nego Value', value: formatNilaiSingkat(radarSummary.total_nego_value) });
  if (radarSummary.total_net_foreign != null) summaryKpi.push({ metric: 'Total Net Foreign', value: formatNilaiSingkat(radarSummary.total_net_foreign) });
  if (radarSummary.asp_latest != null) summaryKpi.push({ metric: 'ASP Latest (base 100)', value: fmtPrice(radarSummary.asp_latest) });
  if (radarSummary.mwi_latest != null) summaryKpi.push({ metric: 'MWI Latest (base 100)', value: fmtPrice(radarSummary.mwi_latest) });

  if (summaryKpi.length) el.appendChild(buildTable('MARKET SUMMARY KPIs', ['Metric', 'Value'], summaryKpi));

  // Mount charts
  requestAnimationFrame(() => mountMarketCharts(asp, mwi, marketData));
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

async function mountMarketCharts(asp, mwi, marketData) {
  clearCharts();
  if (!marketData.length) return;
  try {
    await loadApexCharts();
  } catch (e) {
    console.error('[Market] Failed to load chart library:', e);
    marketRootEl.querySelectorAll('.market-page__chart').forEach(c => {
      c.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-3);font-size:var(--text-sm);">
        <span style="margin-right:var(--s-2);">${icons['alert-circle']}</span> Gagal memuat chart library
      </div>`;
    });
    return;
  }

  const containers = marketRootEl.querySelectorAll('.market-page__chart');
  containers.forEach(container => {
    const type = container.dataset.chartType;
    let chart;
    try {
      if (type === 'ASP vs MWI') chart = buildAspMwiChartApex(container, asp, mwi);
      else if (type === 'Total Nilai Transaksi Pasar') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.value })), '#F6903D');
      else if (type === 'Frekuensi Transaksi Pasar') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.frequency })), '#5B8FF9');
      else if (type === 'ATV Pasar') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.atv })), '#9270CA');
      else if (type === 'Arus Dana Asing Pasar') chart = buildForeignMarketChartApex(container, marketData);
      else if (type === 'BII Score Pasar') chart = buildLineChartApex(container, marketData.map(d => ({ date: d.date, close: d.bii_score })), '#7B61FF');
      else if (type === 'Nilai Nego Pasar') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.non_reg_value })), '#F6C022');
      else if (type === 'Frekuensi Nego Pasar') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.non_reg_freq })), '#90A4AE');
      if (chart) marketState.charts.push(chart);
    } catch (e) {
      console.error(`[Market] Chart "${type}" failed:`, e);
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-3);font-size:var(--text-sm);">
        <span style="margin-right:var(--s-2);">${icons['alert-circle']}</span> Chart error
      </div>`;
    }
  });
}

function buildDailyFlowSection(acc, dist, dateStr) {
  const dl = dateStr ? dateLabel(dateStr) : '-';
  const tabelPeringkatHtml = (title, rows, color) => `
    <div style="flex:1 1 0;min-width:280px;">
      <div style="font-size:var(--text-sm);font-weight:700;margin-bottom:var(--s-2);color:${color};">${title}</div>
      <div style="overflow-x:auto;">
        <table class="table">
          <thead><tr><th>Ticker</th><th>Company</th><th style="text-align:right;">Net Foreign</th></tr></thead>
          <tbody>
            ${rows.map(r => `<tr>
              <td style="font-weight:600;font-size:var(--text-sm);"><a href="#/saham/stocks" style="color:var(--c-primary);" onclick="localStorage.setItem('stocks_initial_ticker','${r.ticker}')">${r.ticker}</a></td>
              <td style="font-size:var(--text-sm);">${r.company_name || '-'}</td>
              <td style="font-size:var(--text-sm);text-align:right;color:${color};font-weight:600;">${formatNilaiSingkat(r.net_flow_val)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  const wrap = createEl('div', { style: { marginBottom: 'var(--s-6)' } });
  wrap.innerHTML = `
    <div style="font-size:var(--text-md);font-weight:700;">TOP NET FOREIGN HARIAN</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin:2px 0 var(--s-3);">10 saham dengan net foreign terbesar &middot; ${dl} &middot; 1 hari terakhir</div>
    <div style="display:flex;gap:var(--s-4);flex-wrap:wrap;">
      ${tabelPeringkatHtml('TOP NET BUY', acc, '#00A86B')}
      ${tabelPeringkatHtml('TOP NET SELL', dist, '#D94B4B')}
    </div>`;
  return wrap;
}

function fmtPctFrac(v) { return v == null ? '-' : (v * 100).toFixed(1) + '%'; }
function fmtSignedPctFrac(v) { return v == null ? '-' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%'; }
function fmtPer(v) { return v == null ? '-' : v.toFixed(1) + '×'; }
function qualityChip(q) {
  if (q === 'sehat') return '<span style="color:#00A86B;font-weight:600;">● Sehat</span>';
  if (q === 'waspada') return '<span style="color:#E8A33D;font-weight:600;">● Waspada</span>';
  if (q === 'bermasalah') return '<span style="color:#D94B4B;font-weight:600;">● Bermasalah</span>';
  return 'belum lapor';
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
                return `<td style="font-weight:600;font-size:var(--text-sm);"><a href="#/saham/stocks" style="color:var(--c-primary);" onclick="localStorage.setItem('stocks_initial_ticker','${v}')">${v}</a></td>`;
              }
              if (typeof v === 'number' && Math.abs(v) >= 1e6) return `<td style="font-size:var(--text-sm);">${formatNilaiSingkat(v)}</td>`;
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
  marketRootEl = null; marketRefs = {};
}

/* ─── Export render ─── */
export function render() {
  marketState.days = 30; marketState.loading = false; marketState.data = null; marketState.charts = [];
  marketRootEl = createEl('div', { class: 'market-page', style: { maxWidth: '900px', margin: '0 auto', padding: 'var(--s-4)' } });
  marketRefs = {};

  if (!document.getElementById('market-page-keyframes')) {
    const style = createEl('style', { id: 'market-page-keyframes' });
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  renderHeader();
  renderPeriodChips();
  renderLoading();
  loadMarket();

  marketRootEl._cleanup = cleanup;
  return marketRootEl;
}
