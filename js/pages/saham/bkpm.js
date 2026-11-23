/* pages/saham/bkpm.js — BKPM viewer (Fase D2).
 * Realisasi investasi (fact_bkpm_raw) dari /api/bkpm: agregat saja,
 * tanpa dump baris mentah. Tab Ringkasan (tren per TW + grafik Total),
 * Sektor, Negara (PMA saja), Provinsi. Nilai uang di API dalam Rp juta;
 * tabel menampilkan Rp triliun (titik desimal). TW1-2024 ditampilkan
 * apa adanya, dengan satu baris catatan di bawah tabel ringkasan.
 */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { loadApexCharts, buildLineChartApex, destroyChart, createChartPanel } from '../../ui/chart.js';
import { fmtPrice } from '../../utils/format.js';
import { spinnerCardHtml } from '../../ui/loading.js';

const chartPanel = createChartPanel('bkpm-page');

const TABS = {
  summary: 'Ringkasan',
  sector: 'Sektor',
  country: 'Negara',
  province: 'Provinsi',
};
const LIST_LIMIT = 20;

const state = {
  tab: 'summary',
  period: null,
  periods: [],
  latest: null,
  items: [],
  total: 0,
  offset: 0,
  loading: false,
  charts: [],
};

let rootEl = null;
let refs = {};

/* Rp juta -> Rp triliun (titik desimal). Nilai di bawah Rp 0.01 T
   ditampilkan dalam Rp miliar (M) atau Rp juta (jt) agar tetap terbaca. */
function fmtT(juta) {
  if (juta == null) return '-';
  const t = juta / 1e6;
  if (t >= 0.01) return t.toFixed(2);
  const m = juta / 1e3;
  if (m >= 0.01) return `${m.toFixed(2)} M`;
  return `${juta.toFixed(0)} jt`;
}

/* '2026_tw3' -> '2026-07-01' (awal triwulan, untuk sumbu tanggal grafik). */
function periodToDate(p) {
  const m = String(p || '').match(/^(\d{4})_tw([1-4])$/);
  if (!m) return null;
  return `${m[1]}-${String((+m[2] - 1) * 3 + 1).padStart(2, '0')}-01`;
}

function clearCharts() {
  state.charts.forEach(destroyChart);
  state.charts = [];
}

/* ─── Muat data ─── */

async function loadPeriods() {
  try {
    const res = await Api.get('/bkpm/periods');
    state.periods = res.periods || [];
    state.latest = res.latest_period || null;
    if (!state.period) state.period = state.latest;
  } catch (e) {
    toast('Gagal memuat data BKPM', { type: 'error' });
  }
  renderHeader();
  renderPeriodSelect();
  renderBody();
  mountChart();
}

async function loadBreakdown(reset) {
  if (reset) {
    state.items = [];
    state.offset = 0;
    state.total = 0;
  }
  if (!state.period) return;
  state.loading = true;
  renderBody();
  try {
    const res = await Api.get('/bkpm/breakdown', {
      period: state.period, by: state.tab,
      limit: LIST_LIMIT, offset: state.offset,
    });
    state.total = res.total || 0;
    state.items = reset ? (res.items || []) : state.items.concat(res.items || []);
  } catch (e) {
    toast('Gagal memuat rincian BKPM', { type: 'error' });
  }
  state.loading = false;
  renderBody();
}

async function mountChart() {
  if (!rootEl || state.tab !== 'summary' || !state.periods.length) return;
  const container = rootEl.querySelector('.bkpm-page__chart');
  if (!container) return;
  clearCharts();
  try {
    await loadApexCharts();
  } catch (e) {
    console.error('[BKPM] Failed to load chart library:', e);
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-3);font-size:var(--text-sm);">
      <span style="margin-right:var(--s-2);">${icons['alert-circle']}</span> Failed to load chart library
    </div>`;
    return;
  }
  try {
    const data = state.periods
      .map((p) => ({ date: periodToDate(p.period), close: p.total / 1e6 }))
      .filter((d) => d.date && d.close != null);
    const chart = buildLineChartApex(container, data, '#0EA5A4', {
      height: 260, name: 'Total (Rp T)',
    });
    if (chart) state.charts.push(chart);
  } catch (e) {
    console.error('[BKPM] Chart failed:', e);
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-3);font-size:var(--text-sm);">
      <span style="margin-right:var(--s-2);">${icons['alert-circle']}</span> Chart error
    </div>`;
  }
}

