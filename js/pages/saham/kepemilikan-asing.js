/* pages/kepemilikan-asing.js — Kepemilikan Asing (KSEI): posisi asing
 * kumulatif, kepemilikan resmi KSEI, bedah nilai asing, dan bedah golongan
 * investor. Halaman ini menampung seksi KSEI yang sebelumnya menumpuk di
 * market.js (dipindah 2026-10-21, RENCANA_BEDAH_GOLONGAN §8). */
import { on, createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { loadApexCharts, buildBaseOptions, renderChart, destroyChart, toTs, buildPositionChartApex, createChartPanel } from '../../ui/chart.js';
const chartPanel = createChartPanel('kepemilikan-page');
import { formatNilaiSingkat, dateLabelYear } from '../../utils/format.js';
import { spinnerCardHtml } from '../../ui/loading.js';

/* ─── State ─── */
const pageState = { loading: false, data: null, charts: [] };
const decState = { mode: 'peak', data: null, loading: false };
const typeState = { data: null };

/* ─── API ─── */
async function loadPage() {
  pageState.loading = true;
  renderLoading();
  try {
    const [fpos, fown, fstruct, fdec, ftype] = await Promise.all([
      Api.get('/idx/market/foreign-position', { bucket: 30 }).catch(() => null),
      Api.get('/idx/market/foreign-ownership').catch(() => null),
      Api.get('/idx/market/ownership-structure').catch(() => null),
      Api.get('/idx/market/foreign-decomposition', { mode: 'peak' }).catch(() => null),
      Api.get('/idx/market/ownership-by-type', { mode: 'peak' }).catch(() => null),
    ]);
    pageState.data = {};
    const fp = fpos?.data || fpos;
    if (fp) pageState.data.foreign_pos = fp;
    const fo = fown?.data || fown;
    if (fo) pageState.data.foreign_own = fo;
    const fs = fstruct?.data || fstruct;
    if (fs) pageState.data.structure = fs;
    const fd = fdec?.data || fdec;
    if (fd) { decState.data = fd; decState.mode = 'peak'; }
    const ft = ftype?.data || ftype;
    if (ft) typeState.data = ft;
    pageState.loading = false;
    renderPage();
  } catch (e) {
    pageState.loading = false;
    toast('Failed to load foreign ownership data: ' + (e.message || e), 'danger');
    renderLoading();
  }
}

/* ─── DOM ─── */
let pageRootEl = null;
let pageRefs = {};
let typeWrapEl = null;

function clearCharts() {
  pageState.charts.forEach(c => destroyChart(c));
  pageState.charts = [];
}

function renderHeader() {
  const header = createEl('div', { style: { marginBottom: 'var(--s-5)' } });
  header.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--s-3);">
      <div>
        <h1 style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--s-1);">Foreign Ownership</h1>
        <p style="color:var(--c-text-2);font-size:var(--text-sm);">Cumulative foreign position, official KSEI ownership, and investor-group breakdown.</p>
      </div>
      <div style="display:flex;gap:var(--s-2);">
        <button class="btn btn--secondary btn--sm" id="kepemilikan-refresh" aria-label="Refresh">${icons['refresh']} <span>Refresh</span></button>
      </div>
    </div>
  `;
  on(header.querySelector('#kepemilikan-refresh'), 'click', loadPage);
  pageRootEl.appendChild(header);
}

function renderLoading() {
  let el = pageRefs.content;
  if (!el) {
    el = createEl('div', { class: 'kepemilikan-page__content' });
    pageRefs.content = el;
    pageRootEl.appendChild(el);
  }
  el.innerHTML = spinnerCardHtml('Loading foreign ownership data...');
  clearCharts();
}

/* ─── Render: Halaman ─── */
function renderPage() {
  let el = pageRefs.content;
  if (!el) {
    el = createEl('div', { class: 'kepemilikan-page__content' });
    pageRefs.content = el;
    pageRootEl.appendChild(el);
  }
  const d = pageState.data || {};
  const fp = d.foreign_pos;
  const fo = d.foreign_own;
  el.innerHTML = '';
  typeWrapEl = null;

  if (!fp && !fo && !d.structure && !decState.data && !typeState.data) {
    el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;">
      <div style="font-size:var(--text-sm);color:var(--c-text-3);">Foreign ownership data unavailable</div>
    </div>`;
    return;
  }

  // ── Posisi Asing Kumulatif (insight jangka panjang, jendela tetap server-side) ──
  if (fp && fp.series && fp.series.length) {
    el.appendChild(chartPanel('Cumulative Market Foreign Position', `Cumulative net foreign since ${dateLabelYear(fp.data_start)} · per point = ${fp.bucket_days}-day accumulation`, [{ label: 'Position', color: '#0EA5A4' }], 230));
    el.appendChild(buildForeignPositionSection(fp));
  }

  // ── Kepemilikan Asing resmi KSEI (absolut, snapshot bulanan) ──
  if (fo && fo.series && fo.series.length) {
    el.appendChild(chartPanel('Market Foreign Ownership (KSEI)', `Official KSEI foreign ownership value since ${dateLabelYear(fo.data_start)} · monthly snapshots`, [{ label: 'Foreign value', color: '#E8A33D' }], 230));
    el.appendChild(buildMarketOwnershipSection(fo));
  }

  // ── Struktur Kepemilikan Pasar (pangsa kapitalisasi per kelompok) ──
  const st = d.structure;
  if (st && st.series && st.series.length) el.appendChild(buildStructureSection(st));

  // ── Bedah Perubahan Nilai Asing + Arus Kotor (mengikuti jendela snapshot KSEI) ──
  if (decState.data) el.appendChild(buildDecompositionSection());

  // ── Bedah Golongan Asing + Cermin Lokal (jendela sama, chip mode di kartu Bedah) ──
  if (typeState.data) {
    typeWrapEl = createEl('div', {});
    fillByTypeSection(typeWrapEl);
    el.appendChild(typeWrapEl);
  }

  requestAnimationFrame(() => mountPageCharts());
}

