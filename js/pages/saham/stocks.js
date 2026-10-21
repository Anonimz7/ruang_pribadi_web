/* pages/stocks.js — Stock Analysis (Anti-Slop, ApexCharts) */
import { $, on, createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { loadApexCharts, buildBaseOptions, renderChart, destroyChart, normalizeDate, toTs, buildLineChartApex, buildBarChartApex, buildPositionChartApex, createChartPanel } from '../../ui/chart.js';
const chartPanel = createChartPanel('stocks-page');
import { fmtPrice, formatNilaiSingkat, dateLabel, dateLabelYear } from '../../utils/format.js';
import { StockSectorBadge, DelistedBadge } from '../../ui/stock-widgets.js';
import { StockListItem, StockDataPoint, StockSummary, StockAnalysis } from '../../models/stocks.js';
import { spinnerCardHtml } from '../../ui/loading.js';

/* Kartu info saham khusus halaman ini (fork dari StockInfoCard di
   ui/stock-widgets.js) — memuat seksi Remarks + Riwayat Remarks yang
   hanya ada di halaman analisis saham. */
function StockInfoCardRemarks(stock) {
  const hasSector = !!(stock.sector || stock.primarySector);
  const hasCore = !!(stock.coreBusiness && stock.coreBusiness.length > 0);
  const hasRemarks = !!stock.remarksText;
  if (!hasSector && !hasCore && !hasRemarks && stock.labelDelisted == null) return null;
  const card = createEl('div', { class: 'card', style: { marginTop: 'var(--s-3)', background: 'var(--c-surface-2)' } });
  let html = `<div style="display:flex;align-items:center;gap:var(--s-2);margin-bottom:var(--s-3);">
    <span style="color:var(--c-primary);">${icons['globe']}</span>
    <span style="font-size:var(--text-sm);font-weight:700;">Info Sektor</span>
    <span style="margin-left:auto;"></span>
  </div>`;
  if (stock.sector) html += `<div style="display:flex;gap:var(--s-2);margin-bottom:var(--s-1);"><span style="width:120px;flex-shrink:0;font-size:var(--text-sm);font-weight:600;color:var(--c-text-2);">Sektor</span><span style="font-size:var(--text-sm);color:var(--c-text);">${stock.sector}</span></div>`;
  if (stock.primarySector) html += `<div style="display:flex;gap:var(--s-2);margin-bottom:var(--s-1);"><span style="width:120px;flex-shrink:0;font-size:var(--text-sm);font-weight:600;color:var(--c-text-2);">Sub Sektor Primer</span><span style="font-size:var(--text-sm);color:var(--c-text);">${stock.primarySector}</span></div>`;
  if (stock.subSector) html += `<div style="display:flex;gap:var(--s-2);margin-bottom:var(--s-1);"><span style="width:120px;flex-shrink:0;font-size:var(--text-sm);font-weight:600;color:var(--c-text-2);">Sub Sektor</span><span style="font-size:var(--text-sm);color:var(--c-text);">${stock.subSector}</span></div>`;
  if (hasRemarks) {
    html += `<div style="display:flex;gap:var(--s-2);margin-bottom:var(--s-1);"><span style="width:120px;flex-shrink:0;font-size:var(--text-sm);font-weight:600;color:var(--c-text-2);">Remarks</span><span style="font-size:var(--text-sm);color:var(--c-text);">${remarksSegmentsHtml(stock.remarksSegments, stock.remarksText)}</span></div>`;
    html += `<div style="display:flex;gap:var(--s-2);margin-bottom:var(--s-1);">
      <span style="width:120px;flex-shrink:0;"></span>
      <span style="min-width:0;">
        <button type="button" class="stocks-page__remarks-history-btn" aria-expanded="false"
          aria-label="Tampilkan riwayat perubahan remarks">
          <span>Riwayat Remarks</span>${icons['chevron-right']}
        </button>
        <div class="stocks-page__remarks-history-list" style="display:none;margin-top:var(--s-2);"></div>
      </span>
    </div>`;
  }
  if (stock.sector || stock.subSector) {
    html += `<div style="display:flex;gap:var(--s-1);flex-wrap:wrap;margin-top:var(--s-2);">`;
    if (stock.sector) { const b = StockSectorBadge(stock.sector); if (b) html += b.outerHTML; }
    if (stock.primarySector) { const b = StockSectorBadge(stock.primarySector, true); if (b) html += b.outerHTML; }
    if (stock.subSector) { const b = StockSectorBadge(stock.subSector, true); if (b) html += b.outerHTML; }
    html += `</div>`;
  }
  if (hasCore) {
    html += `<div style="margin-top:var(--s-3);padding-top:var(--s-3);border-top:1px solid var(--c-border);">
      <div style="font-size:var(--text-xs);font-weight:600;color:var(--c-text-2);margin-bottom:var(--s-1);">Bisnis Inti</div>
      <p style="font-size:var(--text-sm);line-height:1.5;color:var(--c-text-2);">${stock.coreBusiness}</p>
    </div>`;
    const query = encodeURIComponent(`Apa itu saham ${stock.ticker} (${stock.companyName})?`);
    html += `<a href="https://www.google.com/search?udm=50&q=${query}" target="_blank" rel="noopener" class="btn btn--secondary stocks-page__learn-btn" style="margin-top:var(--s-3);font-size:var(--text-sm);">Pelajari ${stock.companyName}</a>`;
  }
  card.innerHTML = html;
  if (hasRemarks) wireRemarksHistory(card, stock.ticker);
  const headSpan = card.querySelector('span:last-child');
  if (headSpan) {
    const badge = DelistedBadge({ labelDelisted: stock.labelDelisted, stockStatus: stock.stockStatus, statusReason: stock.statusReason });
    if (badge) headSpan.appendChild(badge);
  }
  return card;
}

/* ─── Riwayat Remarks (lazy, per ticker, pagination) ─── */
const REMARKS_HISTORY_PAGE = 20; // baris per halaman (total riwayat max ±127)

function escText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Warna potongan remarks: danger = sanksi/pelanggaran berat (merah),
   warning = pelanggaran administratif (oranye), info = teks biasa. */
const REMARKS_TONE_STYLE = {
  danger: 'color:var(--c-danger);font-weight:600;',
  warning: 'color:var(--c-warn);',
};

function remarksSegmentsHtml(segments, fallback) {
  const list = (Array.isArray(segments) ? segments : []).filter((s) => s && s.text);
  if (!list.length) return escText(fallback || '');
  return list.map((s, i) => {
    const style = REMARKS_TONE_STYLE[s.tone];
    const body = style
      ? `<span style="${style}">${escText(s.text)}</span>`
      : escText(s.text);
    return i ? ` · ${body}` : body;
  }).join('');
}

async function fetchRemarksHistory(ticker) {
  if (stockState.remarksHistory[ticker]) return stockState.remarksHistory[ticker];
  const res = await Api.get(`/idx/stocks/${ticker}/remarks-history`, { limit: 500 });
  stockState.remarksHistory[ticker] = (res && Array.isArray(res.items))
    ? res
    : { ticker, count: 0, items: [] };
  return stockState.remarksHistory[ticker];
}

function renderRemarksHistory(res, start = 0) {
  const all = res.items || [];
  const total = res.count || all.length;
  if (!all.length) {
    return '<div style="font-size:var(--text-xs);color:var(--c-text-2);">Belum ada riwayat perubahan remarks.</div>';
  }
  const end = Math.min(start + REMARKS_HISTORY_PAGE, all.length);
  let html = all.slice(start, end).map((it) => `
    <div style="display:flex;gap:var(--s-2);font-size:var(--text-xs);margin-bottom:2px;align-items:baseline;">
      <span style="flex-shrink:0;width:76px;color:var(--c-text-2);">${escText(it.date)}</span>
      <span style="color:var(--c-text);min-width:0;">${remarksSegmentsHtml(it.segments, it.text)}</span>
    </div>`).join('');

  if (all.length > REMARKS_HISTORY_PAGE) {
    html += `
      <div class="stocks-page__remarks-history-nav">
        <button type="button" class="stocks-page__remarks-nav-btn" data-nav="prev"${start > 0 ? '' : ' disabled'}>‹ Sebelumnya</button>
        <span class="stocks-page__remarks-nav-info">${start + 1}–${end} dari ${total}</span>
        <button type="button" class="stocks-page__remarks-nav-btn" data-nav="next"${end < all.length ? '' : ' disabled'}>Berikutnya ›</button>
      </div>`;
  } else if (total > all.length) {
    // cadangan bila server membatasi jumlah item yang dikirim
    html += `<div style="font-size:var(--text-xs);color:var(--c-text-2);margin-top:var(--s-1);">…menampilkan ${all.length} dari ${total} perubahan</div>`;
  }
  return html;
}

function setRemarksHistoryBtn(btn, open) {
  btn.innerHTML = `<span>Riwayat Remarks</span>${open ? icons['chevron-down'] : icons['chevron-right']}`;
  btn.setAttribute('aria-expanded', String(open));
  btn.setAttribute('aria-label',
    (open ? 'Sembunyikan' : 'Tampilkan') + ' riwayat perubahan remarks');
}

function wireRemarksHistory(card, ticker) {
  const btn = card.querySelector('.stocks-page__remarks-history-btn');
  const list = card.querySelector('.stocks-page__remarks-history-list');
  if (!btn || !list) return;
  let res = null;   // data (di-cache di stockState.remarksHistory)
  let start = 0;    // offset halaman aktif

  const tampilkanRemarks = () => { list.innerHTML = res ? renderRemarksHistory(res, start) : ''; };

  // Pagination dikendalikan lewat delegation agar tetap hidup
  // setiap kali isi list diganti (innerHTML).
  list.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (!nav || !res) return;
    const count = (res.items || []).length;
    const maxStart = Math.max(0, Math.ceil(count / REMARKS_HISTORY_PAGE) - 1) * REMARKS_HISTORY_PAGE;
    start = nav.dataset.nav === 'next'
      ? Math.min(start + REMARKS_HISTORY_PAGE, maxStart)
      : Math.max(start - REMARKS_HISTORY_PAGE, 0);
    tampilkanRemarks();
    // pertahankan fokus pada tombol navigasi (elemennya diganti tampilkanRemarks)
    const want = nav.dataset.nav;
    const same = list.querySelector(`[data-nav="${want}"]`);
    const alt = list.querySelector('[data-nav]:not([disabled])');
    if (same && !same.disabled) same.focus();
    else if (alt) alt.focus();
  });

  btn.addEventListener('click', async () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    if (open) {
      setRemarksHistoryBtn(btn, false);
      list.style.display = 'none';
      return;
    }
    setRemarksHistoryBtn(btn, true);
    list.style.display = '';
    if (res) return;
    list.innerHTML = '<div style="font-size:var(--text-xs);color:var(--c-text-2);">Memuat riwayat…</div>';
    try {
      res = await fetchRemarksHistory(ticker);
      start = 0;
      tampilkanRemarks();
    } catch (e) {
      console.error('[Stocks] remarks history error:', e);
      res = null;
      list.innerHTML = '';
      list.style.display = 'none';
      btn.remove();
      toast('Gagal memuat riwayat remarks', 'danger');
    }
  });
}

