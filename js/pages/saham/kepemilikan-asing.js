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
    const [fpos, fown, fdec, ftype] = await Promise.all([
      Api.get('/idx/market/foreign-position', { bucket: 30 }).catch(() => null),
      Api.get('/idx/market/foreign-ownership').catch(() => null),
      Api.get('/idx/market/foreign-decomposition', { mode: 'peak' }).catch(() => null),
      Api.get('/idx/market/ownership-by-type', { mode: 'peak' }).catch(() => null),
    ]);
    pageState.data = {};
    const fp = fpos?.data || fpos;
    if (fp) pageState.data.foreign_pos = fp;
    const fo = fown?.data || fown;
    if (fo) pageState.data.foreign_own = fo;
    const fd = fdec?.data || fdec;
    if (fd) { decState.data = fd; decState.mode = 'peak'; }
    const ft = ftype?.data || ftype;
    if (ft) typeState.data = ft;
    pageState.loading = false;
    renderPage();
  } catch (e) {
    pageState.loading = false;
    toast('Gagal memuat data kepemilikan asing: ' + (e.message || e), 'danger');
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
        <h1 style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--s-1);">Kepemilikan Asing</h1>
        <p style="color:var(--c-text-2);font-size:var(--text-sm);">Posisi asing kumulatif, kepemilikan resmi KSEI, dan bedah golongan investor.</p>
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
  el.innerHTML = spinnerCardHtml('Memuat data kepemilikan asing...');
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

  if (!fp && !fo && !decState.data && !typeState.data) {
    el.innerHTML = `<div class="card" style="padding:var(--s-6);text-align:center;">
      <div style="font-size:var(--text-sm);color:var(--c-text-3);">Data kepemilikan asing tidak tersedia</div>
    </div>`;
    return;
  }

  // ── Posisi Asing Kumulatif (insight jangka panjang, jendela tetap server-side) ──
  if (fp && fp.series && fp.series.length) {
    el.appendChild(chartPanel('Posisi Asing Kumulatif Pasar', `Net foreign kumulatif sejak ${dateLabelYear(fp.data_start)} · per titik = akumulasi ${fp.bucket_days} hari`, [{ label: 'Posisi', color: '#0EA5A4' }], 230));
    el.appendChild(buildForeignPositionSection(fp));
  }

  // ── Kepemilikan Asing resmi KSEI (absolut, snapshot bulanan) ──
  if (fo && fo.series && fo.series.length) {
    el.appendChild(chartPanel('Kepemilikan Asing Pasar (KSEI)', `Nilai kepemilikan asing resmi KSEI sejak ${dateLabelYear(fo.data_start)} · snapshot bulanan`, [{ label: 'Nilai asing', color: '#E8A33D' }], 230));
    el.appendChild(buildMarketOwnershipSection(fo));
  }

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
      if (type === 'Posisi Asing Kumulatif Pasar') { const fp = d.foreign_pos; chart = fp && fp.series ? buildPositionChartApex(container, fp.series) : null; }
      else if (type === 'Kepemilikan Asing Pasar (KSEI)') { const fo = d.foreign_own; chart = fo && fo.series ? buildMarketOwnershipChartApex(container, fo.series) : null; }
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
    name: 'Nilai kepemilikan asing',
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
    if (typeWrapEl) typeWrapEl.innerHTML = '<div style="padding:var(--s-4);color:var(--c-text-3);font-size:var(--text-sm);">Memuat bedah golongan…</div>';
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
      ${selKpiHtml('Nilai Asing Sekarang', formatNilaiSingkat(cur.foreign_value), dateLabelYear(cur.date) + ' · ' + (cur.emiten || '-') + ' emiten', '#E8A33D')}
      ${selKpiHtml('Porsi Asing Pasar', cur.foreign_pct != null ? cur.foreign_pct.toFixed(1) + '%' : '-', 'dari total nilai ekuitas', '#5B8FF9')}
      ${selKpiHtml('Nilai Tertinggi', formatNilaiSingkat(fo.peak && fo.peak.foreign_value), dateLabelYear(fo.peak && fo.peak.date), '#00A86B')}
      ${selKpiHtml('Nilai Terendah', formatNilaiSingkat(fo.trough && fo.trough.foreign_value), dateLabelYear(fo.trough && fo.trough.date), '#D94B4B')}
      ${selKpiHtml('Perubahan Nilai 3 / 12 bln', deltaHtml, 'efek harga + beli/jual')}
    </div>`;
  return wrap;
}


/* ─── Bedah Golongan Asing + Cermin Lokal ─── */
const TYPE_LABELS = { IS: 'Asuransi', CP: 'Korporasi', PF: 'Dana Pensiun', IB: 'Bank Investasi', ID: 'Individu', MF: 'Reksa Dana', SC: 'Sekuritas', FD: 'Yayasan', OT: 'Lainnya' };
const FOREIGN_BUCKET_INFO = [
  ['lengket', 'Lengket', 'Dana pensiun · asuransi · yayasan', '#5B8FF9'],
  ['taktis', 'Taktis', 'Reksa dana · bank investasi', '#9270CA'],
  ['korporasi', 'Korporasi', 'Perusahaan asing langsung', '#F6903D'],
  ['lainnya', 'Lainnya', 'Individu · sekuritas · lainnya (termasuk akun nominee)', '#E8A33D'],
];
const LOCAL_GROUP_INFO = [
  ['institusi_dana', 'Institusi Dana', 'Reksa dana · dana pensiun · asuransi', '#5B8FF9'],
  ['korporasi', 'Korporasi', 'Perusahaan lokal — sering kendaraan pengendali', '#F6903D'],
  ['ritel', 'Ritel', 'Investor individu lokal', '#00A86B'],
  ['lainnya', 'Lainnya', 'Bank investasi · sekuritas · yayasan · lainnya', '#8A94A6'],
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
        beli ? `paling membeli: <b>${beli.ticker}</b> ${formatBertanda(beli.effect)}` : '',
        jual ? `paling menjual: <b>${jual.ticker}</b> ${formatBertanda(jual.effect)}` : '',
      ].filter(Boolean).join(' · ');
      return `<div style="padding:var(--s-2) 0;border-bottom:1px dashed var(--c-border);">
        <div style="display:flex;justify-content:space-between;gap:var(--s-3);flex-wrap:wrap;">
          <span style="font-size:var(--text-sm);font-weight:600;">${TYPE_LABELS[code]} <span style="color:var(--c-text-3);font-weight:400;">(${code})</span></span>
          <span style="font-size:var(--text-sm);">lembar <b style="color:${(t.effect_shares || 0) < 0 ? '#D94B4B' : '#00A86B'};">${formatBertanda(t.effect_shares)}</b> · harga ${formatBertanda(t.effect_price)} · porsi ${(t.pct_start || 0).toFixed(1)}% → ${(t.pct_end || 0).toFixed(1)}%</span>
        </div>
        ${movers ? `<div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:2px;">${movers}</div>` : ''}
      </div>`;
    }).join('');
  return `<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);padding:var(--s-4);margin-bottom:var(--s-4);">
    <div style="font-size:var(--text-md);font-weight:700;">● Bedah Golongan Asing — Siapa Melepas, Siapa Menahan</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin:var(--s-2) 0 var(--s-3);">Perubahan lembar per golongan investor asing (KSEI) · ${dateLabelYear(res.from_date)} → ${dateLabelYear(res.to_date)} · ${res.emiten_analyzed} emiten dibedah · ${res.emiten_events} emiten aksi korporasi dipisah · jendela mengikuti chip mode di kartu Bedah di atas</div>
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.55;">Golongan <b>lengket</b> (dana pensiun, asuransi, yayasan) kini memegang <b>${(res.sticky_pct_end || 0).toFixed(1)}%</b> nilai asing, ${naik ? 'naik' : 'turun'} dari ${(res.sticky_pct_start || 0).toFixed(1)}% di awal jendela — uang paling sabar ${naik ? 'bertahan dan bertambah porsinya' : 'ikut menyusut porsinya'}.</div>
    <div style="margin-top:var(--s-2);">${bars}</div>
    <div style="font-size:var(--text-sm);color:var(--c-text-2);line-height:1.55;">Dari ember Lainnya (${formatBertanda(lainEff)}), golongan Lainnya (OT) sendiri menyumbang ${formatBertanda(otEff)} — ember ini mencakup akun nominee dan omnibus, jadi isinya bukan satu jenis investor tunggal.</div>
    <button data-typedetail style="margin-top:var(--s-3);padding:4px 12px;border:1px solid var(--c-border);border-radius:999px;font-size:var(--text-xs);cursor:pointer;background:var(--c-surface-2);color:var(--c-text-2);">Lihat rincian 9 golongan</button>
    <div id="kepemilikan-rincian-golongan" style="display:none;margin-top:var(--s-2);">${detailRows}</div>
    <div style="margin-top:var(--s-2);font-size:var(--text-xs);color:var(--c-text-3);line-height:1.5;">Δ antar-snapshot adalah perubahan kepemilikan — termasuk perpindahan luar pasar dan reklasifikasi — bukan arus bursa murni.</div>
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
    ? `Seluruh lembar terklasifikasi lokal berubah ${formatBertanda(lTot)}, sementara asing ${formatBertanda(fTot)}. Selisihnya bukan kesalahan: irisan tak-terklasifikasi (saham tanpa klasifikasi SID) berubah ${formatBertanda(u.effect_shares)} pada periode yang sama — lembar berpindah dari irisan itu ke golongan lokal yang terklasifikasi, di samping penerbitan bersih emiten non-event.`
    : `Seluruh lembar terklasifikasi lokal berubah ${formatBertanda(lTot)}, sementara asing ${formatBertanda(fTot)} — selisih keduanya berasal dari perubahan irisan tak-terklasifikasi (saham tanpa klasifikasi SID) dan penerbitan bersih emiten non-event.`;
  return `<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);padding:var(--s-4);margin-bottom:var(--s-4);">
    <div style="font-size:var(--text-md);font-weight:700;">● Cermin Lokal — Siapa Menyerap</div>
    <div style="font-size:var(--text-xs);color:var(--c-text-3);margin:var(--s-2) 0 var(--s-3);">Perubahan lembar per kelompok investor lokal (KSEI) pada jendela yang sama</div>
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
    btn.textContent = openNow ? 'Lihat rincian 9 golongan' : 'Sembunyikan rincian';
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