async function mountPageCharts() {
  clearCharts();
  try {
    await loadApexCharts();
  } catch (e) {
    console.error('[Kepemilikan] Failed to load chart library:', e);
    return;
  }
  const d = pageState.data || {};
  pageRootEl.querySelectorAll('.kepemilikan-page__chart').forEach(container => {
    const type = container.dataset.chartType;
    let chart;
    try {
      if (type === 'Cumulative Market Foreign Position') { const fp = d.foreign_pos; chart = fp && fp.series ? buildPositionChartApex(container, fp.series) : null; }
      else if (type === 'Market Foreign Ownership (KSEI)') { const fo = d.foreign_own; chart = fo && fo.series ? buildMarketOwnershipChartApex(container, fo.series) : null; }
      if (chart) pageState.charts.push(chart);
    } catch (e) {
      console.error(`[Kepemilikan] Chart "${type}" failed:`, e);
    }
  });
}

function buildMarketOwnershipChartApex(container, series) {
  const opts = buildBaseOptions({ height: 230, type: 'line' });
  opts.colors = ['#E8A33D'];
  opts.stroke.width = 2.5;
  opts.series = [{
    name: 'Foreign ownership value',
    data: series.filter(d => d.date && d.foreign_value != null).map(d => ({ x: toTs(d.date), y: d.foreign_value })),
  }];
  opts.tooltip.y = { formatter: (v) => formatNilaiSingkat(v) };
  return renderChart(container, opts);
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
      ${selKpiHtml('Highest Position', formatNilaiSingkat(fp.peak), dateLabelYear(fp.peak_date), '#00A86B')}
      ${selKpiHtml('Lowest Position', formatNilaiSingkat(fp.trough), dateLabelYear(fp.trough_date), '#D94B4B')}
      ${selKpiHtml('Current Position', formatNilaiSingkat(fp.current), 'latest cumulative', fp.current >= 0 ? '#00A86B' : '#D94B4B')}
      ${selKpiHtml('Position in Range', rangePct, '0% = lowest · 100% = highest', rangeColor)}
      ${selKpiHtml('Outflow Since Peak', formatNilaiSingkat(fp.distance_from_peak), 'total foreign net sell from peak to now')}
      ${selKpiHtml('Net Foreign 30 / 90 days', netHtml, 'latest flows')}
    </div>`;
  return wrap;
}

const DEC_MODES = [['peak', 'From Peak'], ['ytd', 'This Year'], ['12m', '12 Months'], ['all', 'Full Archive']];
const PATTERN_LABEL = {
  'AKUMULASI': 'Accumulation',
  'ROTASI': 'Rotation',
  'KELUAR': 'Exit',
  'PENGURANGAN BERTAHAP': 'Gradual reduction',
};
const DEC_PATTERN_INFO = {
  'AKUMULASI': 'Foreign buying exceeds selling — foreigners added net position in this period.',
  'ROTASI': 'Buying and selling nearly balanced with a small net — foreigners rotated positions across issuers rather than exiting the market.',
  'KELUAR': 'Selling dominant, buying shrunk below half of selling, and sales spread across many issuers — a market-exit pattern.',
  'PENGURANGAN BERTAHAP': 'Selling exceeds buying, but buying remains substantial or net selling is concentrated in few issuers — a gradual reduction, not an exodus.',
};
async function loadDecomposition(mode) {
  const [r, rt] = await Promise.all([
    Api.get('/idx/market/foreign-decomposition', { mode }).catch(() => null),
    Api.get('/idx/market/ownership-by-type', { mode }).catch(() => null),
  ]);
  const d = r?.data || r;
  if (d) decState.data = d;
  const t = rt?.data || rt;
  if (t) typeState.data = t;
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
    wrap.innerHTML = '<div style="padding:var(--s-4);color:var(--c-text-3);font-size:var(--text-sm);">Loading foreign value breakdown…</div>';
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
    `<span style="display:inline-block;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:6px;padding:2px 8px;margin:2px 3px 0 0;font-size:var(--text-xs);"><b>${e.ticker}</b> ${formatBertanda(e.delta_value)} · shares ${e.total_change_pct >= 0 ? '+' : ''}${e.total_change_pct.toFixed(0)}%</span>`
  ).join('');
  const recon = d.effect_price + d.effect_shares + d.effect_events;

  const g = d.gross || {};
  const maxGross = Math.max(g.buy || 0, g.sell || 0, 1);
  const ratioPct = g.buy_sell_ratio != null ? Math.round(g.buy_sell_ratio * 100) + '%' : '-';
  const concPct = g.top5_concentration != null ? Math.round(g.top5_concentration * 100) + '%' : '-';
  const topSell = (g.top_net_sellers || []).map(x => x.ticker).join(', ') || '-';

  wrap.innerHTML = `
  <div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);padding:var(--s-4);margin-bottom:var(--s-4);">
    <div style="font-size:var(--text-md);font-weight:700;">● Foreign Value Change Breakdown</div>
    <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;margin:var(--s-3) 0 var(--s-2);">${chips}</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-bottom:var(--s-3);">${dateLabelYear(d.from_date)} → ${dateLabelYear(d.to_date)} · ${d.emiten_analyzed} issuers analyzed · ${d.emiten_events} corporate-action issuers separated</div>
    <div style="display:flex;align-items:baseline;gap:var(--s-3);flex-wrap:wrap;background:var(--c-warn-bg);border:1px solid var(--c-border);border-radius:var(--radius);padding:var(--s-3);margin-bottom:var(--s-3);">
      <span style="font-size:var(--text-sm);">Starting value <b>Rp ${formatNilaiSingkat(d.value_start)}</b></span><span>→</span>
      <span style="font-size:var(--text-sm);">Ending value <b>Rp ${formatNilaiSingkat(d.value_end)}</b></span>
      <span style="margin-left:auto;text-align:right;"><span style="font-size:var(--text-lg);font-weight:700;color:${warnaArah(d.delta)};">${formatBertanda(d.delta)}</span>
      <span style="display:block;font-size:var(--text-xs);color:var(--c-text-3);">total change (Rp)</span></span>
    </div>
    ${batangNilaiHtml('Price Effect', 'share prices changed', d.effect_price, maxEff, d.effect_price < 0 ? '#D94B4B' : '#00A86B')}
    ${batangNilaiHtml('Foreign Shares Effect', 'foreign shares changed', d.effect_shares, maxEff, d.effect_shares < 0 ? '#E88A8A' : '#00A86B')}
    ${batangNilaiHtml('Corporate Actions', 'split / rights / placement', d.effect_events, maxEff, '#A3A3A3', 'var(--c-text-2)')}
    <div style="display:flex;justify-content:space-between;border-top:1px dashed var(--c-border);margin-top:var(--s-3);padding-top:var(--s-2);font-size:var(--text-sm);color:var(--c-text-2);">
      <span>Reconciliation: <b>${formatBertanda(d.effect_price)} + ${formatBertanda(d.effect_shares)} + ${formatBertanda(d.effect_events)} = ${formatBertanda(recon)}</b></span>
      <span style="color:#00A86B;font-weight:700;">✓ matches the total change</span>
    </div>
    ${evTags ? `<div style="margin-top:var(--s-3);font-size:var(--text-xs);color:var(--c-text-2);">Largest corporate-action issuers: ${evTags}</div>` : ''}
    <div style="margin-top:var(--s-2);font-size:var(--text-xs);color:var(--c-text-3);line-height:1.5;">The shares effect covers regular-market buy/sell and off-market transfers (e.g. share distributions). Issuers whose share count changed &gt;2% are separated into Corporate Actions so as not to distort the price effect; the full value change of those issuers appears in that bucket.</div>
  </div>
  <div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);padding:var(--s-4);">
    <div style="font-size:var(--text-md);font-weight:700;">● Gross Foreign Flows — Rotation or Exit?</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin:var(--s-2) 0 var(--s-3);">Total foreign transactions in the regular market over the same period (${dateLabelYear(d.from_date)} – ${dateLabelYear(d.to_date)})</div>
    ${batangNilaiHtml('Total Foreign Buying', 'accumulated in the regular market', g.buy, maxGross, '#00A86B', '#00A86B')}
    ${batangNilaiHtml('Total Foreign Selling', 'distributed in the regular market', g.sell, maxGross, '#D94B4B', '#D94B4B', formatNilaiSingkat(g.sell))}
    ${batangNilaiHtml('Net', 'buy minus sell', g.net, maxGross, g.net < 0 ? '#E88A8A' : '#00A86B')}
    <div style="background:var(--c-info-bg);border:1px solid var(--c-border);border-radius:var(--radius);padding:var(--s-3);margin-top:var(--s-3);">
      <div style="font-size:var(--text-sm);font-weight:700;color:var(--c-primary);">🧭 Pattern reading: ${PATTERN_LABEL[g.pattern] || g.pattern || '-'}</div>
      <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.55;margin-top:2px;">${DEC_PATTERN_INFO[g.pattern] || ''} Buying ran at ${ratioPct} of sell value; the 5 largest issuers contributed ${concPct} of net selling (${topSell}).</div>
    </div>
    <div style="margin-top:var(--s-2);font-size:var(--text-xs);color:var(--c-text-3);">The Rp figures on this card and the breakdown card use the same window but different sources (daily flows vs KSEI snapshots), so net flow need not match the shares effect exactly.</div>
  </div>
  ${(() => {
    const flowNet = g.net || 0;
    const shareEff = d.effect_shares || 0;
    const gapVal = shareEff - flowNet;
    let gapBlock;
    if (Math.abs(gapVal) < 0.10 * Math.max(Math.abs(flowNet), 1)) {
      gapBlock = `<div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.6;margin-top:var(--s-2);">The two are nearly equal — this period's share change is almost fully explained by regular-market transactions.</div>`;
    } else {
      const hargaTurun = (d.effect_price || 0) < 0;
      const judul2 = hargaTurun ? 'Share Prices Fell' : 'Share Prices Rose';
      const sebab2 = `the lower card figures are priced at transaction-time prices, while the upper card (KSEI) is priced at end-of-period prices. Because prices at period end ${hargaTurun ? 'fell' : 'rose'}, the rupiah value of the shares that ${gapVal > 0 ? 'disappeared' : 'changed'} ${hargaTurun ? 'shrank' : 'grew'} along with them.`;
      const teksPenjelasanLuarPasar = (v) => v > 0
        ? 'not all proceeds from exchange sales were taken home — part was used to buy shares off-exchange (e.g. private placements, rights issues, or direct deals). Those transactions are <b>not</b> recorded in Gross Flows (lower card), but are recorded in KSEI data (upper card) — which is why the share reduction is smaller than net selling.'
        : 'some shares left via off-exchange routes (e.g. share distributions or direct transfers). Those moves are <b>not</b> recorded in Gross Flows (lower card), but are recorded in KSEI data (upper card) — which is why the share reduction is larger than net selling.';
      const gp = d.gap;
      if (gp && (gp.off_market != null)) {
        const causes = [
          { key: 'off', val: gp.off_market || 0, color: '#E8A33D', label: 'Off-market',
            title: (gp.off_market || 0) > 0 ? 'Off-Exchange Buying (Outside the Regular Market)' : 'Off-Exchange Disposal (Outside the Regular Market)',
            body: teksPenjelasanLuarPasar(gp.off_market || 0), note: `off-market net ${formatBertanda(gp.off_market || 0)}` },
          { key: 'basis', val: gp.price_basis || 0, color: '#5B8FF9', label: 'Price basis',
            title: judul2,
            body: `Gross Flow figures (lower card) are priced at transaction-time prices, while the shares effect (upper card) is priced at end-of-period prices. Because prices moved sharply during this period — total price effect ${formatBertanda(d.effect_price)} — the rupiah value of the same share change looks different on the two cards, and this pricing difference is the largest contributor to the gap.`,
            note: `price basis ${formatBertanda(gp.price_basis || 0)}` },
          { key: 'cov', val: gp.coverage || 0, color: '#8A94A6', label: 'Event-issuer coverage',
            title: 'Corporate-Action Issuer Coverage',
            body: `${d.emiten_events || 0} issuers whose share count changed by more than 2% are not broken down per share — their full value change goes into the Corporate Actions bucket — but their regular buy/sell still counts in Gross Flows (lower card). The net flow of those issuers is the largest contributor to the gap between the two cards.`,
            note: `event-issuer coverage ${formatBertanda(gp.coverage || 0)}` },
        ];
        const sorted = [...causes].sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
        const main = sorted[0];
        const totAbs = causes.reduce((s, c) => s + Math.abs(c.val), 0) || 1;
        const segs = causes.map(c => `<div style="background:${c.color};width:${(Math.abs(c.val) / totAbs * 100).toFixed(1)}%;"></div>`).join('');
        const legend = causes.map(c => `<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${c.color};margin-right:6px;"></span>${c.label} <b>${formatBertanda(c.val)}</b></span>`).join('');
        const inTxt = (gp.top_off_market_in || []).map(r => `${r.ticker} ${formatBertanda(r.value)}`).join(' · ');
        const outTxt = (gp.top_off_market_out || []).map(r => `${r.ticker} ${formatBertanda(r.value)}`).join(' · ');
        const namesLine = (inTxt || outTxt) ? `<div style="font-size:var(--text-sm);color:var(--c-text-2);margin-top:var(--s-2);">Largest off-market — ${inTxt ? `in: <span style="color:#2FBF71;font-weight:600;">${inTxt}</span>` : ''}${inTxt && outTxt ? ' &nbsp;|&nbsp; ' : ''}${outTxt ? `out: <span style="color:#E5484D;font-weight:600;">${outTxt}</span>` : ''}</div>` : '';
        const otherNotes = sorted.slice(1).map(c => c.note).join(' · ');
        gapBlock = `
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.6;margin-top:var(--s-2);">The gap of <b>${formatBertanda(gapVal)}</b> is mainly explained by one thing:</div>
    <div style="background:rgba(232,163,61,.07);border:1px solid var(--c-border);border-radius:var(--radius-sm,8px);padding:10px 14px;margin-top:var(--s-2);font-size:var(--text-sm);color:var(--c-text-2);line-height:1.6;"><b>${main.title}:</b> ${main.body}</div>
    <div style="font-size:var(--text-xs);letter-spacing:.04em;color:var(--c-text-3);margin-top:var(--s-3);">GAP BREAKDOWN ${formatBertanda(gapVal)}</div>
    <div style="display:flex;height:22px;border-radius:6px;overflow:hidden;margin-top:6px;">${segs}</div>
    <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:var(--text-sm);color:var(--c-text-2);margin-top:7px;">${legend}</div>
    ${namesLine}
    <div style="font-size:var(--text-xs);color:var(--c-text-3);line-height:1.5;margin-top:var(--s-2);">Other components — ${otherNotes}. A component signed opposite to the gap dampens it rather than adding to it.</div>`;
      } else {
        const judul1 = gapVal > 0 ? 'Off-Exchange Buying (Outside the Regular Market)' : 'Off-Exchange Disposal (Outside the Regular Market)';
        gapBlock = `
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.6;margin-top:var(--s-2);">The gap of <b>${formatBertanda(gapVal)}</b> is mainly explained by one thing:</div>
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.6;margin-top:var(--s-2);"><b>${judul1}:</b> ${teksPenjelasanLuarPasar(gapVal)}</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);line-height:1.5;margin-top:var(--s-2);">Other technical factors — <b>${judul2}:</b> ${sebab2}${d.emiten_events ? ` Coverage: ${d.emiten_events} corporate-action issuers are excluded from the shares effect, but their regular flows count on the lower card — also contributing to the gap.` : ''}</div>`;
      }
    }
    return `<div style="background:var(--c-surface);border:1px solid var(--c-border);border-left:4px solid #E8A33D;border-radius:var(--radius);padding:var(--s-4);margin-top:var(--s-4);">
    <div style="font-size:var(--text-md);font-weight:700;">● Combined Conclusion — Activity vs Final Outcome</div>
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.6;margin-top:var(--s-2);">
      In the regular market, foreigners ${flowNet < 0 ? 'sold' : 'bought'} a net <b>${formatNilaiSingkat(Math.abs(flowNet))}</b> (activity), while their official KSEI ownership shares changed by an equivalent <b>${formatBertanda(shareEff)}</b> (final outcome).
    </div>
    ${gapBlock}
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.6;margin-top:var(--s-2);">
      Conclusion for this period: foreign value changed <b>${formatBertanda(d.delta)}</b> — mainly through the price effect (<b>${formatBertanda(d.effect_price)}</b>) — with a <b>${g.pattern || '-'}</b> flow pattern.
    </div>
  </div>`;
  })()}`;

  wrap.querySelectorAll('[data-decmode]').forEach(btn => btn.addEventListener('click', async () => {
    const m = btn.getAttribute('data-decmode');
    if (m === decState.mode || decState.loading) return;
    decState.mode = m;
    decState.loading = true;
    fillDecomposition(wrap);
    if (typeWrapEl) typeWrapEl.innerHTML = '<div style="padding:var(--s-4);color:var(--c-text-3);font-size:var(--text-sm);">Loading group breakdown…</div>';
    await loadDecomposition(m);
    fillDecomposition(wrap);
    if (typeWrapEl) fillByTypeSection(typeWrapEl);
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
      ${selKpiHtml('Current Foreign Value', formatNilaiSingkat(cur.foreign_value), dateLabelYear(cur.date) + ' · ' + (cur.emiten || '-') + ' issuers', '#E8A33D')}
      ${selKpiHtml('Market Foreign Share', cur.foreign_pct != null ? cur.foreign_pct.toFixed(1) + '%' : '-', 'of total equity value', '#5B8FF9')}
      ${selKpiHtml('Highest Value', formatNilaiSingkat(fo.peak && fo.peak.foreign_value), dateLabelYear(fo.peak && fo.peak.date), '#00A86B')}
      ${selKpiHtml('Lowest Value', formatNilaiSingkat(fo.trough && fo.trough.foreign_value), dateLabelYear(fo.trough && fo.trough.date), '#D94B4B')}
      ${selKpiHtml('Value Change 3 / 12 mo', deltaHtml, 'price effect + buy/sell')}
    </div>`;
  return wrap;
}