/* ─── DOM ─── */

function renderHeader() {
  if (!rootEl) return;
  const el = rootEl.querySelector('.bkpm-page__head');
  if (!el) return;
  const n = state.periods.length;
  const first = n ? state.periods[0].period : '-';
  const last = state.latest || '-';
  const rows = state.periods.reduce((a, p) => a + (p.rows || 0), 0);
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--s-3);">
      <div>
        <h1 style="margin:0;">BKPM — Realisasi Investasi</h1>
        <div style="font-size:var(--text-sm);color:var(--c-text-3);margin-top:4px;">${n ? `${n} triwulan · ${first} – ${last} · ${fmtPrice(rows)} baris` : 'Memuat…'}</div>
      </div>
    </div>`;
}

function renderTabs() {
  if (!rootEl) return;
  const el = rootEl.querySelector('.bkpm-page__tabs');
  if (!el) return;
  el.innerHTML = Object.keys(TABS).map((k) => `
    <button type="button" class="btn btn--sm${state.tab === k ? ' btn--primary' : ''}" data-tab="${k}">${TABS[k]}</button>
  `).join('');
  el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    if (state.tab === b.dataset.tab) return;
    state.tab = b.dataset.tab;
    clearCharts();
    renderTabs();
    renderPeriodSelect();
    renderBody();
    if (state.tab === 'summary') mountChart();
    else loadBreakdown(true);
  }));
}

function renderPeriodSelect() {
  if (!rootEl) return;
  const wrap = rootEl.querySelector('.bkpm-page__period');
  if (!wrap) return;
  // Dropdown periode hanya untuk tab rincian; ringkasan menampilkan semua TW.
  if (state.tab === 'summary' || !state.periods.length) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = `
    <div style="display:flex;gap:var(--s-2);align-items:center;">
      <span style="font-size:var(--text-sm);color:var(--c-text-2);">Periode:</span>
      <select style="padding:var(--s-2) var(--s-3);">
        ${state.periods.map((p) => `<option value="${p.period}"${p.period === state.period ? ' selected' : ''}>${p.period}</option>`).join('')}
      </select>
    </div>`;
  wrap.querySelector('select').addEventListener('change', (e) => {
    state.period = e.target.value;
    loadBreakdown(true);
  });
}

function valueCells(r, withSplit) {
  if (!withSplit) {
    return `<td style="text-align:right;">${fmtT(r.total)}</td>
      <td style="text-align:right;">${fmtPrice(r.rows)}</td>`;
  }
  return `<td style="text-align:right;">${fmtT(r.total)}</td>
    <td style="text-align:right;">${fmtT(r.pma)}</td>
    <td style="text-align:right;">${fmtT(r.pmdn)}</td>
    <td style="text-align:right;">${fmtPrice(r.rows)}</td>`;
}

function renderBody() {
  if (!rootEl) return;
  const el = rootEl.querySelector('.bkpm-page__body');
  if (!el) return;
  if (state.tab === 'summary') {
    renderSummary(el);
    return;
  }
  renderBreakdown(el);
}

function renderSummary(el) {
  if (state.loading && state.periods.length === 0) {
    el.innerHTML = spinnerCardHtml('Loading…');
    return;
  }
  if (state.periods.length === 0) {
    el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;">
      <div style="font-size:var(--text-sm);color:var(--c-text-3);">Belum ada data BKPM.</div></div>`;
    return;
  }
  const rows = state.periods.map((p) => `
    <tr>
      <td>${p.period}</td>
      ${valueCells(p, true)}
    </tr>`).join('');
  const panel = chartPanel('Total per triwulan', 'Realisasi investasi (Rp triliun)', [
    { color: '#0EA5A4', label: 'Total' },
  ], 260);
  el.innerHTML = '';
  el.appendChild(panel);
  const tableWrap = createEl('div', {}, []);
  tableWrap.innerHTML = `
    <div class="card" style="overflow-x:auto;">
      <table class="table">
        <thead><tr><th>Triwulan</th><th style="text-align:right;">Total (Rp T)</th><th style="text-align:right;">PMA (Rp T)</th><th style="text-align:right;">PMDN (Rp T)</th><th style="text-align:right;">Baris</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p style="color:var(--c-text-3);font-size:var(--text-sm);margin-top:var(--s-3);">TW1-2024: berkas sumber memuat baris duplikat (88.294 baris), sehingga total triwulan ini lebih besar dari kondisi sebenarnya.</p>`;
  el.appendChild(tableWrap);
}

