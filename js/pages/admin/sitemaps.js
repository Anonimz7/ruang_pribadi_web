/* pages/admin/sitemaps.js — Sitemap Management with API */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api, { ApiError } from '../../core/api.js';
import { toast } from '../../ui/toast.js';

export function render() {
  const state = {
    sitemaps: [],
    langMap: {},
    loading: true,
    newUrl: '',
    newLang: 'id',
  };

  const container = createEl('div', { class: 'admin-sitemaps' }, []);

  container.appendChild(createEl('h1', {}, ['Sitemaps']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Manage news source sitemaps.']));

  // Add form
  const formCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-5)' } });
  container.appendChild(formCard);

  // Table
  const tableWrap = createEl('div', { class: 'table-wrap' });
  container.appendChild(tableWrap);

  function renderForm() {
    formCard.innerHTML = '';
    formCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    formCard.querySelector('.card__head').innerHTML = '<div class="card__title">Add Sitemap</div>';

    const body = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap', alignItems: 'flex-end' } });
    body.innerHTML = `
      <div class="field" style="flex:1;min-width:260px;">
        <label class="field__label">Sitemap URL</label>
        <input type="url" class="field__input" id="sitemap-url" placeholder="https://example.com/sitemap.xml" value="${state.newUrl}">
      </div>
      <div class="field" style="width:140px;">
        <label class="field__label">Language</label>
        <select class="field__select" id="sitemap-lang">
          <option value="id" ${state.newLang === 'id' ? 'selected' : ''}>id</option>
          <option value="en" ${state.newLang === 'en' ? 'selected' : ''}>en</option>
        </select>
      </div>
      <button class="btn btn--primary" id="add-sitemap">${icons['plus']} Add</button>
    `;
    formCard.appendChild(body);

    body.querySelector('#sitemap-url').addEventListener('input', (e) => { state.newUrl = e.target.value; });
    body.querySelector('#sitemap-lang').addEventListener('change', (e) => { state.newLang = e.target.value; });
    body.querySelector('#add-sitemap').addEventListener('click', addSitemap);
  }

  async function addSitemap() {
    if (!state.newUrl.trim()) {
      toast('Masukkan URL sitemap', { type: 'error' });
      return;
    }
    try {
      await Api.post('/sitemaps', { url: state.newUrl.trim(), language: state.newLang });
      toast('Sitemap berhasil ditambahkan', { type: 'success' });
      state.newUrl = '';
      state.newLang = 'id';
      renderForm();
      loadSitemaps();
    } catch (e) {
      toast('Gagal menambahkan: ' + (e.message || e), { type: 'error' });
    }
  }

  async function loadSitemaps() {
    state.loading = true;
    renderLoading();

    try {
      const data = await Api.get('/sitemaps');
      state.sitemaps = Array.isArray(data) ? data : [];
      // Also load language mapping
      const langData = await Api.get('/sitemaps/languages');
      state.langMap = langData || {};
    } catch (e) {
      state.sitemaps = [];
      toast('Gagal memuat sitemaps: ' + (e.message || e), { type: 'error' });
    }

    state.loading = false;
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
      tableWrap.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--s-6);">
          <div style="font-size:48px;margin-bottom:var(--s-4);opacity:0.3;">${icons['link']}</div>
          <p style="color:var(--c-text-2);">Belum ada sitemap.</p>
        </div>
      `;
      return;
    }

    const table = createEl('table', { class: 'table' });
    table.innerHTML = `
      <thead><tr><th>#</th><th>Domain</th><th>URL</th><th>Lang</th><th></th></tr></thead>
      <tbody>
        ${state.sitemaps.map((s, i) => `
          <tr>
            <td>${s.index}</td>
            <td><span class="badge badge--neutral">${s.domain}</span></td>
            <td style="font-size:var(--text-sm);color:var(--c-text-2);font-family:var(--font-mono);">${s.url}</td>
            <td><span class="badge badge--primary">${s.language || state.langMap[s.domain] || 'en'}</span></td>
            <td class="table__actions">
              <button class="btn btn--ghost btn--sm" title="Delete" onclick="window.sitemapDelete(${s.index})" style="color:var(--c-danger);">${icons['trash']}</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    tableWrap.appendChild(table);
  }

  window.sitemapDelete = async (index) => {
    try {
      await Api.delete(`/sitemaps/${index}`);
      toast('Sitemap berhasil dihapus', { type: 'success' });
      loadSitemaps();
    } catch (e) {
      toast('Gagal menghapus: ' + (e.message || e), { type: 'error' });
    }
  };

  container._cleanup = () => {
    delete window.sitemapDelete;
  };

  // Init
  renderForm();
  loadSitemaps();

  return container;
}