/* ─── Constants ─── */
const PERIODS = [30, 60, 90, 180, 365];
const COMPARE_COLORS = ['#00A86B', '#5B8FF9', '#F6903D', '#E86452', '#9270CA', '#5AD8A6', '#6DC8EC', '#F6C022'];

/* ─── Formatters ─── */

function fullDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* ─── ApexCharts helpers ─── */

function buildForeignChartApex(container, data) {
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
    data: data.filter(d => d.date && d.netForeign != null).map(d => ({ x: toTs(d.date), y: d.netForeign })),
  }];
  opts.tooltip.y = { formatter: (v) => (v >= 0 ? '+' : '') + formatNilaiSingkat(v) };
  return renderChart(container, opts);
}

function buildOwnershipChartApex(container, series) {
  const opts = buildBaseOptions({ height: 230, type: 'line' });
  opts.colors = ['#E8A33D'];
  opts.stroke.width = 2.5;
  opts.series = [{
    name: 'Kepemilikan asing (lembar)',
    data: series.filter(d => d.date && d.foreign_shares != null).map(d => ({ x: toTs(d.date), y: d.foreign_shares })),
  }];
  opts.tooltip.y = { formatter: (v) => formatNilaiSingkat(v) + ' lbr' };
  return renderChart(container, opts);
}