function renderBreakdown(el) {
  const isCountry = state.tab === 'country';
  if (state.loading && state.items.length === 0) {
    el.innerHTML = spinnerCardHtml('Loading…');
    return;
  }
  if (state.items.length === 0) {
    el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;">
      <div style="font-size:var(--text-sm);color:var(--c-text-3);">Tidak ada data untuk periode ini.</div></div>`;
    return;
  }
  const head = isCountry
    ? `<tr><th>Negara</th><th style="text-align:right;">Total / PMA (Rp T)</th><th style="text-align:right;">Baris</th></tr>`
    : `<tr><th>${state.tab === 'sector' ? 'Sektor' : 'Provinsi'}</th><th style="text-align:right;">Total (Rp T)</th><th style="text-align:right;">PMA (Rp T)</th><th style="text-align:right;">PMDN (Rp T)</th><th style="text-align:right;">Baris</th></tr>`;
  const rows = state.items.map((r) => `
    <tr>
      <td><div style="font-weight:600;">${r.key || '—'}</div></td>
      ${valueCells(r, !isCountry)}
    </tr>`).join('');
  const shown = state.offset + state.items.length;
  const more = (shown < state.total)
    ? `<button type="button" class="btn btn--sm bkpm-page__more">Load more (${fmtPrice(state.total - shown)} remaining)</button>`
    : '';
  const note = isCountry
    ? `<p style="color:var(--c-text-3);font-size:var(--text-sm);margin-top:var(--s-3);">PMA saja — PMDN tidak punya negara asal.</p>`
    : `<p style="color:var(--c-text-3);font-size:var(--text-sm);margin-top:var(--s-3);">Nilai di bawah Rp 0.01 T ditampilkan dalam Rp miliar (M) atau Rp juta (jt).</p>`;
  el.innerHTML = `
    <div class="card" style="overflow-x:auto;">
      <table class="table">
        <thead>${head}</thead>
        <tbody>${rows}</tbody>
      </table>
    </div>${note}${more}`;
  const moreBtn = el.querySelector('.bkpm-page__more');
  if (moreBtn) moreBtn.addEventListener('click', () => {
    state.offset += state.items.length;
    loadBreakdown(false);
  });
}

function cleanup() {
  clearCharts();
}

/* ─── Export render ─── */
export function render() {
  const page = createEl('div', { class: 'bkpm-page' });

  const head = createEl('div', { class: 'bkpm-page__head' });
  page.appendChild(head);

  const tabs = createEl('div', { class: 'bkpm-page__tabs', style: { display: 'flex', gap: 'var(--s-2)', margin: 'var(--s-4) 0' } });
  page.appendChild(tabs);

  const period = createEl('div', { class: 'bkpm-page__period', style: { marginBottom: 'var(--s-4)' } });
  page.appendChild(period);

  const body = createEl('div', { class: 'bkpm-page__body' });
  page.appendChild(body);

  rootEl = page;
  refs = { head, tabs, period, body };

  renderHeader();
  renderTabs();
  renderPeriodSelect();
  renderBody();
  loadPeriods();

  page._cleanup = () => {
    cleanup();
    rootEl = null;
    refs = {};
  };

  return page;
}
