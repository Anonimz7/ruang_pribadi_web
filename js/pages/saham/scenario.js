/* pages/saham/scenario.js — Skenario komoditas + kurs (E8).
 * What-if simulation anchored to commodities/FX (mesin E7).
 * Tiga fitur: (1) beta index murni, (2) beta per-ticker dalam index
 * (output daftar), (3) simulasi single stock. Pemilihan faktor dua
 * mode: MANUAL (centang sendiri) atau SUB-SECTOR (sistem menyarankan
 * dari Sub_Sector, pengguna bisa ubah). Label ditulis polos dan
 * harfiah (tanpa singkatan statistik); kartu catatan dihapus atas
 * kata user 2026-11-10 — satu kalimat "bukan ramalan harga" disimpan
 * sebagai keterangan kecil di bawah hasil (rancangan
 * RANCANGAN_SKENARIO_MC.md §7).
 * Preset: kartu prasetel satu klik (mesin E7 yang sama).
 * Layout mengikuti simulasi-iseng.js (card + createEl + Api + toast). */
import { createEl } from '../../utils/dom.js';
import Api from '../../core/api.js';
import { toast } from '../../ui/toast.js';

/* ─── Bootstrap trial (branch coba-bootstrap) ──────────────────────────────
 * CSS-only, lingkup halaman ini saja — pola yang sama dengan stocks.js
 * (stylesheet dimuat di render(), dilepas di cleanup(); data-bs-theme
 * disinkronkan dari data-theme). Bila Bootstrap diadopsi menyeluruh,
 * loader ini pindah ke app.js/index.html agar tidak diduplikasi per
 * halaman. Versi di-pin dan DI-VENDOR LOKAL (css/vendor/): Bootstrap
 * 5.3.8 + Bootstrap Icons 1.13.2 (stylesheet CDN tidak teraplikasi di
 * Firefox uji VM — terdiagnosis 2026-11-11). Backend tidak disentuh.
 */
const BS_CSS_URL = 'css/vendor/bootstrap.min.css';
const BS_ICONS_URL = 'css/vendor/bootstrap-icons.min.css';
let bsThemeObserver = null;

function syncBsTheme() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
}

function ensureBootstrap() {
  if (!document.getElementById('bs-trial-css')) {
    const l = document.createElement('link');
    l.id = 'bs-trial-css'; l.rel = 'stylesheet'; l.href = BS_CSS_URL;
    document.head.appendChild(l);
  }
  if (!document.getElementById('bs-trial-icons')) {
    const l = document.createElement('link');
    l.id = 'bs-trial-icons'; l.rel = 'stylesheet'; l.href = BS_ICONS_URL;
    document.head.appendChild(l);
  }
  syncBsTheme();
  if (!bsThemeObserver) {
    bsThemeObserver = new MutationObserver((muts) => {
      if (muts.some((m) => m.attributeName === 'data-theme')) syncBsTheme();
    });
    bsThemeObserver.observe(document.documentElement, { attributes: true });
  }
}

function removeBootstrap() {
  document.getElementById('bs-trial-css')?.remove();
  document.getElementById('bs-trial-icons')?.remove();
  document.documentElement.removeAttribute('data-bs-theme');
  if (bsThemeObserver) { bsThemeObserver.disconnect(); bsThemeObserver = null; }
}

const PRESETS = [
  { key: 'coal-boom', label: 'Batubara boom', desc: 'Batubara +20% dalam 6 bulan',
    target: { index_id: 11 }, factors: [{ key: 'coal', total_change_pct: 20 }],
    horizon_months: 6 },
  { key: 'idr-weak', label: 'Rupiah melemah', desc: 'USD/IDR +10% dalam 6 bulan',
    target: { index_id: 11 }, factors: [{ key: 'usd_idr', total_change_pct: 10 }],
    horizon_months: 6 },
  { key: 'gold-fly', label: 'Emas terbang', desc: 'Gold +15% dalam 6 bulan (ANTM)',
    target: { tickers: ['ANTM'] }, factors: [{ key: 'gold', total_change_pct: 15 }],
    horizon_months: 6 },
];

const scState = {
  factors: [],          // daftar faktor (GET /scenario/factors)
  indices: [],          // daftar index (GET /index-saham)
  targetKind: 'index',  // 'index' | 'tickers'
  factorMode: 'manual', // 'manual' | 'sub_sector'
  running: false,
  result: null,
};