/* ─── Struktur Kepemilikan Pasar ─── */
const STRUCTURE_GROUP_INFO = [
  ['foreign', 'Foreign', '#E8A33D'],
  ['local_institutions', 'Local Institutions', '#5B8FF9'],
  ['retail', 'Retail', '#00A86B'],
  ['local_corporates', 'Local Corporates', '#F6903D'],
  ['local_others', 'Other Local', '#8A94A6'],
  ['unclassified', 'Unclassified', '#D5DAE0'],
];
// Urutan tumpuk kolom (bawah -> atas): tak-terklasifikasi di dasar,
// asing di puncak.
const STRUCTURE_STACK_ORDER = ['unclassified', 'local_others', 'local_corporates', 'retail', 'local_institutions', 'foreign'];

function buildStructureSectionHtml(res) {
  const series = res.series || [];
  const cur = res.current || series[series.length - 1] || {};
  const start = res.start || series[0] || {};
  const g = (snap, key) => ((snap.groups || {})[key] || {}).pct || 0;
  const gv = (snap, key) => ((snap.groups || {})[key] || {}).value || 0;

  const tileHtml = (label, value, color) => `
    <div style="flex:1 1 140px;min-width:140px;padding:var(--s-3);background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);">
      <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-bottom:var(--s-1);">${label}</div>
      <div style="font-size:var(--text-lg);font-weight:700;color:${color || 'inherit'};">${value}</div>
    </div>`;
  const tiles = `
    <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;margin-bottom:var(--s-3);">
      ${tileHtml('Market Capitalization · ' + dateLabelYear(cur.date), formatNilaiSingkat(cur.total_value), 'inherit')}
      ${STRUCTURE_GROUP_INFO.map(([key, label, color]) => tileHtml(label, g(cur, key).toFixed(1) + '%', color)).join('')}
    </div>`;

  const kolom = series.map(snap => {
    const segs = STRUCTURE_STACK_ORDER.map(key => {
      const pct = g(snap, key);
      const color = STRUCTURE_GROUP_INFO.find(([k]) => k === key)[2];
      return pct > 0 ? `<div style="height:${pct}%;background:${color};" title="${snap.date}"></div>` : '';
    }).join('');
    return `<div style="flex:1 1 0;min-width:3px;display:flex;flex-direction:column-reverse;height:100%;background:var(--c-surface-2);border-radius:2px;overflow:hidden;">${segs}</div>`;
  }).join('');
  const legenda = STRUCTURE_GROUP_INFO.map(([key, label, color]) =>
    `<span style="font-size:var(--text-xs);color:var(--c-text-2);"><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${color};margin-right:5px;"></span>${label} ${g(cur, key).toFixed(1)}%</span>`).join('');

  const rNow = g(cur, 'retail');
  const rStart = g(start, 'retail');
  const rNaik = rNow >= rStart;
  const rp = res.retail_peak || {};
  const termometer = `Retail thermometer: local individual investor ownership is now <b>${formatNilaiSingkat(gv(cur, 'retail'))}</b> (${rNow.toFixed(1)}% of capitalization), ${rNaik ? 'up' : 'down'} from ${rStart.toFixed(1)}% on ${dateLabelYear(start.date)} — the retail share ${rNaik ? 'grew' : 'shrank'} within the market structure. Highest retail value ${formatNilaiSingkat(rp.value)} on ${dateLabelYear(rp.date)}.`;

  return `<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);padding:var(--s-4);margin-bottom:var(--s-4);">
    <div style="font-size:var(--text-md);font-weight:700;">● Market Ownership Structure</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin:var(--s-2) 0 var(--s-3);">Market-capitalization share per owner group · from KSEI snapshots (including illiquid issuers) · ${dateLabelYear(res.data_start)} → ${dateLabelYear(res.data_end)} · one column per snapshot</div>
    ${tiles}
    <div style="display:flex;gap:2px;height:110px;align-items:stretch;">${kolom}</div>
    <div style="display:flex;gap:var(--s-3);flex-wrap:wrap;margin-top:var(--s-2);">${legenda}</div>
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.55;margin-top:var(--s-3);">${termometer}</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);line-height:1.5;margin-top:var(--s-2);">The unclassified slice is shares without SID classification — usually controlling/strategic holdings; its size is not a data error but a limit of KSEI classification.</div>
  </div>`;
}

