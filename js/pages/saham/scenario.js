/* pages/saham/scenario.js — Skenario komoditas + kurs (E8).
 * What-if simulation anchored to commodities/FX (mesin E7).
 * Tiga fitur: (1) beta index murni, (2) beta per-ticker dalam index
 * (output daftar), (3) simulasi single stock. Pemilihan faktor dua
 * mode: MANUAL (centang sendiri) atau SUB-SECTOR (sistem menyarankan
 * dari Sub_Sector, pengguna bisa ubah). Warning labels W1–W4 tampil
 * di dekat angka (rancangan RANCANGAN_SKENARIO_MC.md §7).
 * Playful: kartu prasetel satu klik (mesin E7 yang sama).
 * Layout mengikuti simulasi-iseng.js (card + createEl + Api + toast). */
import { createEl } from '../../utils/dom.js';
import Api from '../../core/api.js';
import { toast } from '../../ui/toast.js';

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

function collectFactors() {
  const out = [];
  for (const f of scState.factors) {
    const row = scRefs.factorRows?.[f.key];
    if (!row || !row.check.checked) continue;
    const pct = parseFloat(row.pct.value);
    if (Number.isNaN(pct)) continue;
    out.push({ key: f.key, total_change_pct: pct });
  }
  return out;
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
    target = preset.target;
    factors = preset.factors;
    horizon = preset.horizon_months;
  } else {
    target = collectTarget();
    if (!target) {
      toast('Pilih index atau isi ticker dulu.', 'danger');
      return;
    }
    factors = collectFactors();
    if (!factors.length) {
      toast('Centang minimal satu faktor.', 'danger');
      return;
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
    const check = createEl('input', { type: 'checkbox' });
    check.checked = false;
    const label = createEl('label', { style: { flex: '1', fontSize: 'var(--text-sm)' } },
      [`${f.display_name} `, createEl('span', { style: { color: 'var(--c-text-3)' } },
        [`(${f.source} ${f.series_code})`])]);
    const pct = createEl('input', {
      type: 'number', step: '1', value: '0',
      class: 'field__input',
      style: { width: '90px', textAlign: 'right' },
      title: 'Total % perubahan faktor selama horizon',
    });
    const pctLabel = createEl('span', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } }, ['%']);
    row.appendChild(check);
    row.appendChild(label);
    row.appendChild(pct);
    row.appendChild(pctLabel);
    wrap.appendChild(row);
    scRefs.factorRows[f.key] = { check, pct };
  });
}

