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
    name: 'Net foreign flow',
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
  days: 30, loading: false, data: null, charts: [], loadEpoch: 0,
};

/* ─── API ─── */
async function loadMarket() {
  // Epoch: drop results from loads superseded by navigation or a newer load.
  const epoch = ++marketState.loadEpoch;
  marketState.loading = true;
  renderLoading();
  try {
    const [res, daily, tfo, div] = await Promise.all([
      Api.get('/idx/market/summary', { days: marketState.days }),
      Api.get('/idx/market/top-foreign-flow', { days: 1 }).catch(() => null),
      Api.get('/idx/market/top-foreign-ownership').catch(() => null),
      Api.get('/idx/market/divergence', { days: marketState.days }).catch(() => null),
    ]);
    if (epoch !== marketState.loadEpoch) return;
    marketState.data = res?.data || res;
    const tf = tfo?.data || tfo;
    if (tf) marketState.data.top_foreign_own = tf;
    const dv = div?.data || div;
    marketState.data.divergence = dv ? (dv.items || []) : null;
    const dd = daily?.data || daily;
    if (dd) {
      marketState.data.top_daily_acc = dd.accumulation || [];
      marketState.data.top_daily_dist = dd.distribution || [];
    }
    marketState.loading = false;
    renderMarket();
  } catch (e) {
    marketState.loading = false;
    toast('Failed to load market data: ' + (e.message || e), 'danger');
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
        <h1 style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--s-1);">Market Summary</h1>
        <p style="color:var(--c-text-2);font-size:var(--text-sm);">Indonesian stock market analysis.</p>
      </div>
      <div style="display:flex;gap:var(--s-2);">
        <button class="btn btn--secondary btn--sm" id="market-refresh" aria-label="Refresh">${icons['refresh']} <span>Refresh</span></button>
        <a href="#/saham/stocks" class="btn btn--ghost btn--sm">${icons['trending-up']} <span>Analysis</span></a>
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
    chip.textContent = d + 'D';
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
  if (!marketRootEl) return;
  let el = marketRefs.content;
  if (!el) {
    el = createEl('div', { class: 'market-page__content' });
    marketRefs.content = el;
    marketRootEl.appendChild(el);
  }
  el.innerHTML = spinnerCardHtml('Loading market data…');
  clearCharts();
}