let scRootEl = null;
let scRefs = {};

function fmtPct(v, digits = 2) {
  if (v == null || Number.isNaN(Number(v))) return '-';
  return `${Number(v).toFixed(digits)}%`;
}

function fmtBeta(v) {
  if (v == null || Number.isNaN(Number(v))) return '-';
  const n = Number(v);
  return (n >= 0 ? '+' : '') + n.toFixed(3);
}

function fmtSignedPct(v, digits = 0) {
  if (v == null || Number.isNaN(Number(v))) return '-';
  const n = Number(v);
  return (n >= 0 ? '+' : '') + n.toFixed(digits) + '%';
}

/* Alasan "tidak terpengaruh" versi pendek untuk sel tabel (alasan mentah
   dari API seperti "|corr|=0.219 < 0.3" membingungkan di layar kecil). */
function shortReason(reason) {
  const r = String(reason || '');
  const n = r.match(/n\s*=\s*(\d+)/);
  if (n && Number(n[1]) < 36) return `data ${n[1]} bln (< 36)`;
  const c = r.match(/\|corr\|\s*=\s*([0-9.]+)/);
  if (c) return `korelasi ${Number(c[1]).toFixed(2)}`;
  if (/tidak ada data/.test(r)) return 'tidak ada data harga';
  const m = r.match(/hanya (\d+) bulan/);
  if (m) return `data ${m[1]} bln`;
  return r || 'korelasi lemah';
}

/* Segmented control: tombol-tombol pil (aktif = btn-primary, sisanya
   btn-outline-secondary). Mengembalikan { el, set(value) }; set() hanya
   mengubah tampilan, tanpa memanggil onChange (dipakai saat preset
   mengisi form). */
function segmentedControl(options, current, onChange) {
  const wrap = createEl('div', { style: { display: 'flex', gap: 'var(--s-1)', flexWrap: 'wrap' } });
  const btns = {};
  function paint() {
    Object.entries(btns).forEach(([v, b]) => {
      b.className = 'btn btn-sm ' + (v === current ? 'btn-primary' : 'btn-outline-secondary');
    });
  }
  options.forEach(([value, label]) => {
    const b = createEl('button', { class: 'btn btn-sm btn-outline-secondary', type: 'button' }, [label]);
    b.addEventListener('click', () => {
      if (value === current) return;
      current = value;
      paint();
      onChange(value);
    });
    btns[value] = b;
    wrap.appendChild(b);
  });
  paint();
  return { el: wrap, set(v) { current = v; paint(); } };
}

/* ─── API ─── */

async function loadFactors() {
  try {
    const res = await Api.get('/scenario/factors');
    scState.factors = (res && res.factors) || [];
    renderFactorList();
  } catch (e) {
    toast('Failed to load factors: ' + (e.message || e), 'danger');
  }
}

async function loadIndices() {
  try {
    const res = await Api.get('/index-saham');
    scState.indices = Array.isArray(res) ? res : (res && res.indices) || [];
    renderIndexSelect();
  } catch (e) {
    toast('Failed to load indices: ' + (e.message || e), 'danger');
  }
}

/* Saran mode SUB-SECTOR: single stock -> /suggest(ticker); index ->
   /suggest tiap anggota, gabung (union). Kembalikan Set factor key. */
async function suggestFactors() {
  const keys = new Set();
  try {
    if (scState.targetKind === 'tickers') {
      const t = (scRefs.tickerInput?.value || '').trim().toUpperCase();
      if (!t) return keys;
      const res = await Api.post('/scenario/suggest', { ticker: t });
      (res?.suggested_factors || []).forEach((k) => keys.add(k));
    } else {
      const id = Number(scRefs.indexSelect?.value);
      if (!id) return keys;
      const idx = await Api.get(`/index-saham/${id}`);
      const members = (idx && idx.members) || [];
      const tickers = members.map((m) => m.ticker).filter(Boolean);
      const results = await Promise.all(
        tickers.map((t) => Api.post('/scenario/suggest', { ticker: t })
          .catch(() => null)));
      results.forEach((res) => {
        (res?.suggested_factors || []).forEach((k) => keys.add(k));
      });
    }
  } catch (e) {
    toast('Failed to suggest factors: ' + (e.message || e), 'danger');
  }
  return keys;
}

