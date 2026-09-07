/* pages/admin/sitemaps.js — Sitemap Management (Flutter parity) */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { createModal } from '../../ui/modal.js';

const LANGS = [
  { code: 'id', label: '🇮🇩 Indonesia' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'ja', label: '🇯🇵 Japanese' },
];

function langFlag(code) {
  return (LANGS.find(l => l.code === code) || LANGS[1]).label.split(' ')[0];
}

export function render() {
  const state = {
    sitemaps: [],
    langMap: {},
    loading: true,
    newUrl: '',
    newLang: 'en',
  };

  const container = createEl('div', { class: 'admin-sitemaps' }, []);

  // Header + count + add
  const header = createEl('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--s-3)', marginBottom: 'var(--s-5)', flexWrap: 'wrap' } });
  const title = createEl('h1', { style: { margin: 0 } }, ['Sitemaps']);
  const countBadge = createEl('span', { class: 'badge badge--neutral' }, []);
  const addBtn = createEl('button', { class: 'btn btn--accent', style: { marginLeft: 'auto' } }, []);
  addBtn.innerHTML = `${icons['plus']} Tambah`;
  addBtn.addEventListener('click', openAddModal);
  header.append(title, countBadge, addBtn);
  container.appendChild(header);

  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Kelola sumber sitemap berita.']));

  // Table
  const tableWrap = createEl('div', { class: 'table-wrap' });
  container.appendChild(tableWrap);

  async function loadSitemaps() {
    state.loading = true;
    renderLoading();

    try {
      const data = await Api.get('/sitemaps');
      state.sitemaps = Array.isArray(data) ? data : [];
      const langData = await Api.get('/sitemaps/languages');
      state.langMap = langData || {};
    } catch (e) {
      state.sitemaps = [];
      toast('Gagal memuat sitemaps: ' + (e.message || e), { type: 'error' });
    }

    state.loading = false;
    countBadge.textContent = `${state.sitemaps.length} sitemap`;
    renderTable();
  }

  function renderLoading() {
    tableWrap.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const row = createEl('div', { class: 'skeleton', style: { height: '48px', borderRadius: '6px', marginBottom: '8px' } });
      tableWrap.appendChild(row);
    }
  }

  function renderTable() {
    tableWrap.innerHTML = '';

    if (state.sitemaps.length === 0) {
      const empty = createEl('div', { class: 'admin-sitemaps__empty' }, []);
      empty.innerHTML = `
        <div class="admin-sitemaps__empty-icon">${icons['link']}</div>
        <p style="color:var(--c-text-2);font-size:var(--text-sm);margin:0;">Belum ada sitemap.</p>
      `;
      tableWrap.appendChild(empty);
      return;
    }

    const table = createEl('table', { class: 'table' });
    table.innerHTML = `
      <thead><tr>
        <th>Domain</th><th>URL</th><th>Bahasa</th><th></th>
      </tr></thead>
    `;
    const tbody = createEl('tbody');
    state.sitemaps.forEach(s => tbody.appendChild(buildRow(s)));
    table.appendChild(tbody);
    tableWrap.appendChild(table);
  }

  function buildRow(s) {
    const tr = createEl('tr', {});
    const lang = s.language || state.langMap[s.domain] || 'en';

    // Domain — avatar inisial + nama
    const tdDomain = createEl('td');
    const domainWrap = createEl('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--s-2)' } });
    const avatar = createEl('span', { class: 'admin-sitemaps__avatar' },
      [s.domain ? s.domain[0].toUpperCase() : '?']);
    domainWrap.appendChild(avatar);
    domainWrap.appendChild(createEl('span', { style: { fontWeight: 600, whiteSpace: 'nowrap' } }, [s.domain]));
    tdDomain.appendChild(domainWrap);
    tr.appendChild(tdDomain);

    // URL — mono + ellipsis + title
    const tdUrl = createEl('td');
    tdUrl.appendChild(createEl('div', { class: 'admin-sitemaps__url', title: s.url }, [s.url]));
    tr.appendChild(tdUrl);

    // Language badge — klik untuk ganti (paritas Flutter)
    const tdLang = createEl('td');
    const langBtn = createEl('button', {
      type: 'button',
      class: 'badge badge--primary admin-sitemaps__lang',
      title: 'Klik untuk ubah bahasa',
    }, [`${langFlag(lang)} ${lang}`]);
    langBtn.addEventListener('click', () => openLangModal(s.domain, lang));
    tdLang.appendChild(langBtn);
    tr.appendChild(tdLang);

    // Delete
    const tdActions = createEl('td');
    const actionsWrap = createEl('div', { class: 'table__actions' });
    const delBtn = createEl('button', {
      class: 'btn btn--ghost btn--sm',
      title: 'Hapus',
      style: { color: 'var(--c-danger)' },
    }, []);
    delBtn.innerHTML = icons['trash'];
    delBtn.addEventListener('click', () => openDeleteConfirm(s));
    actionsWrap.appendChild(delBtn);
    tdActions.appendChild(actionsWrap);
    tr.appendChild(tdActions);

    return tr;
  }

  // ── Add modal (paritas Flutter: dialog + bahasa id/en/ja) ──
  function openAddModal() {
    const form = createEl('form', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
    form.innerHTML = `
      <div class="field">
        <label class="field__label">Sitemap URL</label>
        <input type="url" class="field__input" name="url" placeholder="https://example.com/sitemap.xml" required>
      </div>
      <div class="field">
        <label class="field__label">Bahasa</label>
        <select class="field__select" name="lang">
          ${LANGS.map(l => `<option value="${l.code}" ${l.code === state.newLang ? 'selected' : ''}>${l.label}</option>`).join('')}
        </select>
      </div>
      <div class="field field--inline" style="justify-content:flex-end;margin-top:var(--s-2);">
        <button type="button" class="btn btn--secondary" id="cancel">Batal</button>
        <button type="submit" class="btn btn--primary">${icons['plus']} Tambah</button>
      </div>
    `;

    const modal = createModal({ title: 'Tambah Sitemap', content: form, width: '420px' });
    form.querySelector('#cancel').addEventListener('click', () => modal.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const url = fd.get('url').trim();
      if (!url) { toast('Masukkan URL sitemap', { type: 'error' }); return; }
      try {
        await Api.post('/sitemaps', { url, language: fd.get('lang') });
        toast('Sitemap ditambahkan', { type: 'success' });
        modal.close();
        loadSitemaps();
      } catch (err) {
        toast('Gagal menambahkan: ' + (err.message || err), { type: 'error' });
      }
    });
  }

  // ── Edit language modal (paritas Flutter) ──
  function openLangModal(domain, currentLang) {
    const content = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
    content.appendChild(createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } },
      [`Bahasa untuk domain <b>${domain}</b>`]));

    const select = createEl('select', { class: 'field__select' });
    LANGS.forEach(l => {
      const opt = createEl('option', { value: l.code }, [l.label]);
      if (l.code === currentLang) opt.selected = true;
      select.appendChild(opt);
    });
    content.appendChild(select);

    const footer = createEl('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)', marginTop: 'var(--s-2)' } });
    const modal = createModal({ title: 'Ubah Bahasa', content, width: '360px' });

    const cancelBtn = createEl('button', { class: 'btn btn--secondary', type: 'button' }, ['Batal']);
    cancelBtn.addEventListener('click', () => modal.close());

    const saveBtn = createEl('button', { class: 'btn btn--primary', type: 'button' }, ['Simpan']);
    saveBtn.addEventListener('click', async () => {
      try {
        const newMapping = { ...state.langMap, [domain]: select.value };
        await Api.put('/sitemaps/languages', newMapping);
        toast('Bahasa diperbarui', { type: 'success' });
        modal.close();
        loadSitemaps();
      } catch (e) {
        toast('Gagal simpan bahasa: ' + (e.message || e), { type: 'error' });
      }
    });

    footer.append(cancelBtn, saveBtn);
    content.appendChild(footer);
  }

  // ── Delete confirm (modal) ──
  function openDeleteConfirm(s) {
    const content = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
    content.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', fontSize: 'var(--text-sm)' } },
      [`Hapus sitemap dari "${s.domain}"?`]));

    const footer = createEl('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)', marginTop: 'var(--s-2)' } });
    const modal = createModal({ title: 'Hapus Sitemap', content, width: '380px' });

    const cancelBtn = createEl('button', { class: 'btn btn--secondary' }, ['Batal']);
    cancelBtn.addEventListener('click', () => modal.close());

    const delBtn = createEl('button', { class: 'btn btn--danger' }, ['Hapus']);
    delBtn.addEventListener('click', async () => {
      try {
        await Api.delete(`/sitemaps/${s.index}`);
        toast('Sitemap dihapus', { type: 'success' });
        modal.close();
        loadSitemaps();
      } catch (e) {
        toast('Gagal menghapus: ' + (e.message || e), { type: 'error' });
      }
    });

    footer.append(cancelBtn, delBtn);
    content.appendChild(footer);
  }

  container._cleanup = () => {};

  // Init
  loadSitemaps();

  return container;
}