/* ─── Render: Market ─── */
function renderMarket() {
  if (!marketRootEl) return;
  let el = marketRefs.content;
  if (!el) {
    el = createEl('div', { class: 'market-page__content' });
    marketRefs.content = el;
    marketRootEl.appendChild(el);
  }

  if (!marketState.data) {
    el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;">
      <div style="font-size:var(--text-sm);color:var(--c-text-3);">Market data unavailable</div>
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
    ${kpiTile('Net foreign flow', radarSummary.total_net_foreign ? formatNilaiSingkat(radarSummary.total_net_foreign) : '-', 0, radarSummary.total_net_foreign >= 0 ? '#00A86B' : '#D94B4B')}
    ${kpiTile('Avg BII', marketData.length ? marketData[marketData.length - 1].bii_score.toFixed(1) : '-', 0, '#7B61FF')}
  `;
  el.appendChild(kpiWrap);

  // ── ASP vs MWI Chart ──
  if (asp.length && mwi.length) {
    const panel = chartPanel('ASP vs MWI', 'Average market price vs market-cap-weighted index (base 100)', [
      { label: 'ASP', color: '#00A86B' }, { label: 'MWI', color: '#F2B705' }
    ], 270);
    el.appendChild(panel);
  }

  // ── Market Charts ──
  if (marketData.length) {
    el.appendChild(chartPanel('Total Market Transaction Value', 'Total daily transaction value', [{ label: 'Value', color: '#F6903D' }], 200));
    el.appendChild(chartPanel('Market Transaction Frequency', 'Daily transaction count', [{ label: 'Frequency', color: '#5B8FF9' }], 200));
    el.appendChild(chartPanel('Market ATV', 'Average market transaction size', [{ label: 'ATV', color: '#9270CA' }], 200));
    el.appendChild(chartPanel('Market Foreign Flow', 'Total market net foreign buy/sell', [{ label: 'Buy', color: '#00A86B' }, { label: 'Sell', color: '#D94B4B' }], 210));
    // ── Top 10 Net Foreign harian terakhir (breakdown bar terakhir chart di atas) ──
    if (topDailyAcc.length || topDailyDist.length) el.appendChild(buildDailyFlowSection(topDailyAcc, topDailyDist, latestDate));
    el.appendChild(chartPanel('Market BII Score', 'Market accumulation score', [{ label: 'BII', color: '#7B61FF' }], 210));
    el.appendChild(chartPanel('Market Nego Value', 'Market non-regular transactions', [{ label: 'Nego Value', color: '#F6C022' }], 200));
    el.appendChild(chartPanel('Market Nego Frequency', 'Market negotiated transactions', [{ label: 'Nego Freq', color: '#90A4AE' }], 180));
  }

  // ── Tables ──
  const fundHeaders = ['Ticker', 'Company', 'Net foreign flow', 'ROE', 'Profit YoY', 'PER', 'Quality', 'Smart Score'];
  const fundRow = r => ({
    ticker: r.ticker, company: r.company_name, netForeign: r.net_flow_val,
    roe: fmtPctFrac(r.roe), profitYoy: fmtSignedPctFrac(r.profit_yoy),
    per: fmtPer(r.per), quality: qualityChip(r.quality), smart: smartChip(r)
  });
  if (topAcc.length) el.appendChild(buildTable('TOP ACCUMULATION', fundHeaders, topAcc.map(fundRow)));

  if (topDist.length) el.appendChild(buildTable('TOP DISTRIBUTION', fundHeaders, topDist.map(fundRow)));

  if (topAcc.length || topDist.length) {
    const note = createEl('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'calc(var(--s-6) * -1 + var(--s-2))', marginBottom: 'var(--s-6)' } });
    note.textContent = 'ROE, Profit YoY & PER are based on the latest financial statements of each issuer (TTM when complete). Quality: Healthy / Caution (profit down >20%) / Distressed (loss / negative EPS / negative equity). Smart Score (0–100) = Flow (foreign flow intensity vs market cap, 0–50) + Fundamental (ROE, profit growth, DER; financial sector neutral on DER, 0–50); loss-making issuers capped at 39; "-" when fundamental data is not yet available.';
    el.appendChild(note);
  }

  const divergence = d.divergence;
  if (divergence != null) {
    if (divergence.length) {
      el.appendChild(buildTable('DIVERGENCE — PRICE/FLOW UP, FUNDAMENTALS LAGGING', ['Ticker', 'Company', 'Price Change', 'Net foreign flow', 'Profit YoY', 'Quality', 'Signal'], divergence.map(r => ({
        ticker: r.ticker, company: r.company_name,
        priceChange: fmtSignedPctFrac(r.price_change), netForeign: r.net_flow_val,
        profitYoy: fmtSignedPctFrac(r.profit_yoy), quality: qualityChip(r.quality),
        sinyal: (r.reasons || []).map(reasonLabel).join(' · ')
      }))));
      const dnote = createEl('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'calc(var(--s-6) * -1 + var(--s-2))', marginBottom: 'var(--s-6)' } });
      dnote.textContent = 'Price up ≥20% in the selected window or net foreign inflow, but the latest financial statements show loss-making / negative EPS / profit down >20% / stagnant profit. Initial screen for review — not a recommendation.';
      el.appendChild(dnote);
    } else {
      const dnone = createEl('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginBottom: 'var(--s-6)' } });
      dnone.textContent = 'Divergence: no issuers with rising price/flow but lagging fundamentals in this window.';
      el.appendChild(dnone);
    }
  }

  if (topForeignOwn.length) el.appendChild(buildTable('TOP 10 FOREIGN OWNERSHIP', ['Ticker', 'Company', 'Foreign Value', '% Shares'], topForeignOwn.map(r => ({
    ticker: r.ticker, company: r.company_name, nilaiAsing: r.foreign_value,
    pct: r.foreign_pct_total != null ? r.foreign_pct_total.toFixed(1) + '%' : '-'
  }))));

  // Build market summary KPIs from radar summary
  const summaryKpi = [];
  if (radarSummary.total_reg_value != null) summaryKpi.push({ metric: 'Total Regular Value', value: formatNilaiSingkat(radarSummary.total_reg_value) });
  if (radarSummary.total_nego_value != null) summaryKpi.push({ metric: 'Total Nego Value', value: formatNilaiSingkat(radarSummary.total_nego_value) });
  if (radarSummary.total_net_foreign != null) summaryKpi.push({ metric: 'Total net foreign flow', value: formatNilaiSingkat(radarSummary.total_net_foreign) });
  if (radarSummary.asp_latest != null) summaryKpi.push({ metric: 'ASP Latest (base 100)', value: fmtPrice(radarSummary.asp_latest) });
  if (radarSummary.mwi_latest != null) summaryKpi.push({ metric: 'MWI Latest (base 100)', value: fmtPrice(radarSummary.mwi_latest) });

  if (summaryKpi.length) el.appendChild(buildTable('MARKET SUMMARY KPIs', ['Metric', 'Value'], summaryKpi));

  el.appendChild(buildScreenerSection());

  // Mount charts
  requestAnimationFrame(() => mountMarketCharts(asp, mwi, marketData));
}

function buildScreenerSection() {
  const wrap = createEl('div', { style: { marginBottom: 'var(--s-6)' } });
  const inp = 'padding:var(--s-2);background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);color:var(--c-text);font-size:var(--text-sm);width:104px;';
  const sel = inp + 'width:auto;';
  const lab = 'display:flex;flex-direction:column;gap:var(--s-1);font-size:var(--text-xs);color:var(--c-text-3);';
  wrap.innerHTML = `
    <div style="font-size:var(--text-md);font-weight:700;margin-bottom:var(--s-3);">SCREENER — FUNDAMENTAL + FOREIGN FLOW</div>
    <div style="display:flex;gap:var(--s-3);flex-wrap:wrap;align-items:flex-end;margin-bottom:var(--s-3);">
      <label style="${lab}">ROE min (%)<input id="scr-roe" type="number" step="any" placeholder="e.g. 10" style="${inp}"></label>
      <label style="${lab}">Profit YoY min (%)<input id="scr-yoy" type="number" step="any" placeholder="e.g. 0" style="${inp}"></label>
      <label style="${lab}">DER max<input id="scr-der" type="number" step="any" placeholder="e.g. 2" style="${inp}"></label>
      <label style="${lab}">PER max<input id="scr-per" type="number" step="any" placeholder="e.g. 15" style="${inp}"></label>
      <label style="${lab}">Smart Score min<input id="scr-smart" type="number" step="1" min="0" max="100" placeholder="e.g. 50" style="${inp}"></label>
      <label style="${lab}">Quality
        <select id="scr-quality" style="${sel}">
          <option value="">All</option>
          <option value="sehat">Healthy</option>
          <option value="sehat,waspada">Healthy + Caution</option>
          <option value="bermasalah">Distressed</option>
        </select></label>
      <label style="${lab}">Foreign flow
        <select id="scr-flow" style="${sel}">
          <option value="semua">All</option>
          <option value="positif">Inflow (positive)</option>
          <option value="negatif">Outflow (negative)</option>
        </select></label>
      <label style="${lab}">Sort by
        <select id="scr-sort" style="${sel}">
          <option value="smart">Smart Score</option>
          <option value="flow">Largest flow</option>
          <option value="roe">Highest ROE</option>
        </select></label>
      <button id="scr-apply" class="btn btn--primary btn--sm" type="button">Apply</button>
    </div>
    <div id="scr-result" style="font-size:var(--text-sm);color:var(--c-text-3);">Set the filters, then click Apply. The screener covers all issuers that already have XBRL fundamental data — it does not load automatically. The flow window follows the day selector above.</div>`;
  const result = wrap.querySelector('#scr-result');
  const run = async () => {
    const num = id => { const v = wrap.querySelector(id).value.trim(); return v === '' ? null : Number(v); };
    const params = { days: marketState.days, limit: 50, sort: wrap.querySelector('#scr-sort').value, flow: wrap.querySelector('#scr-flow').value };
    const roe = num('#scr-roe'); if (roe != null && !Number.isNaN(roe)) params.min_roe = roe / 100;
    const yoy = num('#scr-yoy'); if (yoy != null && !Number.isNaN(yoy)) params.min_profit_yoy = yoy / 100;
    const der = num('#scr-der'); if (der != null && !Number.isNaN(der)) params.max_der = der;
    const per = num('#scr-per'); if (per != null && !Number.isNaN(per)) params.max_per = per;
    const sm = num('#scr-smart'); if (sm != null && !Number.isNaN(sm)) params.min_smart = sm;
    const q = wrap.querySelector('#scr-quality').value; if (q) params.quality = q;
    result.textContent = 'Screening…';
    try {
      const res = await Api.get('/idx/market/screener', params);
      const d = res?.data || res;
      const items = d.items || [];
      result.innerHTML = '';
      const info = createEl('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginBottom: 'var(--s-3)' } });
      info.textContent = `Showing ${d.count ?? items.length} of ${d.total_matched ?? items.length} matching issuers · flow window ${d.period_days ?? marketState.days} days. The DER filter is applied as-is — financial-sector DER is structurally high, read it together with the Sector column.`;
      result.appendChild(info);
      if (items.length) {
        result.appendChild(buildTable('SCREENER RESULTS', ['Ticker', 'Company', 'Sector', 'Net foreign flow', 'ROE', 'Profit YoY', 'DER', 'PER', 'Quality', 'Smart Score'], items.map(r => ({
          ticker: r.ticker, company: r.company_name, sektor: r.sub_sector || r.sector || '-',
          netForeign: r.net_flow_val, roe: fmtPctFrac(r.roe), profitYoy: fmtSignedPctFrac(r.profit_yoy),
          der: r.der == null ? '-' : r.der.toFixed(2), per: fmtPer(r.per),
          quality: qualityChip(r.quality), smart: smartChip(r)
        }))));
      } else {
        const none = createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-3)' } });
        none.textContent = 'No issuers match these filters.';
        result.appendChild(none);
      }
    } catch (e) {
      result.textContent = 'Failed to load screener — try again.';
    }
  };
  on(wrap.querySelector('#scr-apply'), 'click', run);
  wrap.querySelectorAll('input').forEach(i => on(i, 'keydown', ev => { if (ev.key === 'Enter') run(); }));
  return wrap;
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
  if (!marketRootEl) return;
  clearCharts();
  if (!marketData.length) return;
  try {
    await loadApexCharts();
  } catch (e) {
    console.error('[Market] Failed to load chart library:', e);
    marketRootEl.querySelectorAll('.market-page__chart').forEach(c => {
      c.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-3);font-size:var(--text-sm);">
        <span style="margin-right:var(--s-2);">${icons['alert-circle']}</span> Failed to load chart library
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
      else if (type === 'Total Market Transaction Value') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.value })), '#F6903D');
      else if (type === 'Market Transaction Frequency') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.frequency })), '#5B8FF9');
      else if (type === 'Market ATV') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.atv })), '#9270CA');
      else if (type === 'Market Foreign Flow') chart = buildForeignMarketChartApex(container, marketData);
      else if (type === 'Market BII Score') chart = buildLineChartApex(container, marketData.map(d => ({ date: d.date, close: d.bii_score })), '#7B61FF');
      else if (type === 'Market Nego Value') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.non_reg_value })), '#F6C022');
      else if (type === 'Market Nego Frequency') chart = buildBarChartApex(container, marketData.map(d => ({ date: d.date, value: d.non_reg_freq })), '#90A4AE');
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
          <thead><tr><th>Ticker</th><th>Company</th><th style="text-align:right;">Net foreign flow</th></tr></thead>
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
    <div style="font-size:var(--text-md);font-weight:700;">TOP DAILY NET FOREIGN FLOW</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin:2px 0 var(--s-3);">Top 10 stocks by net foreign flow &middot; ${dl} &middot; last 1 day</div>
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
  if (q === 'sehat') return '<span style="color:#00A86B;font-weight:600;">● Healthy</span>';
  if (q === 'waspada') return '<span style="color:#E8A33D;font-weight:600;">● Caution</span>';
  if (q === 'bermasalah') return '<span style="color:#D94B4B;font-weight:600;">● Distressed</span>';
  return 'not yet reported';
}

function smartChip(r) {
  if (r.smart_score == null) return '-';
  const s = r.smart_score;
  const color = s >= 70 ? '#00A86B' : s >= 50 ? '#E8A33D' : '#D94B4B';
  const parts = `Flow ${r.smart_flow ?? '-'} + Fundamental ${r.smart_fund ?? '-'}`;
  const cap = r.smart_capped ? ' · capped at max 39 (loss)' : '';
  return `<span style="color:${color};font-weight:700;" title="${parts}${cap}">${s}</span>`;
}

function reasonLabel(code) {
  if (code === 'laba_rugi') return 'Loss-making';
  if (code === 'eps_rugi') return 'Negative EPS';
  if (code === 'laba_turun') return 'Profit down >20%';
  if (code === 'laba_stagnan') return 'Stagnant profit';
  return code;
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
  marketState.loadEpoch++;
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
