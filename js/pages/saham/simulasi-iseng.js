/* pages/saham/simulasi-iseng.js — Simulasi Iseng: 3 garis perwakilan.
 * Menu iseng/main-main: garis median jalur bullish / sideways /
 * bearish dari bootstrap blok atas log-return historis emiten atau
 * indeks. HANYA BACA: tidak ada simpan ke server, tidak ada riwayat,
 * tidak ada localStorage. Seed acak tiap permintaan (tombol "Kocok
 * lagi" = simulasi ulang dengan seed baru). Bukan ramalan, bukan
 * rekomendasi. Warna garis sengaja TANPA hijau/merah vonis. */
import { createEl } from '../../utils/dom.js';
import Api from '../../core/api.js';
import { toast } from '../../ui/toast.js';

const HORIZONS = [[21, '1 mo'], [63, '3 mo'], [126, '6 mo'], [252, '1 yr'], [504, '2 yr']];
const NSIMS = [[10000, '10,000'], [50000, '50,000'], [100000, '100,000'], [250000, '250,000']];
const WINDOWS = [['all', 'All history'], ['1y', '1 yr'], ['2y', '2 yr'], ['3y', '3 yr'], ['5y', '5 yr']];
const CONDITIONS = [['all', 'All history'], ['flow', 'Current flow regime']];
const FLOW_LABEL = { masuk: 'Inflow', netral: 'Neutral', keluar: 'Outflow' };
const BUCKETS = ['bullish', 'sideways', 'bearish'];
const COLORS = { bullish: '#3b82f6', sideways: '#9ca3af', bearish: '#f59e0b' };
const LABELS = { bullish: 'Bullish (up)', sideways: 'Sideways (flat)', bearish: 'Bearish (down)' };

function fmtPct(v) {
  if (v == null || isNaN(v)) return '-';
  const n = Number(v) * 100;
  return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
}
function fmtProb(v) {
  if (v == null || isNaN(v)) return '-';
  return (Number(v) * 100).toFixed(1) + '%';
}

function linesSvg(points, lines) {
  const horizon = points[points.length - 1];
  const vals = [0];
  BUCKETS.forEach((b) => (lines[b] || []).forEach((v) => { if (v != null) vals.push(v); }));
  let mn = Math.min(...vals), mx = Math.max(...vals);
  const sp = (mx - mn) * 0.08 || 0.01; mn -= sp; mx += sp;
  const W = 900, H = 320, L = 56, R = 12, T = 12, B = 26;
  const X = (d) => L + (d / horizon) * (W - L - R);
  const Y = (v) => T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;background:var(--c-bg-2);border-radius:8px;">`;
  s += `<line x1="${L}" y1="${Y(0).toFixed(1)}" x2="${W - R}" y2="${Y(0).toFixed(1)}" stroke="var(--c-border)" stroke-dasharray="4 4"/>`;
  BUCKETS.forEach((b) => {
    const line = lines[b] || [];
    if (!line.length || line[0] == null) return;
    const d = line.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(points[i]).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    s += `<path d="${d}" fill="none" stroke="${COLORS[b]}" stroke-width="2.5"/>`;
  });
  const yLbl = (v, y) => `<text x="${L - 6}" y="${y}" text-anchor="end" font-size="11" fill="var(--c-text-3)">${fmtPct(v)}</text>`;
  s += yLbl(mx, T + 4) + yLbl(0, Y(0) + 4) + yLbl(mn, H - B + 4);
  const mid = points[Math.floor(points.length / 2)];
  const xLbl = (d) => `<text x="${X(d).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="var(--c-text-3)">day ${d}</text>`;
  s += xLbl(points[0]) + xLbl(mid) + xLbl(points[points.length - 1]);
  s += '</svg>';
  return s;
}