function renderRunState() {
  if (scRefs.runBtn) scRefs.runBtn.disabled = scState.running;
  if (scRefs.runLabel) {
    scRefs.runLabel.textContent = scState.running ? 'Running…' : '';
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
  const stats = createEl('div', {
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--s-2)' },
  });
  stats.appendChild(statCard('Median (p50)', fmtPct(d.p50), 'return kumulatif horizon'));
  stats.appendChild(statCard('P5', fmtPct(d.p5)));
  stats.appendChild(statCard('P95', fmtPct(d.p95)));
  stats.appendChild(statCard('Mean', fmtPct(d.mean)));
  stats.appendChild(statCard('Prob. loss', fmtPct(r.prob_loss_pct), 'simulasi berakhir negatif'));
  head.appendChild(stats);
  wrap.appendChild(head);

  // Bilah distribusi (p5–p95, median ditandai).
  const barCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  barCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Distribution']));
  const bar = createEl('div', {
    style: { position: 'relative', height: '18px', background: 'var(--c-bg-2)',
             borderRadius: '9px', overflow: 'hidden', marginBottom: 'var(--s-1)' },
  });
  // Skala: rentang p5..p95 dipetakan ke 0..100%; 0% sebagai acuan.
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
    [`p5 ${fmtPct(d.p5)}  ·  median ${fmtPct(d.p50)}  ·  p95 ${fmtPct(d.p95)}`]));
  wrap.appendChild(barCard);

  // Atribusi per faktor.
  const attrCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  attrCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Attribution']));
  const attrTable = createEl('table', { class: 'table' });
  const attrHead = createEl('thead', {});
  const attrHeadRow = createEl('tr', {});
  ['Factor', 'Beta (agg)', 'Change', 'Approx. contribution'].forEach((h) => {
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
  attrCard.appendChild(attrTable);
  attrCard.appendChild(createEl('p', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', margin: 'var(--s-1) 0 0' } },
    ['Kontribusi = aproksimasi linear (beta agregat × perubahan faktor); tidak persis menjumlah ke median karena compounding + noise.']));
  wrap.appendChild(attrCard);

  // Daftar per-ticker.
  const tickCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  tickCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Per-ticker']));
  const tickTable = createEl('table', { class: 'table' });
  const tickHead = createEl('thead', {});
  const tickHeadRow = createEl('tr', {});
  ['Ticker', 'Weight', 'Median', 'P5', 'P95', 'Factors (beta / R²)'].forEach((h) => {
    tickHeadRow.appendChild(createEl('th', {}, [h]));
  });
  tickHead.appendChild(tickHeadRow);
  tickTable.appendChild(tickHead);
  const tickBody = createEl('tbody', {});
  (r.tickers || []).forEach((t) => {
    const tr = createEl('tr', {});
    tr.appendChild(createEl('td', {}, [t.ticker]));
    tr.appendChild(createEl('td', {}, [t.weight != null ? `${(t.weight * 100).toFixed(1)}%` : '-']));
    tr.appendChild(createEl('td', {}, [fmtPct(t.median_pct)]));
    tr.appendChild(createEl('td', {}, [fmtPct(t.p5_pct)]));
    tr.appendChild(createEl('td', {}, [fmtPct(t.p95_pct)]));
    const fcell = createEl('td', {});
    (t.factors || []).forEach((f) => {
      const line = f.usable
        ? `${f.factor}: β ${fmtBeta(f.beta)}, R² ${(f.r2 != null ? (f.r2 * 100).toFixed(1) : '-')}%`
        : `${f.factor}: tidak dijangkar (${f.reason || ''})`;
      fcell.appendChild(createEl('div', { style: { fontSize: 'var(--text-sm)' } }, [line]));
    });
    tr.appendChild(fcell);
    tickBody.appendChild(tr);
  });
  tickTable.appendChild(tickBody);
  tickCard.appendChild(tickTable);
  wrap.appendChild(tickCard);

  // Warning labels (W1–W4) di dekat angka.
  const warnCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  warnCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Notes']));
  const labels = r.labels || {};
  if (labels.W1) warnCard.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', margin: '0 0 var(--s-1)' } }, ['W1 — ' + labels.W1]));
  if (labels.W4) warnCard.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', margin: '0 0 var(--s-1)' } }, ['W4 — ' + labels.W4]));
  const w3 = (r.warnings || []).filter((w) => w);
  if (w3.length) {
    warnCard.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', margin: 'var(--s-2) 0 var(--s-1)' } },
      ['W3 — Beta tidak dihitung (data < 36 bulan / korelasi lemah) — saham ini tidak dijangkar faktor:']));
    const ul = createEl('ul', { style: { fontSize: 'var(--text-sm)', margin: '0', paddingLeft: 'var(--s-4)' } });
    w3.forEach((w) => {
      ul.appendChild(createEl('li', {}, [`${w.ticker} / ${w.factor}: ${w.reason || ''}`]));
    });
    warnCard.appendChild(ul);
  } else {
    warnCard.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', margin: '0' } },
      ['Semua ticker lolos ambang beta (tidak ada warning W3).']));
  }
  wrap.appendChild(warnCard);
}

/* ─── Halaman ─── */

