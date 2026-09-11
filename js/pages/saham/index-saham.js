/* pages/index-saham.js — Index Saham (custom indices) — VNPC: list → detail → manage */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import { store } from '../../core/state.js';
import Api from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { createModal } from '../../ui/modal.js';
import { DelistedBadge, StockSectorBadge } from '../../ui/stock-widgets.js';
import { loadApexCharts, buildBaseOptions, renderChart, destroyChart, normalizeDate } from '../../ui/chart.js';

const MODES = {
  mcap: 'Market Cap',
  equal: 'Equal Weight',
  custom: 'Custom Weight',
};

function fmtLevel(v) {
  if (v == null || isNaN(v)) return '-';
  return v.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function fmtPct(v) {
  if (v == null || isNaN(v)) return '-';
  const n = Number(v);
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}

function toTs(dateStr) {
  const d = new Date(normalizeDate(dateStr));
  return isNaN(d) ? 0 : d.getTime();
}

export function render() {
  const isAdmin = store.tier === 'admin';

  const state = {
    indices: [],
    selected: null,      // selected detail payload { index, members, series, contributions }
    compareId: '',       // comparison index id ('' = none, 'ihsg' = IHSG)
    chart: null,
    loading: true,
    searchDebounce: null,
  };

  const container = createEl('div', {
    class: 'stock-list-page',
    style: { maxWidth: '1100px', margin: '0 auto', padding: 'var(--s-4)' },
  });

  // Header
  const header = createEl('div', {
    style: { display: 'flex', alignItems: 'center', gap: 'var(--s-3)', marginBottom: 'var(--s-4)', flexWrap: 'wrap' },
  });
  header.appendChild(createEl('h1', {}, ['Index Saham']));
  header.appendChild(createEl('p', {
    style: { color: 'var(--c-text-2)', flex: '1', minWidth: '200px' },
  }, ['Indeks kustom yang dibangun dari daftar saham IDX.']));
  if (isAdmin) {
    const createBtn = createEl('button', { class: 'btn btn--primary' });
    createBtn.innerHTML = `${icons['plus']} Buat Index`;
    createBtn.addEventListener('click', () => openCreateModal());
    header.appendChild(createBtn);
  }
  container.appendChild(header);

  // Index list
  const listWrap = createEl('div', { id: 'index-list', style: { marginBottom: 'var(--s-5)' } });
  container.appendChild(listWrap);

  // Detail (hidden until selection)
  const detailWrap = createEl('div', { id: 'index-detail', style: { display: 'none' } });
  container.appendChild(detailWrap);

  // ---- Data loading ----

  async function loadIndices() {
    state.loading = true;
    try {
      state.indices = (await Api.get('/index-saham')) || [];
    } catch (e) {
      state.indices = [];
      toast('Gagal memuat daftar: ' + (e.message || e), { type: 'error' });
    }
    state.loading = false;
    renderList();
  }

  // ---- List rendering ----

  function renderList() {
    listWrap.innerHTML = '';

    if (state.loading) {
      for (let i = 0; i < 3; i++) {
        listWrap.appendChild(createEl('div', {
          class: 'skeleton', style: { height: '72px', borderRadius: '10px', marginBottom: 'var(--s-2)' },
        }));
      }
      return;
    }

    if (state.indices.length === 0) {
      listWrap.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--s-6);border:1px dashed var(--c-border);border-radius:var(--radius);">
          <div style="font-size:44px;margin-bottom:var(--s-3);opacity:0.3;display:inline-flex;">${icons['layers']}</div>
          <p style="color:var(--c-text-2);">${isAdmin ? 'Belum ada index. Buat index pertama Anda.' : 'Belum ada index.'}</p>
          ${isAdmin ? '<button class="btn btn--primary" style="margin-top:var(--s-3);" id="empty-create">' + icons['plus'] + ' Buat Index</button>' : ''}
        </div>`;
      const btn = listWrap.querySelector('#empty-create');
      if (btn) btn.addEventListener('click', () => openCreateModal());
      return;
    }

    const grid = createEl('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 'var(--s-3)' },
    });

    state.indices.forEach((idx) => {
      const card = createEl('div', {
        class: 'card',
        style: { cursor: 'pointer', transition: 'border-color var(--dur-fast)' },
      });
      const chg = idx.last_change_pct;
      const chgColor = chg == null ? 'var(--c-text-3)' : (chg >= 0 ? 'var(--c-accent)' : 'var(--c-danger)');
      const tr = totalReturnPct(idx.last_level, idx.first_level != null ? idx.first_level : idx.base_value);
      const trColor = tr == null ? 'var(--c-text-3)' : (tr >= 0 ? 'var(--c-accent)' : 'var(--c-danger)');

      card.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:var(--s-3);">
          <span class="drawer__icon" style="color:var(--c-primary);flex-shrink:0;display:inline-flex;">${icons['layers']}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:var(--text-md);">${idx.name}</div>
            <div style="font-size:var(--text-xs);color:var(--c-text-3);text-transform:uppercase;letter-spacing:0.05em;">${idx.code} · ${MODES[idx.weighting_mode] || idx.weighting_mode}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-weight:700;font-size:var(--text-md);">${fmtLevel(idx.last_level)}</div>
            <div style="font-size:var(--text-sm);font-weight:600;color:${chgColor};">${fmtPct(chg)} (harian)</div>
          </div>
        </div>
        <div style="display:flex;gap:var(--s-2);margin-top:var(--s-3);font-size:var(--text-xs);color:var(--c-text-3);flex-wrap:wrap;">
          <span style="font-weight:600;color:${trColor};">${tr == null ? '' : `${fmtPct(tr)} sejak dasar`}</span>
          <span>${idx.member_count ?? 0} anggota</span>
          ${idx.last_stale ? `<span style="color:var(--c-warn);">data belum lengkap</span>` : ''}
          ${idx.is_active ? '' : `<span style="color:var(--c-danger);">nonaktif</span>`}
        </div>
      `;
      card.addEventListener('mouseenter', () => card.style.borderColor = 'var(--c-border-hi)');
      card.addEventListener('mouseleave', () => card.style.borderColor = '');
      card.addEventListener('click', () => selectIndex(idx.id));
      grid.appendChild(card);
    });

    listWrap.appendChild(grid);
  }

  // Total return sejak Tanggal Dasar: (level_terbaru / nilai_dasar - 1) * 100
  function totalReturnPct(lastLevel, baseValue) {
    const base = Number(baseValue);
    if (lastLevel == null || !base || base <= 0) return null;
    return (lastLevel / base - 1) * 100;
  }

  // ---- Detail ----

  async function selectIndex(id) {
    try {
      // days=0 (default): seluruh periode dari Tanggal Dasar index
      state.selected = await Api.get(`/index-saham/${id}`);
    } catch (e) {
      state.selected = null;
      toast('Gagal memuat detail: ' + (e.message || e), { type: 'error' });
      detailWrap.style.display = 'none';
      return;
    }
    state.compareId = '';
    renderDetail();
    detailWrap.style.display = 'block';
    detailWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderDetail() {
    const d = state.selected;
    if (!d) return;
    const idx = d.index;
    const members = d.members || [];
    const series = d.series || [];
    const contribs = d.contributions || {};
    const breadth = contribs.breadth || {};

    detailWrap.innerHTML = '';
    detailWrap.appendChild(buildDetailHeader(
      idx,
      members,
      series.length ? totalReturnPct(series[series.length - 1].level, series[0].level) : null,
    ));
    detailWrap.appendChild(buildChartCard(idx, series));
    const two = createEl('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 'var(--s-3)', marginTop: 'var(--s-3)' },
    });
    two.appendChild(buildContributionsCard(contribs));
    two.appendChild(buildMembersCard(idx, members));
    detailWrap.appendChild(two);
  }

  function buildDetailHeader(idx, members, totalReturn) {
    const head = createEl('div', {
      class: 'card',
      style: { display: 'flex', alignItems: 'center', gap: 'var(--s-3)', flexWrap: 'wrap', marginBottom: 'var(--s-3)' },
    });
    const info = createEl('div', { style: { flex: '1', minWidth: '220px' } });
    info.appendChild(createEl('h2', { style: { fontSize: 'var(--text-lg)', fontWeight: 700 } }, [idx.name]));
    const sub = createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } },
      [`${idx.code} · ${MODES[idx.weighting_mode] || idx.weighting_mode} · base ${fmtLevel(idx.base_value)} @ ${idx.base_date || '-'} · ${members.length} anggota`]);
    if (totalReturn != null) {
      const span = createEl('span', {
        style: { fontWeight: 600, color: totalReturn >= 0 ? 'var(--c-accent)' : 'var(--c-danger)' },
      }, [` ${fmtPct(totalReturn)} sejak dasar`]);
      sub.appendChild(span);
    }
    info.appendChild(sub);
    if (idx.description) {
      info.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-3)', marginTop: 'var(--s-1)' } }, [idx.description]));
    }
    head.appendChild(info);

    if (isAdmin) {
      const actions = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' } });
      const editBtn = createEl('button', { class: 'btn btn--secondary btn--sm' });
      editBtn.innerHTML = `${icons['edit']} Ubah`;
      editBtn.addEventListener('click', () => openEditModal(idx));
      const membersBtn = createEl('button', { class: 'btn btn--secondary btn--sm' });
      membersBtn.innerHTML = `${icons['list']} Anggota`;
      membersBtn.addEventListener('click', () => openMembersModal(idx));
      const rebuildBtn = createEl('button', { class: 'btn btn--secondary btn--sm' });
      rebuildBtn.innerHTML = `${icons['refresh']} Rebuild`;
      rebuildBtn.addEventListener('click', () => rebuildIndex(idx.id));
      const delBtn = createEl('button', { class: 'btn btn--danger btn--sm' });
      delBtn.innerHTML = `${icons['trash']} Hapus`;
      delBtn.addEventListener('click', () => deleteIndex(idx));
      actions.append(editBtn, membersBtn, rebuildBtn, delBtn);
      head.appendChild(actions);
    }

    return head;
  }

  function buildChartCard(idx, series) {
    const card = createEl('div', { class: 'card' });
    const headRow = createEl('div', {
      class: 'card__head',
      style: { display: 'flex', gap: 'var(--s-3)', alignItems: 'center', flexWrap: 'wrap' },
    });
    headRow.appendChild(createEl('h3', { class: 'card__title' }, ['Level Index']));

    const compareSel = createEl('select', { class: 'field__select', style: { width: 'auto' } });
    compareSel.appendChild(createEl('option', { value: '' }, ['Tanpa pembanding']));
    compareSel.appendChild(createEl('option', { value: 'ihsg' }, ['IHSG (EWI)']));
    state.indices
      .filter((i) => String(i.id) !== String(idx.id))
      .forEach((i) => compareSel.appendChild(createEl('option', { value: String(i.id) }, [i.name])));
    compareSel.value = state.compareId;
    compareSel.addEventListener('change', async (e) => {
      state.compareId = e.target.value;
      await drawChart(idx, series);
    });
    headRow.appendChild(compareSel);
    card.appendChild(headRow);

    const chartBox = createEl('div', { id: 'index-chart', style: { width: '100%' } });
    card.appendChild(chartBox);

    // async redraw
    drawChart(idx, series);
    return card;
  }

  async function drawChart(idx, series) {
    const box = document.getElementById('index-chart');
    if (!box) return;
    if (state.chart) { destroyChart(state.chart); state.chart = null; }

    // Jendela tanggal = periode seri utama (dari Tanggal Dasar index).
    // Pembanding difilter ke jendela yang sama agar grafik dan datanya sinkron.
    const d0 = series.length ? series[0].date : null;
    const d1 = series.length ? series[series.length - 1].date : null;
    const inWindow = (p) => !d0 || (p.date >= d0 && p.date <= d1);
    const daysW = Math.max(series.length, 1);

    const norm = (pts, key = 'level') => {
      const valid = pts.filter((p) => p[key] != null);
      if (valid.length === 0) return [];
      const base = valid[0][key];
      return valid.map((p) => ({ x: toTs(p.date), y: base ? (p[key] / base) * 100 : 100 }));
    };

    const seriesArr = [{
      name: idx.name,
      type: 'line',
      data: norm(series),
    }];
    const colors = ['#2563eb'];

    if (state.compareId === 'ihsg') {
      try {
        const radar = await Api.get('/idx/market/radar', { days: daysW });
        const pts = (radar?.data || []).filter(inWindow).map((p) => ({ date: p.date, close: p.ewi }));
        seriesArr.push({ name: 'IHSG', type: 'line', data: norm(pts, 'close') });
        colors.push('#059669');
      } catch (e) {
        toast('Gagal memuat IHSG: ' + (e.message || e), { type: 'warn' });
      }
    } else if (state.compareId) {
      try {
        const other = await Api.get(`/index-saham/${state.compareId}`, { days: daysW });
        const pts = (other?.series || []).filter(inWindow);
        seriesArr.push({ name: other?.index?.name || 'Lainnya', type: 'line', data: norm(pts, 'level') });
        colors.push('#d97706');
      } catch (e) {
        toast('Gagal memuat pembanding: ' + (e.message || e), { type: 'warn' });
      }
    }

    await loadApexCharts();
    const opts = buildBaseOptions({ height: 280, type: 'line' });
    opts.colors = colors;
    opts.legend = { show: true, position: 'top', labels: { colors: 'var(--c-text-2)' } };
    opts.stroke.width = 2;
    opts.series = seriesArr;
    state.chart = renderChart(box, opts);
  }

  function buildContributionsCard(contribs) {
    const card = createEl('div', { class: 'card' });
    card.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-3)' } }, ['Kontribusi Pergerakan']));

    const b = contribs.breadth || {};
    const breadthRow = createEl('div', {
      style: { display: 'flex', gap: 'var(--s-3)', fontSize: 'var(--text-sm)', marginBottom: 'var(--s-3)', flexWrap: 'wrap' },
    });
    breadthRow.innerHTML = `
      <span style="color:var(--c-accent);font-weight:600;">▲ ${b.advancers ?? 0} naik</span>
      <span style="color:var(--c-danger);font-weight:600;">▼ ${b.decliners ?? 0} turun</span>
      <span style="color:var(--c-text-3);">${b.unchanged ?? 0} datar</span>
    `;
    card.appendChild(breadthRow);

    const tops = contribs.top_contributors || [];
    const bottoms = contribs.top_detractors || [];
    if (tops.length === 0) {
      card.appendChild(createEl('p', { style: { color: 'var(--c-text-3)', fontSize: 'var(--text-sm)' } },
        ['Belum ada data kontribusi.']));
      return card;
    }

    const table = createEl('table', { class: 'table' });
    table.innerHTML = `<thead><tr><th>Ticker</th><th>Return</th><th>Bobot</th><th>Kontribusi</th></tr></thead>`;
    const tbody = createEl('tbody');
    [...tops, ...bottoms].forEach((c) => {
      const tr = createEl('tr', {});
      const color = c.contribution_pct >= 0 ? 'var(--c-accent)' : 'var(--c-danger)';
      tr.innerHTML = `
        <td style="font-weight:600;">${c.ticker}</td>
        <td>${fmtPct(c.return_pct)}</td>
        <td>${c.weight_pct != null ? c.weight_pct.toLocaleString('id-ID') + '%' : '-'}</td>
        <td style="color:${color};font-weight:600;">${fmtPct(c.contribution_pct)}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    const wrap = createEl('div', { class: 'table-wrap' });
    wrap.appendChild(table);
    card.appendChild(wrap);
    return card;
  }

  function buildMembersCard(idx, members) {
    const card = createEl('div', { class: 'card' });
    card.appendChild(createEl('h3', { class: 'card__title', style: { marginBottom: 'var(--s-3)' } },
      [`Anggota (${members.length})`]));

    if (members.length === 0) {
      card.appendChild(createEl('p', { style: { color: 'var(--c-text-3)', fontSize: 'var(--text-sm)' } },
        ['Index ini belum memiliki anggota.']));
      return card;
    }

    const table = createEl('table', { class: 'table' });
    table.innerHTML = `<thead><tr><th>Ticker</th><th>Perusahaan</th><th>Sektor</th>${idx.weighting_mode === 'custom' ? '<th>Bobot</th>' : ''}<th>Status</th></tr></thead>`;
    const tbody = createEl('tbody');
    members.forEach((m) => {
      const tr = createEl('tr', {});
      const badge = DelistedBadge({ labelDelisted: m.label_delisted, stockStatus: m.stock_status, statusReason: m.status_reason, small: true, nowrap: true });
      const sectorBadge = StockSectorBadge(m.sector, true);
      tr.innerHTML = `
        <td style="font-weight:600;">${m.ticker}</td>
        <td style="font-size:var(--text-sm);color:var(--c-text-2);">${m.company_name || '-'}</td>
        <td>${sectorBadge ? sectorBadge.outerHTML : '<span class="badge badge--neutral">-</span>'}</td>
        ${idx.weighting_mode === 'custom' ? `<td>${m.weight_pct != null ? m.weight_pct.toLocaleString('id-ID') + '%' : '-'}</td>` : ''}
        <td style="white-space:nowrap;">${badge.outerHTML}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    const wrap = createEl('div', { class: 'table-wrap' });
    wrap.appendChild(table);
    card.appendChild(wrap);
    return card;
  }

  // ---- Admin actions ----

  async function rebuildIndex(id) {
    try {
      await Api.post(`/index-saham/${id}/rebuild`);
      toast('Rebuild selesai.', { type: 'success' });
      await Promise.all([loadIndices(), selectIndex(id)]);
    } catch (e) {
      toast('Gagal rebuild: ' + (e.message || e), { type: 'error' });
    }
  }

  function deleteIndex(idx) {
    const content = createEl('div', {});
    content.appendChild(createEl('p', { style: { color: 'var(--c-text-2)' } },
      [`Hapus index "${idx.name}" beserta seluruh data level hariannya?`]));
    const modal = createModal({ title: 'Hapus Index', content, width: '420px' });
    const footer = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', marginTop: 'var(--s-3)', justifyContent: 'flex-end' } });
    const cancel = createEl('button', { class: 'btn btn--secondary' }, ['Batal']);
    cancel.addEventListener('click', () => modal.close());
    const confirm = createEl('button', { class: 'btn btn--danger' }, ['Hapus']);
    confirm.addEventListener('click', async () => {
      try {
        await Api.delete(`/index-saham/${idx.id}`);
        toast('Index dihapus.', { type: 'success' });
        modal.close();
        state.selected = null;
        detailWrap.style.display = 'none';
        state.chart && destroyChart(state.chart);
        state.chart = null;
        loadIndices();
      } catch (e) {
        toast('Gagal hapus: ' + (e.message || e), { type: 'error' });
      }
    });
    footer.append(cancel, confirm);
    content.appendChild(footer);
  }

  // ---- Create / Edit modal ----

  function openCreateModal() {
    openFormModal(null);
  }

  function openEditModal(idx) {
    openFormModal(idx);
  }

  function openFormModal(idx) {
    const isEdit = !!idx;
    const content = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
    const modal = createModal({ title: isEdit ? `Ubah: ${idx.name}` : 'Buat Index', content, width: '480px' });

    const nameField = createEl('div', { class: 'field' });
    nameField.innerHTML = '<label class="field__label">Nama *</label>';
    const nameInput = createEl('input', { class: 'field__input', type: 'text', placeholder: 'Contoh: Big Cap 30' });
    if (isEdit) nameInput.value = idx.name;
    nameField.appendChild(nameInput);

    const codeField = createEl('div', { class: 'field' });
    codeField.innerHTML = '<label class="field__label">Kode (slug; kosongkan untuk otomatis dari nama)</label>';
    const codeInput = createEl('input', { class: 'field__input', type: 'text', placeholder: 'big-cap-30' });
    if (isEdit) { codeInput.value = idx.code; codeInput.disabled = true; codeInput.style.opacity = 0.5; }
    codeField.appendChild(codeInput);

    const modeField = createEl('div', { class: 'field' });
    modeField.innerHTML = '<label class="field__label">Mode Pembobotan</label>';
    const modeSel = createEl('select', { class: 'field__select' });
    Object.entries(MODES).forEach(([v, l]) => modeSel.appendChild(createEl('option', { value: v }, [l])));
    if (isEdit) modeSel.value = idx.weighting_mode;
    if (isEdit && idx.weighting_mode === 'custom') modeSel.disabled = true; // validation: members already weighted
    modeField.appendChild(modeSel);

    const baseDateField = createEl('div', { class: 'field' });
    baseDateField.innerHTML = '<label class="field__label">Tanggal Dasar (kosongkan = tanggal terbaru)</label>';
    const baseDateInput = createEl('input', { class: 'field__input', type: 'date' });
    if (isEdit && idx.base_date) baseDateInput.value = idx.base_date;
    baseDateField.appendChild(baseDateInput);

    const row2 = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)' } });
    const baseValField = createEl('div', { class: 'field', style: { flex: '1' } });
    baseValField.innerHTML = '<label class="field__label">Nilai Dasar</label>';
    const baseValInput = createEl('input', { class: 'field__input', type: 'number', step: '0.01', value: '100' });
    if (isEdit && idx.base_value != null) baseValInput.value = idx.base_value;
    baseValField.appendChild(baseValInput);
    const covField = createEl('div', { class: 'field', style: { flex: '1' } });
    covField.innerHTML = '<label class="field__label">Min Coverage (%)</label>';
    const covInput = createEl('input', { class: 'field__input', type: 'number', step: '1', value: '60' });
    if (isEdit && idx.min_coverage != null) covInput.value = idx.min_coverage;
    covField.appendChild(covInput);
    row2.append(baseValField, covField);

    const descField = createEl('div', { class: 'field' });
    descField.innerHTML = '<label class="field__label">Deskripsi</label>';
    const descInput = createEl('textarea', { class: 'field__textarea', rows: 2 });
    if (isEdit && idx.description) descInput.value = idx.description;
    descField.appendChild(descInput);

    content.append(nameField, codeField, modeField, baseDateField, row2, descField);

    const footer = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', marginTop: 'var(--s-2)', justifyContent: 'flex-end' } });
    const cancel = createEl('button', { class: 'btn btn--secondary' }, ['Batal']);
    cancel.addEventListener('click', () => modal.close());
    const save = createEl('button', { class: 'btn btn--primary' }, [isEdit ? 'Simpan' : 'Buat']);
    save.addEventListener('click', () => handleSaveForm());
    footer.append(cancel, save);
    content.appendChild(footer);

    async function handleSaveForm() {
      const name = nameInput.value.trim();
      if (!name) { toast('Nama wajib diisi', { type: 'error' }); return; }
      const body = {
        name,
        description: descInput.value.trim() || null,
        weighting_mode: modeSel.value,
        base_value: Number(baseValInput.value) || 100,
        min_coverage: Number(covInput.value) || 60,
      };
      if (!isEdit) body.code = codeInput.value.trim() || null;
      if (baseDateInput.value) body.base_date = baseDateInput.value;

      try {
        if (isEdit) {
          await Api.put(`/index-saham/${idx.id}`, body);
        } else {
          await Api.post('/index-saham', body);
        }
        toast(isEdit ? 'Index diperbarui.' : 'Index dibuat.', { type: 'success' });
        modal.close();
        await loadIndices();
      } catch (e) {
        toast(e.message || 'Gagal menyimpan', { type: 'error' });
      }
    }
  }

  // ---- Members modal ----

  function openMembersModal(idx) {
    const state2 = {
      idx,
      selected: new Set(),
      weights: {},
      q: '',
      sector: '',
      primary: '',
      sub: '',
      page: 1,
      perPage: 25,
      total: 0,
      results: [],
      searchDebounce: null,
      view: '', // '' = semua, 'selected' = hanya terpilih
      allStocks: [], // cache seluruh daftar saham untuk filter "Terpilih saja"
    };

    // Prefill from the currently selected detail members
    const sel = state.selected;
    if (sel && String(sel.index.id) === String(idx.id)) {
      (sel.members || []).forEach((m) => {
        state2.selected.add(m.ticker);
        if (m.weight_pct != null) state2.weights[m.ticker] = m.weight_pct;
      });
    }

    const content = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
    const modal = createModal({ title: `Anggota: ${idx.name}`, content, width: '760px' });
    const isCustom = idx.weighting_mode === 'custom';

    // Weight-sum indicator (custom mode)
    const weightHint = createEl('div', {
      style: { fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--c-text-2)' },
    });
    if (isCustom) content.appendChild(weightHint);
    const updateWeightHint = () => {
      if (!isCustom) return;
      const sum = Object.values(state2.weights).reduce((a, b) => a + (Number(b) || 0), 0);
      const ok = Math.abs(sum - 100) <= 0.01;
      weightHint.textContent = `Total bobot: ${sum.toLocaleString('id-ID', { maximumFractionDigits: 2 })}% `;
      weightHint.style.color = ok ? 'var(--c-accent)' : 'var(--c-danger)';
      if (!ok) weightHint.textContent += '— harus 100%';
    };

    // Toolbar: search + cascading sector filters (seperti halaman Stock List)
    const toolbar = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', alignItems: 'flex-end' } });
    const searchWrap = createEl('div', { class: 'search', style: { flex: '1', minWidth: '200px' } });
    searchWrap.innerHTML = `
      <span class="search__icon">${icons['search']}</span>
      <input type="text" class="search__input" placeholder="Cari ticker / nama...">
      <button type="button" class="search__clear" aria-label="Bersihkan pencarian">${icons['x']}</button>`;
    toolbar.appendChild(searchWrap);

    const makeSelect = (label, width) => {
      const field = createEl('div', { class: 'field', style: { width, minWidth: width } });
      field.innerHTML = `<label class="field__label">${label}</label>`;
      const sel = createEl('select', { class: 'field__select' });
      sel.appendChild(createEl('option', { value: '' }, ['Semua']));
      field.appendChild(sel);
      toolbar.appendChild(field);
      return sel;
    };
    const sectorSel = makeSelect('Sektor', '130px');
    const primarySel = makeSelect('Primary', '130px');
    const subSel = makeSelect('Sub Sektor', '130px');
    const viewSel = makeSelect('Tampilan', '150px');
    viewSel.innerHTML = '<option value="">Semua saham</option><option value="selected">Terpilih saja</option>';
    content.appendChild(toolbar);

    // Bulk add: tempel daftar ticker langsung
    const bulkWrap = createEl('div', { class: 'card', style: { padding: 'var(--s-3)' } });
    bulkWrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s-2);">
        <b style="font-size:var(--text-sm);">Tambah Langsung</b>
        <span style="font-size:var(--text-xs);color:var(--c-text-3);">tempel ticker, pisahkan dengan koma / baris / spasi</span>
      </div>`;
    const bulkInput = createEl('textarea', {
      class: 'field__textarea', rows: 2, style: { fontFamily: 'monospace' },
      placeholder: 'contoh: BBCA, BBRI, TLKM\nUNVR ASII',
    });
    bulkWrap.appendChild(bulkInput);
    const bulkRow = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', marginTop: 'var(--s-2)', alignItems: 'center' } });
    const bulkBtn = createEl('button', { class: 'btn btn--secondary btn--sm' });
    bulkBtn.innerHTML = `${icons['plus']} Tambah ke Pilihan`;
    const unknownHint = createEl('span', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)' } });
    bulkRow.append(bulkBtn, unknownHint);
    bulkWrap.appendChild(bulkRow);
    content.appendChild(bulkWrap);

    function parseBulkTickers(raw) {
      return raw.split(/[\s,;]+/).map((t) => t.trim().toUpperCase()).filter((t) => /^[A-Z0-9.\-]{1,10}$/.test(t));
    }
    bulkBtn.addEventListener('click', () => {
      const tickers = parseBulkTickers(bulkInput.value);
      if (tickers.length === 0) { toast('Tidak ada ticker valid di input', { type: 'warn' }); return; }
      let added = 0;
      tickers.forEach((t) => {
        if (!state2.selected.has(t)) {
          state2.selected.add(t);
          if (isCustom && state2.weights[t] == null) state2.weights[t] = 0;
          added++;
        }
      });
      unknownHint.textContent = `${tickers.length} dibaca, ${added} baru ditambahkan.`;
      bulkInput.value = '';
      if (isCustom) updateWeightHint();
      updateSelectedCount();
      loadStocks(); // refresh checkbox state
    });

    const tableWrap = createEl('div', { class: 'table-wrap', style: { maxHeight: '40vh', overflowY: 'auto' } });
    content.appendChild(tableWrap);

    const pagRow = createEl('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--s-2)', fontSize: 'var(--text-sm)', color: 'var(--c-text-3)' } });
    content.appendChild(pagRow);

    // Selected counter + select/deselect all
    const selectedCount = createEl('span', { style: { fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--c-primary)' } });
    pagRow.appendChild(selectedCount);
    const selectAllBtn = createEl('button', { class: 'btn btn--ghost btn--sm' }, ['Pilih Semua']);
    const deselectAllBtn = createEl('button', { class: 'btn btn--ghost btn--sm' }, ['Hapus Pilihan']);
    selectAllBtn.addEventListener('click', () => {
      state2.results.forEach((s) => {
        if (s.label_delisted !== 1 && !state2.selected.has(s.ticker)) {
          state2.selected.add(s.ticker);
          if (isCustom && state2.weights[s.ticker] == null) state2.weights[s.ticker] = 0;
        }
      });
      if (isCustom) updateWeightHint();
      updateSelectedCount();
      if (state2.view === 'selected') loadStocks(); else renderTable();
    });
    deselectAllBtn.addEventListener('click', () => {
      state2.results.forEach((s) => {
        state2.selected.delete(s.ticker);
        if (isCustom) delete state2.weights[s.ticker];
      });
      if (isCustom) updateWeightHint();
      updateSelectedCount();
      if (state2.view === 'selected') loadStocks(); else renderTable();
    });
    pagRow.append(selectedCount, selectAllBtn, deselectAllBtn);

    function updateSelectedCount() {
      selectedCount.textContent = `Terpilih: ${state2.selected.size} saham`;
    }
    updateSelectedCount();

    // Search wiring
    const searchInput = searchWrap.querySelector('.search__input');
    const clearBtn = searchWrap.querySelector('.search__clear');
    searchInput.addEventListener('input', (e) => {
      state2.q = e.target.value;
      state2.page = 1;
      searchWrap.classList.toggle('has-clear', state2.q !== '');
      clearTimeout(state2.searchDebounce);
      state2.searchDebounce = setTimeout(loadStocks, 350);
    });
    clearBtn.addEventListener('click', () => {
      state2.q = ''; searchInput.value = ''; state2.page = 1;
      searchWrap.classList.remove('has-clear');
      loadStocks();
    });
    sectorSel.addEventListener('change', (e) => {
      state2.sector = e.target.value;
      state2.primary = ''; state2.sub = '';
      state2.page = 1;
      loadSubOptions().then(loadStocks);
    });
    primarySel.addEventListener('change', (e) => {
      state2.primary = e.target.value;
      state2.sub = '';
      state2.page = 1;
      loadSubOptions().then(loadStocks);
    });
    subSel.addEventListener('change', (e) => {
      state2.sub = e.target.value;
      state2.page = 1;
      loadStocks();
    });
    viewSel.addEventListener('change', (e) => {
      state2.view = e.target.value;
      state2.page = 1;
      loadStocks();
    });
    if (isCustom) updateWeightHint();

    async function loadSubOptions() {
      if (state2.sector) {
        try {
          const options = await Api.get('/idx/sectors', { sector: state2.sector });
          primarySel.innerHTML = '<option value="">Semua</option>' + (options || []).map((o) => `<option value="${o}">${o}</option>`).join('');
        } catch (_) { primarySel.innerHTML = '<option value="">Semua</option>'; }
      } else {
        primarySel.innerHTML = '<option value="">Semua</option>';
      }
      if (state2.sector && state2.primary) {
        try {
          const options = await Api.get('/idx/sectors', { sector: state2.sector, primary_sector: state2.primary });
          subSel.innerHTML = '<option value="">Semua</option>' + (options || []).map((o) => `<option value="${o}">${o}</option>`).join('');
        } catch (_) { subSel.innerHTML = '<option value="">Semua</option>'; }
      } else {
        subSel.innerHTML = '<option value="">Semua</option>';
      }
    }

    async function loadStocks() {
      tableWrap.innerHTML = '<div class="skeleton" style="height:160px;border-radius:6px;"></div>';
      try {
        if (state2.view === 'selected') {
          // Filter lokal: hanya saham terpilih (dari cache seluruh daftar),
          // tetap hormati pencarian dan filter sektor.
          const q = state2.q.trim().toLowerCase();
          const rows = state2.allStocks.filter((s) => {
            if (q && !(s.ticker.toLowerCase().includes(q) || String(s.company_name || '').toLowerCase().includes(q))) return false;
            if (state2.sector && s.sector !== state2.sector) return false;
            if (state2.primary && s.primary_sector !== state2.primary) return false;
            if (state2.sub && s.sub_sector !== state2.sub) return false;
            return state2.selected.has(s.ticker);
          });
          state2.total = rows.length;
          const start = (state2.page - 1) * state2.perPage;
          state2.results = rows.slice(start, start + state2.perPage);
        } else {
          const params = {
            limit: state2.perPage, offset: (state2.page - 1) * state2.perPage,
            q: state2.q, sector: state2.sector,
            primary_sector: state2.primary, sub_sector: state2.sub,
          };
          const data = await Api.get('/idx/stocks', params);
          state2.results = (data && data.stocks) || [];
          state2.total = (data && data.total) || 0;
        }
      } catch (e) {
        state2.results = []; state2.total = 0;
        toast('Gagal memuat saham: ' + (e.message || e), { type: 'error' });
      }
      renderTable();
      renderPagination();
    }

    function renderTable() {
      tableWrap.innerHTML = '';
      if (state2.results.length === 0) {
        tableWrap.innerHTML = '<p style="padding:var(--s-4);color:var(--c-text-3);font-size:var(--text-sm);">Tidak ada saham ditemukan.</p>';
        return;
      }
      const table = createEl('table', { class: 'table' });
      table.innerHTML = `<thead><tr>
        <th style="width:36px;"></th>
        <th>Ticker</th><th>Perusahaan</th><th>Sektor</th>
        ${isCustom ? '<th style="width:110px;">Bobot %</th>' : ''}
      </tr></thead>`;
      const tbody = createEl('tbody');
      state2.results.forEach((s) => {
        const delisted = s.label_delisted === 1;
        const tr = createEl('tr', { class: delisted ? 'stock-list-page__row--delisted' : '' });
        const tdChk = createEl('td', {});
        const chk = createEl('input', { type: 'checkbox' });
        chk.checked = state2.selected.has(s.ticker);
        if (delisted) { chk.disabled = true; chk.title = 'Saham delisted'; }
        chk.addEventListener('change', () => {
          if (chk.checked) {
            state2.selected.add(s.ticker);
            if (isCustom && state2.weights[s.ticker] == null) state2.weights[s.ticker] = 0;
          } else {
            state2.selected.delete(s.ticker);
            if (isCustom) delete state2.weights[s.ticker];
          }
          if (isCustom) updateWeightHint();
          updateSelectedCount();
          // di view "Terpilih saja", baris yang di-uncheck langsung hilang dari daftar
          if (state2.view === 'selected') loadStocks();
        });
        tdChk.appendChild(chk);
        tr.appendChild(tdChk);

        const tdTicker = createEl('td', { style: { fontWeight: 600 } }, [s.ticker]);
        tr.appendChild(tdTicker);
        tr.appendChild(createEl('td', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } }, [s.company_name || '-']));
        const sb = StockSectorBadge(s.sector, true);
        const tdSector = createEl('td', {});
        tdSector.innerHTML = sb ? sb.outerHTML : '<span class="badge badge--neutral">-</span>';
        tr.appendChild(tdSector);

        if (isCustom) {
          const tdW = createEl('td', {});
          const wIn = createEl('input', {
            type: 'number', step: '0.01', min: '0', max: '100',
            class: 'field__input', style: { width: '90px', padding: 'var(--s-1) var(--s-2)' },
          });
          wIn.value = state2.weights[s.ticker] != null ? state2.weights[s.ticker] : '';
          wIn.disabled = !chk.checked;
          wIn.addEventListener('input', () => {
            state2.weights[s.ticker] = Number(wIn.value) || 0;
            updateWeightHint();
          });
          tdW.appendChild(wIn);
          tr.appendChild(tdW);
        }
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
    }

    function renderPagination() {
      // remove old controls, keep the selected-count span
      pagRow.querySelectorAll('.pag-ctl').forEach((el) => el.remove());
      const totalPages = Math.ceil(state2.total / state2.perPage);
      const info = createEl('span', { class: 'pag-ctl' }, [`${state2.page} / ${totalPages || 1} (${state2.total} saham)`]);
      const prev = createEl('button', { class: 'btn btn--ghost btn--sm pag-ctl' }, ['Prev']);
      prev.addEventListener('click', () => { if (state2.page > 1) { state2.page--; loadStocks(); } });
      const next = createEl('button', { class: 'btn btn--ghost btn--sm pag-ctl' }, ['Next']);
      next.addEventListener('click', () => { if (state2.page < totalPages) { state2.page++; loadStocks(); } });
      pagRow.append(info, prev, next);
    }

    const footer = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', alignItems: 'center' } });
    const previewBtn = createEl('button', { class: 'btn btn--secondary' });
    previewBtn.innerHTML = `${icons['radar']} Preview`;
    footer.appendChild(previewBtn);
    footer.appendChild(createEl('span', { style: { flex: '1' } }, []));
    const cancelBtn = createEl('button', { class: 'btn btn--secondary' }, ['Batal']);
    cancelBtn.addEventListener('click', () => modal.close());
    const saveBtn = createEl('button', { class: 'btn btn--primary' }, ['Simpan Anggota']);
    saveBtn.addEventListener('click', handleSave);
    footer.append(cancelBtn, saveBtn);
    content.appendChild(footer);

    previewBtn.addEventListener('click', handlePreview);

    async function handlePreview() {
      const tickers = [...state2.selected];
      if (tickers.length === 0) { toast('Pilih minimal 1 saham', { type: 'warn' }); return; }
      if (isCustom) {
        const sum = tickers.reduce((a, t) => a + (Number(state2.weights[t]) || 0), 0);
        if (Math.abs(sum - 100) > 0.01) { toast('Total bobot harus 100%', { type: 'error' }); return; }
      }
      try {
        const body = { weighting_mode: idx.weighting_mode, tickers };
        if (isCustom) body.weight_map = state2.weights;
        const res = await Api.post('/index-saham/preview', body);
        if (!res.valid) { toast(res.reason || 'Preview gagal', { type: 'error' }); return; }
        const lines = [
          `Level simulasi: ${fmtLevel(res.level_preview)} (${fmtPct(res.return_pct)})`,
          `Cakupan: ${res.coverage_pct}%`,
        ];
        const contrib = (res.contributors || []).slice(0, 5)
          .map((c) => `${c.ticker} ${fmtPct(c.contribution_pct)}/${fmtPct(c.return_pct)}`).join(' · ');
        if (contrib) lines.push(`Top kontributor: ${contrib}`);
        toast(lines.join(' | '), { type: 'info', duration: 5000 });
      } catch (e) {
        toast(e.message || 'Preview gagal', { type: 'error' });
      }
    }

    async function handleSave() {
      const tickers = [...state2.selected];
      if (tickers.length === 0) { toast('Pilih minimal 1 saham', { type: 'warn' }); return; }
      if (isCustom) {
        const sum = tickers.reduce((a, t) => a + (Number(state2.weights[t]) || 0), 0);
        if (Math.abs(sum - 100) > 0.01) { toast('Total bobot harus 100%', { type: 'error' }); return; }
      }
      try {
        const body = { tickers };
        if (isCustom) body.weight_map = state2.weights;
        const res = await Api.put(`/index-saham/${idx.id}/members`, body);
        toast(`Anggota disimpan (${res.member_count || tickers.length}). Rebuild: ${res.rebuild?.days_written ?? '?'} hari.`, { type: 'success', duration: 5000 });
        modal.close();
        await Promise.all([loadIndices(), selectIndex(idx.id)]);
      } catch (e) {
        toast(e.message || 'Gagal menyimpan anggota', { type: 'error' });
      }
    }

    // Init
    loadSectorOptions().then(loadStocks);
    loadAllStocks();

    // Muat seluruh daftar saham (2 panggilan, limit maksimal 500) untuk filter "Terpilih saja".
    async function loadAllStocks() {
      if (state2.allStocks.length > 0) return;
      try {
        const all = [];
        for (let offset = 0; offset < 1500; offset += 500) {
          const data = await Api.get('/idx/stocks', { limit: 500, offset });
          const batch = (data && data.stocks) || [];
          all.push(...batch);
          if (batch.length < 500) break;
        }
        state2.allStocks = all;
      } catch (_) {
        // cache gagal dimuat; view "Terpilih saja" tetap bisa dipakai setelah
        // halaman dijelajahi karena hasil pencarian server tetap masuk state2.results
      }
    }

    async function loadSectorOptions() {
      try {
        const sectors = await Api.get('/idx/sectors');
        sectorSel.innerHTML = '<option value="">Semua</option>' + (sectors || []).map((s) => `<option value="${s}">${s}</option>`).join('');
      } catch (_) {}
    }
  }

  container._cleanup = () => {
    if (state.chart) { destroyChart(state.chart); state.chart = null; }
    clearTimeout(state.searchDebounce);
  };

  // Init
  loadIndices();
  return container;
}