function buildCompareChartApex(container, primaryData, compareData, compareTickers, primaryTicker) {
  const opts = buildBaseOptions({ height: 300, type: 'line' });
  opts.colors = COMPARE_COLORS;
  opts.stroke.width = [2.5, 2, 2, 2, 2, 2, 2, 2];
  opts.yaxis = opts.yaxis || {};
  opts.yaxis.labels = opts.yaxis.labels || {};
  opts.yaxis.labels.formatter = (v) => {
    if (v == null) return '';
    return v.toFixed(1) + '%';
  };

  const validPrimary = primaryData.filter(d => d.close != null);
  const base1 = validPrimary[0]?.close || 1;
  const dateMap = validPrimary.map(d => d.date);

  const series = [{
    name: primaryTicker,
    data: validPrimary.map((d, i) => ({ x: i, y: ((d.close - base1) / base1) * 100 })),
  }];

  compareTickers.forEach((t) => {
    const cd = compareData[t];
    if (!cd || !cd.length) return;
    const validCd = cd.filter(d => d.close != null);
    const base = validCd[0]?.close || 1;
    series.push({
      name: t,
      data: validCd.map((d, i) => ({ x: i, y: ((d.close - base) / base) * 100 })),
    });
  });

  opts.series = series;

  opts.xaxis = opts.xaxis || {};
  opts.xaxis.type = 'numeric';
  opts.xaxis.tickAmount = 5;
  opts.xaxis.labels = {
    formatter: (val) => {
      const idx = Math.round(val);
      if (idx < 0 || idx >= dateMap.length) return '';
      return dateLabel(dateMap[idx]);
    }
  };

  opts.tooltip = opts.tooltip || {};
  opts.tooltip.x = {
    formatter: (val) => {
      const idx = Math.round(val);
      const date = dateMap[idx];
      return date ? fullDate(date) : String(idx);
    }
  };

  return renderChart(container, opts);
}

/* BII Score comparison: plot nilai mentah 0-100 tiap saham (sudah ter-normalisasi per saham di backend) */
function buildCompareBiiChartApex(container, primaryData, compareData, compareTickers, primaryTicker) {
  const opts = buildBaseOptions({ height: 210, type: 'line' });
  opts.colors = COMPARE_COLORS;
  opts.stroke.width = [2.5, 2, 2, 2, 2, 2, 2, 2];
  opts.yaxis = opts.yaxis || {};
  opts.yaxis.min = 0;
  opts.yaxis.max = 100;

  const validPrimary = primaryData.filter(d => d.biiScore != null);
  const dateMap = validPrimary.map(d => d.date);

  const series = [{
    name: primaryTicker,
    data: validPrimary.map((d, i) => ({ x: i, y: d.biiScore })),
  }];

  compareTickers.forEach((t) => {
    const cd = compareData[t];
    if (!cd || !cd.length) return;
    const validCd = cd.filter(d => d.biiScore != null);
    series.push({
      name: t,
      data: validCd.map((d, i) => ({ x: i, y: d.biiScore })),
    });
  });

  opts.series = series;

  opts.xaxis = opts.xaxis || {};
  opts.xaxis.type = 'numeric';
  opts.xaxis.tickAmount = 5;
  opts.xaxis.labels = {
    formatter: (val) => {
      const idx = Math.round(val);
      if (idx < 0 || idx >= dateMap.length) return '';
      return dateLabel(dateMap[idx]);
    }
  };

  opts.tooltip = opts.tooltip || {};
  opts.tooltip.x = {
    formatter: (val) => {
      const idx = Math.round(val);
      const date = dateMap[idx];
      return date ? fullDate(date) : String(idx);
    }
  };

  return renderChart(container, opts);
}

/* ─── State ─── */
const stockState = {
  searchTerm: '', searchResults: [], searching: false,
  selectedTicker: '', days: 30, analysis: null, loading: false,
  foreignPos: null,
  foreignOwn: null,
  foreignAnchor: null,
  compareMode: false, compareTickers: [], compareData: {}, compareLoading: false,
  charts: [],
  remarksHistory: {}, // cache riwayat remarks per ticker (diambil sekali)
};

/* ─── API ─── */
async function jalankanPencarian(q) {
  if (!q.trim()) { stockState.searchResults = []; return; }
  stockState.searching = true;
  renderSearchDropdown();
  try {
    const res = await Api.get('/idx/stocks', { q, limit: 8 });
    let list = [];
    if (Array.isArray(res)) {
      list = res;
    } else if (res && Array.isArray(res.stocks)) {
      list = res.stocks;
    }
    stockState.searchResults = list.map(d => new StockListItem(d));
  } catch (_) { stockState.searchResults = []; }
  finally { stockState.searching = false; renderSearchDropdown(); }
}

async function loadAnalysis(ticker, { keepCompare = false } = {}) {
  const t = ticker.toUpperCase();
  stockState.loading = true; stockState.searchResults = []; stockState.selectedTicker = t;
  stockState.analysis = null;
  stockState.foreignPos = null;
  stockState.foreignOwn = null;
  stockState.foreignAnchor = null;
  if (!keepCompare) clearCompare();
  renderStatusPencarian();
  try {
    const res = await Api.get(`/idx/stocks/${t}/analysis`, { days: stockState.days });
    stockState.analysis = new StockAnalysis(res);
    const fp = await Api.get(`/idx/stocks/${t}/foreign-position`, { bucket: stockState.days }).catch(() => null);
    stockState.foreignPos = (fp && (fp.data || fp)) || null;
    const fo = await Api.get(`/idx/stocks/${t}/foreign-ownership`).catch(() => null);
    stockState.foreignOwn = (fo && (fo.data || fo)) || null;
    const fa = await Api.get(`/idx/stocks/${t}/foreign-ownership-anchored`).catch(() => null);
    stockState.foreignAnchor = (fa && (fa.data || fa)) || null;
    for (const ct of stockState.compareTickers) { await refreshCompare(ct); }
  } catch (e) {
    toast('Gagal memuat analisis: ' + (e.message || e), 'danger');
    console.error('[Stocks] Analysis error:', e);
  } finally {
    stockState.loading = false;
    renderAnalysis();
  }
}

async function addCompare(ticker) {
  const t = ticker.toUpperCase();
  if (stockState.compareTickers.includes(t)) return;
  stockState.compareLoading = true;
  renderCompareBar();
  try {
    const res = await Api.get(`/idx/stocks/${t}/analysis`, { days: stockState.days });
    const analysis = new StockAnalysis(res);
    if (!analysis.data.length) { toast('Tidak ada data untuk ' + t, 'warn'); stockState.compareLoading = false; renderCompareBar(); return; }
    stockState.compareTickers.push(t);
    stockState.compareData[t] = analysis.data.map(d => ({...d}));
    stockState.compareMode = true;
  } catch (e) { toast('Gagal membandingkan: ' + (e.message || e), 'danger'); }
  finally { stockState.compareLoading = false; renderCompareBar(); renderAnalysis(); }
}

async function refreshCompare(ticker) {
  const t = ticker.toUpperCase();
  if (!stockState.compareTickers.includes(t)) return;
  try {
    const res = await Api.get(`/idx/stocks/${t}/analysis`, { days: stockState.days });
    const analysis = new StockAnalysis(res);
    if (analysis.data.length) stockState.compareData[t] = analysis.data.map(d => ({...d}));
  } catch (_) {}
}