/* Terapkan saran Sub-Sector ke checkbox faktor. */
async function runSuggest() {
  const keys = await suggestFactors();
  if (!keys.size) {
    toast('Tidak ada saran faktor untuk target ini.', 'danger');
    return;
  }
  Object.entries(scRefs.factorRows || {}).forEach(([k, row]) => {
    row.check.checked = keys.has(k);
  });
}

function setTargetKind(kind, focus) {
  scState.targetKind = kind;
  if (scRefs.targetSeg) scRefs.targetSeg.set(kind);
  if (scRefs.indexSelect) scRefs.indexSelect.disabled = (kind !== 'index');
  if (scRefs.tickerInput) {
    scRefs.tickerInput.disabled = (kind !== 'tickers');
    if (kind === 'tickers' && focus) scRefs.tickerInput.focus();
  }
}

function setFactorMode(mode, autoSuggest) {
  scState.factorMode = mode;
  if (scRefs.modeSeg) scRefs.modeSeg.set(mode);
  if (scRefs.suggestBtn) scRefs.suggestBtn.disabled = (mode !== 'sub_sector');
  if (mode === 'sub_sector' && autoSuggest) runSuggest();
}

/* Isi form dari preset sebelum jalan: yang tampil = yang dijalankan,
   dan pengguna bisa mengubahnya lalu Run ulang. */
function applyPresetToForm(preset) {
  const t = preset.target || {};
  if (t.index_id != null) {
    setTargetKind('index');
    if (scRefs.indexSelect) scRefs.indexSelect.value = String(t.index_id);
  } else if (t.tickers && t.tickers.length) {
    setTargetKind('tickers');
    if (scRefs.tickerInput) scRefs.tickerInput.value = t.tickers[0];
  }
  setFactorMode('manual');
  Object.entries(scRefs.factorRows || {}).forEach(([k, row]) => {
    const pf = (preset.factors || []).find((f) => f.key === k);
    row.check.checked = !!pf;
    row.pct.value = pf ? String(pf.total_change_pct) : '';
  });
  if (scRefs.horizonInput) scRefs.horizonInput.value = String(preset.horizon_months ?? 6);
}

function collectFactors() {
  const out = [];
  const zero = [];
  for (const f of scState.factors) {
    const row = scRefs.factorRows?.[f.key];
    if (!row || !row.check.checked) continue;
    const pct = parseFloat(row.pct.value);
    // Dicentang tapi 0%/kosong = tidak ada efek; jangan diam-diam
    // diikutkan, laporkan sebagai zero.
    if (Number.isNaN(pct) || pct === 0) { zero.push(f.display_name); continue; }
    out.push({ key: f.key, total_change_pct: pct });
  }
  return { factors: out, zero };
}

function collectTarget() {
  if (scState.targetKind === 'index') {
    const id = Number(scRefs.indexSelect?.value);
    if (!id) return null;
    return { index_id: id };
  }
  const t = (scRefs.tickerInput?.value || '').trim().toUpperCase();
  if (!t) return null;
  return { tickers: [t] };
}

async function runScenario(preset) {
  if (scState.running) return;
  let target; let factors; let horizon;
  if (preset) {
    // Isi form dari preset dulu: yang tampil = yang dijalankan.
    applyPresetToForm(preset);
    target = preset.target;
    factors = preset.factors;
    horizon = preset.horizon_months;
  } else {
    target = collectTarget();
    if (!target) {
      toast('Pilih index atau isi kode saham dulu.', 'danger');
      return;
    }
    const collected = collectFactors();
    factors = collected.factors;
    if (!factors.length) {
      toast(collected.zero.length
        ? 'Faktor yang dicentang masih 0% — isi % perubahannya dulu (mis. +20).'
        : 'Centang minimal satu faktor dan isi % perubahannya.', 'danger');
      return;
    }
    if (collected.zero.length) {
      toast(`${collected.zero.join(', ')} 0% — tidak diikutkan (tidak ada efek).`, 'warn');
    }
    horizon = parseInt(scRefs.horizonInput?.value, 10) || 6;
  }
  const nSims = parseInt(scRefs.simsInput?.value, 10) || 1000;
  scState.running = true;
  renderRunState();
  try {
    const body = { ...target, factors, horizon_months: horizon, n_sims: nSims, seed: 42 };
    const res = await Api.post('/scenario/run', body);
    if (!res) return; // 401 -> auto-logout
    scState.result = res;
    renderResult();
  } catch (e) {
    toast('Failed to run scenario: ' + (e.message || e), 'danger');
  } finally {
    scState.running = false;
    renderRunState();
  }
}

