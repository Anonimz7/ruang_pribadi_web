/* pages/bahasa.js — Language / Kamus */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';

const DOCS = [
  { id: 1, string_lang: 'id-jp', judul: 'Selamat Pagi — Ohayou Gozaimasu', lang_source: 'Indonesia → Jepang' },
  { id: 2, string_lang: 'id-jp', judul: 'Terima Kasih — Arigatou Gozaimasu', lang_source: 'Indonesia → Jepang' },
  { id: 3, string_lang: 'id-en', judul: 'Selamat Pagi — Good Morning', lang_source: 'Indonesia → Inggris' },
  { id: 4, string_lang: 'id-en', judul: 'Terima Kasih — Thank You', lang_source: 'Indonesia → Inggris' },
  { id: 5, string_lang: 'id-jp', judul: 'Maaf — Gomennasai', lang_source: 'Indonesia → Jepang' },
];

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['Language']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Kamus pasangan kata.']));

  // Search + Filter
  const toolbar = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', marginBottom: 'var(--s-4)', flexWrap: 'wrap' } });
  toolbar.innerHTML = `
    <div class="search" style="flex:1;min-width:240px;">
      <span class="search__icon">${icons['search']}</span>
      <input type="text" class="search__input" placeholder="Cari kata...">
    </div>
    <select class="field__select" style="width:160px;">
      <option>Semua Bahasa</option>
      <option>Indonesia → Jepang</option>
      <option>Indonesia → Inggris</option>
    </select>
    <button class="btn btn--primary">${icons['plus']} Tambah</button>
  `;
  container.appendChild(toolbar);

  // Table
  const tableWrap = createEl('div', { class: 'table-wrap' });
  const table = createEl('table', { class: 'table' });
  table.innerHTML = `
    <thead><tr>
      <th>ID</th><th>Judul</th><th>Bahasa</th><th>Sumber</th><th></th>
    </tr></thead>
    <tbody>
      ${DOCS.map(d => `
        <tr>
          <td>#${d.id}</td>
          <td style="font-weight:500;">${d.judul}</td>
          <td><span class="badge badge--primary">${d.string_lang}</span></td>
          <td style="color:var(--c-text-2);font-size:var(--text-sm);">${d.lang_source}</td>
          <td class="table__actions">
            <button class="btn btn--ghost btn--sm">${icons['edit']}</button>
            <button class="btn btn--ghost btn--sm" style="color:var(--c-danger);">${icons['trash']}</button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  `;
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);

  return container;
}