function removeCompare(ticker) {
  stockState.compareTickers = stockState.compareTickers.filter(t => t !== ticker);
  delete stockState.compareData[ticker];
  if (!stockState.compareTickers.length) stockState.compareMode = false;
  renderCompareBar(); renderAnalysis();
}

function clearCompare() {
  stockState.compareTickers = [];
  stockState.compareData = {};
  stockState.compareMode = false;
  if (stockRefs.compareBar) {
    stockRefs.compareBar.remove();
    stockRefs.compareBar = null;
  }
}

/* ─── DOM ─── */
let stockRootEl = null;
let stockRefs = {};

function clearCharts() {
  stockState.charts.forEach(c => destroyChart(c));
  stockState.charts = [];
}

function renderStatusPencarian() {
  renderLoading(); renderSearchDropdown();
}

/* ─── Render: Toolbar (once) ─── */
function renderToolbarOnce() {
  const toolbar = createEl('div', { class: 'stocks-page__toolbar' });
  const row = createEl('div', { style: { position: 'relative', flex: '1 1 300px' } });
  const searchWrap = createEl('div', { class: 'search', style: { width: '100%' } });
  searchWrap.innerHTML = `<span class="search__icon">${icons['search']}</span>`;
  const input = createEl('input', {
    type: 'text', class: 'search__input stocks-page__search-input',
    placeholder: 'Cari ticker (BBCA, GOTO...)', value: stockState.searchTerm,
    'aria-label': 'Cari saham', autocomplete: 'off',
  });
  on(input, 'input', (e) => {
    stockState.searchTerm = e.target.value;
    clearTimeout(stockState._searchDebounce);
    stockState._searchDebounce = setTimeout(() => jalankanPencarian(stockState.searchTerm), 300);
  });
  on(input, 'keydown', (e) => { if (e.key === 'Enter' && stockState.searchTerm.trim()) loadAnalysis(stockState.searchTerm.trim()); });
  searchWrap.appendChild(input);
  row.appendChild(searchWrap);

  const dropdown = createEl('div', {
    class: 'stocks-page__dropdown',
    style: {
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      borderRadius: 'var(--radius)', zIndex: 50, maxHeight: '250px',
      overflow: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', display: 'none',
    }
  });
  row.appendChild(dropdown);
  stockRefs.searchInput = input;
  stockRefs.searchDropdown = dropdown;
  toolbar.appendChild(row);

  const chips = createEl('div', {
    class: 'stocks-page__periods',
    style: { display: 'flex', gap: 'var(--s-1)', flexWrap: 'wrap', marginTop: 'var(--s-3)' }
  });
  PERIODS.forEach(d => {
    const chip = createEl('button', {
      class: `btn btn--sm stocks-page__chip ${stockState.days === d ? 'stocks-page__chip--active' : ''}`,
      style: {
        padding: 'var(--s-1) var(--s-3)', fontSize: 'var(--text-xs)', fontWeight: 600,
        borderRadius: '16px', border: '1px solid var(--c-border)',
        background: stockState.days === d ? 'var(--c-accent)' : 'transparent',
        color: stockState.days === d ? '#fff' : 'var(--c-text-2)',
      }
    });
    chip.textContent = d + 'H';
    on(chip, 'click', () => { stockState.days = d; updatePeriodChips(); if (stockState.selectedTicker) loadAnalysis(stockState.selectedTicker, { keepCompare: true }); });
    chips.appendChild(chip);
  });
  stockRefs.periodChips = chips;
  toolbar.appendChild(chips);
  stockRootEl.appendChild(toolbar);
}

function updatePeriodChips() {
  if (!stockRefs.periodChips) return;
  Array.from(stockRefs.periodChips.children).forEach((chip, i) => {
    const d = PERIODS[i];
    const active = stockState.days === d;
    chip.style.background = active ? 'var(--c-accent)' : 'transparent';
    chip.style.color = active ? '#fff' : 'var(--c-text-2)';
    chip.classList.toggle('stocks-page__chip--active', active);
  });
}

/* ─── Render: Search dropdown ─── */
function renderSearchDropdown() {
  const dd = stockRefs.searchDropdown;
  if (!dd) return;
  if (stockState.searching) {
    dd.style.display = 'block';
    dd.innerHTML = `<div style="padding:var(--s-4);text-align:center;font-size:var(--text-sm);color:var(--c-text-3);">Mencari...</div>`;
    return;
  }
  if (!stockState.searchResults.length) { dd.style.display = 'none'; dd.innerHTML = ''; return; }
  dd.style.display = 'block';
  dd.innerHTML = stockState.searchResults.map(s => {
    const sectorBadge = s.sector ? StockSectorBadge(s.sector, true) : null;
    const delistedBadge = s.isDelisted || s.isBlacklisted
      ? DelistedBadge({ labelDelisted: s.labelDelisted, stockStatus: s.stockStatus, statusReason: s.statusReason, small: true })
      : null;
    return `
      <div class="stocks-page__result-item" data-ticker="${s.ticker}" style="padding:var(--s-2) var(--s-3);cursor:pointer;display:flex;align-items:center;gap:var(--s-2);border-bottom:1px solid var(--c-border);" onmouseover="this.style.background='var(--c-surface-2)'" onmouseout="this.style.background='transparent'">
        <span style="color:var(--c-accent);flex-shrink:0;">${icons['trending-up']}</span>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:var(--s-1);flex-wrap:wrap;">
            <span style="font-weight:600;font-size:var(--text-sm);">${s.ticker}</span>
            ${sectorBadge ? sectorBadge.outerHTML : ''}
            ${delistedBadge ? delistedBadge.outerHTML : ''}
          </div>
          <div style="font-size:var(--text-xs);color:var(--c-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.companyName}</div>
        </div>
      </div>`;
  }).join('');
  dd.querySelectorAll('.stocks-page__result-item').forEach(item => {
    on(item, 'click', () => { stockState.searchTerm = item.dataset.ticker; stockRefs.searchInput.value = item.dataset.ticker; loadAnalysis(item.dataset.ticker); });
  });
}

