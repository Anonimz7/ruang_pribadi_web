/* pages/admin/sitemaps.js — Sitemap Management */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';

const SITEMAPS = [
  { index: 0, url: 'https://kompas.com/sitemap.xml', domain: 'kompas', language: 'id' },
  { index: 1, url: 'https://detik.com/sitemap-index.xml', domain: 'detik', language: 'id' },
  { index: 2, url: 'https://cnnindonesia.com/sitemap.xml', domain: 'cnnindonesia', language: 'id' },
];

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['Sitemaps']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Manage news source sitemaps.']));

  const form = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-5)' } });
  form.innerHTML = `
    <div class="card__head"><div class="card__title">Add Sitemap</div></div>
    <div style="display:flex;gap:var(--s-3);flex-wrap:wrap;align-items:flex-end;">
      <div class="field" style="flex:1;min-width:260px;">
        <label class="field__label">Sitemap URL</label>
        <input type="url" class="field__input" placeholder="https://example.com/sitemap.xml">
      </div>
      <div class="field" style="width:140px;">
        <label class="field__label">Language</label>
        <select class="field__select"><option>id</option><option>en</option></select>
      </div>
      <button class="btn btn--primary">${icons['plus']} Add</button>
    </div>
  `;
  container.appendChild(form);

  const wrap = createEl('div', { class: 'table-wrap' });
  const table = createEl('table', { class: 'table' });
  table.innerHTML = `
    <thead><tr><th>#</th><th>Domain</th><th>URL</th><th>Lang</th><th></th></tr></thead>
    <tbody>
      ${SITEMAPS.map(s => `
        <tr>
          <td>${s.index}</td>
          <td><span class="badge badge--neutral">${s.domain}</span></td>
          <td style="font-size:var(--text-sm);color:var(--c-text-2);font-family:var(--font-mono);">${s.url}</td>
          <td><span class="badge badge--primary">${s.language}</span></td>
          <td class="table__actions">
            <button class="btn btn--ghost btn--sm" style="color:var(--c-danger);">${icons['trash']}</button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  `;
  wrap.appendChild(table);
  container.appendChild(wrap);

  return container;
}