export function render() {
  const container = createEl('div', {});
  const head = createEl('div', { style: { marginBottom: 'var(--s-3)' } });
  head.appendChild(createEl('h2', {}, ['Playful Simulation']));
  head.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0' } },
    ['Just for fun — three representative lines from simulations over historical issuer or index data. Not a forecast, not a recommendation. Nothing is saved.']));
  container.appendChild(head);

  const state = { target: 'indeks', ticker: '', indexId: '', window: 'all', condition: 'all', horizon: 63, nSims: 50000, running: false, hasResult: false };

  const ctl = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
  ctl.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-3)' } }, ['Simulation Settings']));
  const grid = createEl('div', { style: { display: 'flex', gap: 'var(--s-4)', flexWrap: 'wrap', alignItems: 'flex-end' } });
  const field = (label, el) => {
    const w = createEl('div', {});
    w.appendChild(createEl('label', {
      style: { display: 'block', fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginBottom: 'var(--s-1)', letterSpacing: '0.04em' },
    }, [label]));
    w.appendChild(el);
    return w;
  };
  const sel = (opts, val, onChange) => {
    const s = createEl('select', { class: 'field__select' });
    opts.forEach(([v, l]) => s.appendChild(createEl('option', { value: String(v) }, [l])));
    s.value = String(val);
    s.addEventListener('change', (e) => onChange(e.target.value));
    return s;
  };
  const targetSel = sel([['indeks', 'Index'], ['saham', 'Issuer']], state.target, (v) => {
    state.target = v;
    tickerField.style.display = v === 'saham' ? '' : 'none';
    idxField.style.display = v === 'indeks' ? '' : 'none';
  });
  const tickerInput = createEl('input', {
    class: 'field__input', type: 'text', placeholder: 'e.g. BBCA',
    style: { width: '140px', textTransform: 'uppercase' },
  });
  tickerInput.addEventListener('input', (e) => { state.ticker = e.target.value; });
  const tickerField = field('TICKER', tickerInput);
  tickerField.style.display = 'none';
  const idxSel = createEl('select', { class: 'field__select', style: { minWidth: '220px' } });
  idxSel.addEventListener('change', (e) => { state.indexId = e.target.value; });
  const idxField = field('INDEX', idxSel);
  const windowSel = sel(WINDOWS, state.window, (v) => { state.window = v; });
  const condSel = sel(CONDITIONS, state.condition, (v) => { state.condition = v; });
  const horizonSel = sel(HORIZONS, state.horizon, (v) => { state.horizon = Number(v); });
  const nSimsSel = sel(NSIMS, state.nSims, (v) => { state.nSims = Number(v); });
  const runBtn = createEl('button', { class: 'btn btn--primary' }, ['Simulate']);
  const againBtn = createEl('button', { class: 'btn btn--secondary', disabled: true }, ['Roll again']);
  grid.appendChild(field('TARGET', targetSel));
  grid.appendChild(tickerField);
  grid.appendChild(idxField);
  grid.appendChild(field('RETURN WINDOW', windowSel));
  grid.appendChild(field('CONDITION', condSel));
  grid.appendChild(field('HORIZON', horizonSel));
  grid.appendChild(field('NUMBER OF SIMULATIONS', nSimsSel));
  grid.appendChild(runBtn);
  grid.appendChild(againBtn);
  ctl.appendChild(grid);
  ctl.appendChild(createEl('p', {
    style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-3)' },
  }, ['One line point = 1 day for short horizons; longer horizons are aggregated (1 point = 5 days up to 1 year, 21 days above that). Groups from path ends: up when the final log return is > +1%, down when < −1%, otherwise flat. Condition = which blocks the simulation may start from. All history uses every block; current flow regime uses only blocks starting on days whose foreign-flow state matches the latest day (inflow / neutral / outflow).']));
  container.appendChild(ctl);

  const resultWrap = createEl('div', {});
  container.appendChild(resultWrap);

  function renderResult(r) {
    resultWrap.innerHTML = '';
    const total = r.counts.bullish + r.counts.sideways + r.counts.bearish;
    const last = (b) => (r.lines[b] || []).slice(-1)[0];
    const stats = createEl('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 'var(--s-3)', marginBottom: 'var(--s-3)' },
    });
    BUCKETS.forEach((b) => {
      const c = createEl('div', { class: 'card' });
      c.appendChild(createEl('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)' } },
        [`● ${LABELS[b]}`]));
      c.style.borderTop = `3px solid ${COLORS[b]}`;
      const cnt = r.counts[b];
      c.appendChild(createEl('div', { style: { fontSize: 'var(--text-lg)', fontWeight: '600' } },
        [cnt ? `${cnt.toLocaleString('en-US')} paths (${fmtProb(cnt / total)})` : 'no paths']));
      c.appendChild(createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } },
        [`Final median: ${fmtPct(last(b))}`]));
      stats.appendChild(c);
    });
    resultWrap.appendChild(stats);

    const chartCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-3)' } });
    chartCard.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-2)' } },
      [`Representative Lines — ${r.label}`]));
    const svgWrap = createEl('div', {});
    svgWrap.innerHTML = linesSvg(r.points, r.lines);
    chartCard.appendChild(svgWrap);
    const legend = createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } });
    legend.innerHTML = BUCKETS.map((b) => {
      const cnt = r.counts[b];
      return `<span style="color:${COLORS[b]}">●</span> ${LABELS[b]}: ${cnt ? `${cnt.toLocaleString('en-US')} paths (${fmtProb(cnt / total)})` : 'no paths end here'}`;
    }).join(' · ');
    chartCard.appendChild(legend);
    resultWrap.appendChild(chartCard);

    resultWrap.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-2)' } },
      [`1 point = ${r.step_days} days · returns used: ${r.n_returns.toLocaleString('en-US')} · horizon ${r.horizon_days} days · ${r.n_sims.toLocaleString('en-US')} simulations.`]));
    if (r.flow) {
      resultWrap.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', margin: '0 0 var(--s-2)' } },
        [`Condition: current flow regime — ${FLOW_LABEL[r.flow.state] || r.flow.state} (${r.flow.date}) · blocks — inflow: ${r.flow.blocks.masuk}, neutral: ${r.flow.blocks.netral}, outflow: ${r.flow.blocks.keluar} · ${Number(r.flow.flow_days).toLocaleString('en-US')} flow days read.`]));
    }
    resultWrap.appendChild(createEl('p', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', margin: '0' } },
      [r.note || 'Not a forecast, not a recommendation — median lines from simulations over historical data.']));
  }

  async function run() {
    if (state.running) return;
    if (state.target === 'saham' && !state.ticker.trim()) {
      toast('Enter a ticker first', { type: 'error' });
      return;
    }
    if (state.target === 'indeks' && !state.indexId) {
      toast('Choose an index first', { type: 'error' });
      return;
    }
    state.running = true;
    runBtn.textContent = 'Rolling…';
    runBtn.disabled = true;
    againBtn.disabled = true;
    try {
      const body = {
        target: state.target,
        horizon_days: state.horizon,
        n_sims: state.nSims,
        window: state.window,
        condition: state.condition,
      };
      if (state.target === 'saham') body.ticker = state.ticker.trim();
      else body.index_id = Number(state.indexId);
      const r = await Api.post('/simulasi-iseng', body);
      renderResult(r);
      state.hasResult = true;
    } catch (e) {
      resultWrap.innerHTML = '';
      resultWrap.appendChild(createEl('div', { class: 'card', style: { fontSize: 'var(--text-sm)', color: 'var(--c-danger)' } },
        [`Failed: ${e.message || e}`]));
    }
    state.running = false;
    runBtn.textContent = 'Simulate';
    runBtn.disabled = false;
    againBtn.disabled = !state.hasResult;
  }
  runBtn.addEventListener('click', run);
  againBtn.addEventListener('click', run);

  (async () => {
    try {
      const indices = (await Api.get('/index-saham')) || [];
      idxSel.innerHTML = '';
      if (!indices.length) {
        idxSel.appendChild(createEl('option', { value: '' }, ['— no index yet —']));
        return;
      }
      indices.forEach((i) => {
        idxSel.appendChild(createEl('option', { value: String(i.id) }, [`${i.name} (${i.code})`]));
      });
      state.indexId = String(indices[0].id);
      idxSel.value = state.indexId;
    } catch (e) {
      idxSel.innerHTML = '';
      idxSel.appendChild(createEl('option', { value: '' }, ['— failed to load indexes —']));
      toast('Failed to load the index list: ' + (e.message || e), { type: 'error' });
    }
  })();

  return container;
}