/* ─── Render: Compare bar ─── */
function renderCompareBar() {
  let el = stockRefs.compareBar;
  if (!stockState.analysis) { if (el) { el.remove(); stockRefs.compareBar = null; } return; }
  if (!el) {
    el = createEl('div', { class: 'stocks-page__compare-bar', style: { marginTop: 'var(--s-3)' } });
    stockRefs.compareBar = el;
    stockRootEl.insertBefore(el, stockRefs.analysisContainer || null);
  }
  let html = `<div style="display:flex;align-items:center;gap:var(--s-2);flex-wrap:wrap;">
    <span style="font-size:var(--text-xs);font-weight:600;color:var(--c-text-3);display:flex;align-items:center;gap:var(--s-1);">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h3v3h-3zM8 3h3v3H8zM5 8h14v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8zM12 12v4"/></svg>
      Bandingkan
    </span>
    <button class="btn btn--secondary btn--sm stocks-page__add-compare" style="padding:var(--s-1) var(--s-2);font-size:var(--text-xs);">${icons['plus']} Tambah</button>
  </div>`;
  if (stockState.compareTickers.length) {
    html += `<div style="display:flex;gap:var(--s-1);flex-wrap:wrap;margin-top:var(--s-2);">`;
    html += `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:${COMPARE_COLORS[0]}1A;border:1px solid ${COMPARE_COLORS[0]}66;border-radius:16px;font-size:var(--text-xs);font-weight:600;color:${COMPARE_COLORS[0]};"><span style="width:8px;height:8px;border-radius:50%;background:${COMPARE_COLORS[0]};display:inline-block;"></span>${stockState.analysis.ticker}</span>`;
    stockState.compareTickers.forEach((t, i) => {
      const c = COMPARE_COLORS[(i + 1) % COMPARE_COLORS.length];
      html += `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:${c}1A;border:1px solid ${c}66;border-radius:16px;font-size:var(--text-xs);font-weight:600;color:${c};"><span style="width:8px;height:8px;border-radius:50%;background:${c};display:inline-block;"></span>${t}<button class="btn btn--ghost btn--sm stocks-page__remove-compare" data-ticker="${t}" style="padding:0;width:16px;height:16px;min-width:16px;min-height:16px;color:var(--c-text-3);margin-left:2px;" aria-label="Hapus ${t}">${icons['x']}</button></span>`;
    });
    html += `</div>`;
  }
  if (stockState.compareLoading) html += `<div style="margin-top:var(--s-2);font-size:var(--text-xs);color:var(--c-text-3);">Memuat data perbandingan...</div>`;
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
    role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tambah Saham untuk Dibandingkan',
  });
  const sheet = createEl('div', { class: 'stocks-page__compare-sheet' });
  sheet.innerHTML = `
    <div class="stocks-page__compare-handle"></div>
    <div class="stocks-page__compare-head">
      <h3>Tambah Saham untuk Dibandingkan</h3>
      <button type="button" class="btn btn--ghost stocks-page__compare-close" aria-label="Tutup">${icons['x']}</button>
    </div>
    <div class="search stocks-page__compare-search"><span class="search__icon">${icons['search']}</span><input type="text" class="search__input stocks-page__compare-input" placeholder="Cari ticker (BBCA, GOTO...)" autofocus></div>
    <div class="stocks-page__compare-results"></div>
  `;
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  const tanganiTombolModalBandingkan = (e) => { if (e.key === 'Escape') tutupModalBandingkan(); };
  const tutupModalBandingkan = () => { document.removeEventListener('keydown', tanganiTombolModalBandingkan); overlay.remove(); };
  document.addEventListener('keydown', tanganiTombolModalBandingkan);
  const closeBtn = sheet.querySelector('.stocks-page__compare-close');
  if (closeBtn) on(closeBtn, 'click', tutupModalBandingkan);
  overlay.onclick = (e) => { if (e.target === overlay) tutupModalBandingkan(); };
  const input = sheet.querySelector('.stocks-page__compare-input');
  const resultsEl = sheet.querySelector('.stocks-page__compare-results');
  on(input, 'input', (e) => {
    const q = e.target.value;
    if (!q.trim()) { resultsEl.innerHTML = ''; return; }
    resultsEl.innerHTML = '<div style="padding:var(--s-4);text-align:center;color:var(--c-text-3);font-size:var(--text-sm);">Mencari...</div>';
    clearTimeout(stockState._compareDebounce);
    stockState._compareDebounce = setTimeout(async () => {
      try {
        const res = await Api.get('/idx/stocks', { q, limit: 8 });
        let list = Array.isArray(res) ? res : (res?.stocks || []);
        const items = list.map(d => new StockListItem(d));
        if (!items.length) { resultsEl.innerHTML = '<div style="padding:var(--s-4);text-align:center;color:var(--c-text-3);font-size:var(--text-sm);">Tidak ada hasil</div>'; return; }
        resultsEl.innerHTML = items.map(s => {
          const already = stockState.compareTickers.includes(s.ticker.toUpperCase());
          const sectorBadge = s.sector ? StockSectorBadge(s.sector, true) : null;
          return `<div class="stocks-page__compare-item" data-ticker="${s.ticker}" style="padding:var(--s-2) var(--s-3);cursor:pointer;display:flex;align-items:center;gap:var(--s-2);border-bottom:1px solid var(--c-border);opacity:${already ? 0.5 : 1};pointer-events:${already ? 'none' : 'auto'};" onmouseover="this.style.background='var(--c-surface-2)'" onmouseout="this.style.background='transparent'">
            <span style="color:${already ? 'var(--c-accent)' : 'var(--c-text-3)'};flex-shrink:0;">${already ? icons['check'] : icons['plus']}</span>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:var(--s-1);flex-wrap:wrap;"><span style="font-weight:600;font-size:var(--text-sm);">${s.ticker}</span>${sectorBadge ? sectorBadge.outerHTML : ''}</div>
              <div style="font-size:var(--text-xs);color:var(--c-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.companyName}</div>
            </div>
          </div>`;
        }).join('');
        resultsEl.querySelectorAll('.stocks-page__compare-item').forEach(item => {
          on(item, 'click', () => { addCompare(item.dataset.ticker); tutupModalBandingkan(); });
        });
      } catch (_) { resultsEl.innerHTML = '<div style="padding:var(--s-4);text-align:center;color:var(--c-danger);font-size:var(--text-sm);">Gagal mencari</div>'; }
    }, 300);
  });
  input.focus();
}

/* ─── Render: Loading ─── */
function renderLoading() {
  let el = stockRefs.analysisContainer;
  if (!el) {
    el = createEl('div', { class: 'stocks-page__analysis' });
    stockRefs.analysisContainer = el;
    stockRootEl.appendChild(el);
  }
  el.innerHTML = spinnerCardHtml('Memuat analisis...', { marginTop: true });
  clearCharts();
}

