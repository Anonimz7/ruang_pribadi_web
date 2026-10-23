/* pages/monte-carlo.js — Monte Carlo (MC-1): penilai probabilistik
 * Index Saham. Menu sendiri (keputusan user 2026-10-23); Index Saham
 * tetap pemilik komposisi — halaman ini hanya membaca & menilai.
 * MC-4: penyusun komposisi kelas modal + juri walk-forward
 * (POST /index-saham/monte-carlo-compose) di kartu bawah.
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

  // ── Penyusun Komposisi (MC-4) ──
  const compCard = createEl('div', { class: 'card', style: { marginTop: 'var(--s-3)' } });
  compCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Penyusun Komposisi (MC-4)']));
  compCard.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-3)' } },
    ['Masukkan modal — kelas Proposal B diturunkan darinya dan ditegakkan sebagai kendala keras (jumlah anggota kelas, posisi minimum 2× LOT*, cap sektor). Penyusun serakah mengisi susunan sampai ukuran kelas dengan tambahan terbaik menurut return p25 simulasi (horizon 1 kuartal, syarat peluang drawdown >20% ≤ 10%), memolesnya dengan tukar, lalu merealisasikannya ke lot bulat. Fitur hanya tampil bila lulus juri walk-forward di bawah.']));
  const cgrid = createEl('div', { style: { display: 'flex', gap: 'var(--s-4)', flexWrap: 'wrap', alignItems: 'flex-end' } });
  const compCapInput = createEl('input', {
    class: 'field__input', type: 'number', min: '1000000', step: '500000',
    placeholder: 'cth. 25000000', style: { width: '180px' },
  });
  const compIdxSel = createEl('select', { class: 'field__select', style: { minWidth: '220px' } });
  const compBtn = createEl('button', { class: 'btn btn--primary' }, ['Susun Komposisi']);
  cgrid.appendChild(field('MODAL (WAJIB, RP)', compCapInput));
  cgrid.appendChild(field('BANDINGKAN DENGAN', compIdxSel));
  cgrid.appendChild(compBtn);
  compCard.appendChild(cgrid);
  container.appendChild(compCard);
  const compWrap = createEl('div', { style: { marginTop: 'var(--s-3)' } });
  container.appendChild(compWrap);

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
      statCard('PELUANG BERAKHIR POSITIF', fmtProb(r.p_end_positive), r.p_end_positive >= 0.5 ? 'var(--c-accent)' : 'var(--c-danger)'),
      statCard('RETURN MEDIAN (p50)', fmtPct(r.end_ret.p50), r.end_ret.p50 >= 0 ? 'var(--c-accent)' : 'var(--c-danger)'),
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
          ? `⚠ ${cp.warning} — berdasarkan ${cp.basis} (${cp.n_members} anggota). Peringatan lunak; pagar keras adalah urusan penyusun (MC-4).`
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
      statCard('PELUANG BERAKHIR POSITIF', fmtProb(r.p_end_positive), r.p_end_positive >= 0.5 ? 'var(--c-accent)' : 'var(--c-danger)'),
      statCard('RETURN MEDIAN (p50)', fmtPct(r.end_ret.p50), r.end_ret.p50 >= 0 ? 'var(--c-accent)' : 'var(--c-danger)'),
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
      }, ['Dihitung dari bobot kontinu sebelum pembulatan lot — menilai keranjangnya, bukan janji eksekusi. Realisasi lot, sisa kas, dan penegakan batas kelas adalah lapis MC-4.']));
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

  function renderCompose(r) {
    compWrap.innerHTML = '';
    const wf = r.walk_forward || {};
    const passed = !!wf.passed;
    const wc = createEl('div', {
      class: 'card',
      style: { borderLeft: `3px solid ${passed ? 'var(--c-accent)' : 'var(--c-danger)'}`, marginBottom: 'var(--s-3)' },
    });
    wc.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } },
      [`Juri Walk-Forward — ${passed ? 'LULUS' : 'MENAHAN PENYUSUN'}`]));
    wc.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-3)' } },
      [`Penyusun dijalankan ulang pada ${wf.folds ? wf.folds.length : 0} tanggal potong kuartalan 2023–2025 hanya dengan data sebelum potong (modal acuan ${fmtRp(wf.capital_ref)}); realisasi 63 hari berikutnya diperiksa terhadap pita p5–p95 simulasinya. Cakupan: <b>${fmtProb(wf.coverage)}</b> dari ${wf.composed_folds} lipatan tersusun — ambang ${fmtProb(wf.threshold)}.`]));
    const ft = createEl('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' } });
    ft.innerHTML = `<thead><tr style="border-bottom:1px solid var(--c-border);color:var(--c-text-3);font-size:var(--text-xs);">
      <th style="text-align:left;padding:6px 8px;">POTONG</th><th style="text-align:left;padding:6px 8px;">DATA S.D.</th>
      <th style="text-align:right;padding:6px 8px;">ANGGOTA</th><th style="text-align:right;padding:6px 8px;">REALISASI</th>
      <th style="text-align:right;padding:6px 8px;">PITA p5–p95</th><th style="text-align:left;padding:6px 8px;">HASIL</th></tr></thead>
      <tbody>${(wf.folds || []).map((f) => `<tr style="border-bottom:1px solid var(--c-border);">
        <td style="padding:6px 8px;">${f.cutoff}</td>
        <td style="padding:6px 8px;">${f.as_of ? fmtDate(f.as_of) : '-'}</td>
        <td style="padding:6px 8px;text-align:right;">${f.composed ? f.n_members : '-'}</td>
        <td style="padding:6px 8px;text-align:right;">${f.composed ? fmtPct(f.realized) : '-'}</td>
        <td style="padding:6px 8px;text-align:right;">${f.composed ? fmtPct(f.p5) + ' s.d. ' + fmtPct(f.p95) : '-'}</td>
        <td style="padding:6px 8px;">${f.composed ? (f.covered ? 'Di dalam pita' : '<b>Di luar pita</b>') : (f.error ? 'Gagal: ' + f.error : 'Tak tersusun')}</td></tr>`).join('')}</tbody>`;
    wc.appendChild(ft);
    compWrap.appendChild(wc);
    if (r.withheld) {
      const rb = createEl('div', { class: 'card', style: { borderLeft: '3px solid var(--c-danger)', fontSize: 'var(--text-sm)' } });
      rb.innerHTML = `<b>Penyusun ditahan.</b> ${r.reason || ''}`;
      compWrap.appendChild(rb);
      return;
    }
    const c = r.composition;
    const strip = createEl('div', {
      class: 'card',
      style: { borderLeft: '3px solid var(--c-warning, #f0a840)', marginBottom: 'var(--s-3)', fontSize: 'var(--text-sm)' },
    });
    strip.innerHTML = `<b>Kelas ${c.class}</b> (rentang anggota ${c.class_range[0]}–${c.class_range[1]}) · modal ${fmtRp(r.capital)} · ` +
      `LOT* ${fmtRp(r.lot_star)} (median 1 lot dari ${r.universe_size} emiten likuid teratas) · ` +
      `${r.candidates} kandidat lolos saringan kualitas + Skor Smart · data s.d. ${fmtDate(r.as_of)} · ` +
      `terinvestasi ${fmtRp(c.invested)} · <b>sisa kas ${fmtRp(c.cash)} (${fmtProb(c.cash_pct)})</b>.` +
      (c.below_class_min ? `<br><b>Catatan:</b> jumlah anggota akhir ${c.members.length} di bawah minimum kelas ${c.class_range[0]} — kendala posisi minimum 2× LOT* / kolam kandidat yang mengikat; dilaporkan apa adanya.` : '') +
      (c.dd_relaxed ? `<br><b>Catatan:</b> pada sebagian langkah pengisian tidak ada kandidat yang memenuhi syarat drawdown, sehingga dipilih kandidat berpeluang drawdown terkecil (pelonggaran tercatat, bukan disembunyikan).` : '');
    compWrap.appendChild(strip);

    const cmp = createEl('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 'var(--s-3)', marginBottom: 'var(--s-3)' },
    });
    const mkEvCard = (title, ev) => {
      const card = createEl('div', { class: 'card', style: { marginBottom: '0' } });
      card.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, [title]));
      const tb = createEl('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' } });
      tb.innerHTML = evalRows(ev).map(([k, v]) => `<tr style="border-bottom:1px solid var(--c-border);">
        <td style="padding:5px 8px;color:var(--c-text-2);">${k}</td>
        <td style="padding:5px 8px;text-align:right;font-weight:600;">${v}</td></tr>`).join('');
      card.appendChild(tb);
      return card;
    };
    cmp.appendChild(mkEvCard(`Susunan Usulan — evaluasi MC (1 kuartal)`, c.evaluation));
    const b = r.benchmark || {};
    const bTitle = b.kind === 'index'
      ? `Pembanding — indeks terpilih (evaluasi MC)`
      : `Pembanding — semesta likuid sama rata (${b.n_members} emiten)`;
    cmp.appendChild(mkEvCard(bTitle, b.evaluation));
    compWrap.appendChild(cmp);

    const mc = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
    mc.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, [`Komposisi Terealisasi — ${c.members.length} anggota`]));
    const tbl = createEl('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' } });
    tbl.innerHTML = `<thead><tr style="border-bottom:1px solid var(--c-border);color:var(--c-text-3);font-size:var(--text-xs);">
      <th style="text-align:left;padding:6px 8px;">EMITEN</th><th style="text-align:left;padding:6px 8px;">SEKTOR / SUB</th>
      <th style="text-align:right;padding:6px 8px;">SKOR SMART</th><th style="text-align:right;padding:6px 8px;">HARGA</th>
      <th style="text-align:right;padding:6px 8px;">LOT</th><th style="text-align:right;padding:6px 8px;">NILAI</th>
      <th style="text-align:right;padding:6px 8px;">TARGET</th><th style="text-align:right;padding:6px 8px;">TEREALISASI</th></tr></thead>
      <tbody>${c.members.map((m) => `<tr style="border-bottom:1px solid var(--c-border);">
        <td style="padding:6px 8px;font-weight:600;">${m.ticker}</td>
        <td style="padding:6px 8px;">${m.sector || '-'} / ${m.sub_sector || '-'}</td>
        <td style="padding:6px 8px;text-align:right;">${m.smart != null ? Number(m.smart).toFixed(0) : '-'}</td>
        <td style="padding:6px 8px;text-align:right;">${fmtRp(m.price)}</td>
        <td style="padding:6px 8px;text-align:right;">${Number(m.lots).toLocaleString('id-ID')}</td>
        <td style="padding:6px 8px;text-align:right;">${fmtRp(m.value)}</td>
        <td style="padding:6px 8px;text-align:right;">${(m.target_weight * 100).toFixed(1).replace('.', ',')}%</td>
        <td style="padding:6px 8px;text-align:right;">${(m.realized_weight * 100).toFixed(2).replace('.', ',')}%</td></tr>`).join('')}</tbody>`;
    mc.appendChild(tbl);
    const topSec = Object.entries(c.realized_sector_shares || {}).sort((a, b2) => b2[1] - a[1])[0];
    mc.appendChild(createEl('p', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-2)' } },
      [`Pangsa sektor terealisasi terbesar: ${topSec ? topSec[0] + ' ' + fmtProb(topSec[1]) + ' dari terinvestasi' : '-'}. Cap 40% Sektor / 25% Sub_Sektor ditegakkan sebagai batas hitungan anggota saat konstruksi (dibulatkan ke atas ke anggota utuh); distorsi lot pada pangsa nilai ditampilkan apa adanya, tidak diamputasi.`]));
    compWrap.appendChild(mc);

    const saveCard = createEl('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: 'var(--s-3)', flexWrap: 'wrap' } });
    saveCard.appendChild(createEl('div', { style: { flex: '1', minWidth: '220px', fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } },
      ['Simpan susunan ini sebagai Index Saham (pembobotan custom menurut bobot terealisasi) untuk dipantau & dinilai berkala. Membuat indeks adalah kewenangan admin.']));
    const saveBtn = createEl('button', { class: 'btn btn--secondary' }, ['Simpan sebagai Indeks']);
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Menyimpan…';
      try {
        const name = `MC-4 ${c.class} ${r.as_of}`;
        const created = await Api.post('/index-saham', {
          name, weighting_mode: 'custom', base_value: 100, min_coverage: 60,
          description: `Susunan MC-4 kelas ${c.class} dari modal ${fmtRp(r.capital)} per ${r.as_of}; LOT* ${fmtRp(r.lot_star)}; sisa kas ${fmtRp(c.cash)}.`,
        });
        const newId = created && created.index && created.index.id;
        if (!newId) throw new Error('Respons pembuatan indeks tidak memuat id');
        const tot = c.members.reduce((a, m) => a + m.realized_weight, 0) || 1;
        const weightMap = {};
        let acc = 0;
        c.members.forEach((m, i) => {
          let pct = i === c.members.length - 1
            ? Math.round((100 - acc) * 100) / 100
            : Math.round((m.realized_weight / tot) * 10000) / 100;
          acc += pct;
          weightMap[m.ticker] = pct;
        });
        await Api.put(`/index-saham/${newId}/members`, {
          tickers: c.members.map((m) => m.ticker), weight_map: weightMap,
        });
        toast(`Indeks "${name}" tersimpan dengan ${c.members.length} anggota.`, { type: 'success', duration: 5000 });
        saveBtn.textContent = 'Tersimpan ✓';
      } catch (e) {
        toast('Gagal menyimpan indeks: ' + (e.message || e), { type: 'error' });
        saveBtn.disabled = false;
        saveBtn.textContent = 'Simpan sebagai Indeks';
      }
    });
    saveCard.appendChild(saveBtn);
    compWrap.appendChild(saveCard);
  }

  let compPolls = 0;
  async function runCompose(auto = false) {
    const capital = Number(compCapInput.value || 0);
    if (!(capital >= 1000000)) {
      toast('Modal wajib diisi, minimum Rp 1.000.000 (kelas B1)', { type: 'error' });
      return;
    }
    if (!auto) compPolls = 0;
    compBtn.disabled = true;
    compBtn.textContent = compPolls
      ? `Menunggu putusan walk-forward… (pemeriksaan ${compPolls})`
      : 'Menyusun…';
    try {
      const body = { capital };
      if (compIdxSel.value) body.compare_index_id = Number(compIdxSel.value);
      const r = await Api.post('/index-saham/monte-carlo-compose', body);
      if (r.wf_status === 'computing') {
        compWrap.innerHTML = '';
        const box = createEl('div', { class: 'card', style: { borderLeft: '3px solid var(--c-warning, #f0a840)', fontSize: 'var(--text-sm)' } });
        box.innerHTML = `<b>Putusan walk-forward sedang dihitung.</b> ${r.message || ''}`;
        compWrap.appendChild(box);
        compPolls += 1;
        if (compPolls <= 12) {
          setTimeout(() => runCompose(true), 20000);
          return;
        }
        compBtn.disabled = false;
        compBtn.textContent = 'Susun Komposisi';
        return;
      }
      if (r.wf_status === 'error') {
        compWrap.innerHTML = '';
        const box = createEl('div', { class: 'card', style: { borderLeft: '3px solid var(--c-danger)', fontSize: 'var(--text-sm)' } });
        box.innerHTML = `<b>Walk-forward gagal.</b> ${r.message || ''}`;
        compWrap.appendChild(box);
        compBtn.disabled = false;
        compBtn.textContent = 'Susun Komposisi';
        return;
      }
      renderCompose(r);
    } catch (e) {
      compWrap.innerHTML = '';
      const box = createEl('div', { class: 'card', style: { borderLeft: '3px solid var(--c-danger)', fontSize: 'var(--text-sm)' } });
      box.innerHTML = `<b>Penyusunan tidak dapat dijalankan.</b> ${e.message || e}`;
      compWrap.appendChild(box);
    }
    compBtn.disabled = false;
    compBtn.textContent = 'Susun Komposisi';
  }
  compBtn.addEventListener('click', () => runCompose(false));

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
    compIdxSel.innerHTML = '';
    compIdxSel.appendChild(createEl('option', { value: '' }, ['Semesta likuid (sama rata)']));
    state.indices.forEach((i) => {
      compIdxSel.appendChild(createEl('option', { value: String(i.id) }, [`Indeks: ${i.name} (${i.code})`]));
    });
    let initial = '';
    try {
      initial = localStorage.getItem('mc_initial_index') || '';
      if (initial) localStorage.removeItem('mc_initial_index');
    } catch (e) { /* abaikan */ }
    const hit = state.indices.find((i) => String(i.id) === String(initial));
    state.indexId = hit ? String(hit.id) : String(state.indices[0].id);
    idxSel.value = state.indexId;
  })();

  return container;
}