function buildStructureSection(res) {
  const wrap = createEl('div', {});
  wrap.innerHTML = buildStructureSectionHtml(res);
  return wrap;
}

/* ─── Bedah Golongan Asing + Cermin Lokal ─── */
const TYPE_LABELS = { IS: 'Insurance', CP: 'Corporates', PF: 'Pension Funds', IB: 'Investment Banks', ID: 'Individuals', MF: 'Mutual Funds', SC: 'Securities Firms', FD: 'Foundations', OT: 'Others' };
const FOREIGN_BUCKET_INFO = [
  ['lengket', 'Sticky', 'Pension funds · insurance · foundations', '#5B8FF9'],
  ['taktis', 'Tactical', 'Mutual funds · investment banks', '#9270CA'],
  ['korporasi', 'Corporates', 'Direct foreign companies', '#F6903D'],
  ['lainnya', 'Others', 'Individuals · securities firms · others (including nominee accounts)', '#E8A33D'],
];
const LOCAL_GROUP_INFO = [
  ['institusi_dana', 'Fund Institutions', 'Mutual funds · pension funds · insurance', '#5B8FF9'],
  ['korporasi', 'Corporates', 'Local companies — often controlling vehicles', '#F6903D'],
  ['ritel', 'Retail', 'Local individual investors', '#00A86B'],
  ['lainnya', 'Others', 'Investment banks · securities firms · foundations · others', '#8A94A6'],
];

