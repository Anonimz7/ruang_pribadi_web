/* pages/monte-carlo.js — Monte Carlo (MC-1): penilai probabilistik
 * Index Saham. Menu sendiri (keputusan user 2026-10-23); Index Saham
 * tetap pemilik komposisi — halaman ini hanya membaca & menilai.
 * DICABUT 2026-10-24 (keputusan filosofis): penyusun komposisi (MC-4),
 * kartu sisa-horizon terkondisi, dan segala keluaran pengambil keputusan.
 * Yang tersisa: lensa pemahaman — kipas, perbandingan rezim, atribusi,
 * dan jurnal penilaian (buku besar). Halaman ini menilai, bukan memutuskan.
 * Simulasi: POST /index-saham/{id}/monte-carlo (bootstrap blok atas
 * log-return level; seed tetap; jendela selalu dilabeli). */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { navigate } from '../../core/router.js';
import { formatNilaiSingkat } from '../../utils/format.js';

const HORIZONS = [[21, '1 bln'], [63, '3 bln'], [126, '6 bln'], [252, '1 thn']];
const WINDOWS = [['1y', '1 thn'], ['2y', '2 thn'], ['3y', '3 thn'], ['5y', '5 thn'], ['all', 'Semua']];
const NSIMS = [[2000, '2.000'], [5000, '5.000'], [10000, '10.000']];
const METHODS = [['level', 'Level (harga)'], ['fundamental', 'Fundamental (laba × kelipatan)']];
const MODES = [['semua', 'Semua blok'], ['rezim', 'Ikuti rezim terkini'], ['tekanan', 'Skenario tekanan']];
const STATE_LABEL = { masuk: 'Arus masuk', netral: 'Netral', keluar: 'Arus keluar' };
const MODE_LABEL = { semua: 'Semua blok', rezim: 'Ikuti rezim terkini', tekanan: 'Skenario tekanan' };
const WIN_LABEL = { '1y': '1 tahun terakhir', '2y': '2 tahun terakhir', '3y': '3 tahun terakhir', '5y': '5 tahun terakhir', all: 'seluruh seri' };