/* ─── Render ─── */

function renderIndexSelect() {
  const sel = scRefs.indexSelect;
  if (!sel) return;
  sel.innerHTML = '';
  if (!scState.indices.length) {
    sel.appendChild(createEl('option', { value: '' }, ['(no indices)']));
    return;
  }
  scState.indices.forEach((ix) => {
    sel.appendChild(createEl('option', { value: String(ix.id) },
      [`${ix.name || ix.code} (id ${ix.id})`]));
  });
  // Default: index Batu Bara (id 11) bila ada.
  const bb = scState.indices.find((ix) => ix.id === 11);
  if (bb) sel.value = '11';
}

function renderFactorList() {
  const wrap = scRefs.factorList;
  if (!wrap) return;
  wrap.innerHTML = '';
  scRefs.factorRows = {};
  scState.factors.forEach((f) => {
    const row = createEl('div', {
      class: 'scenario-page__factor-row',
      style: { display: 'flex', gap: 'var(--s-2)', alignItems: 'center',
               padding: 'var(--s-1) 0', borderBottom: '1px solid var(--c-border)' },
    });
    const check = createEl('input', {
      type: 'checkbox', class: 'form-check-input',
      style: { marginTop: '0', flexShrink: '0' },
    });
    check.checked = false;
    const label = createEl('label', { style: { flex: '1', fontSize: 'var(--text-sm)' } },
      [`${f.display_name} `, createEl('span', { style: { color: 'var(--c-text-3)' } },
        [`(${f.source} ${f.series_code})`])]);
    // % di DALAM kotak (suffix absolut) + placeholder contoh, supaya
    // jelas kotaknya persen dan berapa yang diisi.
    const pctWrap = createEl('span', {
      style: { position: 'relative', display: 'inline-block', flex: '0 0 auto' },
    });
    const pct = createEl('input', {
      type: 'number', step: '1', value: '',
      class: 'form-control',
      style: { width: '92px', textAlign: 'right', paddingRight: '26px' },
      placeholder: '+20',
      title: 'Total % perubahan faktor selama jangka waktu (+20 = naik 20%, -20 = turun 20%)',
    });
    pctWrap.appendChild(pct);
    pctWrap.appendChild(createEl('span', {
      style: { position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)',
               fontSize: 'var(--text-sm)', color: 'var(--c-text-3)', pointerEvents: 'none' },
    }, ['%']));
    row.appendChild(check);
    row.appendChild(label);
    row.appendChild(pctWrap);
    wrap.appendChild(row);
    scRefs.factorRows[f.key] = { check, pct };
  });
}

function renderRunState() {
  if (scRefs.runBtn) scRefs.runBtn.disabled = scState.running;
  if (scRefs.runLabel) {
    scRefs.runLabel.textContent = scState.running ? 'Menghitung…' : '';
  }
}

function statCard(label, value, sub) {
  const c = createEl('div', { class: 'card' });
  c.appendChild(createEl('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)' } }, [label]));
  c.appendChild(createEl('div', { style: { fontSize: 'var(--text-lg)', fontWeight: '600' } }, [value]));
  if (sub) {
    c.appendChild(createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } }, [sub]));
  }
  return c;
}

