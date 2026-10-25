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

const HORIZONS = [[21, '1 mo'], [63, '3 mo'], [126, '6 mo'], [252, '1 yr']];
const WINDOWS = [['1y', '1 yr'], ['2y', '2 yr'], ['3y', '3 yr'], ['5y', '5 yr'], ['all', 'All']];
const NSIMS = [[2000, '2,000'], [5000, '5,000'], [10000, '10,000']];
const METHODS = [['level', 'Level (price)'], ['fundamental', 'Fundamental (earnings × multiple)']];
const MODES = [['semua', 'All blocks'], ['rezim', 'Current flow regime'], ['tekanan', 'Stress scenario'], ['ksei', 'KSEI ownership trend']];
const STATE_LABEL = { masuk: 'Inflow', netral: 'Neutral', keluar: 'Outflow' };
const KSEI_LABEL = { atas: 'High', tengah: 'Middle', bawah: 'Low' };
const MODE_LABEL = { semua: 'All blocks', rezim: 'Current flow regime', tekanan: 'Stress scenario', ksei: 'KSEI ownership trend' };
const WIN_LABEL = { '1y': 'Last 1 year', '2y': 'Last 2 years', '3y': 'Last 3 years', '5y': 'Last 5 years', all: 'full series' };

function fmtPct(v) {
  if (v == null || isNaN(v)) return '-';
  const n = Number(v) * 100;
  return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
}
function fmtProb(v) {
  if (v == null || isNaN(v)) return '-';
  return (Number(v) * 100).toFixed(1) + '%';
}
function fmtRp(v) {
  if (v == null || isNaN(v)) return '-';
  return 'Rp ' + Math.round(Number(v)).toLocaleString('en-US');
}
function fmtDate(s) {
  if (!s) return '-';
  const d = new Date(s + 'T00:00:00');
  return isNaN(d) ? s : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
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
      xl += `<text x="${X(f.h)}" y="${H - 6}" fill="var(--c-text-3)" font-size="11" text-anchor="middle">${f.h} d</text>`;
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
      xl += `<text x="${X(f.h)}" y="${H - 6}" fill="var(--c-text-3)" font-size="11" text-anchor="middle">${f.h} d</text>`;
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
    xl += `<text x="${X(f.q)}" y="${H - 6}" fill="var(--c-text-3)" font-size="11" text-anchor="middle">Q${f.q}</text>`;
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
    ['Probabilistic appraisal of an index basket: outcome spread, chance of a positive result, and drawdown risk (fall from peak) — not a direction forecast.']));
  head.appendChild(hinfo);
  const toIdx = createEl('button', { class: 'btn btn--secondary btn--sm' });
  toIdx.innerHTML = `${icons['layers']} Open Stock Indexes`;
  toIdx.addEventListener('click', () => navigate('/saham/index'));
  head.appendChild(toIdx);
  container.appendChild(head);

  // ── Pengaturan ──
  const ctl = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  ctl.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-3)' } }, ['Simulation Settings']));
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
  const modeField = field('FLOW REGIME MODE', makeSeg(MODES, state.mode, (v) => { state.mode = v; }));
  modeField.appendChild(createEl('p', {
    style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-1)' },
  }, ['Regime = the index foreign-flow window state (inflow / neutral / outflow). Current regime uses only blocks from the current state; stress uses only outflow blocks, as if outflow continued. KSEI lens: months are grouped by aggregate foreign-ownership tertile; only blocks from months in the same tertile as the latest snapshot are used.']));
  const methodNote = createEl('p', {
    style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-3)' },
  }, ['Method: 20-day block bootstrap over log returns of the index level (stale (no-trade) days skipped). Fixed seed — same input gives the same result. Regime mode conditions blocks on the index foreign-flow state (window state: inflow / neutral / outflow). Results always read together with their source window: output inherits the regime of that window.']);
  const methodField = field('METHOD', makeSeg(METHODS, state.method, (v) => {
    state.method = v;
    modeField.style.display = v === 'fundamental' ? 'none' : '';
    methodNote.textContent = v === 'fundamental'
      ? 'Method: fundamental attribution — earnings × multiple + dividends per quarter (constituents not eligible for attribution are valued on their fallback price path). Fixed seed — same input gives the same result. The window parameter only governs the fallback path; profit & PER history pools use the full history. No drawdown (fall from peak) statistics — quarterly points too coarse.'
      : 'Method: 20-day block bootstrap over log returns of the index level (stale (no-trade) days skipped). Fixed seed — same input gives the same result. Regime mode conditions blocks on the index foreign-flow state (window state: inflow / neutral / outflow). Results always read together with their source window: output inherits the regime of that window.';
  }));
  grid.appendChild(methodField);
  grid.appendChild(field('INDEX', idxSel));
  grid.appendChild(field('HORIZON', makeSeg(HORIZONS, state.horizon, (v) => { state.horizon = v; })));
  grid.appendChild(field('RETURN SOURCE WINDOW', makeSeg(WINDOWS, state.window, (v) => { state.window = v; })));
  grid.appendChild(field('NUMBER OF SIMULATIONS', makeSeg(NSIMS, state.nSims, (v) => { state.nSims = v; })));
  grid.appendChild(modeField);
  const capInput = createEl('input', {
    class: 'field__input', type: 'number', min: '0', step: '100000',
    placeholder: 'e.g. 25000000', style: { width: '170px' },
  });
  grid.appendChild(field('CAPITAL (OPTIONAL, RP)', capInput));
  const runBtn = createEl('button', { class: 'btn btn--primary' }, ['Run Simulation']);
  grid.appendChild(runBtn);
  ctl.appendChild(grid);
  ctl.appendChild(methodNote);
  container.appendChild(ctl);

  const resultWrap = createEl('div', {});
  container.appendChild(resultWrap);


  // ── Riwayat Simulasi (rujukan; tanpa penilaian/kalibrasi) ──
  const ledgerCard = createEl('div', { class: 'card', style: { marginTop: 'var(--s-3)' } });
  ledgerCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Simulation History']));
  ledgerCard.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-3)' } },
    ['Every simulation — Level (MC-1/MC-2) and Fundamental (MC-3) — is saved automatically — complete with parameters, results, fan, constituent snapshot & its data fingerprint — so it need not be repeated and can be reopened as reference material. This history only records; it does not judge and does not decide.']));
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
    strip.innerHTML = `<b>Fundamental method:</b> horizon ${r.horizon_days} days rounded to <b>${r.quarters} quarters</b> of simulation · ` +
      `${Number(r.n_sims).toLocaleString('en-US')} simulations · weight covered by earnings × multiple attribution: <b>${(mt.covered_weight * 100).toFixed(1)}%</b> ` +
      `(${mt.n_covered} of ${mt.n_members} constituents; ${mt.n_fallback} constituents valued on fallback price paths). ` +
      `The window parameter only governs the fallback path; profit & PER history pools use the full history. No drawdown statistics — quarterly points too coarse.`;
    resultWrap.appendChild(strip);

    const fanCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
    fanCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } },
      [`Outcome fan chart — ${idx ? idx.name : 'Index'} (cumulative return per quarter)`]));
    const svgWrap = createEl('div', {});
    svgWrap.innerHTML = fanSvgQ(r.fan, r.quarters);
    fanCard.appendChild(svgWrap);
    fanCard.appendChild(createEl('div', {
      style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-2)' },
    }, ['Outer band = 90% of paths · inner band = middle 50% of paths · middle line = median · Q = quarter.']));
    resultWrap.appendChild(fanCard);

    const stats = createEl('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--s-3)', marginBottom: 'var(--s-3)' },
    });
    stats.append(
      statCard('CHANCE OF ENDING POSITIVE', fmtProb(r.p_end_positive)),
      statCard('MEDIAN RETURN (middle outcome)', fmtPct(r.end_ret.p50)),
      statCard('WORST 5% RETURN (5th percentile)', fmtPct(r.end_ret.p5), 'var(--c-danger)'),
      statCard('BEST 5% RETURN (95th percentile)', fmtPct(r.end_ret.p95), 'var(--c-accent)'),
    );
    resultWrap.appendChild(stats);

    const at = r.attribution || {};
    const ac = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
    ac.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Return attribution — what drives the median outcome']));
    const arows = [
      ['Earnings growth', at.earnings], ['Multiple change (PER)', at.multiple],
      ['Earnings × multiple interaction', at.interaction], ['Dividends (cash)', at.dividend],
      ['Fallback price path', at.fallback],
    ];
    const ap = createEl('p', { style: { fontSize: 'var(--text-sm)', margin: '0' } });
    ap.innerHTML = arows.map(([k, v]) => `${k}: <b>${fmtPct(v || 0)}</b>`).join(' · ');
    ac.appendChild(ap);
    ac.appendChild(createEl('p', {
      style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-2)' },
    }, ['In each simulation, the five components sum exactly to its total return. What is shown is the median of each component, so the five medians need not sum exactly to the median return.']));
    resultWrap.appendChild(ac);

    if (r.capital) {
      const cc = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
      cc.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Final Value in Rupiah']));
      const ev = r.capital.end_value;
      cc.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', marginBottom: 'var(--s-3)' } },
        [`Capital ${fmtRp(r.capital.amount)} → capital class ${r.capital.class} (Proposal B). Final value at the ${r.quarters}-quarter horizon:`]));
      const cg = createEl('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--s-3)' },
      });
      cg.append(
        statCard('WORST 5% (5th percentile)', fmtRp(ev.p5)),
        statCard('MEDIAN (middle outcome)', fmtRp(ev.p50)),
        statCard('BEST 5% (95th percentile)', fmtRp(ev.p95)),
        statCard('CHANCE OF ENDING BELOW CAPITAL', fmtProb(r.capital.p_end_below_capital)),
      );
      cc.appendChild(cg);
      resultWrap.appendChild(cc);
    }

    const mc = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
    mc.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Data per Constituent']));
    const tbl = createEl('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' } });
    tbl.innerHTML = `<thead><tr style="border-bottom:1px solid var(--c-border);color:var(--c-text-3);font-size:var(--text-xs);">
      <th style="text-align:left;padding:6px 8px;">ISSUER</th><th style="text-align:left;padding:6px 8px;">SECTOR</th>
      <th style="text-align:right;padding:6px 8px;">WEIGHT</th><th style="text-align:left;padding:6px 8px;">STATUS</th>
      <th style="text-align:right;padding:6px 8px;">CURRENT / MEDIAN PER</th><th style="text-align:right;padding:6px 8px;">DIV YIELD</th></tr></thead>
      <tbody>${(r.members || []).map((m) => `<tr style="border-bottom:1px solid var(--c-border);">
        <td style="padding:6px 8px;font-weight:600;">${m.ticker}</td>
        <td style="padding:6px 8px;">${m.sector || '-'}</td>
        <td style="padding:6px 8px;text-align:right;">${(m.weight * 100).toFixed(1)}%</td>
        <td style="padding:6px 8px;">${m.status === 'covered' ? 'Covered' : 'Fallback — ' + (m.reason || '')}${m.n_recovered ? ` · ${m.n_recovered} recovered quarters used` : ''}</td>
        <td style="padding:6px 8px;text-align:right;">${m.per0 ? m.per0.toLocaleString('en-US') + ' / ' + m.per_median.toLocaleString('en-US') : '-'}</td>
        <td style="padding:6px 8px;text-align:right;">${m.div_yield != null ? (m.div_yield * 100).toFixed(2) + '%' : '-'}</td></tr>`).join('')}</tbody>`;
    mc.appendChild(tbl);
    resultWrap.appendChild(mc);

    const as = createEl('div', { class: 'card' });
    as.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Assumptions Used']));
    as.appendChild(createEl('p', {
      style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0' },
    }, [`Three-layer shocks: market (shared) → sector deviation → issuer-specific residual. PER mean-reversion speed φ = ${asm.phi} (${asm.phi_basis}). ` +
      `Earnings growth winsorized to [${fmtPct(asm.winsor_growth ? asm.winsor_growth[0] : 0)}, ${fmtPct(asm.winsor_growth ? asm.winsor_growth[1] : 0)}] (pooled 5th/95th percentiles). ` +
      `PER floored at ${asm.per_floor} and capped at ${asm.per_cap}×. Dividends: ${asm.dividend}. Flow-regime mode (MC-2) does not apply to this method.`]));
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
    wl.innerHTML = `<b>Source window:</b> ${WIN_LABEL[r.window.label] || r.window.label} — ` +
      `${Number(r.window.n_returns).toLocaleString('en-US')} daily returns, ${fmtDate(r.window.from)} to ${fmtDate(r.window.to)} · ` +
      `${Number(r.n_sims).toLocaleString('en-US')} simulations · horizon ${r.horizon_days} trading days. Results inherit this window's regime.` +
      (r.mode === 'tekanan'
        ? `<br><b>STRESS SCENARIO:</b> results below use only blocks starting on outflow days — this is an "as if the outflow regime continued" scenario, not the average state.`
        : r.mode === 'rezim'
          ? `<br><b>Conditioned on the current flow regime:</b> results below use only blocks starting in the current flow state (${STATE_LABEL[(r.regime.current || {}).state] || '-'}).`
          : r.mode === 'ksei'
            ? `<br><b>Conditioned on the current KSEI tertile:</b> results below use only blocks from months in the same foreign-ownership tertile as the latest snapshot (${(r.ksei && r.ksei.current) ? `${KSEI_LABEL[r.ksei.current.tertile] || r.ksei.current.tertile} (${r.ksei.current.month}, ${r.ksei.current.pct.toFixed(1)}% foreign)` : '-'}).`
            : '');
    resultWrap.appendChild(wl);

    if (r.comparison) {
      const rc = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
      rc.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Mode Comparison']));
      const rg = r.regime || {};
      const info = createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-3)' } });
      if (rg.available && rg.current) {
        info.textContent = `Current state: ${STATE_LABEL[rg.current.state] || rg.current.state} ` +
          `(${fmtDate(rg.current.date)}, index net foreign flow ${formatNilaiSingkat(rg.current.flow)}). ` +
          `Blocks available — inflow: ${rg.blocks.masuk}, neutral: ${rg.blocks.netral}, outflow: ${rg.blocks.keluar} ` +
          `of ${Number(rg.flow_days).toLocaleString('en-US')} flow days read.`;
      } else {
        info.textContent = 'Index foreign flow is not read sufficiently or uniformly in this window — conditioned modes are unavailable; only All blocks mode can be used.';
      }
      rc.appendChild(info);
      if (r.ksei && r.ksei.available && r.ksei.current) {
        const ki = createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-3)' } });
        ki.textContent = `KSEI lens: ${r.ksei.months} monthly snapshots, latest ${r.ksei.current.month} at ${r.ksei.current.pct.toFixed(1)}% foreign (classified) — tertile ${KSEI_LABEL[r.ksei.current.tertile] || r.ksei.current.tertile}. ` +
          `Blocks — high: ${r.ksei.blocks.atas}, middle: ${r.ksei.blocks.tengah}, low: ${r.ksei.blocks.bawah}; ` +
          `days in labeled months: ${Number(r.ksei.days_labeled).toLocaleString('en-US')}, excluded: ${Number(r.ksei.days_excluded).toLocaleString('en-US')}.`;
        rc.appendChild(ki);
      }
      const tbl = createEl('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' } });
      const rowHtml = (c) => {
        const name = MODE_LABEL[c.mode] + (c.state ? ` (${KSEI_LABEL[c.state] || STATE_LABEL[c.state] || c.state})` : '');
        if (c.unavailable) {
          return `<td style="padding:6px 8px;">${name}</td><td colspan="4" style="padding:6px 8px;color:var(--c-text-3);">${c.unavailable}</td>`;
        }
        const thin = c.thin ? ' <span style="color:var(--c-warning, #f0a840);font-weight:600;">· thin data</span>' : '';
        const sel = c.mode === r.mode ? ' style="font-weight:700;"' : '';
        return `<td style="padding:6px 8px;"${sel}>${name}${thin}</td>` +
          `<td style="padding:6px 8px;text-align:right;">${fmtProb(c.p_end_positive)}</td>` +
          `<td style="padding:6px 8px;text-align:right;">${fmtPct(c.end_ret_p50)}</td>` +
          `<td style="padding:6px 8px;text-align:right;">${fmtPct(c.end_ret_p5)}</td>` +
          `<td style="padding:6px 8px;text-align:right;">${Number(c.blocks).toLocaleString('en-US')}</td>`;
      };
      tbl.innerHTML = `<thead><tr style="border-bottom:1px solid var(--c-border);color:var(--c-text-3);font-size:var(--text-xs);">` +
        `<th style="text-align:left;padding:6px 8px;">MODE</th><th style="text-align:right;padding:6px 8px;">P(positive)</th>` +
        `<th style="text-align:right;padding:6px 8px;">MEDIAN</th><th style="text-align:right;padding:6px 8px;">WORST 5%</th>` +
        `<th style="text-align:right;padding:6px 8px;">BLOCKS</th></tr></thead>` +
        `<tbody>${r.comparison.map((c) => `<tr style="border-bottom:1px solid var(--c-border);">${rowHtml(c)}</tr>`).join('')}</tbody>`;
      rc.appendChild(tbl);
      if (r.composition) {
        const cp = r.composition;
        const line = createEl('p', {
          style: { fontSize: 'var(--text-sm)', margin: 'var(--s-3) 0 0', color: cp.warning ? 'var(--c-warning, #f0a840)' : 'var(--c-text-2)' },
        }, [cp.warning
          ? `⚠ ${cp.warning} — based on ${cp.basis} (${cp.n_members} constituents). Soft warning; this page only appraises, it does not enforce.`
          : `Composition concentration: largest sector ${cp.top_sector} covers ${(cp.top_share * 100).toFixed(0)}% of ${cp.n_members} constituents (based on ${cp.basis}).`]);
        rc.appendChild(line);
      }
      resultWrap.appendChild(rc);
    }

    const fanCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
    fanCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } },
      [`Outcome fan chart — ${idx ? idx.name : 'Index'} (cumulative return)`]));
    const svgWrap = createEl('div', {});
    svgWrap.innerHTML = fanSvg(r.fan, r.horizon_days);
    fanCard.appendChild(svgWrap);
    fanCard.appendChild(createEl('div', {
      style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-2)' },
    }, ['Outer band = 90% of paths · inner band = middle 50% of paths · middle line = median · red line = 0%.']));
    resultWrap.appendChild(fanCard);

    const stats = createEl('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--s-3)', marginBottom: 'var(--s-3)' },
    });
    stats.append(
      statCard('CHANCE OF ENDING POSITIVE', fmtProb(r.p_end_positive)),
      statCard('MEDIAN RETURN (middle outcome)', fmtPct(r.end_ret.p50)),
      statCard('WORST 5% RETURN (5th percentile)', fmtPct(r.end_ret.p5), 'var(--c-danger)'),
      statCard('BEST 5% RETURN (95th percentile)', fmtPct(r.end_ret.p95), 'var(--c-accent)'),
      statCard('CHANCE OF DRAWDOWN (FALL FROM PEAK) >10%', fmtProb(r.p_dd_gt_10)),
      statCard('CHANCE OF DRAWDOWN (FALL FROM PEAK) >20%', fmtProb(r.p_dd_gt_20)),
      statCard('MEDIAN DRAWDOWN (FALL FROM PEAK)', fmtPct(-Math.abs(r.dd_median)), 'var(--c-danger)'),
    );
    resultWrap.appendChild(stats);

    if (r.capital) {
      const cc = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
      cc.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['Final Value in Rupiah']));
      const ev = r.capital.end_value;
      cc.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', marginBottom: 'var(--s-3)' } },
        [`Capital ${fmtRp(r.capital.amount)} → capital class ${r.capital.class} (Proposal B). Final value at the ${r.horizon_days}-trading-day horizon:`]));
      const cg = createEl('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--s-3)' },
      });
      cg.append(
        statCard('WORST 5% (5th percentile)', fmtRp(ev.p5)),
        statCard('MEDIAN (middle outcome)', fmtRp(ev.p50)),
        statCard('BEST 5% (95th percentile)', fmtRp(ev.p95)),
        statCard('CHANCE OF ENDING BELOW CAPITAL', fmtProb(r.capital.p_end_below_capital)),
      );
      cc.appendChild(cg);
      cc.appendChild(createEl('p', {
        style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-3)' },
      }, ['Computed from continuous weights before lot rounding — it appraises the basket, not an execution promise.']));
      resultWrap.appendChild(cc);
    }

    const note = createEl('div', { class: 'card' });
    note.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, ['How to Read']));
    note.appendChild(createEl('p', {
      style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0' },
    }, ['Monte Carlo rearranges blocks of past returns into thousands of future paths that never happened, then reports their distribution. It reduces sequence bias, not history bias — its raw material is still the past. Changing the composition of an index is done in Stock Indexes; this page only appraises it.']));
    resultWrap.appendChild(note);
  }

  function renderError(msg) {
    resultWrap.innerHTML = '';
    const box = createEl('div', {
      class: 'card',
      style: { borderLeft: '3px solid var(--c-danger)', fontSize: 'var(--text-sm)' },
    });
    box.innerHTML = `<b>The simulation could not be run.</b> ${msg}`;
    resultWrap.appendChild(box);
  }

  async function run() {
    if (state.running) return;
    if (!state.indexId) {
      toast('Choose an index first', { type: 'error' });
      return;
    }
    const capRaw = String(capInput.value || '').trim();
    const capital = capRaw === '' ? null : Number(capRaw);
    if (capital !== null && !(capital > 0)) {
      toast('Capital must be greater than 0', { type: 'error' });
      return;
    }
    state.running = true;
    runBtn.textContent = 'Calculating…';
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
      loadLedger();
    } catch (e) {
      state.result = null;
      renderError(e.message || String(e));
    }
    state.running = false;
    runBtn.textContent = 'Run Simulation';
    runBtn.disabled = false;
  }
  runBtn.addEventListener('click', run);

  function evalRows(ev) {
    return [['Chance of ending positive', fmtProb(ev.p_end_positive)],
      ['25th percentile return', fmtPct(ev.end_ret.p25)],
      ['Median return', fmtPct(ev.end_ret.p50)],
      ['Worst 5% return', fmtPct(ev.end_ret.p5)],
      ['Chance of drawdown (fall from peak) >20%', fmtProb(ev.p_dd_gt_20)],
      ['Median drawdown (fall from peak)', fmtPct(-Math.abs(ev.dd_median))]];
  }


  // ── Buku besar: daftar, detail, kalibrasi ──
  const idxName = (id) => {
    const hit = state.indices.find((i) => String(i.id) === String(id));
    return hit ? `${hit.name} (${hit.code})` : `Index #${id}`;
  };

  async function loadLedger() {
    try {
      const r = await Api.get('/index-saham/monte-carlo-runs', { limit: 30 });
      const runs = (r && r.runs) || [];
      ledgerListWrap.innerHTML = '';
      if (!runs.length) {
        ledgerListWrap.appendChild(createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-3)' } },
          ['No saved simulations yet. Run a simulation above — Level and Fundamental are both saved automatically.']));
        return;
      }
      const tbl = createEl('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' } });
      tbl.innerHTML = `<thead><tr style="text-align:left;color:var(--c-text-3);">
        <th style="padding:4px 6px;">Simulation</th><th style="padding:4px 6px;">Index</th>
        <th style="padding:4px 6px;">Engine</th><th style="padding:4px 6px;">Horizon</th>
        <th style="padding:4px 6px;">Final median</th></tr></thead>`;
      const tb = createEl('tbody', {});
      runs.forEach((run) => {
        const tr = createEl('tr', { style: { borderTop: '1px solid var(--c-border)', cursor: 'pointer' } });
        const modeTxt = run.engine === 'mc2'
          ? `Regime (${MODE_LABEL[run.params?.mode] || run.params?.mode || '-'})`
          : run.engine === 'mc3' ? 'Fundamental' : 'Level';
        tr.innerHTML = `
          <td style="padding:5px 6px;">${run.pinned ? '📌 ' : ''}${run.name ? run.name : fmtDate((run.created_at || '').slice(0, 10))}</td>
          <td style="padding:5px 6px;">${idxName(run.index_id)}</td>
          <td style="padding:5px 6px;">${modeTxt}</td>
          <td style="padding:5px 6px;">${run.params?.horizon_days ?? '-'} d</td>
          <td style="padding:5px 6px;">${fmtPct(run.summary?.end_ret?.p50)}</td>`;
        tr.addEventListener('click', () => openLedgerDetail(run.id));
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      ledgerListWrap.appendChild(tbl);
    } catch (e) {
      ledgerListWrap.innerHTML = '';
      ledgerListWrap.appendChild(createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-danger)' } },
        [`Failed to load history: ${e.message || e}`]));
    }
  }

  async function openLedgerDetail(runId) {
    ledgerDetailWrap.innerHTML = '';
    const loading = createEl('div', { class: 'card', style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } }, ['Loading run details…']);
    ledgerDetailWrap.appendChild(loading);
    let d = null;
    try {
      d = await Api.get(`/index-saham/monte-carlo-runs/${runId}`);
    } catch (e) {
      loading.textContent = `Failed to load details: ${e.message || e}`;
      return;
    }
    ledgerDetailWrap.innerHTML = '';
    const card = createEl('div', { class: 'card' });
    const title = d.name || `Simulation ${fmtDate((d.created_at || '').slice(0, 10))}`;
    card.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } }, [`${d.pinned ? '📌 ' : ''}${title} — ${idxName(d.index_id)}`]));
    const fp = d.fingerprint || {};
    const engineTxt = d.engine === 'mc2' ? 'MC-2 (regime)' : d.engine === 'mc3' ? 'MC-3 (fundamental)' : 'MC-1 (level)';
    const qTxt = d.engine === 'mc3' ? ` · ${d.params?.quarters ?? '-'} quarters` : '';
    card.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-2)' } },
      [`Engine ${engineTxt} v${d.engine_version} · data up to ${fmtDate(d.as_of_date)} · horizon ${d.params?.horizon_days ?? '-'} days${qTxt} · ${d.params?.n_sims ?? '-'} simulations · window ${WIN_LABEL[d.params?.window] || d.params?.window || '-'} · constituents at simulation time: ${(d.members_snapshot || []).length} issuers.`]));
    card.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-3)', margin: '0 0 var(--s-3)' } },
      [`Data fingerprint: market up to ${fp.market_max || '-'} · fundamentals up to ${fp.fundamentals_max || '-'} · ratios ${fp.ratios_count ?? '-'} rows · KSEI ${fp.ksei_latest || '-'}.`]));
    const kp = d.params?.ksei;
    if (kp && kp.current) {
      card.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-3)' } },
        [`KSEI lens at simulation time: ${kp.months} monthly snapshots, latest ${kp.current.month} at ${kp.current.pct.toFixed(1)}% foreign (classified) — tertile ${KSEI_LABEL[kp.current.tertile] || kp.current.tertile}. Blocks — high: ${kp.blocks.atas}, middle: ${kp.blocks.tengah}, low: ${kp.blocks.bawah}; days in labeled months: ${Number(kp.days_labeled).toLocaleString('en-US')}, excluded: ${Number(kp.days_excluded).toLocaleString('en-US')}.`]));
    }
    const snap = d.members_snapshot || [];
    if (snap.length) {
      const parts = snap.map((m) => {
        const base = m.weight_pct != null ? `${m.ticker || '-'} ${m.weight_pct.toLocaleString('en-US') + '%'}` : (m.ticker || '-');
        return (d.engine === 'mc3' && m.status === 'fallback') ? `${base} (fallback)` : base;
      }).join(' · ');
      card.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-3)' } },
        [`Constituent list (${snap.length}): ${parts}.`]));
    }
    const fan = (d.summary && d.summary.fan) || [];
    if (fan.length) {
      const fc = createEl('div', {});
      if (d.engine === 'mc3') {
        fc.innerHTML = fanSvgQ(fan, d.params?.quarters || 1);
        card.appendChild(fc);
        card.appendChild(createEl('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginBottom: 'var(--s-3)' } },
          ['Bands = quarterly spread saved on the simulation date. No drawdown statistics — quarterly points too coarse.']));
      } else {
        fc.innerHTML = fanSvgRealized(fan, d.params?.horizon_days || 63, []);
        card.appendChild(fc);
        card.appendChild(createEl('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginBottom: 'var(--s-3)' } },
          ['Bands = path spread saved on the simulation date.']));
      }
    }
    if (d.engine === 'mc3' && d.summary) {
      const at = d.summary.attribution || {};
      const mat = d.summary.materials || {};
      const ac = createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-3)' } });
      ac.innerHTML = `Attribution (median): earnings growth <b>${fmtPct(at.earnings || 0)}</b> · multiple change (PER) <b>${fmtPct(at.multiple || 0)}</b> · interaction <b>${fmtPct(at.interaction || 0)}</b> · dividends <b>${fmtPct(at.dividend || 0)}</b> · fallback path <b>${fmtPct(at.fallback || 0)}</b>. (Component medians need not sum to the median return.)`;
      card.appendChild(ac);
      card.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-3)' } },
        [`Data: ${mat.n_covered ?? '-'} of ${mat.n_members ?? '-'} constituents covered by attribution (weight ${mat.covered_weight != null ? (mat.covered_weight * 100).toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%' : '-'}); the rest are valued on fallback price paths.`]));
    }
    const acts = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' } });
    const pinBtn = createEl('button', { class: 'btn btn--secondary btn--sm' }, [d.pinned ? 'Unpin' : 'Pin']);
    pinBtn.addEventListener('click', async () => {
      try {
        await Api.patch(`/index-saham/monte-carlo-runs/${runId}`, { pinned: !d.pinned });
        loadLedger(); openLedgerDetail(runId);
      } catch (e) { toast(e.message || String(e), { type: 'error' }); }
    });
    const nameBtn = createEl('button', { class: 'btn btn--secondary btn--sm' }, ['Name']);
    nameBtn.addEventListener('click', async () => {
      const nm = window.prompt('Run name:', d.name || '');
      if (nm == null) return;
      try {
        await Api.patch(`/index-saham/monte-carlo-runs/${runId}`, { name: nm });
        loadLedger(); openLedgerDetail(runId);
      } catch (e) { toast(e.message || String(e), { type: 'error' }); }
    });
    const delBtn = createEl('button', { class: 'btn btn--secondary btn--sm' }, ['Delete']);
    delBtn.addEventListener('click', async () => {
      if (!window.confirm('Delete this simulation run permanently?')) return;
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
      toast('Failed to load the index list: ' + (e.message || e), { type: 'error' });
    }
    idxSel.innerHTML = '';
    if (!state.indices.length) {
      idxSel.appendChild(createEl('option', { value: '' }, ['— no index yet —']));
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
