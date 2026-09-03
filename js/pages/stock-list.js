/* pages/stock-list.js — Stock List with filters */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';

const ALL_STOCKS = Array.from({ length: 12 }, (_, i) => ({
  ticker: ['BBCA', 'BBRI', 'TLKM', 'ASII', 'UNVR', 'BMRI', 'BBNI', 'PGAS', 'INDF', 'KLBF', 'EXCL', 'PTBA'][i],
  name: ['Bank Central Asia', 'Bank Rakyat Indonesia', 'Telkom Indonesia', 'Astra International', 'Unilever Indonesia', 'Bank Mandiri', 'Bank Negara Indonesia', 'Perusahaan Gas Negara', 'Indofood', 'Kalbe Farma', 'XL Axiata', 'Bukit Asam'][i],
  sector: ['Finance', 'Finance', 'Infrastructure', 'Consumer', 'Consumer', 'Finance', 'Finance', 'Energy', 'Consumer', 'Healthcare', 'Infrastructure', 'Energy'][i],
  price: [8925, 4670, 3810, 5125, 3420, 6125, 4520, 1420, 7825, 1240, 2140, 2680][i],
  change: [1.25, -0.85, 0.42, 2.10, -1.20, 0.95, -0.30, 3.45, 1.80, -0.55, 0.20, -2.10][i],
}));

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['Stock List']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Browse all IDX stocks with advanced filters.']));

  // Filters — mobile stack
  const filters = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-5)' } });
  filters.innerHTML = `
    <div style="display:flex;gap:var(--s-3);flex-wrap:wrap;align-items:flex-end;">
      <div class="search" style="flex:1;min-width:200px;">
        <span class="search__icon">${icons['search']}</span>
        <input type="text" class="search__input" placeholder="Search ticker or name...">
      </div>
      <div class="field" style="width:140px;min-width:140px;">
        <label class="field__label">Sector</label>
        <select class="field__select"><option>All</option><option>Finance</option><option>Consumer</option><option>Energy</option><option>Infrastructure</option><option>Healthcare</option></select>
      </div>
      <div class="field" style="width:140px;min-width:140px;">
        <label class="field__label">Primary</label>
        <select class="field__select"><option>All</option></select>
      </div>
      <div class="field" style="width:140px;min-width:140px;">
        <label class="field__label">Sub Sector</label>
        <select class="field__select"><option>All</option></select>
      </div>
      <button class="btn btn--primary">${icons['search']} Filter</button>
    </div>
  `;
  container.appendChild(filters);

  // Table
  const tableWrap = createEl('div', { class: 'table-wrap' });
  const table = createEl('table', { class: 'table' });
  table.innerHTML = `
    <thead><tr>
      <th>Ticker</th><th>Name</th><th>Sector</th><th>Price</th><th>Change %</th><th></th>
    </tr></thead>
    <tbody>
      ${ALL_STOCKS.map(s => `
        <tr>
          <td><span class="badge badge--primary">${s.ticker}</span></td>
          <td style="font-weight:500;">${s.name}</td>
          <td><span class="badge badge--neutral">${s.sector}</span></td>
          <td style="font-family:var(--font-mono);font-weight:600;">${s.price.toLocaleString()}</td>
          <td style="color:${s.change >= 0 ? 'var(--c-accent)' : 'var(--c-danger)'};font-weight:500;">${s.change >= 0 ? '+' : ''}${s.change}%</td>
          <td class="table__actions">
            <button class="btn btn--ghost btn--sm">${icons['eye']}</button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  `;
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);

  // Pagination
  const pag = createEl('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--s-4)', flexWrap: 'wrap', gap: 'var(--s-3)' } });
  pag.innerHTML = `
    <span style="font-size:var(--text-sm);color:var(--c-text-3);">Showing 1–12 of 890 stocks</span>
    <div style="display:flex;gap:var(--s-2);">
      <button class="btn btn--ghost btn--sm">Prev</button>
      <button class="btn btn--primary btn--sm">1</button>
      <button class="btn btn--ghost btn--sm">2</button>
      <button class="btn btn--ghost btn--sm">3</button>
      <button class="btn btn--ghost btn--sm">Next</button>
    </div>
  `;
  container.appendChild(pag);

  return container;
}