function fmtPct(v) {
  if (v == null || isNaN(v)) return '-';
  const n = Number(v) * 100;
  return (n > 0 ? '+' : '') + n.toFixed(1).replace('.', ',') + '%';
}
function fmtProb(v) {
  if (v == null || isNaN(v)) return '-';
  return (Number(v) * 100).toFixed(1).replace('.', ',') + '%';
}
function fmtRp(v) {
  if (v == null || isNaN(v)) return '-';
  return 'Rp ' + Math.round(Number(v)).toLocaleString('id-ID');
}
function fmtDate(s) {
  if (!s) return '-';
  const d = new Date(s + 'T00:00:00');
  return isNaN(d) ? s : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function makeSeg(options, initial, onPick) {
  const wrap = createEl('div', {
    style: {
      display: 'inline-flex', border: '1px solid var(--c-border)', borderRadius: '8px',
      overflow: 'hidden', flexWrap: 'wrap',
    },
  });
  const btns = [];
  options.forEach(([val, label]) => {
    const b = createEl('button', {
      class: 'btn btn--sm',
      style: { borderRadius: '0', border: '0', background: 'transparent', color: 'var(--c-text-2)' },
    }, [label]);
    const paint = () => {
      const on = String(val) === String(wrap.dataset.value);
      b.style.background = on ? 'var(--c-primary)' : 'transparent';
      b.style.color = on ? '#fff' : 'var(--c-text-2)';
    };
    b.addEventListener('click', () => {
      wrap.dataset.value = String(val);
      btns.forEach((x) => x.paint());
      onPick(val);
    });
    b.paint = paint;
    btns.push(b);
    wrap.appendChild(b);
  });
  wrap.dataset.value = String(initial);
  btns.forEach((x) => x.paint());
  return wrap;
}

function statCard(label, value, color) {
  const el = createEl('div', {
    class: 'card',
    style: { padding: 'var(--s-3)', marginBottom: '0' },
  });
  el.innerHTML = `
    <div style="font-size:var(--text-xs);color:var(--c-text-3);letter-spacing:0.04em;">${label}</div>
    <div style="font-size:var(--text-lg);font-weight:700;margin-top:2px;${color ? `color:${color};` : ''}">${value}</div>`;
  return el;
}

function fanSvg(fan, horizon) {
  const W = 900, H = 320, L = 56, R = 12, T = 12, B = 26;
  const vals = fan.flatMap((f) => [f.p5, f.p95]).concat([0]);
  let mn = Math.min(...vals), mx = Math.max(...vals);
  const sp = (mx - mn) * 0.08 || 0.01; mn -= sp; mx += sp;
  const X = (h) => L + (h / horizon) * (W - L - R);
  const Y = (v) => T + ((mx - v) / (mx - mn)) * (H - T - B);
  const band = (lo, hi, op) => {
    let d1 = '', d2 = '';
    fan.forEach((f) => { d1 += `L${X(f.h).toFixed(1)},${Y(f[hi]).toFixed(1)} `; });
    [...fan].reverse().forEach((f) => { d2 += `L${X(f.h).toFixed(1)},${Y(f[lo]).toFixed(1)} `; });
    return `<path d="M${X(0)},${Y(0)} ${d1}${d2}Z" fill="var(--c-primary)" fill-opacity="${op}"/>`;
  };
  const line = (k, color, w) => {
    let d = `M${X(0)},${Y(0)} `;
    fan.forEach((f) => { d += `L${X(f.h).toFixed(1)},${Y(f[k]).toFixed(1)} `; });
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"/>`;
  };
  let grid = '';
  for (let g = 0; g <= 4; g++) {
    const v = mn + (mx - mn) * g / 4, y = Y(v);
    grid += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="var(--c-border)" stroke-width="1"/>
      <text x="${L - 6}" y="${y + 4}" fill="var(--c-text-3)" font-size="11" text-anchor="end">${fmtPct(v)}</text>`;
  }
  let xl = '';
  fan.forEach((f) => {
    if (f.h % 21 === 0 || f.h === horizon) {
      xl += `<text x="${X(f.h)}" y="${H - 6}" fill="var(--c-text-3)" font-size="11" text-anchor="middle">${f.h} hr</text>`;
    }
  });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
    ${grid}${band('p5', 'p95', 0.13)}${band('p25', 'p75', 0.28)}
    <line x1="${L}" y1="${Y(0)}" x2="${W - R}" y2="${Y(0)}" stroke="var(--c-danger)" stroke-width="1.2"/>
    ${line('p50', 'var(--c-primary)', 2.2)}${xl}</svg>`;
}

function fanSvgRealized(fan, horizon, points) {
  /* Kipas tersimpan + garis realisasi (buku besar §17): points =
   * [{h, v}] return kumulatif realisasi pada titik periksa. */
  const W = 900, H = 320, L = 56, R = 12, T = 12, B = 26;
  const vals = fan.flatMap((f) => [f.p5, f.p95])
    .concat(points.map((p) => p.v)).concat([0]);
  let mn = Math.min(...vals), mx = Math.max(...vals);
  const sp = (mx - mn) * 0.08 || 0.01; mn -= sp; mx += sp;
  const X = (h) => L + (h / horizon) * (W - L - R);
  const Y = (v) => T + ((mx - v) / (mx - mn)) * (H - T - B);
  const band = (lo, hi, op) => {
    let d1 = '', d2 = '';
    fan.forEach((f) => { d1 += `L${X(f.h).toFixed(1)},${Y(f[hi]).toFixed(1)} `; });
    [...fan].reverse().forEach((f) => { d2 += `L${X(f.h).toFixed(1)},${Y(f[lo]).toFixed(1)} `; });
    return `<path d="M${X(0)},${Y(0)} ${d1}${d2}Z" fill="var(--c-primary)" fill-opacity="${op}"/>`;
  };
  const line = (k, color, w) => {
    let d = `M${X(0)},${Y(0)} `;
    fan.forEach((f) => { d += `L${X(f.h).toFixed(1)},${Y(f[k]).toFixed(1)} `; });
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"/>`;
  };
  let grid = '';
  for (let g = 0; g <= 4; g++) {
    const v = mn + (mx - mn) * g / 4, y = Y(v);
    grid += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="var(--c-border)" stroke-width="1"/>
      <text x="${L - 6}" y="${y + 4}" fill="var(--c-text-3)" font-size="11" text-anchor="end">${fmtPct(v)}</text>`;
  }
  let xl = '';
  fan.forEach((f) => {
    if (f.h % 21 === 0 || f.h === horizon) {
      xl += `<text x="${X(f.h)}" y="${H - 6}" fill="var(--c-text-3)" font-size="11" text-anchor="middle">${f.h} hr</text>`;
    }
  });
  let realized = '';
  if (points.length) {
    let d = `M${X(0)},${Y(0)} `;
    points.forEach((p) => { d += `L${X(p.h).toFixed(1)},${Y(p.v).toFixed(1)} `; });
    realized = `<path d="${d}" fill="none" stroke="#f0a840" stroke-width="2.4"/>`
      + points.map((p) => `<circle cx="${X(p.h)}" cy="${Y(p.v)}" r="4.5" fill="#f0a840" stroke="#fff" stroke-width="1.4"/>`).join('');
  }
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
    ${grid}${band('p5', 'p95', 0.13)}${band('p25', 'p75', 0.28)}
    <line x1="${L}" y1="${Y(0)}" x2="${W - R}" y2="${Y(0)}" stroke="var(--c-danger)" stroke-width="1.2"/>
    ${line('p50', 'var(--c-primary)', 2.2)}${realized}${xl}</svg>`;
}

function fanSvgQ(fan, quarters) {
  const W = 900, H = 320, L = 56, R = 12, T = 12, B = 26;
  const vals = fan.flatMap((f) => [f.p5, f.p95]).concat([0]);
  let mn = Math.min(...vals), mx = Math.max(...vals);
  const sp = (mx - mn) * 0.08 || 0.01; mn -= sp; mx += sp;
  const X = (q) => L + (q / quarters) * (W - L - R);
  const Y = (v) => T + ((mx - v) / (mx - mn)) * (H - T - B);
  const band = (lo, hi, op) => {
    let d1 = '', d2 = '';
    fan.forEach((f) => { d1 += `L${X(f.q).toFixed(1)},${Y(f[hi]).toFixed(1)} `; });
    [...fan].reverse().forEach((f) => { d2 += `L${X(f.q).toFixed(1)},${Y(f[lo]).toFixed(1)} `; });
    return `<path d="M${X(0)},${Y(0)} ${d1}${d2}Z" fill="var(--c-primary)" fill-opacity="${op}"/>`;
  };
  const line = (k, color, w) => {
    let d = `M${X(0)},${Y(0)} `;
    fan.forEach((f) => { d += `L${X(f.q).toFixed(1)},${Y(f[k]).toFixed(1)} `; });
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"/>`;
  };
  let grid = '';
  for (let g = 0; g <= 4; g++) {
    const v = mn + (mx - mn) * g / 4, y = Y(v);
    grid += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="var(--c-border)" stroke-width="1"/>
      <text x="${L - 6}" y="${y + 4}" fill="var(--c-text-3)" font-size="11" text-anchor="end">${fmtPct(v)}</text>`;
  }
  let xl = '';
  fan.forEach((f) => {
    xl += `<text x="${X(f.q)}" y="${H - 6}" fill="var(--c-text-3)" font-size="11" text-anchor="middle">K${f.q}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
    ${grid}${band('p5', 'p95', 0.13)}${band('p25', 'p75', 0.28)}
    <line x1="${L}" y1="${Y(0)}" x2="${W - R}" y2="${Y(0)}" stroke="var(--c-danger)" stroke-width="1.2"/>
    ${line('p50', 'var(--c-primary)', 2.2)}${xl}</svg>`;
}

export function render() {
  const state = {
    indices: [],
    indexId: '',
    method: 'level',
    horizon: 63,
    window: '3y',
    nSims: 5000,
    mode: 'semua',
    result: null,
    running: false,
  };

  const container = createEl('div', {});

  const head = createEl('div', {
    class: 'card',
    style: { display: 'flex', alignItems: 'center', gap: 'var(--s-3)', flexWrap: 'wrap', marginBottom: 'var(--s-3)' },
  });
  const hinfo = createEl('div', { style: { flex: '1', minWidth: '220px' } });
  hinfo.appendChild(createEl('h2', { style: { fontSize: 'var(--text-lg)', fontWeight: 700 } }, ['Monte Carlo']));
  hinfo.appendChild(createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } },
    ['Penilai probabilistik susunan Index Saham: sebaran hasil, peluang positif, dan risiko drawdown — bukan ramalan arah.']));
  head.appendChild(hinfo);
  const toIdx = createEl('button', { class: 'btn btn--secondary btn--sm' });
  toIdx.innerHTML = `${icons['layers']} Buka Index Saham`;
  toIdx.addEventListener('click', () => navigate('/saham/index'));
  head.appendChild(toIdx);
  container.appendChild(head);

  // ── Pengaturan ──
  const ctl = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  ctl.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-3)' } }, ['Pengaturan Simulasi']));
  const grid = createEl('div', {
    style: { display: 'flex', gap: 'var(--s-4)', flexWrap: 'wrap', alignItems: 'flex-end' },
  });
  const field = (label, el) => {
    const w = createEl('div', {});
    w.appendChild(createEl('label', {
      style: { display: 'block', fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginBottom: 'var(--s-1)', letterSpacing: '0.04em' },
    }, [label]));
    w.appendChild(el);
    return w;
  };
  const idxSel = createEl('select', { class: 'field__select', style: { minWidth: '220px' } });
  idxSel.addEventListener('change', (e) => { state.indexId = e.target.value; });
  const modeField = field('MODE REZIM ARUS', makeSeg(MODES, state.mode, (v) => { state.mode = v; }));
  const methodField = field('METODE', makeSeg(METHODS, state.method, (v) => {
    state.method = v;
    modeField.style.display = v === 'fundamental' ? 'none' : '';
  }));
  grid.appendChild(methodField);
  grid.appendChild(field('INDEKS', idxSel));
  grid.appendChild(field('HORIZON', makeSeg(HORIZONS, state.horizon, (v) => { state.horizon = v; })));
  grid.appendChild(field('JENDELA SUMBER RETURN', makeSeg(WINDOWS, state.window, (v) => { state.window = v; })));
  grid.appendChild(field('JUMLAH SIMULASI', makeSeg(NSIMS, state.nSims, (v) => { state.nSims = v; })));
  grid.appendChild(modeField);
  const capInput = createEl('input', {
    class: 'field__input', type: 'number', min: '0', step: '100000',
    placeholder: 'cth. 25000000', style: { width: '170px' },
  });
  grid.appendChild(field('MODAL (OPSIONAL, RP)', capInput));
  const runBtn = createEl('button', { class: 'btn btn--primary' }, ['Jalankan Simulasi']);
  grid.appendChild(runBtn);
  ctl.appendChild(grid);
  ctl.appendChild(createEl('p', {
    style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-3)' },
  }, ['Metode: bootstrap blok 20 hari atas log-return level indeks (return hari stale dibuang). Seed tetap — masukan yang sama menghasilkan angka yang sama. Mode rezim mengondisikan blok pada keadaan arus asing indeks (tersil jendela: masuk / netral / keluar). Hasil selalu dibaca bersama jendela sumbernya: keluaran mewarisi rezim jendela itu.']));
  container.appendChild(ctl);

  const resultWrap = createEl('div', {});
  container.appendChild(resultWrap);


  // ── Buku Besar Simulasi (Fase A §17) ──
  const ledgerCard = createEl('div', { class: 'card', style: { marginTop: 'var(--s-3)' } });
  ledgerCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Riwayat & Kalibrasi Simulasi']));
  ledgerCard.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-3)' } },
    ['Setiap simulasi Level (MC-1/MC-2) tersimpan otomatis sebagai hipotesis terdaftar — lengkap dengan snapshot anggota & sidik jari datanya. Sesudah titik periksa bulanannya jatuh tempo, realisasi dinilai terhadap jalur tersimpan (persentil & di dalam/luar pita) Penilaian tiap titik dicatat sebagai jurnal: apa yang dulu diperkirakan versus apa yang terjadi. Halaman ini menilai, bukan memutuskan.']));
  const pitWrap = createEl('div', { style: { marginBottom: 'var(--s-3)' } });
  ledgerCard.appendChild(pitWrap);
  const ledgerListWrap = createEl('div', {});
  ledgerCard.appendChild(ledgerListWrap);
  container.appendChild(ledgerCard);
  const ledgerDetailWrap = createEl('div', { style: { marginTop: 'var(--s-3)' } });
  container.appendChild(ledgerDetailWrap);

  function renderFundamental(r) {
    const idx = state.indices.find((i) => String(i.id) === String(r.index_id));
    const mt = r.materials || {};
    const asm = r.assumptions || {};

    const strip = createEl('div', {
      class: 'card',
      style: { borderLeft: '3px solid var(--c-warning, #f0a840)', marginBottom: 'var(--s-3)', fontSize: 'var(--text-sm)' },
    });
    strip.innerHTML = `<b>Metode Fundamental:</b> horizon ${r.horizon_days} hari dibulatkan ke <b>${r.quarters} kuartal</b> simulasi · ` +
      `${Number(r.n_sims).toLocaleString('id-ID')} simulasi · bobot tercakup uraian laba × kelipatan: <b>${(mt.covered_weight * 100).toFixed(1).replace('.', ',')}%</b> ` +
      `(${mt.n_covered} dari ${mt.n_members} anggota; ${mt.n_fallback} anggota dinilai jalur harga cadangan). ` +
      `Parameter jendela hanya mengatur jalur cadangan; kolam laba & PER memakai seluruh riwayat. Tanpa statistik drawdown — simpul kuartalan terlalu kasar.`;
    resultWrap.appendChild(strip);

    const fanCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
    fanCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } },
      [`Grafik Kipas — ${idx ? idx.name : 'Indeks'} (return kumulatif per kuartal)`]));
    const svgWrap = createEl('div', {});
    svgWrap.innerHTML = fanSvgQ(r.fan, r.quarters);
    fanCard.appendChild(svgWrap);
    fanCard.appendChild(createEl('div', {
      style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-2)' },
    }, ['Pita luar p5–p95 · pita dalam p25–p75 · garis tengah median · K = kuartal.']));
    resultWrap.appendChild(fanCard);

    const stats = createEl('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--s-3)', marginBottom: 'var(--s-3)' },
    });
    stats.append(
      statCard('PELUANG BERAKHIR POSITIF', fmtProb(r.p_end_positive)),
      statCard('RETURN MEDIAN (p50)', fmtPct(r.end_ret.p50)),
      statCard('RETURN p5 (BURUK)', fmtPct(r.end_ret.p5), 'var(--c-danger)'),
      statCard('RETURN p95 (BAIK)', fmtPct(r.end_ret.p95), 'var(--c-accent)'),
    );
    resultWrap.appendChild(stats);

    const at = r.attribution || {};
    const ac = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
    ac.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Atribusi Return (median per komponen)']));
    const arows = [
      ['Pertumbuhan laba', at.earnings], ['Perubahan kelipatan (PER)', at.multiple],
      ['Interaksi laba × kelipatan', at.interaction], ['Dividen (kas)', at.dividend],
      ['Jalur harga cadangan', at.fallback],
    ];
    const ap = createEl('p', { style: { fontSize: 'var(--text-sm)', margin: '0' } });
    ap.innerHTML = arows.map(([k, v]) => `${k}: <b>${fmtPct(v || 0)}</b>`).join(' · ');
    ac.appendChild(ap);
    ac.appendChild(createEl('p', {
      style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-2)' },
    }, ['Pada tiap simulasi, kelima komponen berjumlah persis ke return totalnya. Yang ditampilkan adalah median tiap komponen, jadi jumlah kelimanya tidak harus sama persis dengan return median.']));
    resultWrap.appendChild(ac);

    if (r.capital) {
      const cc = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
      cc.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Nilai Akhir dalam Rupiah']));
      const ev = r.capital.end_value;
      cc.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', marginBottom: 'var(--s-3)' } },
        [`Modal ${fmtRp(r.capital.amount)} → kelas modal ${r.capital.class} (Proposal B). Nilai akhir pada horizon ${r.quarters} kuartal:`]));
      const cg = createEl('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--s-3)' },
      });
      cg.append(
        statCard('p5 (BURUK)', fmtRp(ev.p5)),
        statCard('MEDIAN', fmtRp(ev.p50)),
        statCard('p95 (BAIK)', fmtRp(ev.p95)),
        statCard('PELUANG AKHIR DI BAWAH MODAL', fmtProb(r.capital.p_end_below_capital)),
      );
      cc.appendChild(cg);
      resultWrap.appendChild(cc);
    }

    const mc = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
    mc.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Bahan per Anggota']));
    const tbl = createEl('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' } });
    tbl.innerHTML = `<thead><tr style="border-bottom:1px solid var(--c-border);color:var(--c-text-3);font-size:var(--text-xs);">
      <th style="text-align:left;padding:6px 8px;">EMITEN</th><th style="text-align:left;padding:6px 8px;">SEKTOR</th>
      <th style="text-align:right;padding:6px 8px;">BOBOT</th><th style="text-align:left;padding:6px 8px;">STATUS</th>
      <th style="text-align:right;padding:6px 8px;">PER KINI / MEDIAN</th><th style="text-align:right;padding:6px 8px;">YIELD DIV</th></tr></thead>
      <tbody>${(r.members || []).map((m) => `<tr style="border-bottom:1px solid var(--c-border);">
        <td style="padding:6px 8px;font-weight:600;">${m.ticker}</td>
        <td style="padding:6px 8px;">${m.sector || '-'}</td>
        <td style="padding:6px 8px;text-align:right;">${(m.weight * 100).toFixed(1).replace('.', ',')}%</td>
        <td style="padding:6px 8px;">${m.status === 'covered' ? 'Tercakup' : 'Cadangan — ' + (m.reason || '')}${m.n_recovered ? ` · ${m.n_recovered} kuartal pulih terpakai` : ''}</td>
        <td style="padding:6px 8px;text-align:right;">${m.per0 ? m.per0.toLocaleString('id-ID') + ' / ' + m.per_median.toLocaleString('id-ID') : '-'}</td>
        <td style="padding:6px 8px;text-align:right;">${m.div_yield != null ? (m.div_yield * 100).toFixed(2).replace('.', ',') + '%' : '-'}</td></tr>`).join('')}</tbody>`;
    mc.appendChild(tbl);
    resultWrap.appendChild(mc);

    const as = createEl('div', { class: 'card' });
    as.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Asumsi yang Dipakai']));
    as.appendChild(createEl('p', {
      style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0' },
    }, [`Guncangan tiga lapis: pasar (bersama) → deviasi sektor → sisa khas emiten. Kecepatan reversi PER φ = ${asm.phi} (${asm.phi_basis}). ` +
      `Pertumbuhan laba dipangkas pada [${fmtPct(asm.winsor_growth ? asm.winsor_growth[0] : 0)}, ${fmtPct(asm.winsor_growth ? asm.winsor_growth[1] : 0)}] (persentil 5/95 pooled). ` +
      `PER berlantai ${asm.per_floor} dan berplafon ${asm.per_cap}×. Dividen: ${asm.dividend}. Mode rezim arus (MC-2) tidak berlaku untuk metode ini.`]));
    resultWrap.appendChild(as);
  }

  function renderResult() {
    resultWrap.innerHTML = '';
    const r = state.result;
    if (!r) return;
    if (r.method === 'fundamental') { renderFundamental(r); return; }
    const idx = state.indices.find((i) => String(i.id) === String(r.index_id));

    const wl = createEl('div', {
      class: 'card',
      style: { borderLeft: '3px solid var(--c-warning, #f0a840)', marginBottom: 'var(--s-3)', fontSize: 'var(--text-sm)' },
    });
    wl.innerHTML = `<b>Jendela sumber:</b> ${WIN_LABEL[r.window.label] || r.window.label} — ` +
      `${Number(r.window.n_returns).toLocaleString('id-ID')} return harian, ${fmtDate(r.window.from)} s.d. ${fmtDate(r.window.to)} · ` +
      `${Number(r.n_sims).toLocaleString('id-ID')} simulasi · horizon ${r.horizon_days} hari bursa. Hasil mewarisi rezim jendela ini.` +
      (r.mode === 'tekanan'
        ? `<br><b>SKENARIO TEKANAN:</b> hasil di bawah hanya memakai blok yang mulai pada hari arus-keluar — ini skenario "seolah rezim keluar berlanjut", bukan keadaan rata-rata.`
        : r.mode === 'rezim'
          ? `<br><b>Terkondisi rezim terkini:</b> hasil di bawah hanya memakai blok yang mulai pada keadaan arus terkini (${STATE_LABEL[(r.regime.current || {}).state] || '-'}).`
          : '');
    resultWrap.appendChild(wl);

    if (r.comparison) {
      const rc = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
      rc.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Rezim Arus & Perbandingan Mode']));
      const rg = r.regime || {};
      const info = createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-3)' } });
      if (rg.available && rg.current) {
        info.textContent = `Keadaan terkini: ${STATE_LABEL[rg.current.state] || rg.current.state} ` +
          `(${fmtDate(rg.current.date)}, arus bersih asing indeks ${formatNilaiSingkat(rg.current.flow)}). ` +
          `Blok tersedia — masuk: ${rg.blocks.masuk}, netral: ${rg.blocks.netral}, keluar: ${rg.blocks.keluar} ` +
          `dari ${Number(rg.flow_days).toLocaleString('id-ID')} hari berarus terbaca.`;
      } else {
        info.textContent = 'Arus asing indeks tidak cukup terbaca atau seragam pada jendela ini — mode terkondisi tidak tersedia; hanya mode Semua blok yang dapat dipakai.';
      }
      rc.appendChild(info);
      const tbl = createEl('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' } });
      const rowHtml = (c) => {
        const name = MODE_LABEL[c.mode] + (c.state ? ` (${STATE_LABEL[c.state] || c.state})` : '');
        if (c.unavailable) {
          return `<td style="padding:6px 8px;">${name}</td><td colspan="4" style="padding:6px 8px;color:var(--c-text-3);">${c.unavailable}</td>`;
        }
        const thin = c.thin ? ' <span style="color:var(--c-warning, #f0a840);font-weight:600;">· bahan tipis</span>' : '';
        const sel = c.mode === r.mode ? ' style="font-weight:700;"' : '';
        return `<td style="padding:6px 8px;"${sel}>${name}${thin}</td>` +
          `<td style="padding:6px 8px;text-align:right;">${fmtProb(c.p_end_positive)}</td>` +
          `<td style="padding:6px 8px;text-align:right;">${fmtPct(c.end_ret_p50)}</td>` +
          `<td style="padding:6px 8px;text-align:right;">${fmtPct(c.end_ret_p5)}</td>` +
          `<td style="padding:6px 8px;text-align:right;">${Number(c.blocks).toLocaleString('id-ID')}</td>`;
      };
      tbl.innerHTML = `<thead><tr style="border-bottom:1px solid var(--c-border);color:var(--c-text-3);font-size:var(--text-xs);">` +
        `<th style="text-align:left;padding:6px 8px;">MODE</th><th style="text-align:right;padding:6px 8px;">P(positif)</th>` +
        `<th style="text-align:right;padding:6px 8px;">MEDIAN</th><th style="text-align:right;padding:6px 8px;">p5</th>` +
        `<th style="text-align:right;padding:6px 8px;">BLOK</th></tr></thead>` +
        `<tbody>${r.comparison.map((c) => `<tr style="border-bottom:1px solid var(--c-border);">${rowHtml(c)}</tr>`).join('')}</tbody>`;
      rc.appendChild(tbl);
      if (r.composition) {
        const cp = r.composition;
        const line = createEl('p', {
          style: { fontSize: 'var(--text-sm)', margin: 'var(--s-3) 0 0', color: cp.warning ? 'var(--c-warning, #f0a840)' : 'var(--c-text-2)' },
        }, [cp.warning
          ? `⚠ ${cp.warning} — berdasarkan ${cp.basis} (${cp.n_members} anggota). Peringatan lunak; halaman ini hanya menilai, tidak menegakkan.`
          : `Konsentrasi komposisi: Sektor terbesar ${cp.top_sector} mencakup ${(cp.top_share * 100).toFixed(0).replace('.', ',')}% dari ${cp.n_members} anggota (berdasarkan ${cp.basis}).`]);
        rc.appendChild(line);
      }
      resultWrap.appendChild(rc);
    }

    const fanCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
    fanCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } },
      [`Grafik Kipas — ${idx ? idx.name : 'Indeks'} (return kumulatif)`]));
    const svgWrap = createEl('div', {});
    svgWrap.innerHTML = fanSvg(r.fan, r.horizon_days);
    fanCard.appendChild(svgWrap);
    fanCard.appendChild(createEl('div', {
      style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-2)' },
    }, ['Pita luar p5–p95 (90% jalur) · pita dalam p25–p75 (50% jalur) · garis tengah median (p50) · garis merah 0%.']));
    resultWrap.appendChild(fanCard);

    const stats = createEl('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--s-3)', marginBottom: 'var(--s-3)' },
    });
    stats.append(
      statCard('PELUANG BERAKHIR POSITIF', fmtProb(r.p_end_positive)),
      statCard('RETURN MEDIAN (p50)', fmtPct(r.end_ret.p50)),
      statCard('RETURN p5 (BURUK)', fmtPct(r.end_ret.p5), 'var(--c-danger)'),
      statCard('RETURN p95 (BAIK)', fmtPct(r.end_ret.p95), 'var(--c-accent)'),
      statCard('PELUANG DRAWDOWN >10%', fmtProb(r.p_dd_gt_10)),
      statCard('PELUANG DRAWDOWN >20%', fmtProb(r.p_dd_gt_20)),
      statCard('DRAWDOWN MEDIAN', fmtPct(-Math.abs(r.dd_median)), 'var(--c-danger)'),
    );
    resultWrap.appendChild(stats);

    if (r.capital) {
      const cc = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
      cc.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Nilai Akhir dalam Rupiah']));
      const ev = r.capital.end_value;
      cc.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', marginBottom: 'var(--s-3)' } },
        [`Modal ${fmtRp(r.capital.amount)} → kelas modal ${r.capital.class} (Proposal B). Nilai akhir pada horizon ${r.horizon_days} hari bursa:`]));
      const cg = createEl('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--s-3)' },
      });
      cg.append(
        statCard('p5 (BURUK)', fmtRp(ev.p5)),
        statCard('MEDIAN', fmtRp(ev.p50)),
        statCard('p95 (BAIK)', fmtRp(ev.p95)),
        statCard('PELUANG AKHIR DI BAWAH MODAL', fmtProb(r.capital.p_end_below_capital)),
      );
      cc.appendChild(cg);
      cc.appendChild(createEl('p', {
        style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-3)' },
      }, ['Dihitung dari bobot kontinu sebelum pembulatan lot — menilai keranjangnya, bukan janji eksekusi.']));
      resultWrap.appendChild(cc);
    }

    const note = createEl('div', { class: 'card' });
    note.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Cara Membaca']));
    note.appendChild(createEl('p', {
      style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0' },
    }, ['Monte Carlo menyusun ulang blok-blok return masa lalu menjadi ribuan jalur masa depan yang tidak pernah terjadi, lalu melaporkan distribusinya. Ia mengurangi bias urutan, bukan bias sejarah — bahan bakunya tetap masa lalu. Mengubah komposisi indeks dilakukan di Index Saham; halaman ini hanya menilainya.']));
    resultWrap.appendChild(note);
  }

  function renderError(msg) {
    resultWrap.innerHTML = '';
    const box = createEl('div', {
      class: 'card',
      style: { borderLeft: '3px solid var(--c-danger)', fontSize: 'var(--text-sm)' },
    });
    box.innerHTML = `<b>Simulasi tidak dapat dijalankan.</b> ${msg}`;
    resultWrap.appendChild(box);
  }

  async function run() {
    if (state.running) return;
    if (!state.indexId) {
      toast('Pilih indeks dulu', { type: 'error' });
      return;
    }
    const capRaw = String(capInput.value || '').trim();
    const capital = capRaw === '' ? null : Number(capRaw);
    if (capital !== null && !(capital > 0)) {
      toast('Modal harus lebih dari 0', { type: 'error' });
      return;
    }
    state.running = true;
    runBtn.textContent = 'Menghitung…';
    runBtn.disabled = true;
    try {
      if (state.method === 'fundamental') {
        state.result = await Api.post(`/index-saham/${state.indexId}/monte-carlo-fundamental`, {
          horizon_days: state.horizon,
          window: state.window,
          n_sims: state.nSims,
          capital,
        });
      } else {
        state.result = await Api.post(`/index-saham/${state.indexId}/monte-carlo`, {
          horizon_days: state.horizon,
          window: state.window,
          n_sims: state.nSims,
          capital,
          mode: state.mode,
        });
      }
      renderResult();
      if (state.method === 'level') loadLedger();
    } catch (e) {
      state.result = null;
      renderError(e.message || String(e));
    }
    state.running = false;
    runBtn.textContent = 'Jalankan Simulasi';
    runBtn.disabled = false;
  }
  runBtn.addEventListener('click', run);

  function evalRows(ev) {
    return [['Peluang berakhir positif', fmtProb(ev.p_end_positive)],
      ['Return p25', fmtPct(ev.end_ret.p25)],
      ['Return median', fmtPct(ev.end_ret.p50)],
      ['Return p5', fmtPct(ev.end_ret.p5)],
      ['Peluang drawdown >20%', fmtProb(ev.p_dd_gt_20)],
      ['Drawdown median', fmtPct(-Math.abs(ev.dd_median))]];
  }


  // ── Buku besar: daftar, detail, kalibrasi ──
  const idxName = (id) => {
    const hit = state.indices.find((i) => String(i.id) === String(id));
    return hit ? `${hit.name} (${hit.code})` : `Indeks #${id}`;
  };

  async function loadPit() {
    try {
      const pit = await Api.get('/index-saham/monte-carlo-runs/pit');
      pitWrap.innerHTML = '';
      if (!pit || !pit.n) {
        pitWrap.appendChild(createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-3)' } },
          ['Kalibrasi lintas larian: belum ada penilaian jatuh tempo.']));
        return;
      }
      const mx = Math.max(...pit.bins, 1);
      const bars = createEl('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '3px', height: '44px' } });
      pit.bins.forEach((n, i) => {
        const b = createEl('div', {
          title: `Persentil ${i * 10}–${i * 10 + 10}: ${n} penilaian`,
          style: {
            flex: '1', height: `${Math.max(6, (n / mx) * 100)}%`,
            background: (i === 0 || i === 9) ? 'var(--c-danger)' : 'var(--c-primary)',
            opacity: '0.75', borderRadius: '2px 2px 0 0',
          },
        });
        bars.appendChild(b);
      });
      pitWrap.appendChild(createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', marginBottom: 'var(--s-1)' } },
        [`Kalibrasi lintas larian — ${pit.n} penilaian jatuh tempo. Sebaran rata = simulator terkalibrasi; menumpuk di tepi (terutama tepi bawah) = bias.`]));
      pitWrap.appendChild(bars);
    } catch (e) { /* diamkan: seksi lain tetap jalan */ }
  }

  async function loadLedger() {
    try {
      const r = await Api.get('/index-saham/monte-carlo-runs', { limit: 30 });
      const runs = (r && r.runs) || [];
      ledgerListWrap.innerHTML = '';
      if (!runs.length) {
        ledgerListWrap.appendChild(createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-3)' } },
          ['Belum ada simulasi tersimpan. Jalankan simulasi Level di atas — ia tersimpan otomatis.']));
        loadPit();
        return;
      }
      const tbl = createEl('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' } });
      tbl.innerHTML = `<thead><tr style="text-align:left;color:var(--c-text-3);">
        <th style="padding:4px 6px;">Simulasi</th><th style="padding:4px 6px;">Indeks</th>
        <th style="padding:4px 6px;">Mesin</th><th style="padding:4px 6px;">Horizon</th>
        <th style="padding:4px 6px;">Median akhir</th><th style="padding:4px 6px;">Penilaian terakhir</th></tr></thead>`;
      const tb = createEl('tbody', {});
      runs.forEach((run) => {
        const tr = createEl('tr', { style: { borderTop: '1px solid var(--c-border)', cursor: 'pointer' } });
        const ev = run.last_evaluation;
        const evTxt = !ev ? 'belum jatuh tempo'
          : `P${Math.round(ev.percentile_rank * 100)} · ${ev.in_band ? 'di dalam pita' : 'DI LUAR PITA'} (hr ${ev.h_days})`;
        const modeTxt = run.engine === 'mc2'
          ? `Rezim (${MODE_LABEL[run.params?.mode] || run.params?.mode || '-'})` : 'Level';
        tr.innerHTML = `
          <td style="padding:5px 6px;">${run.pinned ? '📌 ' : ''}${run.name ? run.name : fmtDate((run.created_at || '').slice(0, 10))}</td>
          <td style="padding:5px 6px;">${idxName(run.index_id)}</td>
          <td style="padding:5px 6px;">${modeTxt}</td>
          <td style="padding:5px 6px;">${run.params?.horizon_days ?? '-'} hr</td>
          <td style="padding:5px 6px;">${fmtPct(run.summary?.end_ret?.p50)}</td>
          <td style="padding:5px 6px;">${evTxt}</td>`;
        tr.addEventListener('click', () => openLedgerDetail(run.id));
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      ledgerListWrap.appendChild(tbl);
    } catch (e) {
      ledgerListWrap.innerHTML = '';
      ledgerListWrap.appendChild(createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-danger)' } },
        [`Gagal memuat riwayat: ${e.message || e}`]));
    }
    loadPit();
  }

  async function openLedgerDetail(runId) {
    ledgerDetailWrap.innerHTML = '';
    const loading = createEl('div', { class: 'card', style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } }, ['Memuat detail larian…']);
    ledgerDetailWrap.appendChild(loading);
    let d = null;
    try {
      d = await Api.get(`/index-saham/monte-carlo-runs/${runId}`);
    } catch (e) {
      loading.textContent = `Gagal memuat detail: ${e.message || e}`;
      return;
    }
    ledgerDetailWrap.innerHTML = '';
    const card = createEl('div', { class: 'card' });
    const title = d.name || `Simulasi ${fmtDate((d.created_at || '').slice(0, 10))}`;
    card.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, [`${d.pinned ? '📌 ' : ''}${title} — ${idxName(d.index_id)}`]));
    const fp = d.fingerprint || {};
    card.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-2)' } },
      [`Mesin ${d.engine === 'mc2' ? 'MC-2 (rezim)' : 'MC-1 (level)'} v${d.engine_version} · data s.d. ${fmtDate(d.as_of_date)} · horizon ${d.params?.horizon_days ?? '-'} hari · ${d.params?.n_sims ?? '-'} simulasi · jendela ${WIN_LABEL[d.params?.window] || d.params?.window || '-'} · anggota saat simulasi: ${(d.members_snapshot || []).length} emiten.`]));
    card.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-3)', margin: '0 0 var(--s-3)' } },
      [`Sidik jari data: pasar s.d. ${fp.market_max || '-'} · fundamental s.d. ${fp.fundamentals_max || '-'} · rasio ${fp.ratios_count ?? '-'} baris · KSEI ${fp.ksei_latest || '-'}.${d.members_changed ? ' PERHATIAN: anggota indeks berubah sejak simulasi — penilaian memakai seri indeks terkini apa adanya.' : ''}`]));
    const fan = (d.summary && d.summary.fan) || [];
    if (fan.length) {
      const pts = (d.evaluations || []).map((e) => ({ h: e.h_days, v: e.realized_ret }));
      const fc = createEl('div', {});
      fc.innerHTML = fanSvgRealized(fan, d.params?.horizon_days || 63, pts);
      card.appendChild(fc);
      card.appendChild(createEl('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginBottom: 'var(--s-3)' } },
        ['Garis oranye = realisasi pada titik periksa bulanan; pita = sebaran jalur tersimpan.']));
    }
    if ((d.evaluations || []).length) {
      const et = createEl('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)', marginBottom: 'var(--s-3)' } });
      et.innerHTML = `<thead><tr style="text-align:left;color:var(--c-text-3);">
        <th style="padding:4px 6px;">Titik</th><th style="padding:4px 6px;">Jatuh tempo</th>
        <th style="padding:4px 6px;">Realisasi</th><th style="padding:4px 6px;">Persentil</th>
        <th style="padding:4px 6px;">Status</th></tr></thead>`;
      const tb = createEl('tbody', {});
      d.evaluations.forEach((e) => {
        const tr = createEl('tr', { style: { borderTop: '1px solid var(--c-border)' } });
        tr.innerHTML = `
          <td style="padding:5px 6px;">hr ${e.h_days}</td>
          <td style="padding:5px 6px;">${fmtDate(e.due_date)}</td>
          <td style="padding:5px 6px;">${fmtPct(e.realized_ret)}</td>
          <td style="padding:5px 6px;">P${Math.round(e.percentile_rank * 100)}</td>
          <td style="padding:5px 6px;">${e.in_band ? 'Di dalam pita' : '<b>Di luar pita</b>'}</td>`;
        tb.appendChild(tr);
      });
      et.appendChild(tb);
      card.appendChild(et);
    } else {
      card.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-3)', margin: '0 0 var(--s-3)' } },
        ['Belum ada titik periksa yang jatuh tempo — penilaian pertama pada hari perdagangan ke-21 sesudah tanggal simulasi.']));
    }
    const acts = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' } });
    const pinBtn = createEl('button', { class: 'btn btn--secondary btn--sm' }, [d.pinned ? 'Lepas pin' : 'Pin']);
    pinBtn.addEventListener('click', async () => {
      try {
        await Api.patch(`/index-saham/monte-carlo-runs/${runId}`, { pinned: !d.pinned });
        loadLedger(); openLedgerDetail(runId);
      } catch (e) { toast(e.message || String(e), { type: 'error' }); }
    });
    const nameBtn = createEl('button', { class: 'btn btn--secondary btn--sm' }, ['Beri nama']);
    nameBtn.addEventListener('click', async () => {
      const nm = window.prompt('Nama larian:', d.name || '');
      if (nm == null) return;
      try {
        await Api.patch(`/index-saham/monte-carlo-runs/${runId}`, { name: nm });
        loadLedger(); openLedgerDetail(runId);
      } catch (e) { toast(e.message || String(e), { type: 'error' }); }
    });
    const delBtn = createEl('button', { class: 'btn btn--secondary btn--sm' }, ['Hapus']);
    delBtn.addEventListener('click', async () => {
      if (!window.confirm('Hapus larian simulasi ini permanen?')) return;
      try {
        await Api.delete(`/index-saham/monte-carlo-runs/${runId}`);
        ledgerDetailWrap.innerHTML = '';
        loadLedger();
      } catch (e) { toast(e.message || String(e), { type: 'error' }); }
    });
    acts.appendChild(pinBtn); acts.appendChild(nameBtn); acts.appendChild(delBtn);
    card.appendChild(acts);
    ledgerDetailWrap.appendChild(card);
  }

  // ── Muat daftar indeks + pramuat pilihan dari detail indeks ──
  (async () => {
    try {
      state.indices = (await Api.get('/index-saham')) || [];
    } catch (e) {
      state.indices = [];
      toast('Gagal memuat daftar indeks: ' + (e.message || e), { type: 'error' });
    }
    idxSel.innerHTML = '';
    if (!state.indices.length) {
      idxSel.appendChild(createEl('option', { value: '' }, ['— belum ada indeks —']));
      runBtn.disabled = true;
      return;
    }
    state.indices.forEach((i) => {
      idxSel.appendChild(createEl('option', { value: String(i.id) }, [`${i.name} (${i.code})`]));
    });
    let initial = '';
    try {
      initial = localStorage.getItem('mc_initial_index') || '';
      if (initial) localStorage.removeItem('mc_initial_index');
    } catch (e) { /* abaikan */ }
    const hit = state.indices.find((i) => String(i.id) === String(initial));
    state.indexId = hit ? String(hit.id) : String(state.indices[0].id);
    idxSel.value = state.indexId;
    loadLedger();
  })();

  return container;
}