function renderResult() {
  const wrap = scRefs.resultWrap;
  const r = scState.result;
  if (!wrap || !r) return;
  wrap.innerHTML = '';
  const d = r.distribution_pct || {};

  // Ringkasan statistik.
  const head = createEl('div', { style: { marginBottom: 'var(--s-3)' } });
  head.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } },
    [`Hasil — ${r.target?.label || ''}`]));
  // Ringkasan input yang dijalankan (supaya hasil bisa dibaca tanpa
  // menebak: faktor + % apa, jangka waktu + simulasi berapa).
  const runBits = (r.factors || []).map((f) =>
    `${f.display_name || f.key} ${fmtSignedPct(f.total_change_pct)}`);
  if (r.horizon_months != null) runBits.push(`Jangka waktu ${r.horizon_months} bulan`);
  if (r.n_sims != null) runBits.push(`${r.n_sims} simulasi`);
  if (runBits.length) {
    head.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-1)' } },
      [runBits.join(' · ')]));
  }
  // Satu kalimat pengaman anti-salah-baca (dulu label W4 di kartu catatan
  // yang sudah dihapus): hasil ini sebaran kemungkinan, bukan ramalan.
  const caveat = (r.labels && r.labels.W4) || 'Simulasi = sebaran kemungkinan, bukan ramalan harga.';
  head.appendChild(createEl('p', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', margin: '0 0 var(--s-2)' } },
    [caveat]));
  const stats = createEl('div', {
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--s-2)' },
  });
  stats.appendChild(statCard('Nilai tengah', fmtPct(d.p50), 'setengah simulasi di bawah angka ini'));
  stats.appendChild(statCard('Batas bawah', fmtPct(d.p5), '95 dari 100 simulasi berakhir di atas angka ini'));
  stats.appendChild(statCard('Batas atas', fmtPct(d.p95), '5 dari 100 simulasi berakhir di atas angka ini'));
  stats.appendChild(statCard('Rata-rata', fmtPct(d.mean), 'rata-rata semua simulasi'));
  stats.appendChild(statCard('Peluang rugi', fmtPct(r.prob_loss_pct), 'simulasi yang berakhir negatif'));
  head.appendChild(stats);
  wrap.appendChild(head);

  // Bilah sebaran hasil (batas bawah–batas atas, nilai tengah ditandai).
  const barCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  barCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Sebaran hasil']));
  const bar = createEl('div', {
    style: { position: 'relative', height: '18px', background: 'var(--c-bg-2)',
             borderRadius: '9px', overflow: 'hidden', marginBottom: 'var(--s-1)' },
  });
  // Skala: rentang batas bawah..batas atas dipetakan ke 0..100%; 0% sebagai acuan.
  const lo = Math.min(d.p5 ?? 0, 0);
  const hi = Math.max(d.p95 ?? 0, 0);
  const span = (hi - lo) || 1;
  const pct = (v) => `${((v - lo) / span) * 100}%`;
  const range = createEl('div', {
    style: { position: 'absolute', left: pct(d.p5 ?? 0), width: `calc(${pct(d.p95 ?? 0)} - ${pct(d.p5 ?? 0)})`,
             top: '0', bottom: '0', background: 'var(--c-accent, #4a90d9)', opacity: '0.55' },
  });
  const med = createEl('div', {
    style: { position: 'absolute', left: pct(d.p50 ?? 0), top: '0', bottom: '0',
             width: '3px', background: 'var(--c-text, #111)' },
  });
  bar.appendChild(range);
  bar.appendChild(med);
  barCard.appendChild(bar);
  barCard.appendChild(createEl('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-2)' } },
    [`batas bawah ${fmtPct(d.p5)}  ·  nilai tengah ${fmtPct(d.p50)}  ·  batas atas ${fmtPct(d.p95)}`]));
  wrap.appendChild(barCard);

  // Kontribusi tiap faktor.
  const attrCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  attrCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Kontribusi faktor']));
  const attrTable = createEl('table', { class: 'table table-sm' });
  const attrHead = createEl('thead', {});
  const attrHeadRow = createEl('tr', {});
  ['Faktor', 'Beta gabungan', 'Perubahan faktor', 'Perkiraan kontribusi'].forEach((h) => {
    attrHeadRow.appendChild(createEl('th', {}, [h]));
  });
  attrHead.appendChild(attrHeadRow);
  attrTable.appendChild(attrHead);
  const attrBody = createEl('tbody', {});
  (r.attribution || []).forEach((a) => {
    const tr = createEl('tr', {});
    tr.appendChild(createEl('td', {}, [a.display_name || a.factor]));
    tr.appendChild(createEl('td', {}, [fmtBeta(a.beta_aggregated)]));
    tr.appendChild(createEl('td', {}, [fmtPct(a.total_change_pct)]));
    tr.appendChild(createEl('td', {}, [fmtPct(a.approx_contribution_pct)]));
    attrBody.appendChild(tr);
  });
  attrTable.appendChild(attrBody);
  attrCard.appendChild(createEl('div', { class: 'table-wrap' }, [attrTable]));
  attrCard.appendChild(createEl('p', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', margin: 'var(--s-1) 0 0' } },
    ['Kontribusi = perkiraan linear (beta gabungan × perubahan faktor); tidak persis menjumlah ke nilai tengah karena perubahan digabung per bulan dan ada unsur acak.']));
  wrap.appendChild(attrCard);

  // Daftar per saham.
  const tickCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  tickCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Per saham']));
  const tickTable = createEl('table', { class: 'table table-sm' });
  const tickHead = createEl('thead', {});
  const tickHeadRow = createEl('tr', {});
  ['Saham', 'Nilai tengah', 'Rentang hasil', 'Pengaruh faktor'].forEach((h) => {
    tickHeadRow.appendChild(createEl('th', {}, [h]));
  });
  tickHead.appendChild(tickHeadRow);
  tickTable.appendChild(tickHead);
  const tickBody = createEl('tbody', {});
  (r.tickers || []).forEach((t) => {
    const tr = createEl('tr', {});
    tr.appendChild(createEl('td', {}, [t.ticker]));
    tr.appendChild(createEl('td', {}, [fmtPct(t.median_pct)]));
    tr.appendChild(createEl('td', {}, [`${fmtPct(t.p5_pct)} – ${fmtPct(t.p95_pct)}`]));
    const fcell = createEl('td', {});
    (t.factors || []).forEach((f) => {
      const fname = (scState.factors.find((x) => x.key === f.factor)?.display_name) || f.factor;
      const line = f.usable
        ? `${fname}: beta ${fmtBeta(f.beta)}, menjelaskan ${(f.r2 != null ? (f.r2 * 100).toFixed(1) : '-')}%`
        : `${fname}: tidak terpengaruh (${shortReason(f.reason)})`;
      fcell.appendChild(createEl('div', { style: { fontSize: 'var(--text-sm)' } }, [line]));
    });
    tr.appendChild(fcell);
    tickBody.appendChild(tr);
  });
  tickTable.appendChild(tickBody);
  tickCard.appendChild(createEl('div', { class: 'table-wrap' }, [tickTable]));
  wrap.appendChild(tickCard);
}

