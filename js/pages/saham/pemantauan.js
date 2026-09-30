/* pages/pemantauan.js — Pemantauan: daftar saham yang sedang BER-FLAG
 * (merah / oranye) dari snapshot remarks TERBARU — bukan kejadian historis.
 *
 * - Urutan default: flag terbaru -> terlama, dengan pemisah tanggal antar grup.
 * - Kartu ringkasan (Merah / Oranye / Flag terbaru / Bersih) berfungsi juga
 *   sebagai filter cepat.
 * - Baris bisa di-expand di tempat untuk melihat seluruh flag + tombol
 *   "Buka analisis" (tab baru, pola localStorage stocks_initial_ticker).
 */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api from '../../core/api.js';
import { DelistedBadge, StockSectorBadge } from '../../ui/stock-widgets.js';

/** Escape teks dari data server sebelum masuk innerHTML. */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu',
  'Sep', 'Okt', 'Nov', 'Des'];

/** 'YYYY-MM-DD' -> '29 Sep 2026' (komponen dibaca manual, tanpa Date/timezone). */
function fmtDate(iso) {
  if (!iso) return '-';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Jarak tanggal flag ke hari ini: 'hari ini' / '3 hari lalu' / '2 bulan lalu'. */
function relLabel(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const then = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today - then) / 86400000);
  if (days <= 0) return 'hari ini';
  if (days < 30) return `${days} hari lalu`;
  if (days < 365) return `${Math.floor(days / 30)} bulan lalu`;
  return `${Math.floor(days / 365)} tahun lalu`;
}

