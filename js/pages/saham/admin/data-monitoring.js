/* pages/admin/data-monitoring.js — Pemantauan Data (admin) */
import { createEl } from '../../../utils/dom.js';
import { icons } from '../../../ui/icons.js';
import Api from '../../../core/api.js';
import { toast } from '../../../ui/toast.js';

export function render() {
  const PAGE_SIZE = 20;

  const state = {
    data: null,
    loading: true,
    error: null,
    query: '',
    page: 1,
  };

  const container = createEl('div', { class: 'admin-data-monitoring' }, []);

  const headRow = createEl('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--s-3)' } }, []);
  const headText = createEl('div', {}, []);
  headText.appendChild(createEl('h1', {}, ['Pemantauan Data']));
  headText.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Terakhir di-update per jenis data. XBRL menampilkan TW terakhir dan saham yang belum lengkap.']));
  const refreshBtn = createEl('button', { class: 'btn btn--ghost btn--sm', title: 'Muat ulang' }, []);
  refreshBtn.innerHTML = icons['refresh'];
  refreshBtn.addEventListener('click', load);
  headRow.append(headText, refreshBtn);
  container.appendChild(headRow);

  const xbrlCard = createEl('div', { class: 'card' }, []);
  const kseiCard = createEl('div', { class: 'card' }, []);
  const holdersCard = createEl('div', { class: 'card' }, []);
  const commodityCard = createEl('div', { class: 'card' }, []);
  container.append(xbrlCard, kseiCard, holdersCard, commodityCard);

  // ── Muat data ────────────────────────────────────────────────────
  async function load() {
    state.loading = true;
    state.error = null;
    state.page = 1;
    renderAll();
    try {
      state.data = await Api.get('/data-updates/monitoring');
    } catch (e) {
      state.data = null;
      state.error = e.message || String(e);
      toast('Gagal memuat data pemantauan', { type: 'error' });
    }
    state.loading = false;
    renderAll();
  }

  function cardHead(card, title, subtitle) {
    card.innerHTML = '';
    card.appendChild(createEl('div', { class: 'card__head' }, [], []));
    card.querySelector('.card__head').innerHTML = `
      <div>
        <div class="card__title">${title}</div>
        ${subtitle ? `<div class="card__subtitle">${subtitle}</div>` : ''}
      </div>
    `;
  }

  function loadingBody() {
    return `<div class="idx-upload__loading">
      <span class="idx-upload__spinner"></span> Memuat...
    </div>`;
  }

  function kvRows(rows) {
    return rows.map(([k, v]) => `
      <div style="display:flex;justify-content:space-between;gap:var(--s-3);padding:var(--s-2) 0;border-bottom:1px solid var(--c-border);font-size:var(--text-sm);">
        <span style="color:var(--c-text-2);">${k}</span>
        <span style="font-weight:600;">${v}</span>
      </div>`).join('');
  }

  // ── Kartu XBRL ───────────────────────────────────────────────────
  function renderXbrl() {
    const d = state.data?.xbrl;
    cardHead(xbrlCard, 'XBRL — Laporan Keuangan',
      d?.latest_period ? `TW terakhir: ${d.latest_period}` : '');
    const body = createEl('div', {}, []);
    if (state.loading) {
      body.innerHTML = loadingBody();
    } else if (!d) {
      body.innerHTML = '<p style="color:var(--c-text-3);font-size:var(--text-sm);">Gagal memuat status XBRL.</p>';
    } else {
      const grid = createEl('div', { class: 'idx-upload__status-grid' }, []);
      [
        { icon: 'grid', label: 'Diharapkan', value: String(d.expected ?? 0) },
        { icon: 'check', label: 'Sudah ada', value: String(d.present ?? 0) },
        { icon: 'alert-circle', label: 'Belum lengkap', value: String(d.missing_count ?? 0) },
      ].forEach(it => {
        const tile = createEl('div', { class: 'idx-upload__status-item' }, []);
        tile.innerHTML = `
          <div class="idx-upload__status-icon">${icons[it.icon]}</div>
          <div>
            <div class="idx-upload__status-label">${it.label}</div>
            <div class="idx-upload__status-value">${it.value}</div>
          </div>`;
        grid.appendChild(tile);
      });
      body.appendChild(grid);

      // Cari saham belum lengkap
      const search = createEl('input', {
        type: 'text',
        placeholder: 'Cari ticker / perusahaan...',
        value: state.query,
        style: { width: '100%', marginTop: 'var(--s-4)', padding: 'var(--s-2) var(--s-3)' },
      }, []);
      search.addEventListener('input', () => {
        state.query = search.value;
        state.page = 1;
        renderMissingTable();
      });
      body.appendChild(search);

      const tableWrap = createEl('div', { class: 'table-wrap', style: { marginTop: 'var(--s-3)' } }, []);
      const table = createEl('table', { class: 'table' }, []);
      tableWrap.appendChild(table);
      body.appendChild(tableWrap);
      const countLine = createEl('p', { style: { color: 'var(--c-text-3)', fontSize: 'var(--text-sm)', marginTop: 'var(--s-2)' } }, []);
      body.appendChild(countLine);
      const pager = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', alignItems: 'center', marginTop: 'var(--s-3)', flexWrap: 'wrap' } }, []);
      body.appendChild(pager);

      const renderMissingTable = () => {
        const q = (state.query || '').trim().toLowerCase();
        const rows = (d.missing || []).filter(m =>
          !q || m.ticker.toLowerCase().includes(q)
            || (m.company_name || '').toLowerCase().includes(q));
        const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
        if (state.page > totalPages) state.page = totalPages;
        const start = (state.page - 1) * PAGE_SIZE;
        const pageRows = rows.slice(start, start + PAGE_SIZE);
        table.innerHTML = `
          <thead><tr><th>Ticker</th><th>Perusahaan</th><th>Terakhir ada</th></tr></thead>
          <tbody>${pageRows.map(m => `
            <tr><td>${m.ticker}</td><td>${m.company_name || '—'}</td><td>${m.last_seen || '—'}</td></tr>`).join('') || `
            <tr><td colspan="3" style="color:var(--c-text-3);">Tidak ada saham yang cocok.</td></tr>`}
          </tbody>`;
        countLine.textContent = rows.length === 0
          ? 'Tidak ada saham yang cocok.'
          : `Menampilkan ${start + 1}–${Math.min(start + PAGE_SIZE, rows.length)} dari ${rows.length} saham belum lengkap.`;
        // Nomor halaman
        pager.innerHTML = '';
        const mkBtn = (label, page, disabled, primary) => {
          const attrs = { class: `btn btn--sm${primary ? ' btn--primary' : ''}` };
          if (disabled) attrs.disabled = '';
          const b = createEl('button', attrs, [label]);
          if (!disabled) b.addEventListener('click', () => {
            state.page = page;
            renderMissingTable();
          });
          return b;
        };
        pager.appendChild(mkBtn('‹', state.page - 1, state.page <= 1, false));
        for (let p = 1; p <= totalPages; p++) {
          pager.appendChild(mkBtn(String(p), p, false, p === state.page));
        }
        pager.appendChild(mkBtn('›', state.page + 1, state.page >= totalPages, false));
      };
      state._renderMissingTable = renderMissingTable;
      renderMissingTable();
    }
    xbrlCard.appendChild(body);
  }

  // ── Kartu snapshot (KSEI / holders) ──────────────────────────────
  function renderSnapshot(card, title, subtitle, d, rowsLabel) {
    cardHead(card, title, subtitle);
    const body = createEl('div', {}, []);
    if (state.loading) {
      body.innerHTML = loadingBody();
    } else if (!d || !d.latest_snapshot) {
      body.innerHTML = '<p style="color:var(--c-text-3);font-size:var(--text-sm);">Belum ada data.</p>';
    } else {
      body.innerHTML = kvRows([
        ['Terakhir di-update', d.latest_snapshot],
        [rowsLabel, String(d.snapshots ?? 0)],
        ['Baris di snapshot terakhir', String(d.rows_latest ?? 0)],
      ]);
    }
    card.appendChild(body);
  }

  // ── Kartu komoditas ──────────────────────────────────────────────
  function renderCommodity() {
    const d = state.data?.commodity;
    const fx = state.data?.fx;
    cardHead(commodityCard, 'Komoditas & Kurs', 'World Bank + IMF');
    const body = createEl('div', {}, []);
    if (state.loading) {
      body.innerHTML = loadingBody();
    } else if (!d && !fx) {
      body.innerHTML = '<p style="color:var(--c-text-3);font-size:var(--text-sm);">Gagal memuat status komoditas.</p>';
    } else {
      body.innerHTML = kvRows([
        ['Komoditas — World Bank', `${d?.wb_latest_month || '—'} (${d?.wb_rows ?? 0} baris)`],
        ['Komoditas — IMF', `${d?.imf_latest_month || '—'} (${d?.imf_rows ?? 0} baris)`],
        ['Kurs — IMF', `${fx?.latest_month || '—'} (${fx?.rows ?? 0} baris)`],
      ]);
    }
    commodityCard.appendChild(body);
  }

  function renderAll() {
    renderXbrl();
    renderSnapshot(kseiCard, 'KSEI — Kepemilikan Asing', 'Snapshot bulanan',
      state.data?.ksei, 'Jumlah snapshot');
    renderSnapshot(holdersCard, 'Shareholding — Pemegang Saham ≥1%', 'Snapshot bulanan',
      state.data?.holders, 'Jumlah bulan');
    renderCommodity();
  }

  // Init
  load();

  return container;
}
