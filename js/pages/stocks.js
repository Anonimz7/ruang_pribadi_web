/* pages/stocks.js — IDX Stocks Analysis */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';

const STOCKS = [
  { ticker: 'BBCA', name: 'Bank Central Asia', price: 8925, change: 1.25, vol: '12.5M' },
  { ticker: 'BBRI', name: 'Bank Rakyat Indonesia', price: 4670, change: -0.85, vol: '8.2M' },
  { ticker: 'TLKM', name: 'Telkom Indonesia', price: 3810, change: 0.42, vol: '5.1M' },
  { ticker: 'ASII', name: 'Astra International', price: 5125, change: 2.10, vol: '3.8M' },
  { ticker: 'UNVR', name: 'Unilever Indonesia', price: 3420, change: -1.20, vol: '2.4M' },
];

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['IDX Stocks']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Real-time stock analysis and market overview.']));

  // Market summary cards
  const summary = createEl('div', { class: 'grid grid--4', style: { marginBottom: 'var(--s-5)' } });
  [
    { label: 'IHSG', value: '7,245.30', change: '+1.2%', up: true },
    { label: 'LQ45', value: '945.20', change: '+0.8%', up: true },
    { label: 'Volume', value: '12.5B', change: '+15%', up: true },
    { label: 'Value', value: '8.2T', change: '-2%', up: false },
  ].forEach(s => {
    const card = createEl('div', { class: 'stat-card' });
    card.innerHTML = `
      <div class="stat-card__label">${s.label}</div>
      <div class="stat-card__value">${s.value}</div>
      <div class="stat-card__change stat-card__change--${s.up ? 'up' : 'down'}">
        ${s.up ? '▲' : '▼'} ${s.change}
      </div>
    `;
    summary.appendChild(card);
  });
  container.appendChild(summary);

  // Search + Chart placeholder
  const chartCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-5)' } });
  chartCard.innerHTML = `
    <div class="card__head" style="flex-wrap:wrap;gap:var(--s-3);">
      <div class="search" style="flex:1;min-width:200px;max-width:320px;">
        <span class="search__icon">${icons['search']}</span>
        <input type="text" class="search__input" placeholder="Search ticker (e.g. BBCA)...">
      </div>
      <select class="field__select" style="width:120px;">
        <option>90 Days</option><option>30 Days</option><option>7 Days</option>
      </select>
    </div>
    <div style="height:320px;background:var(--c-surface-2);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;color:var(--c-text-3);font-size:var(--text-sm);">
      Chart area (lightweight-charts placeholder)
    </div>
  `;
  container.appendChild(chartCard);

  // Stock table
  const tableCard = createEl('div', { class: 'card' });
  tableCard.innerHTML = `
    <div class="card__head"><div class="card__title">Top Movers</div></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th>Ticker</th><th>Name</th><th>Price</th><th>Change</th><th>Volume</th><th></th>
        </tr></thead>
        <tbody>
          ${STOCKS.map(s => `
            <tr>
              <td><span class="badge badge--primary">${s.ticker}</span></td>
              <td style="font-weight:500;">${s.name}</td>
              <td style="font-family:var(--font-mono);font-weight:600;">${s.price.toLocaleString()}</td>
              <td style="color:${s.change >= 0 ? 'var(--c-accent)' : 'var(--c-danger)'};font-weight:500;">${s.change >= 0 ? '+' : ''}${s.change}%</td>
              <td style="color:var(--c-text-2);font-size:var(--text-sm);">${s.vol}</td>
              <td class="table__actions">
                <button class="btn btn--ghost btn--sm">${icons['eye']}</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  container.appendChild(tableCard);

  return container;
}