/* ─── Halaman ─── */

export function render() {
  ensureBootstrap();
  const container = createEl('div', { class: 'scenario-page' });
  const head = createEl('div', { style: { marginBottom: 'var(--s-3)' } });
  head.appendChild(createEl('h2', {}, ['Scenario']));
  head.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0' } },
    ['Simulasi seandainya: ubah pergerakan komoditas atau kurs, lalu lihat sebaran kemungkinan return index atau saham.']));
  container.appendChild(head);

  // Preset sekali klik.
  const presetCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  presetCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Skenario siap pakai — sekali klik']));
  const presetGrid = createEl('div', {
    // minmax 240px: di layar sempit (HP ~480px) preset menumpuk vertikal
    // (tidak berdesakan/terpotong); di desktop 3 kolom.
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--s-2)' },
  });
  PRESETS.forEach((p) => {
    // d-inline-flex: tombol preset berisi 2 div (label + deskripsi) —
    // .btn Bootstrap itu inline-block (akan menumpuk vertikal), sementara
    // tampilan saat ini label + deskripsi sebaris; pertahankan sebaris.
    // whiteSpace normal + flexWrap: tombol tidak luber keluar kartu bila
    // teks lebih lebar dari kolom grid (font Bootstrap 16px > 14px lama);
    // bila sempit, deskripsi turun ke baris kedua, bukan terpotong.
    const card = createEl('button', { class: 'btn btn-outline-secondary d-inline-flex', type: 'button',
      style: { textAlign: 'left', padding: 'var(--s-2)', whiteSpace: 'normal', flexWrap: 'wrap' } }, []);
    card.appendChild(createEl('div', { style: { fontWeight: '600' } }, [p.label]));
    card.appendChild(createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } }, [p.desc]));
    card.addEventListener('click', () => runScenario(p));
    presetGrid.appendChild(card);
  });
  presetCard.appendChild(presetGrid);
  container.appendChild(presetCard);

  // Target.
  const targetCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  targetCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Target']));
  const targetRow = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap', alignItems: 'flex-end' } });
  const targetSeg = segmentedControl(
    [['index', 'Index'], ['tickers', 'Satu saham']],
    scState.targetKind, (v) => setTargetKind(v, true));
  targetRow.appendChild(targetSeg.el);
  const idxSel = createEl('select', { class: 'form-select', style: { minWidth: '220px' } });
  targetRow.appendChild(idxSel);
  const tickerInput = createEl('input', {
    type: 'text', placeholder: 'Kode saham, mis. ITMG', class: 'form-control',
    style: { minWidth: '160px', textTransform: 'uppercase' }, disabled: true,
  });
  targetRow.appendChild(tickerInput);
  targetCard.appendChild(targetRow);
  container.appendChild(targetCard);

  // Faktor + mode.
  const factorCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  factorCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Factors']));
  // Penjelasan cara isi % — di ATAS daftar, bukan catatan kaki kecil.
  factorCard.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-2)' } },
    ['Isi total perubahan tiap faktor selama jangka waktu. +20 = naik 20%, −20 = turun 20%. Faktor yang dicentang tapi 0% tidak berpengaruh.']));
  const modeRow = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', alignItems: 'center', marginBottom: 'var(--s-2)', flexWrap: 'wrap' } });
  const modeSeg = segmentedControl(
    [['manual', 'Manual'], ['sub_sector', 'Sub-Sector']],
    scState.factorMode, (v) => setFactorMode(v, true));
  modeRow.appendChild(modeSeg.el);
  const suggestBtn = createEl('button', { class: 'btn btn-outline-secondary btn-sm', type: 'button', disabled: true }, ['Sarankan faktor']);
  modeRow.appendChild(suggestBtn);
  suggestBtn.addEventListener('click', runSuggest);
  factorCard.appendChild(modeRow);
  const factorList = createEl('div', {});
  factorCard.appendChild(factorList);
  container.appendChild(factorCard);

  // Jangka waktu + simulasi + jalankan.
  const runCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  const runRow = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap', alignItems: 'flex-end' } });
  const horizonWrap = createEl('div', {});
  horizonWrap.appendChild(createEl('label', { style: { fontSize: 'var(--text-sm)', display: 'block' } }, ['Jangka waktu (bulan)']));
  const horizonInput = createEl('input', { type: 'number', value: '6', min: '1', max: '60', class: 'form-control', style: { width: '90px' } });
  horizonWrap.appendChild(horizonInput);
  runRow.appendChild(horizonWrap);
  const simsWrap = createEl('div', {});
  simsWrap.appendChild(createEl('label', { style: { fontSize: 'var(--text-sm)', display: 'block' } }, ['Jumlah simulasi']));
  const simsInput = createEl('input', { type: 'number', value: '1000', min: '1', max: '10000', class: 'form-control', style: { width: '110px' } });
  simsWrap.appendChild(simsInput);
  runRow.appendChild(simsWrap);
  const runBtn = createEl('button', { class: 'btn btn-primary', type: 'button' }, ['Jalankan simulasi']);
  runBtn.addEventListener('click', () => runScenario(null));
  runRow.appendChild(runBtn);
  const runLabel = createEl('span', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } }, ['']);
  runRow.appendChild(runLabel);
  runCard.appendChild(runRow);
  container.appendChild(runCard);

  // Hasil.
  const resultWrap = createEl('div', {});
  container.appendChild(resultWrap);

  scRootEl = container;
  scRefs = { indexSelect: idxSel, tickerInput, factorList, horizonInput, simsInput, runBtn, runLabel, resultWrap, factorRows: {}, targetSeg, modeSeg, suggestBtn };
  // Router hanya memanggil element._cleanup saat pindah halaman (bukan
  // export cleanup()) — tanpa ini stylesheet Bootstrap bocor ke halaman
  // lain. Pola yang sama dipakai market.js, stock-list.js, dsb.
  container._cleanup = cleanup;
  loadFactors();
  loadIndices();
  return container;
}

export function cleanup() {
  removeBootstrap();
  scRootEl = null;
  scRefs = {};
  scState.result = null;
}
