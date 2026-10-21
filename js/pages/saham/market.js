/* pages/market.js — Market Overview (Anti-Slop, ApexCharts) */
import { $, on, createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { StockSectorBadge, sectorColor } from '../../ui/stock-widgets.js';
import { loadApexCharts, buildBaseOptions, renderChart, destroyChart, normalizeDate, toTs, buildLineChartApex, buildBarChartApex, buildPositionChartApex, createChartPanel } from '../../ui/chart.js';
const chartPanel = createChartPanel('market-page');
import { fmtPrice, formatNilaiSingkat, dateLabel, dateLabelYear } from '../../utils/format.js';

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

function buildMarketOwnershipChartApex(container, series) {
  const opts = buildBaseOptions({ height: 230, type: 'line' });
  opts.colors = ['#E8A33D'];
  opts.stroke.width = 2.5;
  opts.series = [{
    name: 'Nilai kepemilikan asing',
    data: series.filter(d => d.date && d.foreign_value != null).map(d => ({ x: toTs(d.date), y: d.foreign_value })),
  }];
  opts.tooltip.y = { formatter: (v) => formatNilaiSingkat(v) };
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
const decState = { mode: 'peak', data: null, loading: false };

/* ─── API ─── */
async function loadMarket() {
  marketState.loading = true;
  renderLoading();
  try {
    const [res, daily, fpos, fown, fdec] = await Promise.all([
      Api.get('/idx/market/summary', { days: marketState.days }),
      Api.get('/idx/market/top-foreign-flow', { days: 1 }).catch(() => null),
      Api.get('/idx/market/foreign-position', { bucket: marketState.days }).catch(() => null),
      Api.get('/idx/market/foreign-ownership').catch(() => null),
      Api.get('/idx/market/foreign-decomposition', { mode: 'peak' }).catch(() => null),
    ]);
    marketState.data = res?.data || res;
    const dd = daily?.data || daily;
    if (dd) {
      marketState.data.top_daily_acc = dd.accumulation || [];
      marketState.data.top_daily_dist = dd.distribution || [];
    }
    const fp = fpos?.data || fpos;
    if (fp) marketState.data.foreign_pos = fp;
    const fo = fown?.data || fown;
    if (fo) marketState.data.foreign_own = fo;
    const fd = fdec?.data || fdec;
    if (fd) { decState.data = fd; decState.mode = 'peak'; }
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
  el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;">
    <div class="spinner" style="width:32px;height:32px;border:3px solid var(--c-border);border-top-color:var(--c-primary);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto var(--s-3);"></div>
    <div style="font-size:var(--text-sm);color:var(--c-text-2);">Memuat data pasar...</div>
  </div>`;
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
  // Backend returns { period_days, radar: { data: [], summary: {} }, top_accumulation, top_distribution, top_domination }
  const radar = d.radar || {};
  const radarData = radar.data || [];
  // Extract ASP & MWI series from radar data (each data point has asp & mwi fields when include_market_indexes=true)
  const asp = radarData.map(point => ({ date: point.date, close: point.asp }));
  const mwi = radarData.map(point => ({ date: point.date, close: point.mwi }));
  const marketData = radarData;
  const topAcc = d.top_accumulation || [];
  const topDist = d.top_distribution || [];
  const topDom = d.top_domination || [];
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
    // ── Posisi Asing Kumulatif Pasar (insight jangka panjang, jendela tetap server-side) ──
    const fp = d.foreign_pos;
    if (fp && fp.series && fp.series.length) {
      el.appendChild(chartPanel('Posisi Asing Kumulatif Pasar', `Net foreign kumulatif sejak ${dateLabelYear(fp.data_start)} · per titik = akumulasi ${fp.bucket_days} hari`, [{ label: 'Posisi', color: '#0EA5A4' }], 230));
      el.appendChild(buildForeignPositionSection(fp));
    }
    // ── Kepemilikan Asing Pasar resmi KSEI (absolut, snapshot bulanan) ──
    const fo = d.foreign_own;
    if (fo && fo.series && fo.series.length) {
      el.appendChild(chartPanel('Kepemilikan Asing Pasar (KSEI)', `Nilai kepemilikan asing resmi KSEI sejak ${dateLabelYear(fo.data_start)} · snapshot bulanan`, [{ label: 'Nilai asing', color: '#E8A33D' }], 230));
      el.appendChild(buildMarketOwnershipSection(fo));
    }
    // ── Bedah Perubahan Nilai Asing + Arus Kotor (mengikuti jendela snapshot KSEI) ──
    if (decState.data) el.appendChild(buildDecompositionSection());
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
      else if (type === 'Posisi Asing Kumulatif Pasar') { const fp = marketState.data && marketState.data.foreign_pos; chart = fp && fp.series ? buildPositionChartApex(container, fp.series) : null; }
      else if (type === 'Kepemilikan Asing Pasar (KSEI)') { const fo = marketState.data && marketState.data.foreign_own; chart = fo && fo.series ? buildMarketOwnershipChartApex(container, fo.series) : null; }
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

function buildForeignPositionSection(fp) {
  const rangePct = fp.range_position_pct != null ? fp.range_position_pct.toFixed(1) + '%' : '-';
  const rangeColor = fp.range_position_pct != null
    ? (fp.range_position_pct <= 15 ? '#D94B4B' : fp.range_position_pct >= 85 ? '#00A86B' : '#F2B705')
    : 'inherit';
  const selKpiHtml = (label, value, sub, color) => `
    <div style="flex:1 1 140px;min-width:140px;padding:var(--s-3);background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);">
      <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-bottom:var(--s-1);">${label}</div>
      <div style="font-size:var(--text-lg);font-weight:700;color:${color || 'inherit'};">${value}</div>
      ${sub ? `<div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:2px;">${sub}</div>` : ''}
    </div>`;
  const warnaArah = (v) => v >= 0 ? '#00A86B' : '#D94B4B';
  const netHtml = `<span style="color:${warnaArah(fp.net_30d)};">${formatNilaiSingkat(fp.net_30d)}</span> / <span style="color:${warnaArah(fp.net_90d)};">${formatNilaiSingkat(fp.net_90d)}</span>`;
  const wrap = createEl('div', { style: { marginBottom: 'var(--s-6)' } });
  wrap.innerHTML = `
    <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;">
      ${selKpiHtml('Posisi Tertinggi', formatNilaiSingkat(fp.peak), dateLabelYear(fp.peak_date), '#00A86B')}
      ${selKpiHtml('Posisi Terendah', formatNilaiSingkat(fp.trough), dateLabelYear(fp.trough_date), '#D94B4B')}
      ${selKpiHtml('Posisi Sekarang', formatNilaiSingkat(fp.current), 'kumulatif terakhir', fp.current >= 0 ? '#00A86B' : '#D94B4B')}
      ${selKpiHtml('Posisi dalam Rentang', rangePct, '0% = terendah · 100% = tertinggi', rangeColor)}
      ${selKpiHtml('Keluar Sejak Puncak', formatNilaiSingkat(fp.distance_from_peak), 'total net sell asing dari puncak ke sekarang')}
      ${selKpiHtml('Net Asing 30 / 90 hari', netHtml, 'arus terbaru')}
    </div>`;
  return wrap;
}

const DEC_MODES = [['peak', 'Dari Puncak'], ['ytd', 'Tahun Ini'], ['12m', '12 Bulan'], ['all', 'Semua Arsip']];
const DEC_PATTERN_INFO = {
  'AKUMULASI': 'Beli asing lebih besar daripada jual — asing menambah posisi bersih pada periode ini.',
  'ROTASI': 'Beli dan jual hampir seimbang dengan netto kecil — asing memutar posisi antar emiten, bukan keluar dari pasar.',
  'KELUAR': 'Jual dominan, beli menyusut di bawah separuh jual, dan penjualan tersebar di banyak emiten — pola keluar pasar.',
  'PENGURANGAN BERTAHAP': 'Jual lebih besar daripada beli, tetapi beli masih berjalan substansial atau jual bersih terkonsentrasi di sedikit emiten — pengurangan posisi bertahap, bukan eksodus.',
};

async function loadDecomposition(mode) {
  const r = await Api.get('/idx/market/foreign-decomposition', { mode }).catch(() => null);
  const d = r?.data || r;
  if (d) decState.data = d;
  decState.loading = false;
}

function buildDecompositionSection() {
  const wrap = createEl('div', { style: { marginBottom: 'var(--s-6)' } });
  fillDecomposition(wrap);
  return wrap;
}

function fillDecomposition(wrap) {
  const d = decState.data;
  if (decState.loading) {
    wrap.innerHTML = '<div style="padding:var(--s-4);color:var(--c-text-3);font-size:var(--text-sm);">Memuat bedah nilai asing…</div>';
    return;
  }
  if (!d) { wrap.innerHTML = ''; return; }

  const formatBertanda = (v) => v == null ? '-' : (v > 0 ? '+' : '') + formatNilaiSingkat(v);
  const warnaArah = (v) => v < 0 ? '#D94B4B' : v > 0 ? '#00A86B' : 'inherit';
  const batangNilaiHtml = (label, sub, value, maxAbs, color, valColor, disp) => {
    const w = !value ? 0 : Math.max(2, Math.abs(value) / maxAbs * 100);
    return `<div style="display:grid;grid-template-columns:180px 1fr 100px;align-items:center;gap:var(--s-3);margin:var(--s-2) 0;">
      <div><div style="font-size:var(--text-sm);font-weight:600;">${label}</div>
      <div style="font-size:var(--text-xs);color:var(--c-text-3);">${sub}</div></div>
      <div style="height:20px;background:var(--c-surface-2);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${w}%;background:${color};border-radius:4px;"></div></div>
      <div style="font-size:var(--text-sm);font-weight:700;text-align:right;color:${valColor || warnaArah(value)};">${disp || formatBertanda(value)}</div>
    </div>`;
  };
  const chips = DEC_MODES.map(([m, lbl]) => {
    const on = decState.mode === m;
    return `<button data-decmode="${m}" style="padding:4px 12px;border:1px solid ${on ? '#E8A33D' : 'var(--c-border)'};border-radius:999px;font-size:var(--text-xs);cursor:pointer;background:${on ? '#E8A33D' : 'var(--c-surface-2)'};color:${on ? '#fff' : 'var(--c-text-2)'};font-weight:${on ? '700' : '400'};">${lbl}</button>`;
  }).join('');
  const maxEff = Math.max(Math.abs(d.effect_price), Math.abs(d.effect_shares), Math.abs(d.effect_events), 1);
  const evTags = (d.events || []).map(e =>
    `<span style="display:inline-block;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:6px;padding:2px 8px;margin:2px 3px 0 0;font-size:var(--text-xs);"><b>${e.ticker}</b> ${formatBertanda(e.delta_value)} · saham ${e.total_change_pct >= 0 ? '+' : ''}${e.total_change_pct.toFixed(0)}%</span>`
  ).join('');
  const recon = d.effect_price + d.effect_shares + d.effect_events;

  const g = d.gross || {};
  const maxGross = Math.max(g.buy || 0, g.sell || 0, 1);
  const ratioPct = g.buy_sell_ratio != null ? Math.round(g.buy_sell_ratio * 100) + '%' : '-';
  const concPct = g.top5_concentration != null ? Math.round(g.top5_concentration * 100) + '%' : '-';
  const topSell = (g.top_net_sellers || []).map(x => x.ticker).join(', ') || '-';

  wrap.innerHTML = `
  <div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);padding:var(--s-4);margin-bottom:var(--s-4);">
    <div style="font-size:var(--text-md);font-weight:700;">● Bedah Perubahan Nilai Asing</div>
    <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;margin:var(--s-3) 0 var(--s-2);">${chips}</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-bottom:var(--s-3);">${dateLabelYear(d.from_date)} → ${dateLabelYear(d.to_date)} · ${d.emiten_analyzed} emiten dibedah · ${d.emiten_events} emiten aksi korporasi dipisah</div>
    <div style="display:flex;align-items:baseline;gap:var(--s-3);flex-wrap:wrap;background:var(--c-warn-bg);border:1px solid var(--c-border);border-radius:var(--radius);padding:var(--s-3);margin-bottom:var(--s-3);">
      <span style="font-size:var(--text-sm);">Nilai awal <b>Rp ${formatNilaiSingkat(d.value_start)}</b></span><span>→</span>
      <span style="font-size:var(--text-sm);">Nilai akhir <b>Rp ${formatNilaiSingkat(d.value_end)}</b></span>
      <span style="margin-left:auto;text-align:right;"><span style="font-size:var(--text-lg);font-weight:700;color:${warnaArah(d.delta)};">${formatBertanda(d.delta)}</span>
      <span style="display:block;font-size:var(--text-xs);color:var(--c-text-3);">perubahan total (Rp)</span></span>
    </div>
    ${batangNilaiHtml('Efek Harga', 'harga saham berubah', d.effect_price, maxEff, d.effect_price < 0 ? '#D94B4B' : '#00A86B')}
    ${batangNilaiHtml('Efek Lembar Asing', 'lembar asing berubah', d.effect_shares, maxEff, d.effect_shares < 0 ? '#E88A8A' : '#00A86B')}
    ${batangNilaiHtml('Aksi Korporasi', 'split / rights / placement', d.effect_events, maxEff, '#A3A3A3', 'var(--c-text-2)')}
    <div style="display:flex;justify-content:space-between;border-top:1px dashed var(--c-border);margin-top:var(--s-3);padding-top:var(--s-2);font-size:var(--text-sm);color:var(--c-text-2);">
      <span>Rekonsiliasi: <b>${formatBertanda(d.effect_price)} + ${formatBertanda(d.effect_shares)} + ${formatBertanda(d.effect_events)} = ${formatBertanda(recon)}</b></span>
      <span style="color:#00A86B;font-weight:700;">✓ cocok dengan perubahan total</span>
    </div>
    ${evTags ? `<div style="margin-top:var(--s-3);font-size:var(--text-xs);color:var(--c-text-2);">Emiten aksi korporasi terbesar: ${evTags}</div>` : ''}
    <div style="margin-top:var(--s-2);font-size:var(--text-xs);color:var(--c-text-3);line-height:1.5;">Efek lembar mencakup jual/beli di pasar reguler dan perpindahan luar pasar (mis. distribusi saham). Emiten dengan perubahan jumlah saham &gt;2% dipisah ke Aksi Korporasi agar tidak mengacaukan efek harga; perubahan nilai emiten tersebut tampil utuh di bucket itu.</div>
  </div>
  <div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);padding:var(--s-4);">
    <div style="font-size:var(--text-md);font-weight:700;">● Arus Kotor Asing — Rotasi atau Keluar?</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin:var(--s-2) 0 var(--s-3);">Total transaksi asing di pasar reguler pada periode yang sama (${dateLabelYear(d.from_date)} – ${dateLabelYear(d.to_date)})</div>
    ${batangNilaiHtml('Total Beli Asing', 'akumulasi di pasar reguler', g.buy, maxGross, '#00A86B', '#00A86B')}
    ${batangNilaiHtml('Total Jual Asing', 'distribusi di pasar reguler', g.sell, maxGross, '#D94B4B', '#D94B4B', formatNilaiSingkat(g.sell))}
    ${batangNilaiHtml('Netto', 'selisih beli − jual', g.net, maxGross, g.net < 0 ? '#E88A8A' : '#00A86B')}
    <div style="background:var(--c-info-bg);border:1px solid var(--c-border);border-radius:var(--radius);padding:var(--s-3);margin-top:var(--s-3);">
      <div style="font-size:var(--text-sm);font-weight:700;color:var(--c-primary);">🧭 Bacaan pola: ${g.pattern || '-'}</div>
      <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.55;margin-top:2px;">${DEC_PATTERN_INFO[g.pattern] || ''} Beli berjalan ${ratioPct} dari nilai jual; 5 emiten terbesar menyumbang ${concPct} jual bersih (${topSell}).</div>
    </div>
    <div style="margin-top:var(--s-2);font-size:var(--text-xs);color:var(--c-text-3);">Angka Rp pada kartu ini dan kartu bedah memakai jendela yang sama tetapi sumber berbeda (arus harian vs snapshot KSEI), jadi netto arus tidak harus sama persis dengan efek lembar.</div>
  </div>
  ${(() => {
    const flowNet = g.net || 0;
    const shareEff = d.effect_shares || 0;
    const gapVal = shareEff - flowNet;
    let gapBlock;
    if (Math.abs(gapVal) < 0.10 * Math.max(Math.abs(flowNet), 1)) {
      gapBlock = `<div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.6;margin-top:var(--s-2);">Keduanya hampir sama — perubahan lembar periode ini hampir seluruhnya dijelaskan oleh transaksi di pasar reguler.</div>`;
    } else {
      const hargaTurun = (d.effect_price || 0) < 0;
      const judul2 = hargaTurun ? 'Harga Saham Jatuh' : 'Harga Saham Naik';
      const sebab2 = `angka kartu bawah dihitung pada harga saat transaksi terjadi, sedangkan kartu atas (KSEI) dihitung pada harga akhir periode. Karena harga di akhir periode ${hargaTurun ? 'jatuh' : 'naik'}, nilai rupiah dari lembar yang ${gapVal > 0 ? 'hilang' : 'berubah'} ikut ${hargaTurun ? 'mengecil' : 'membesar'}.`;
      const teksPenjelasanLuarPasar = (v) => v > 0
        ? 'uang hasil penjualan di bursa tidak semuanya ditarik pulang — sebagian dipakai membeli saham lewat jalur luar bursa (mis. private placement, rights issue, atau kesepakatan langsung). Transaksi itu <b>tidak</b> tercatat di Arus Kotor (kartu bawah), tetapi tercatat di data KSEI (kartu atas) — makanya pengurangan lembarnya lebih kecil daripada jual bersihnya.'
        : 'sebagian lembar keluar lewat jalur luar bursa (mis. distribusi saham atau transfer langsung). Perpindahan itu <b>tidak</b> tercatat di Arus Kotor (kartu bawah), tetapi tercatat di data KSEI (kartu atas) — makanya pengurangan lembarnya lebih besar daripada jual bersihnya.';
      const gp = d.gap;
      if (gp && (gp.off_market != null)) {
        const causes = [
          { key: 'off', val: gp.off_market || 0, color: '#E8A33D', label: 'Luar pasar',
            title: (gp.off_market || 0) > 0 ? 'Ada Beli di Luar Bursa (Luar Pasar Reguler)' : 'Ada Pelepasan di Luar Bursa (Luar Pasar Reguler)',
            body: teksPenjelasanLuarPasar(gp.off_market || 0), note: `luar pasar netto ${formatBertanda(gp.off_market || 0)}` },
          { key: 'basis', val: gp.price_basis || 0, color: '#5B8FF9', label: 'Basis harga',
            title: judul2,
            body: `angka Arus Kotor (kartu bawah) dihargai pada harga saat transaksi terjadi, sedangkan efek lembar (kartu atas) dihargai pada harga akhir periode. Karena harga bergerak besar selama periode ini — efek harga totalnya ${formatBertanda(d.effect_price)} — nilai rupiah dari perubahan lembar yang sama tampil berbeda di kedua kartu, dan perbedaan cara menghargai inilah penyumbang terbesar selisihnya.`,
            note: `basis harga ${formatBertanda(gp.price_basis || 0)}` },
          { key: 'cov', val: gp.coverage || 0, color: '#8A94A6', label: 'Cakupan emiten event',
            title: 'Cakupan Emiten Aksi Korporasi',
            body: `${d.emiten_events || 0} emiten yang jumlah sahamnya berubah lebih dari 2% tidak dibedah per lembar — seluruh perubahan nilainya masuk bucket Aksi Korporasi — tetapi jual-beli reguler mereka tetap terhitung di Arus Kotor (kartu bawah). Arus netto emiten-emiten itulah penyumbang terbesar selisih kedua kartu.`,
            note: `cakupan emiten event ${formatBertanda(gp.coverage || 0)}` },
        ];
        const sorted = [...causes].sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
        const main = sorted[0];
        const totAbs = causes.reduce((s, c) => s + Math.abs(c.val), 0) || 1;
        const segs = causes.map(c => `<div style="background:${c.color};width:${(Math.abs(c.val) / totAbs * 100).toFixed(1)}%;"></div>`).join('');
        const legend = causes.map(c => `<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${c.color};margin-right:6px;"></span>${c.label} <b>${formatBertanda(c.val)}</b></span>`).join('');
        const inTxt = (gp.top_off_market_in || []).map(r => `${r.ticker} ${formatBertanda(r.value)}`).join(' · ');
        const outTxt = (gp.top_off_market_out || []).map(r => `${r.ticker} ${formatBertanda(r.value)}`).join(' · ');
        const namesLine = (inTxt || outTxt) ? `<div style="font-size:var(--text-sm);color:var(--c-text-2);margin-top:var(--s-2);">Luar pasar terbesar — ${inTxt ? `masuk: <span style="color:#2FBF71;font-weight:600;">${inTxt}</span>` : ''}${inTxt && outTxt ? ' &nbsp;|&nbsp; ' : ''}${outTxt ? `keluar: <span style="color:#E5484D;font-weight:600;">${outTxt}</span>` : ''}</div>` : '';
        const otherNotes = sorted.slice(1).map(c => c.note).join(' · ');
        gapBlock = `
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.6;margin-top:var(--s-2);">Selisih <b>${formatBertanda(gapVal)}</b> itu terutama dijelaskan satu hal:</div>
    <div style="background:rgba(232,163,61,.07);border:1px solid var(--c-border);border-radius:var(--radius-sm,8px);padding:10px 14px;margin-top:var(--s-2);font-size:var(--text-sm);color:var(--c-text-2);line-height:1.6;"><b>${main.title}:</b> ${main.body}</div>
    <div style="font-size:var(--text-xs);letter-spacing:.04em;color:var(--c-text-3);margin-top:var(--s-3);">PEMECAHAN SELISIH ${formatBertanda(gapVal)}</div>
    <div style="display:flex;height:22px;border-radius:6px;overflow:hidden;margin-top:6px;">${segs}</div>
    <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:var(--text-sm);color:var(--c-text-2);margin-top:7px;">${legend}</div>
    ${namesLine}
    <div style="font-size:var(--text-xs);color:var(--c-text-3);line-height:1.5;margin-top:var(--s-2);">Komponen lain — ${otherNotes}. Komponen bertanda berlawanan dengan selisih berarti menahan, bukan menambah.</div>`;
      } else {
        const judul1 = gapVal > 0 ? 'Ada Beli di Luar Bursa (Luar Pasar Reguler)' : 'Ada Pelepasan di Luar Bursa (Luar Pasar Reguler)';
        gapBlock = `
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.6;margin-top:var(--s-2);">Selisih <b>${formatBertanda(gapVal)}</b> itu terutama dijelaskan satu hal:</div>
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.6;margin-top:var(--s-2);"><b>${judul1}:</b> ${teksPenjelasanLuarPasar(gapVal)}</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);line-height:1.5;margin-top:var(--s-2);">Faktor teknis lain — <b>${judul2}:</b> ${sebab2}${d.emiten_events ? ` Cakupan: ${d.emiten_events} emiten aksi korporasi tidak masuk efek lembar, tetapi arus regulernya terhitung di kartu bawah — ikut menyumbang selisih.` : ''}</div>`;
      }
    }
    return `<div style="background:var(--c-surface);border:1px solid var(--c-border);border-left:4px solid #E8A33D;border-radius:var(--radius);padding:var(--s-4);margin-top:var(--s-4);">
    <div style="font-size:var(--text-md);font-weight:700;">● Kesimpulan Gabungan — Aktivitas vs Hasil Akhir</div>
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.6;margin-top:var(--s-2);">
      Di pasar reguler asing ${flowNet < 0 ? 'menjual' : 'membeli'} bersih <b>${formatNilaiSingkat(Math.abs(flowNet))}</b> (aktivitas), sementara lembar kepemilikan resmi mereka di KSEI berubah setara <b>${formatBertanda(shareEff)}</b> (hasil akhir).
    </div>
    ${gapBlock}
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.6;margin-top:var(--s-2);">
      Kesimpulan periode ini: nilai asing berubah <b>${formatBertanda(d.delta)}</b> — terutama oleh efek harga (<b>${formatBertanda(d.effect_price)}</b>) — dengan pola arus <b>${g.pattern || '-'}</b>.
    </div>
  </div>`;
  })()}`;

  wrap.querySelectorAll('[data-decmode]').forEach(btn => btn.addEventListener('click', async () => {
    const m = btn.getAttribute('data-decmode');
    if (m === decState.mode || decState.loading) return;
    decState.mode = m;
    decState.loading = true;
    fillDecomposition(wrap);
    await loadDecomposition(m);
    fillDecomposition(wrap);
  }));
}

function buildMarketOwnershipSection(fo) {
  const cur = fo.current || {};
  const warnaArah = (v) => v == null ? 'inherit' : (v >= 0 ? '#00A86B' : '#D94B4B');
  const formatBertanda = (v) => v == null ? '-' : (v >= 0 ? '+' : '') + formatNilaiSingkat(v);
  const deltaHtml = `<span style="color:${warnaArah(fo.change_3m_value)};">${formatBertanda(fo.change_3m_value)}</span> / <span style="color:${warnaArah(fo.change_12m_value)};">${formatBertanda(fo.change_12m_value)}</span>`;
  const selKpiHtml = (label, value, sub, color) => `
    <div style="flex:1 1 140px;min-width:140px;padding:var(--s-3);background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);">
      <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-bottom:var(--s-1);">${label}</div>
      <div style="font-size:var(--text-lg);font-weight:700;color:${color || 'inherit'};">${value}</div>
      ${sub ? `<div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:2px;">${sub}</div>` : ''}
    </div>`;
  const wrap = createEl('div', { style: { marginBottom: 'var(--s-6)' } });
  wrap.innerHTML = `
    <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;">
      ${selKpiHtml('Nilai Asing Sekarang', formatNilaiSingkat(cur.foreign_value), dateLabelYear(cur.date) + ' · ' + (cur.emiten || '-') + ' emiten', '#E8A33D')}
      ${selKpiHtml('Porsi Asing Pasar', cur.foreign_pct != null ? cur.foreign_pct.toFixed(1) + '%' : '-', 'dari total nilai ekuitas', '#5B8FF9')}
      ${selKpiHtml('Nilai Tertinggi', formatNilaiSingkat(fo.peak && fo.peak.foreign_value), dateLabelYear(fo.peak && fo.peak.date), '#00A86B')}
      ${selKpiHtml('Nilai Terendah', formatNilaiSingkat(fo.trough && fo.trough.foreign_value), dateLabelYear(fo.trough && fo.trough.date), '#D94B4B')}
      ${selKpiHtml('Perubahan Nilai 3 / 12 bln', deltaHtml, 'efek harga + beli/jual')}
    </div>`;
  return wrap;
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