export function render() {
  const container = createEl('div', { class: 'scenario-page' });
  const head = createEl('div', { style: { marginBottom: 'var(--s-3)' } });
  head.appendChild(createEl('h2', {}, ['Scenario']));
  head.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0' } },
    ['What-if simulation anchored to commodities & FX. Set a factor move, see the distribution of the index/stock return.']));
  container.appendChild(head);

  // Playful presets.
  const presetCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  presetCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Playful — one-click scenarios']));
  const presetGrid = createEl('div', {
    // minmax 240px: di layar sempit (HP ~480px) preset menumpuk vertikal
    // (tidak berdesakan/terpotong); di desktop 3 kolom.
    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--s-2)' },
  });
  PRESETS.forEach((p) => {
    const card = createEl('button', { class: 'btn btn--secondary', type: 'button',
      style: { textAlign: 'left', padding: 'var(--s-2)' } }, []);
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
  const kindWrap = createEl('div', {});
  const kindIndex = createEl('input', { type: 'radio', name: 'sc-target-kind', value: 'index', checked: true });
  const kindTick = createEl('input', { type: 'radio', name: 'sc-target-kind', value: 'tickers' });
  kindWrap.appendChild(kindIndex);
  kindWrap.appendChild(createEl('span', { style: { fontSize: 'var(--text-sm)', marginRight: 'var(--s-2)' } }, [' Index']));
  kindWrap.appendChild(kindTick);
  kindWrap.appendChild(createEl('span', { style: { fontSize: 'var(--text-sm)' } }, [' Single stock']));
  targetRow.appendChild(kindWrap);
  const idxSel = createEl('select', { class: 'field__select', style: { minWidth: '220px' } });
  targetRow.appendChild(idxSel);
  const tickerInput = createEl('input', {
    type: 'text', placeholder: 'Ticker, mis. ITMG', class: 'field__input',
    style: { minWidth: '160px', textTransform: 'uppercase' }, disabled: true,
  });
  targetRow.appendChild(tickerInput);
  kindIndex.addEventListener('change', () => {
    scState.targetKind = 'index';
    idxSel.disabled = false;
    tickerInput.disabled = true;
  });
  kindTick.addEventListener('change', () => {
    scState.targetKind = 'tickers';
    idxSel.disabled = true;
    tickerInput.disabled = false;
    tickerInput.focus();
  });
  targetCard.appendChild(targetRow);
  container.appendChild(targetCard);

  // Faktor + mode.
  const factorCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  factorCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Factors']));
  const modeRow = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', alignItems: 'center', marginBottom: 'var(--s-2)', flexWrap: 'wrap' } });
  const modeManual = createEl('input', { type: 'radio', name: 'sc-factor-mode', value: 'manual', checked: true });
  const modeSub = createEl('input', { type: 'radio', name: 'sc-factor-mode', value: 'sub_sector' });
  modeRow.appendChild(modeManual);
  modeRow.appendChild(createEl('span', { style: { fontSize: 'var(--text-sm)', marginRight: 'var(--s-2)' } }, [' Manual (centang sendiri)']));
  modeRow.appendChild(modeSub);
  modeRow.appendChild(createEl('span', { style: { fontSize: 'var(--text-sm)' } }, [' Sub-Sector (sistem menyarankan)']));
  const suggestBtn = createEl('button', { class: 'btn btn--secondary btn--sm', type: 'button', disabled: true }, ['Suggest from Sub-Sector']);
  modeRow.appendChild(suggestBtn);
  modeManual.addEventListener('change', () => {
    scState.factorMode = 'manual';
    suggestBtn.disabled = true;
  });
  modeSub.addEventListener('change', async () => {
    scState.factorMode = 'sub_sector';
    suggestBtn.disabled = false;
    const keys = await suggestFactors();
    if (keys.size) {
      Object.entries(scRefs.factorRows || {}).forEach(([k, row]) => {
        row.check.checked = keys.has(k);
      });
    } else {
      toast('Tidak ada saran faktor untuk target ini.', 'danger');
    }
  });
  suggestBtn.addEventListener('click', async () => {
    const keys = await suggestFactors();
    if (keys.size) {
      Object.entries(scRefs.factorRows || {}).forEach(([k, row]) => {
        row.check.checked = keys.has(k);
      });
    } else {
      toast('Tidak ada saran faktor untuk target ini.', 'danger');
    }
  });
  factorCard.appendChild(modeRow);
  const factorList = createEl('div', {});
  factorCard.appendChild(factorList);
  const factorHint = createEl('p', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', margin: 'var(--s-1) 0 0' } },
    ['% = total perubahan faktor selama horizon (mis. +20 berarti naik 20%).']);
  factorCard.appendChild(factorHint);
  container.appendChild(factorCard);

  // Horizon + sims + run.
  const runCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  const runRow = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap', alignItems: 'flex-end' } });
  const horizonWrap = createEl('div', {});
  horizonWrap.appendChild(createEl('label', { style: { fontSize: 'var(--text-sm)', display: 'block' } }, ['Horizon (months)']));
  const horizonInput = createEl('input', { type: 'number', value: '6', min: '1', max: '60', class: 'field__input', style: { width: '90px' } });
  horizonWrap.appendChild(horizonInput);
  runRow.appendChild(horizonWrap);
  const simsWrap = createEl('div', {});
  simsWrap.appendChild(createEl('label', { style: { fontSize: 'var(--text-sm)', display: 'block' } }, ['Simulations']));
  const simsInput = createEl('input', { type: 'number', value: '1000', min: '1', max: '10000', class: 'field__input', style: { width: '110px' } });
  simsWrap.appendChild(simsInput);
  runRow.appendChild(simsWrap);
  const runBtn = createEl('button', { class: 'btn btn--primary', type: 'button' }, ['Run scenario']);
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
  scRefs = { indexSelect: idxSel, tickerInput, factorList, horizonInput, simsInput, runBtn, runLabel, resultWrap, factorRows: {} };
  loadFactors();
  loadIndices();
  return container;
}

export function cleanup() {
  scRootEl = null;
  scRefs = {};
  scState.result = null;
}