export function render() {
  const state = {
    q: '',
    severity: 'flagged', // flagged | danger | warning | clean
    sort: 'recent',      // recent | most | ticker
    page: 1,
    perPage: 20,
    total: 0,
    items: [],
    counts: { danger: 0, warning: 0, flagged: 0, clean: 0 },
    dataDate: null,
    latestFlag: null,
    groups: {}, // jumlah saham per tanggal utk seluruh hasil filter (bukan per halaman)
    expanded: null, // ticker yang sedang dibuka
    error: '',
  };
  let debounce = null;

  const container = createEl('div', {
    class: 'pemantauan-page',
    style: { maxWidth: '1100px', margin: '0 auto', padding: 'var(--s-4)' },
  });

  // ── Header ──────────────────────────────────────────────────────────────
  const header = createEl('div', { class: 'pemantauan-page__header' });
  header.innerHTML = `
    <div>
      <h1>Pemantauan</h1>
      <p>Saham dengan flag dari data terbaru (bukan historis) — merah untuk
         sanksi &amp; kondisi berat, oranye untuk pelanggaran administratif.</p>
    </div>
    <div class="pemantauan-page__meta">
      <span class="pemantauan-page__date" id="pm-date">Memuat…</span>
      <button type="button" class="btn btn--ghost btn--sm" id="pm-refresh"
              title="Muat ulang" aria-label="Muat ulang data pemantauan">${icons['refresh']}</button>
    </div>`;
  container.appendChild(header);

  // ── Kartu ringkasan (juga filter cepat) ─────────────────────────────────
  const summary = createEl('div', { class: 'pemantauan-page__summary' });
  container.appendChild(summary);

  // ── Toolbar: cari + urutkan + jumlah ────────────────────────────────────
  const toolbar = createEl('div', { class: 'pemantauan-page__toolbar' });
  toolbar.innerHTML = `
    <div class="search" id="pm-search-wrap">
      <span class="search__icon">${icons['search']}</span>
      <input type="text" class="search__input" id="pm-search"
             placeholder="Cari ticker / nama perusahaan…" aria-label="Cari saham">
      <button type="button" class="search__clear" id="pm-clear"
              aria-label="Bersihkan pencarian">${icons['x']}</button>
    </div>
    <div class="field" style="width:180px;min-width:180px;">
      <label class="field__label" for="pm-sort">Urutkan</label>
      <select class="field__select" id="pm-sort">
        <option value="recent">Terbaru → terlama</option>
        <option value="most">Terbanyak flag</option>
        <option value="ticker">Ticker A–Z</option>
      </select>
    </div>
    <span class="pemantauan-page__total" id="pm-total"></span>`;
  container.appendChild(toolbar);

  const tableWrap = createEl('div', { class: 'table-wrap' });
  container.appendChild(tableWrap);

  const pagination = createEl('div', { class: 'pemantauan-page__pagination' });
  container.appendChild(pagination);

  // ── Rendering ───────────────────────────────────────────────────────────

  function renderDate() {
    const el = header.querySelector('#pm-date');
    if (el) {
      el.textContent = state.dataDate
        ? `Data per ${fmtDate(state.dataDate)}`
        : 'Data terbaru tidak diketahui';
    }
  }

  function renderSummary() {
    const c = state.counts;
    const cards = [
      { key: 'danger', label: 'Merah', hint: 'sanksi & kondisi berat', value: c.danger, dot: 'danger' },
      { key: 'warning', label: 'Oranye', hint: 'pelanggaran administratif', value: c.warning, dot: 'warn' },
      { key: '__latest__', label: 'Flag terbaru', hint: relLabel(state.latestFlag) || '—', value: fmtDate(state.latestFlag), dot: '' },
      { key: 'clean', label: 'Bersih', hint: 'tanpa flag sama sekali', value: c.clean, dot: 'ok' },
    ];
    summary.innerHTML = cards.map((card) => {
      const clickable = card.key !== '__latest__';
      const active = card.key === state.severity;
      const tag = clickable ? 'button' : 'div';
      const attrs = clickable
        ? `type="button" aria-pressed="${active}" title="Filter: ${esc(card.label)}"`
        : `aria-hidden="false"`;
      return `<${tag} class="pemantauan-page__card${active ? ' pemantauan-page__card--active' : ''}${clickable ? '' : ' pemantauan-page__card--static'}" data-severity="${card.key}" ${attrs}>
        <span class="pemantauan-page__card-label">
          ${card.dot ? `<span class="pemantauan-page__dot pemantauan-page__dot--${card.dot}"></span>` : ''}
          ${esc(card.label)}
        </span>
        <span class="pemantauan-page__card-value">${esc(card.value ?? '-')}</span>
        <span class="pemantauan-page__card-hint">${esc(card.hint)}</span>
      </${tag}>`;
    }).join('');
  }

  function renderTotal() {
    const el = toolbar.querySelector('#pm-total');
    if (!el) return;
    const filter = state.q ? ` untuk “${state.q}”` : '';
    el.textContent = `${state.total} saham${filter}`;
  }

  function flagChips(s, max) {
    const flags = s.flags || [];
    const shown = flags.slice(0, max);
    const rest = flags.length - shown.length;
    const chips = shown.map((f) => (
      `<span class="badge badge--${f.tone === 'danger' ? 'danger' : 'warn'} pemantauan-page__flag"
             title="${esc(f.text)}">${esc(f.text)}</span>`
    )).join('');
    const more = rest > 0
      ? `<span class="pemantauan-page__more">+${rest} lagi</span>`
      : '';
    return chips + more || '<span style="color:var(--c-text-3);">—</span>';
  }

  function detailRowHtml(s, analysisUrl) {
    const flags = s.flags || [];
    const list = flags.length
      ? `<ul class="pemantauan-page__flaglist">${flags.map((f) => `
          <li>
            <span class="badge badge--${f.tone === 'danger' ? 'danger' : 'warn'}">${esc(f.text)}</span>
            <span class="pemantauan-page__tone">${f.tone === 'danger' ? 'Sanksi & kondisi berat' : 'Pelanggaran administratif'}</span>
          </li>`).join('')}</ul>`
      : '<p class="pemantauan-page__tone">Tidak ada flag — saham bersih.</p>';

    return `<tr class="pemantauan-page__detail"><td colspan="4">
      <div class="pemantauan-page__detail-head">
        <span><strong>${esc(s.ticker)}</strong> — ${esc(s.company_name)}
          · ${esc(s.primary_sector || s.sector || '-')}${s.sub_sector ? ` / ${esc(s.sub_sector)}` : ''}</span>
        <span class="pemantauan-page__tone">
          ${s.danger_count} merah · ${s.warning_count} oranye ·
          melekat sejak ${fmtDate(s.flag_since)} (${relLabel(s.flag_since)})
        </span>
      </div>
      ${list}
      <div class="pemantauan-page__detail-actions">
        <a class="btn btn--sm" href="${analysisUrl}" target="_blank" rel="noopener"
           onclick="localStorage.setItem('stocks_initial_ticker','${esc(s.ticker)}')">Buka analisis</a>
        <span class="pemantauan-page__tone">Riwayat perubahan flag ada di kartu saham
          (IDX Stocks → bagian Remarks).</span>
      </div>
    </td></tr>`;
  }

  function renderTable() {
    tableWrap.innerHTML = '';

    if (state.error) {
      const box = createEl('div', {
        class: 'empty',
        style: { padding: 'var(--s-5)', textAlign: 'center', color: 'var(--c-danger)' },
      });
      box.appendChild(createEl('p', {}, [`Gagal memuat: ${state.error}`]));
      const retry = createEl('button', { class: 'btn btn--ghost btn--sm', type: 'button' }, ['Coba lagi']);
      retry.addEventListener('click', () => load());
      box.appendChild(retry);
      tableWrap.appendChild(box);
      return;
    }

    if (state.total === 0) {
      const allClean = !state.q && state.severity === 'flagged' && state.counts.flagged === 0;
      const box = createEl('div', {
        class: 'empty-state',
        style: { textAlign: 'center', padding: 'var(--s-6)' },
      });
      const icon = createEl('div', { style: { fontSize: '48px', marginBottom: 'var(--s-4)', opacity: '0.3' } });
      icon.innerHTML = icons['shield'];
      box.appendChild(icon);
      box.appendChild(createEl('p', { style: { color: 'var(--c-text-2)' } }, [
        allClean
          ? '🎉 Tidak ada saham ter-flag — semua bersih.'
          : 'Tidak ada saham yang cocok dengan filter/pencarian ini.',
      ]));
      tableWrap.appendChild(box);
      return;
    }

    // Pemisah tanggal hanya berguna saat urutan "terbaru → terlama".
    // `state.groups` berisi jumlah per tanggal atas SELURUH hasil filter, jadi
    // grup yang melewati batas halaman tetap menampilkan angka sebenarnya;
    // Map cadangan (hitungan dalam halaman ini) dipakai bila server lama.
    const pageGroups = new Map();
    if (state.sort === 'recent') {
      state.items.forEach((s) => {
        const key = s.flag_since || '';
        pageGroups.set(key, (pageGroups.get(key) || 0) + 1);
      });
    }
    const groupCount = (key) => state.groups[key] ?? pageGroups.get(key) ?? 0;

    // URL lengkap (path + query sekarang) supaya tautan "tab baru" memuat ulang
    // app di rute yang sama — konsisten dengan Stock List.
    const analysisUrl = `${location.pathname}${location.search}#/saham/stocks`;

    const rows = [];
    let lastGroup = null;
    state.items.forEach((s) => {
      const group = state.sort === 'recent' ? (s.flag_since || '') : null;
      if (group && group !== lastGroup) {
        lastGroup = group;
        rows.push(`<tr class="pemantauan-page__group">
          <td colspan="4">${esc(fmtDate(group))} · ${groupCount(group)} saham
            <span class="pemantauan-page__tone">(${esc(relLabel(group))})</span></td>
        </tr>`);
      }

      const delisted = s.label_delisted === 1;
      const badge = DelistedBadge({
        labelDelisted: s.label_delisted,
        stockStatus: s.stock_status,
        statusReason: s.status_reason,
        small: true,
        nowrap: true,
      });
      const statusHtml = badge ? badge.outerHTML : '';
      const sectorBadge = StockSectorBadge(s.sector, true);
      const eyeTitle = delisted ? 'Saham telah delisted' : `Analisis ${s.ticker} (buka di tab baru)`;
      const open = state.expanded === s.ticker;

      rows.push(`
        <tr class="pemantauan-page__row" data-ticker="${esc(s.ticker)}">
          <td>
            ${delisted
              ? `<span class="pemantauan-page__ticker pemantauan-page__ticker--delisted">${esc(s.ticker)}</span>`
              : `<a href="${analysisUrl}" target="_blank" rel="noopener" class="pemantauan-page__ticker"
                   title="Analisis ${esc(s.ticker)} (buka di tab baru)"
                   onclick="localStorage.setItem('stocks_initial_ticker','${esc(s.ticker)}')">${esc(s.ticker)}</a>`}
            <div class="pemantauan-page__name">${esc(s.company_name)}
              ${sectorBadge ? sectorBadge.outerHTML : ''}
              ${statusHtml ? ` ${statusHtml}` : ''}</div>
          </td>
          <td class="pemantauan-page__flags">${flagChips(s, 3)}</td>
          <td class="pemantauan-page__since">${esc(fmtDate(s.flag_since))}
            <span>${esc(relLabel(s.flag_since))}</span></td>
          <td><div class="table__actions">
            <button type="button" class="btn btn--ghost btn--sm pemantauan-page__expand"
                    data-expand="${esc(s.ticker)}" aria-expanded="${open}"
                    aria-label="${open ? 'Tutup' : 'Buka'} detail ${esc(s.ticker)}"
                    title="${open ? 'Tutup detail' : 'Lihat semua flag'}">${icons['chevron-down']}</button>
            ${delisted
              ? `<button class="btn btn--ghost btn--sm" disabled title="${eyeTitle}" aria-label="${eyeTitle}">${icons['eye']}</button>`
              : `<a class="btn btn--ghost btn--sm" href="${analysisUrl}" target="_blank" rel="noopener"
                   title="${eyeTitle}" aria-label="${eyeTitle}"
                   onclick="localStorage.setItem('stocks_initial_ticker','${esc(s.ticker)}')">${icons['eye']}</a>`}
          </div></td>
        </tr>`);

      if (open) rows.push(detailRowHtml(s, analysisUrl));
    });

    const table = createEl('table', { class: 'table pemantauan-page__table' });
    table.innerHTML = `
      <thead><tr>
        <th>Saham</th><th>Flag</th><th>Sejak</th><th></th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>`;
    tableWrap.appendChild(table);

    // Klik baris (atau tombol ⌄) → expand/tutup detail di tempat.
    // Tautan & tombol aksi di dalam baris punya perilakunya sendiri.
    table.addEventListener('click', (e) => {
      const exp = e.target.closest('.pemantauan-page__expand');
      if (exp) { toggleExpand(exp.dataset.expand); return; }
      if (e.target.closest('a, .table__actions, button')) return;
      const tr = e.target.closest('tr.pemantauan-page__row');
      if (tr) toggleExpand(tr.dataset.ticker);
    });
  }

  function toggleExpand(ticker) {
    state.expanded = state.expanded === ticker ? null : ticker;
    renderTable();
    // Pertahankan fokus keyboard pada baris yang sama setelah render ulang.
    const btn = tableWrap.querySelector(`[data-expand="${ticker}"]`);
    if (btn) btn.focus();
  }

  function renderPagination() {
    const totalPages = Math.ceil(state.total / state.perPage);
    if (state.total === 0) { pagination.innerHTML = ''; return; }

    const first = (state.page - 1) * state.perPage + 1;
    const last = Math.min(state.page * state.perPage, state.total);
    pagination.innerHTML = `
      <span style="font-size:var(--text-sm);color:var(--c-text-3);">
        Menampilkan ${first}–${last} dari ${state.total} saham
      </span>
      <div style="display:flex;gap:var(--s-2);align-items:center;">
        <button type="button" class="btn btn--ghost btn--sm" ${state.page <= 1 ? 'disabled' : ''}
                onclick="window.pemantauanPrev()">Prev</button>
        <span class="pemantauan-page__page-indicator"
              aria-label="Halaman ${state.page} dari ${totalPages}">${state.page} / ${totalPages}</span>
        <button type="button" class="btn btn--ghost btn--sm" ${state.page >= totalPages ? 'disabled' : ''}
                onclick="window.pemantauanNext()">Next</button>
      </div>`;
  }

  // ── Data ────────────────────────────────────────────────────────────────

  async function load() {
    tableWrap.innerHTML = '<div class="skeleton" style="height:240px;width:100%;border-radius:6px;"></div>';
    pagination.innerHTML = '';
    try {
      const data = await Api.get('/idx/monitoring', {
        q: state.q,
        severity: state.severity,
        sort: state.sort,
        limit: state.perPage,
        offset: (state.page - 1) * state.perPage,
      });
      state.items = data.items || [];
      state.total = data.total || 0;
      state.counts = data.counts || state.counts;
      state.dataDate = data.data_date || null;
      state.latestFlag = data.latest_flag || null;
      state.groups = data.groups || {};
      state.error = '';
    } catch (e) {
      state.items = [];
      state.total = 0;
      state.error = e.message || String(e);
    }
    renderDate();
    renderSummary();
    renderTotal();
    renderTable();
    renderPagination();
  }

  function setFilter(severity) {
    // Klik kartu yang sama → kembali ke tampilan semua yang ter-flag.
    state.severity = state.severity === severity ? 'flagged' : severity;
    state.page = 1;
    state.expanded = null;
    load();
  }

  // ── Events ──────────────────────────────────────────────────────────────

  summary.addEventListener('click', (e) => {
    const card = e.target.closest('[data-severity]');
    if (!card || card.dataset.severity === '__latest__') return;
    setFilter(card.dataset.severity);
  });

  header.querySelector('#pm-refresh').addEventListener('click', () => load());

  const searchWrap = toolbar.querySelector('#pm-search-wrap');
  const searchInput = toolbar.querySelector('#pm-search');
  const clearBtn = toolbar.querySelector('#pm-clear');

  searchInput.addEventListener('input', (e) => {
    state.q = e.target.value.trim();
    searchWrap.classList.toggle('has-clear', state.q !== '');
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.page = 1;
      state.expanded = null;
      load();
    }, 400);
  });

  clearBtn.addEventListener('click', () => {
    state.q = '';
    searchInput.value = '';
    searchWrap.classList.remove('has-clear');
    state.page = 1;
    state.expanded = null;
    load();
    searchInput.focus();
  });

  toolbar.querySelector('#pm-sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    state.page = 1;
    state.expanded = null;
    load();
  });

  window.pemantauanPrev = () => {
    if (state.page > 1) { state.page--; state.expanded = null; load(); }
  };
  window.pemantauanNext = () => {
    const totalPages = Math.ceil(state.total / state.perPage);
    if (state.page < totalPages) { state.page++; state.expanded = null; load(); }
  };

  container._cleanup = () => {
    delete window.pemantauanPrev;
    delete window.pemantauanNext;
    clearTimeout(debounce);
  };

  // Init
  renderSummary();
  load();

  return container;
}