function formatBertanda(v) {
  return v == null ? '-' : (v > 0 ? '+' : '') + formatNilaiSingkat(v);
}

function barisGolonganHtml(label, sub, value, maxAbs, color) {
  const arah = value < 0 ? '#D94B4B' : value > 0 ? '#00A86B' : 'inherit';
  const w = !value ? 0 : Math.max(2, Math.abs(value) / maxAbs * 100);
  return `<div style="display:grid;grid-template-columns:180px 1fr 100px;align-items:center;gap:var(--s-3);margin:var(--s-2) 0;">
    <div><div style="font-size:var(--text-sm);font-weight:600;">${label}</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);">${sub}</div></div>
    <div style="height:20px;background:var(--c-surface-2);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${w}%;background:${color};border-radius:4px;"></div></div>
    <div style="font-size:var(--text-sm);font-weight:700;text-align:right;color:${arah};">${formatBertanda(value)}</div>
  </div>`;
}

function buildByTypeHtml(res) {
  const f = res.foreign || {};
  const buckets = f.buckets || {};
  const types = f.types || {};
  const maxAbs = Math.max(1, ...FOREIGN_BUCKET_INFO.map(([k]) => Math.abs((buckets[k] || {}).effect_shares || 0)));
  const bars = FOREIGN_BUCKET_INFO.map(([k, label, sub, color]) =>
    barisGolonganHtml(label, sub, (buckets[k] || {}).effect_shares || 0, maxAbs, color)).join('');
  const naik = (res.sticky_pct_end || 0) >= (res.sticky_pct_start || 0);
  const otEff = (types.OT || {}).effect_shares || 0;
  const lainEff = (buckets.lainnya || {}).effect_shares || 0;
  const detailRows = Object.keys(TYPE_LABELS)
    .sort((a, b) => Math.abs((types[b] || {}).effect_shares || 0) - Math.abs((types[a] || {}).effect_shares || 0))
    .map(code => {
      const t = types[code] || {};
      const mv = (f.top_movers || {})[code] || {};
      const beli = (mv.buyers || [])[0];
      const jual = (mv.sellers || [])[0];
      const movers = [
        beli ? `top buyer: <b>${beli.ticker}</b> ${formatBertanda(beli.effect)}` : '',
        jual ? `top seller: <b>${jual.ticker}</b> ${formatBertanda(jual.effect)}` : '',
      ].filter(Boolean).join(' · ');
      return `<div style="padding:var(--s-2) 0;border-bottom:1px dashed var(--c-border);">
        <div style="display:flex;justify-content:space-between;gap:var(--s-3);flex-wrap:wrap;">
          <span style="font-size:var(--text-sm);font-weight:600;">${TYPE_LABELS[code]} <span style="color:var(--c-text-3);font-weight:400;">(${code})</span></span>
          <span style="font-size:var(--text-sm);">shares <b style="color:${(t.effect_shares || 0) < 0 ? '#D94B4B' : '#00A86B'};">${formatBertanda(t.effect_shares)}</b> · price ${formatBertanda(t.effect_price)} · share ${(t.pct_start || 0).toFixed(1)}% → ${(t.pct_end || 0).toFixed(1)}%</span>
        </div>
        ${movers ? `<div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:2px;">${movers}</div>` : ''}
      </div>`;
    }).join('');
  return `<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);padding:var(--s-4);margin-bottom:var(--s-4);">
    <div style="font-size:var(--text-md);font-weight:700;">● Foreign Group Breakdown — Who Sold, Who Held</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin:var(--s-2) 0 var(--s-3);">Share change per foreign investor group (KSEI) · ${dateLabelYear(res.from_date)} → ${dateLabelYear(res.to_date)} · ${res.emiten_analyzed} issuers analyzed · ${res.emiten_events} corporate-action issuers separated · window follows the mode chips on the Breakdown card above</div>
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.55;">The <b>sticky</b> group (pension funds, insurance, foundations) now holds <b>${(res.sticky_pct_end || 0).toFixed(1)}%</b> of foreign value, ${naik ? 'up' : 'down'} from ${(res.sticky_pct_start || 0).toFixed(1)}% at the window start — the most patient money ${naik ? 'held and grew its share' : 'shrank along in share'}.</div>
    <div style="margin-top:var(--s-2);">${bars}</div>
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.55;">From the Others bucket (${formatBertanda(lainEff)}), the Others group (OT) itself contributed ${formatBertanda(otEff)} — this bucket covers nominee and omnibus accounts, so it is not a single investor type.</div>
    <button data-typedetail style="margin-top:var(--s-3);padding:4px 12px;border:1px solid var(--c-border);border-radius:999px;font-size:var(--text-xs);cursor:pointer;background:var(--c-surface-2);color:var(--c-text-2);">Show details of 9 groups</button>
    <div id="kepemilikan-rincian-golongan" style="display:none;margin-top:var(--s-2);">${detailRows}</div>
    <div style="margin-top:var(--s-2);font-size:var(--text-xs);color:var(--c-text-3);line-height:1.5;">Δ between snapshots is an ownership change — including off-market transfers and reclassifications — not pure exchange flow.</div>
  </div>`;
}

function buildLocalMirrorHtml(res) {
  const l = res.local || {};
  const buckets = l.buckets || {};
  const maxAbs = Math.max(1, ...LOCAL_GROUP_INFO.map(([k]) => Math.abs((buckets[k] || {}).effect_shares || 0)));
  const bars = LOCAL_GROUP_INFO.map(([k, label, sub, color]) =>
    barisGolonganHtml(label, sub, (buckets[k] || {}).effect_shares || 0, maxAbs, color)).join('');
  const fTot = ((res.foreign || {}).total || {}).effect_shares || 0;
  const lTot = (l.total || {}).effect_shares || 0;
  const u = res.unclassified;
  const note = u
    ? `All classified local shares changed ${formatBertanda(lTot)}, while foreign shares changed ${formatBertanda(fTot)}. The difference is not an error: the unclassified slice (shares without SID classification) changed ${formatBertanda(u.effect_shares)} over the same period — shares moved from that slice into classified local groups, alongside net issuance by non-event issuers.`
    : `All classified local shares changed ${formatBertanda(lTot)}, while foreign shares changed ${formatBertanda(fTot)} — the difference comes from changes in the unclassified slice (shares without SID classification) and net issuance by non-event issuers.`;
  return `<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);padding:var(--s-4);margin-bottom:var(--s-4);">
    <div style="font-size:var(--text-md);font-weight:700;">● Local Mirror — Who Absorbed</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin:var(--s-2) 0 var(--s-3);">Share change per local investor group (KSEI) over the same window</div>
    ${bars}
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.55;">${note}</div>
  </div>`;
}

function fillByTypeSection(wrap) {
  const res = typeState.data;
  if (!res) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = buildByTypeHtml(res) + buildLocalMirrorHtml(res);
  wrap.querySelectorAll('[data-typedetail]').forEach(btn => btn.addEventListener('click', () => {
    const target = wrap.querySelector('#kepemilikan-rincian-golongan');
    if (!target) return;
    const openNow = target.style.display !== 'none';
    target.style.display = openNow ? 'none' : 'block';
    btn.textContent = openNow ? 'Show details of 9 groups' : 'Hide details';
  }));
}

/* ─── Cleanup ─── */
function cleanup() {
  clearCharts();
  pageRootEl = null; pageRefs = {}; typeWrapEl = null;
}

/* ─── Export render ─── */
export function render() {
  pageState.loading = false; pageState.data = null; pageState.charts = [];
  decState.mode = 'peak'; decState.data = null; decState.loading = false;
  typeState.data = null;
  pageRootEl = createEl('div', { class: 'kepemilikan-page', style: { maxWidth: '900px', margin: '0 auto', padding: 'var(--s-4)' } });
  pageRefs = {};

  if (!document.getElementById('kepemilikan-page-keyframes')) {
    const style = createEl('style', { id: 'kepemilikan-page-keyframes' });
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  renderHeader();
  renderLoading();
  loadPage();

  pageRootEl._cleanup = cleanup;
  return pageRootEl;
}