/* ─── Render: Analysis ─── */
function renderAnalysis() {
  let el = stockRefs.analysisContainer;
  if (!el) {
    el = createEl('div', { class: 'stocks-page__analysis' });
    stockRefs.analysisContainer = el;
    stockRootEl.appendChild(el);
  }
  if (!stockState.analysis) {
    el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;margin-top:var(--s-4);"><div style="font-size:var(--text-sm);color:var(--c-text-3);">Cari saham untuk melihat analisis</div></div>`;
    clearCharts();
    if (stockRefs.compareBar) { stockRefs.compareBar.remove(); stockRefs.compareBar = null; }
    return;
  }
  const a = stockState.analysis;
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

  // Header
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
    </div>`;
  const badgeSlot = header.querySelector('#stock-header-badge');
  const delistedBadge = DelistedBadge({ labelDelisted: a.labelDelisted, stockStatus: a.stockStatus, statusReason: a.statusReason });
  if (delistedBadge && badgeSlot) badgeSlot.appendChild(delistedBadge);
  el.appendChild(header);

  // Info Card
  const infoCard = StockInfoCardRemarks(a);
  if (infoCard) el.appendChild(infoCard);

  // Metrics
  const metrics = createEl('div', { style: { marginTop: 'var(--s-3)' } });
  metrics.innerHTML = `
    <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;margin-bottom:var(--s-2);">
      ${metricCard('BII Score', s.latestBiiScore.toFixed(1), '#9270CA')}
      ${metricCard('Foreign %', s.foreignDominationPct.toFixed(1) + '%', '#5B8FF9')}
      ${metricCard('Net Foreign', formatNilaiSingkat(s.totalNetForeign), '#00A86B')}
    </div>
    <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;">
      ${metricCard('Total Value', formatNilaiSingkat(s.totalValue), '#F6903D')}
      ${metricCard('Total Vol', formatNilaiSingkat(s.totalVolume), '#6DC8EC')}
      ${metricCard('Avg BII', s.avgBiiScore.toFixed(1), '#7B61FF')}
    </div>`;
  el.appendChild(metrics);

  renderCompareBar();

  // Charts
  if (rawData.length > 0) {
    const chartsWrap = createEl('div', { class: 'stocks-page__charts', style: { marginTop: 'var(--s-5)' } });
    if (stockState.compareMode && stockState.compareTickers.length > 0) {
      const compareLegend = [{ label: a.ticker, color: COMPARE_COLORS[0] }, ...stockState.compareTickers.map((t, i) => ({ label: t, color: COMPARE_COLORS[(i + 1) % COMPARE_COLORS.length] }))];
      chartsWrap.appendChild(chartPanel('Perbandingan Harga (Normalisasi)', 'Persentase perubahan dari hari pertama', compareLegend, 300));
      chartsWrap.appendChild(chartPanel('Perbandingan BII Score', 'Skor akumulasi (0-100) relatif tiap saham', compareLegend, 210));
    } else {
      chartsWrap.appendChild(chartPanel('Pergerakan Harga', 'Harga penutupan harian', [{ label: 'Harga penutupan', color: '#00A86B' }], 270));
    }
    chartsWrap.appendChild(chartPanel('Total Nilai Transaksi', 'Regular value per hari', [{ label: 'Nilai transaksi', color: '#F6903D' }], 200));
    chartsWrap.appendChild(chartPanel('Volume Perdagangan', 'Jumlah lot yang diperdagangkan', [{ label: 'Volume', color: '#6DC8EC' }], 200));
    chartsWrap.appendChild(chartPanel('Arus Dana Asing', 'Net foreign buy / sell', [{ label: 'Beli bersih', color: '#00A86B' }, { label: 'Jual bersih', color: '#D94B4B' }], 210));
    const fp = stockState.foreignPos;
    if (fp && fp.series && fp.series.length) {
      chartsWrap.appendChild(chartPanel('Posisi Asing Kumulatif', `Net foreign kumulatif sejak ${fp.data_start} · per titik = akumulasi ${fp.bucket_days} hari`, [{ label: 'Posisi', color: '#0EA5A4' }], 230));
      chartsWrap.appendChild(buildPositionStats(fp));
    }
    const fo = stockState.foreignOwn;
    if (fo && fo.series && fo.series.length) {
      const fa = stockState.foreignAnchor;
      const sub = fa && fa.series && fa.series.length
        ? `Estimasi harian (lembar) tertambat ke snapshot resmi KSEI · jangkar terakhir ${fa.last_anchor ? fa.last_anchor.date : '-'}`
        : `Snapshot bulanan resmi KSEI sejak ${fo.data_start} · absolut dalam lembar saham`;
      chartsWrap.appendChild(chartPanel('Kepemilikan Asing (KSEI)', sub, [{ label: 'Lembar asing', color: '#E8A33D' }], 230));
      chartsWrap.appendChild(buildOwnershipStats(fo, fa));
    }
    chartsWrap.appendChild(chartPanel('BII Score (Buying Intensity Index)', 'Skor akumulasi', [{ label: 'BII Score', color: '#7B61FF' }], 210));
    chartsWrap.appendChild(chartPanel('ATV (Avg Transaction Value)', 'Ukuran transaksi rata-rata', [{ label: 'ATV', color: '#9270CA' }], 200));
    chartsWrap.appendChild(chartPanel('Nilai Nego (Non-Regular)', 'Transaksi negosiasi', [{ label: 'Nego Value', color: '#F6C022' }], 200));
    chartsWrap.appendChild(chartPanel('Frekuensi Nego', 'Jumlah transaksi negosiasi per hari', [{ label: 'Nego Freq', color: '#90A4AE' }], 180));
    chartsWrap.appendChild(buildSummaryTable(rawData));
    el.appendChild(chartsWrap);
    requestAnimationFrame(() => mountCharts(rawData));
  }
}

function metricCard(label, value, color) {
  return `<div style="flex:1 1 100px;min-width:100px;padding:var(--s-3);background:${color}1A;border:1px solid ${color}4D;border-radius:var(--radius);text-align:center;">
    <div style="color:${color};font-size:var(--text-md);font-weight:700;">${value}</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:2px;">${label}</div>
  </div>`;
}

async function mountCharts(rawData) {
  clearCharts();
  try {
    await loadApexCharts();
  } catch (e) {
    console.error('[Stocks] Failed to load chart library:', e);
    stockRootEl.querySelectorAll('.stocks-page__chart').forEach(c => {
      c.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-3);font-size:var(--text-sm);">
        <span style="margin-right:var(--s-2);">${icons['alert-circle']}</span> Gagal memuat chart library
      </div>`;
    });
    return;
  }

  const containers = stockRootEl.querySelectorAll('.stocks-page__chart');
  if (!containers.length) return;

  const normData = rawData.map(d => ({...d, date: normalizeDate(d.date)}));

  containers.forEach((container) => {
    const type = container.dataset.chartType;
    let chart = null;
    try {
      if (type === 'Pergerakan Harga') {
        chart = buildLineChartApex(container, normData, '#00A86B', { height: 270, name: 'Harga Penutupan' });
      } else if (type === 'Perbandingan Harga (Normalisasi)') {
        chart = buildCompareChartApex(container, normData, stockState.compareData, stockState.compareTickers, stockState.analysis.ticker);
      } else if (type === 'Perbandingan BII Score') {
        chart = buildCompareBiiChartApex(container, normData, stockState.compareData, stockState.compareTickers, stockState.analysis.ticker);
      } else if (type === 'Total Nilai Transaksi') {
        chart = buildBarChartApex(container, normData.map(d => ({ time: d.date, value: d.value })), '#F6903D', { timeKey: 'time' });
      } else if (type === 'Volume Perdagangan') {
        chart = buildBarChartApex(container, normData.map(d => ({ time: d.date, value: d.volume })), '#6DC8EC', { timeKey: 'time' });
      } else if (type === 'Arus Dana Asing') {
        chart = buildForeignChartApex(container, normData);
      } else if (type === 'Posisi Asing Kumulatif') {
        chart = stockState.foreignPos && stockState.foreignPos.series ? buildPositionChartApex(container, stockState.foreignPos.series) : null;
      } else if (type === 'Kepemilikan Asing (KSEI)') {
        const fa = stockState.foreignAnchor;
        chart = fa && fa.series && fa.series.length
          ? buildOwnershipChartApex(container, fa.series.map(p => ({ date: p.date, foreign_shares: p.shares })))
          : (stockState.foreignOwn && stockState.foreignOwn.series ? buildOwnershipChartApex(container, stockState.foreignOwn.series) : null);
      } else if (type === 'BII Score (Buying Intensity Index)') {
        chart = buildLineChartApex(container, normData.map(d => ({ time: d.date, close: d.biiScore })), '#7B61FF', { timeKey: 'time' });
      } else if (type === 'ATV (Avg Transaction Value)') {
        chart = buildBarChartApex(container, normData.map(d => ({ time: d.date, value: d.atv })), '#9270CA', { timeKey: 'time' });
      } else if (type === 'Nilai Nego (Non-Regular)') {
        chart = buildBarChartApex(container, normData.map(d => ({ time: d.date, value: d.nonRegValue })), '#F6C022', { timeKey: 'time' });
      } else if (type === 'Frekuensi Nego') {
        chart = buildBarChartApex(container, normData.map(d => ({ time: d.date, value: d.nonRegFreq })), '#90A4AE', { timeKey: 'time' });
      }
      if (chart) stockState.charts.push(chart);
    } catch (e) {
      console.error(`[Stocks] Chart "${type}" failed:`, e);
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-3);font-size:var(--text-sm);">
        <span style="margin-right:var(--s-2);">${icons['alert-circle']}</span> Chart error
      </div>`;
    }
  });
}

function buildPositionStats(fp) {
  const wrap = createEl('div', { style: { marginBottom: 'var(--s-6)' } });
  const rangePct = fp.range_position_pct != null ? fp.range_position_pct.toFixed(1) + '%' : '-';
  const kotakStatistikHtml = (label, value, color) => `<div style="flex:1 1 110px;min-width:110px;padding:var(--s-3);background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);text-align:center;">
    <div style="color:${color};font-size:var(--text-md);font-weight:700;">${value}</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:2px;">${label}</div></div>`;
  const warnaArah = (v) => v >= 0 ? '#00A86B' : '#D94B4B';
  const netHtml = `<span style="color:${warnaArah(fp.net_30d)};">${formatNilaiSingkat(fp.net_30d)}</span> / <span style="color:${warnaArah(fp.net_90d)};">${formatNilaiSingkat(fp.net_90d)}</span>`;
  wrap.innerHTML = `
    <div style="font-size:var(--text-md);font-weight:700;margin-bottom:var(--s-3);">POSISI ASING KUMULATIF</div>
    <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;">
      ${kotakStatistikHtml('Tertinggi · ' + dateLabelYear(fp.peak_date), formatNilaiSingkat(fp.peak), '#00A86B')}
      ${kotakStatistikHtml('Terendah · ' + dateLabelYear(fp.trough_date), formatNilaiSingkat(fp.trough), '#D94B4B')}
      ${kotakStatistikHtml('Sekarang', formatNilaiSingkat(fp.current), fp.current >= 0 ? '#00A86B' : '#D94B4B')}
      ${kotakStatistikHtml('Posisi dalam rentang', rangePct, '#F2B705')}
      ${kotakStatistikHtml('Net sell sejak puncak', formatNilaiSingkat(fp.distance_from_peak), '#90A4AE')}
      ${kotakStatistikHtml('Net 30 / 90 hari', netHtml, 'inherit')}
    </div>`;
  return wrap;
}

function buildOwnershipStats(fo, fa) {
  const wrap = createEl('div', { style: { marginBottom: 'var(--s-6)' } });
  const cur = fo.current || {};
  const warnaArah = (v) => v == null ? 'inherit' : (v >= 0 ? '#00A86B' : '#D94B4B');
  const formatBertanda = (v) => v == null ? '-' : (v >= 0 ? '+' : '') + formatNilaiSingkat(v);
  const deltaHtml = `<span style="color:${warnaArah(fo.change_3m_shares)};">${formatBertanda(fo.change_3m_shares)}</span> / <span style="color:${warnaArah(fo.change_12m_shares)};">${formatBertanda(fo.change_12m_shares)}</span>`;
  const cal = fa && fa.calibration;
  const badgeMap = { 'BERSIH': ['Arus terverifikasi KSEI', '#00A86B'], 'BOCOR': ['Ada pergerakan luar pasar', '#D94B4B'], 'DATA-TIPIS': ['Data kalibrasi tipis', '#8A8F98'] };
  const bm = cal ? (badgeMap[cal.kelas] || ['Kalibrasi: ' + cal.kelas, '#8A8F98']) : null;
  const badge = bm ? `<span style="display:inline-block;margin-left:var(--s-2);padding:2px 8px;border:1px solid ${bm[1]};color:${bm[1]};border-radius:999px;font-size:var(--text-xs);font-weight:600;vertical-align:middle;">${bm[0]}</span>` +
    (cal.flow_vs_delta_pct != null ? `<span style="font-size:var(--text-xs);color:var(--c-text-3);margin-left:var(--s-1);">arus menangkap ${cal.flow_vs_delta_pct}% perubahan resmi</span>` : '') : '';
  const kotakStatistikHtml = (label, value, color) => `<div style="flex:1 1 110px;min-width:110px;padding:var(--s-3);background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);text-align:center;">
    <div style="color:${color};font-size:var(--text-md);font-weight:700;">${value}</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:2px;">${label}</div></div>`;
  wrap.innerHTML = `
    <div style="font-size:var(--text-md);font-weight:700;margin-bottom:var(--s-3);">KEPEMILIKAN ASING RESMI (KSEI)${badge}</div>
    <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;">
      ${kotakStatistikHtml('Sekarang · ' + dateLabelYear(cur.date), formatNilaiSingkat(cur.foreign_shares) + ' lbr', '#E8A33D')}
      ${fa && fa.estimate ? kotakStatistikHtml('Estimasi ' + dateLabelYear(fa.estimate.date) + ' · jangkar ' + dateLabelYear(fa.last_anchor && fa.last_anchor.date), formatNilaiSingkat(fa.estimate.shares) + ' lbr', '#E8A33D') : ''}
      ${kotakStatistikHtml('% total saham · klas ' + (cur.foreign_pct_classified != null ? cur.foreign_pct_classified.toFixed(1) + '%' : '-'), cur.foreign_pct_total != null ? cur.foreign_pct_total.toFixed(1) + '%' : '-', '#5B8FF9')}
      ${kotakStatistikHtml('Nilai asing', formatNilaiSingkat(cur.foreign_value), '#00A86B')}
      ${kotakStatistikHtml('Tertinggi · ' + dateLabelYear(fo.peak && fo.peak.date), formatNilaiSingkat(fo.peak && fo.peak.foreign_shares) + ' lbr', '#00A86B')}
      ${kotakStatistikHtml('Terendah · ' + dateLabelYear(fo.trough && fo.trough.date), formatNilaiSingkat(fo.trough && fo.trough.foreign_shares) + ' lbr', '#D94B4B')}
      ${kotakStatistikHtml('Δ 3 bln / 12 bln (lbr)', deltaHtml, 'inherit')}
    </div>`;
  return wrap;
}

function buildSummaryTable(rawData) {
  const rows = rawData.length > 15 ? rawData.slice(rawData.length - 15) : rawData;
  // Chg% per baris: prevPrice (kolom "sebelumnya" dari API) → fallback change
  // (selisih vs hari sebelumnya) → fallback close baris sebelumnya di data lengkap.
  const chgByRow = new Map();
  rawData.forEach((r, i) => {
    const c = r.close || 0;
    const prev = r.prevPrice > 0 ? r.prevPrice
      : (r.change ? c - r.change
      : (i > 0 ? (rawData[i - 1].close || 0) : 0));
    chgByRow.set(r, prev > 0 ? ((c - prev) / prev) * 100 : null);
  });
  const wrap = createEl('div', { style: { marginTop: 'var(--s-6)' } });
  wrap.innerHTML = `
    <div style="font-size:var(--text-md);font-weight:700;margin-bottom:2px;">Ringkasan Data</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-bottom:var(--s-3);">${rows.length} hari terakhir</div>
    <div style="overflow-x:auto;">
      <table class="table">
        <thead><tr><th>Tanggal</th><th>Harga</th><th>Chg%</th><th>Net For.</th><th>ATV</th><th>BII</th><th>F:R</th></tr></thead>
        <tbody>
          ${rows.slice().reverse().map(r => {
            const close = r.close || 0;
            const chg = chgByRow.get(r);
            const netF = r.netForeign || 0;
            const atv = r.atv || 0;
            const bii = r.biiScore || 0;
            const fb = r.foreignBuy || 0;
            const fs = r.foreignSell || 0;
            const vol = r.volume || 0;
            const frRatio = vol > 0 ? ((fb + fs) / (vol * 2) * 100) : 0;
            const chgText = chg === null ? '—' : `${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%`;
            const chgColor = chg === null ? 'var(--c-text-3)' : (chg >= 0 ? 'var(--c-accent)' : 'var(--c-danger)');
            const netColor = netF >= 0 ? 'var(--c-accent)' : 'var(--c-danger)';
            return `<tr>
              <td style="font-size:var(--text-xs);">${dateLabel(r.date)}</td>
              <td style="font-weight:600;font-size:var(--text-xs);">Rp ${fmtPrice(close)}</td>
              <td style="color:${chgColor};font-size:var(--text-xs);">${chgText}</td>
              <td style="color:${netColor};font-size:var(--text-xs);">${formatNilaiSingkat(netF)}</td>
              <td style="font-size:var(--text-xs);">${formatNilaiSingkat(atv)}</td>
              <td style="color:#7B61FF;font-weight:600;font-size:var(--text-xs);">${bii.toFixed(1)}</td>
              <td style="font-size:var(--text-xs);">${frRatio.toFixed(1)}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  return wrap;
}

/* ─── Cleanup ─── */
function cleanup() {
  clearCharts();
  if (stockState._searchDebounce) clearTimeout(stockState._searchDebounce);
  if (stockState._compareDebounce) clearTimeout(stockState._compareDebounce);
  stockRootEl = null; stockRefs = {};
}

/* ─── Export render ─── */
export function render() {
  Object.assign(stockState, {
    searchTerm: '', searchResults: [], searching: false,
    selectedTicker: '', days: 30, analysis: null, loading: false,
    compareMode: false, compareTickers: [], compareData: {}, compareLoading: false,
    charts: [],
  });
  stockRootEl = createEl('div', { class: 'stocks-page', style: { maxWidth: '900px', margin: '0 auto', padding: 'var(--s-4)' } });
  stockRefs = {};

  if (!document.getElementById('stocks-page-keyframes')) {
    const style = createEl('style', { id: 'stocks-page-keyframes' });
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  const header = createEl('div', { style: { marginBottom: 'var(--s-5)' } });
  header.innerHTML = `<h1 style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--s-1);">Analisis Saham</h1><p style="color:var(--c-text-2);font-size:var(--text-sm);">Analisis teknikal dan fundamental saham IDX.</p>`;
  stockRootEl.appendChild(header);

  renderToolbarOnce();
  renderAnalysis();
  renderCompareBar();

  const initialTicker = localStorage.getItem('stocks_initial_ticker');
  if (initialTicker) {
    localStorage.removeItem('stocks_initial_ticker');
    stockState.searchTerm = initialTicker;
    if (stockRefs.searchInput) stockRefs.searchInput.value = initialTicker;
    loadAnalysis(initialTicker);
  }

  const tanganiKlikLuarDropdown = (e) => {
    if (stockRefs.searchDropdown && !stockRefs.searchDropdown.contains(e.target) && !stockRefs.searchInput.contains(e.target)) {
      stockRefs.searchDropdown.style.display = 'none';
    }
  };
  document.addEventListener('click', tanganiKlikLuarDropdown);
  stockRootEl._outsideClick = tanganiKlikLuarDropdown;

  stockRootEl._cleanup = () => {
    document.removeEventListener('click', tanganiKlikLuarDropdown);
    cleanup();
  };
  return stockRootEl;
}
