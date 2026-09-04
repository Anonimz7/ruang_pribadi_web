/* pages/bahasa.js — Language / Kamus with API integration */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';
import Api, { ApiError } from '../core/api.js';
import { toast } from '../ui/toast.js';
import { createModal } from '../ui/modal.js';

// Language source labels for UI display
const LANG_LABELS = {
  'id-jp': 'Indonesia → Jepang',
  'id-en': 'Indonesia → Inggris',
  'id-es': 'Indonesia → Spanyol',
  'id-fr': 'Indonesia → Prancis',
  'id-de': 'Indonesia → Jerman',
  'id-ar': 'Indonesia → Arab',
  'id-ko': 'Indonesia → Korea',
  'id-th': 'Indonesia → Thai',
  'id-vi': 'Indonesia → Vietnam',
  'id-cn': 'Indonesia → Mandarin',
  'id-jp-en': 'Jepang → Indonesia',
  'en-id': 'Inggris → Indonesia',
};

function langLabel(key) {
  return LANG_LABELS[key] || key;
}

export function render() {
  const state = {
    pairs: [],
    docs: [],
    loading: true,
    searchTerm: '',
    filterLang: '',
    currentPage: 1,
    totalPages: 1,
    perPage: 50,
  };

  const container = createEl('div', { class: 'bahasa-page' }, []);

  // Header
  container.appendChild(createEl('h1', {}, ['Language']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Kamus pasangan kata.']));

  // Toolbar
  const toolbar = createEl('div', {
    style: { display: 'flex', gap: 'var(--s-3)', marginBottom: 'var(--s-5)', flexWrap: 'wrap', alignItems: 'center' }
  });
  toolbar.innerHTML = `
    <div class="search" style="flex:1;min-width:240px;">
      <span class="search__icon">${icons['search']}</span>
      <input type="text" class="search__input" placeholder="Cari kata..." value="">
    </div>
    <select class="field__select" id="lang-filter" style="width:160px;">
      <option value="">Semua Bahasa</option>
    </select>
    <button class="btn btn--primary" id="add-btn">${icons['plus']} Tambah</button>
  `;
  container.appendChild(toolbar);

  // Loading skeleton
  const listContainer = createEl('div', { id: 'bahasa-list' });
  container.appendChild(listContainer);

  // Pagination
  const pagination = createEl('div', {
    style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--s-5)', flexWrap: 'wrap', gap: 'var(--s-3)' }
  });
  container.appendChild(pagination);

  // Wire up toolbar events
  const searchInput = toolbar.querySelector('.search__input');
  const langFilter = toolbar.querySelector('#lang-filter');
  const addBtn = toolbar.querySelector('#add-btn');

  searchInput.addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    state.currentPage = 1;
    renderList();
  });

  langFilter.addEventListener('change', (e) => {
    state.filterLang = e.target.value;
    state.currentPage = 1;
    renderList();
  });

  addBtn.addEventListener('click', () => openAddModal());

  // ---- Functions ----

  async function loadPairs() {
    try {
      const data = await Api.get('/bahasa/pairs');
      state.pairs = data || [];
      // Populate filter dropdown
      langFilter.innerHTML = '<option value="">Semua Bahasa</option>' +
        state.pairs.map(p => `<option value="${p.string_lang}">${langLabel(p.string_lang)}</option>`).join('');
    } catch (e) {
      console.error('[Bahasa] Failed to load pairs:', e);
      state.pairs = [];
    }
  }

  async function loadDocs() {
    state.loading = true;
    renderLoading();
    try {
      const params = { limit: state.perPage, offset: (state.currentPage - 1) * state.perPage };
      if (state.filterLang) params.lang = state.filterLang;
      const data = await Api.get('/bahasa', params);
      state.docs = data || [];
    } catch (e) {
      state.docs = [];
      toast('Gagal memuat kamus: ' + (e.message || e), { type: 'error' });
    } finally {
      state.loading = false;
      renderList();
    }
  }

  function renderLoading() {
    listContainer.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const row = createEl('div', { class: 'skeleton', style: { height: '56px', borderRadius: '6px', marginBottom: '8px' } });
      listContainer.appendChild(row);
    }
  }

  function renderList() {
    if (state.loading) { renderLoading(); return; }

    // Filter by search term locally (API search could be used but keeping simple)
    const filtered = state.docs.filter(d =>
      d.judul.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
      d.string_lang.toLowerCase().includes(state.searchTerm.toLowerCase())
    );

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--s-8);">
          <div style="font-size:48px;margin-bottom:var(--s-4);opacity:0.3;">${icons['globe']}</div>
          <p style="color:var(--c-text-2);">Tidak ada dokumen kamus.</p>
        </div>
      `;
      renderPagination();
      return;
    }

    const table = createEl('table', { class: 'table' });
    table.innerHTML = `
      <thead><tr>
        <th>ID</th><th>Judul</th><th>Bahasa</th><th>Entri</th><th></th>
      </tr></thead>
      <tbody>
        ${filtered.map(d => `
          <tr>
            <td>#${d.id}</td>
            <td style="font-weight:500;">${d.judul}</td>
            <td><span class="badge badge--primary">${d.string_lang}</span></td>
            <td style="color:var(--c-text-3);font-size:var(--text-sm);">${d.jumlah_entri} entri</td>
            <td class="table__actions">
              <button class="btn btn--ghost btn--sm" title="Lihat Detail" data-action="view" data-id="${d.id}">${icons['eye']}</button>
              <button class="btn btn--ghost btn--sm" title="Edit" data-action="edit" data-id="${d.id}" style="color:var(--c-primary);">${icons['edit']}</button>
              <button class="btn btn--ghost btn--sm" title="Hapus" data-action="delete" data-id="${d.id}" style="color:var(--c-danger);">${icons['trash']}</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    listContainer.innerHTML = '';
    listContainer.appendChild(table);

    // Wire up row action buttons (event delegation)
    table.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = parseInt(btn.dataset.id);
      const action = btn.dataset.action;
      if (action === 'view') viewDoc(id);
      else if (action === 'edit') openEditModal(id);
      else if (action === 'delete') confirmDelete(id);
    });

    renderPagination();
  }

  function renderPagination() {
    pagination.innerHTML = `
      <span style="font-size:var(--text-sm);color:var(--c-text-3);">
        ${state.docs.length} dokumen
      </span>
      <div style="display:flex;gap:var(--s-2);">
        <button class="btn btn--ghost btn--sm" ${state.currentPage <= 1 ? 'disabled' : ''} onclick="window.bahasaPrev()">Prev</button>
        <button class="btn btn--primary btn--sm">${state.currentPage}</button>
        <button class="btn btn--ghost btn--sm" ${state.docs.length < state.perPage ? 'disabled' : ''} onclick="window.bahasaNext()">Next</button>
      </div>
    `;
  }

  // Expose navigation for inline onclick handlers
  window.bahasaPrev = () => {
    if (state.currentPage > 1) { state.currentPage--; loadDocs(); }
  };
  window.bahasaNext = () => {
    state.currentPage++; loadDocs();
  };

  async function viewDoc(id) {
    try {
      const doc = await Api.get(`/bahasa/${id}`);
      if (!doc) { toast('Dokumen tidak ditemukan', { type: 'error' }); return; }
      const content = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
      content.innerHTML = `
        <div>
          <strong>${doc.judul}</strong>
          <span class="badge badge--neutral" style="marginLeft:8px;">${doc.string_lang}</span>
        </div>
        <div style="maxHeight:400px;overflow:auto;fontSize:var(--text-sm);">
          ${doc.entries.map(e => `<div style="display:flex;gap:var(--s-3);padding:4px 0;borderBottom:1px solid var(--c-border);"><span style="fontWeight:500;minWidth:120px;">${e.a}</span><span>:</span><span style="flex:1;">${e.b}</span></div>`).join('')}
        </div>
      `;
      createModal({ title: 'Detail Dokumen', content, width: '480px' });
    } catch (e) {
      toast('Gagal memuat dokumen: ' + (e.message || e), { type: 'error' });
    }
  }

  async function openAddModal(id = null) {
    const isEdit = id !== null;
    let doc = null;
    if (isEdit) {
      try {
        doc = await Api.get(`/bahasa/${id}`);
      } catch (e) {
        toast('Gagal memuat dokumen', { type: 'error' });
        return;
      }
    }

    const form = createEl('form', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
    form.innerHTML = `
      <div class="field">
        <label class="field__label">Judul</label>
        <input type="text" name="judul" class="field__input" value="${doc?.judul || ''}" required>
      </div>
      <div class="field">
        <label class="field__label">Pasangan Bahasa (string_lang)</label>
        <select name="string_lang" class="field__select">
          ${state.pairs.length > 0
            ? `<option value="">Pilih pasangan bahasa</option>` +
              state.pairs.map(p => `<option value="${p.string_lang}" ${doc?.string_lang === p.string_lang ? 'selected' : ''}>${langLabel(p.string_lang)}</option>`).join('')
            : '<option value="id-jp">id-jp</option><option value="id-en">id-en</option>'
          }
        </select>
      </div>
      <div class="field">
        <label class="field__label">Entri Kamus (JSON)</label>
        <textarea name="lang_source" class="field__input" rows="6" placeholder='[{"a":"selamat pagi","b":"おはようございます"}]' style="font-family:var(--font-mono);font-size:var(--text-sm);">${doc?.lang_source || ''}</textarea>
        <div class="field__hint">Format: JSON array of {"a":"kata","b":"terjemahan"}</div>
      </div>
      <div class="field field--inline" style="justifyContent:space-between;">
        <button type="button" class="btn btn--ghost" id="cancel-btn">Batal</button>
        <button type="submit" class="btn btn--primary">${icons['plus']} ${isEdit ? 'Update' : 'Buat'}</button>
      </div>
    `;

    const modal = createModal({ title: isEdit ? 'Edit Dokumen' : 'Tambah Dokumen', content: form, width: '520px' });

    form.querySelector('#cancel-btn').addEventListener('click', () => modal.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const body = {
        string_lang: fd.get('string_lang') || form.querySelector('[name="string_lang"]').value,
        judul: fd.get('judul').trim(),
        lang_source: fd.get('lang_source').trim(),
      };

      try {
        if (isEdit) {
          await Api.put(`/bahasa/${id}`, body);
          toast('Dokumen berhasil diupdate', { type: 'success' });
        } else {
          await Api.post('/bahasa', body);
          toast('Dokumen berhasil ditambahkan', { type: 'success' });
        }
        modal.close();
        loadDocs();
      } catch (err) {
        toast('Gagal menyimpan: ' + (err.message || err), { type: 'error' });
      }
    });
  }

  async function confirmDelete(id) {
    const modal = createModal({
      title: 'Konfirmasi Hapus',
      content: createEl('p', {}, ['Yakin ingin menghapus dokumen ini?']),
      width: '360px',
    });
    const btnWrap = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', marginTop: 'var(--s-3)' } });
    btnWrap.innerHTML = `
      <button class="btn btn--ghost" id="cancel-del">Batal</button>
      <button class="btn btn--danger" id="confirm-del">${icons['trash']} Hapus</button>
    `;
    modal.body.appendChild(btnWrap);
    modal.body.querySelector('#cancel-del').addEventListener('click', () => modal.close());
    modal.body.querySelector('#confirm-del').addEventListener('click', async () => {
      try {
        await Api.delete(`/bahasa/${id}`);
        toast('Dokumen berhasil dihapus', { type: 'success' });
        modal.close();
        loadDocs();
      } catch (err) {
        toast('Gagal menghapus: ' + (err.message || err), { type: 'error' });
      }
    });
  }

  // Cleanup
  container._cleanup = () => {
    delete window.bahasaPrev;
    delete window.bahasaNext;
  };

  // Init
  async function init() {
    await loadPairs();
    await loadDocs();
  }
  init();

  return container;
}
