/* pages/admin/dashboard.js — Server Dashboard */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['Server Dashboard']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['System overview and real-time metrics.']));

  const stats = createEl('div', { class: 'grid grid--4', style: { marginBottom: 'var(--s-5)' } });
  [
    { label: 'CPU Usage', value: '24%', sub: '2 cores active', color: 'var(--c-primary)' },
    { label: 'Memory', value: '3.2 GB', sub: 'of 8 GB used', color: 'var(--c-accent)' },
    { label: 'Disk', value: '45%', sub: '90 GB free', color: 'var(--c-warn)' },
    { label: 'Uptime', value: '12d 4h', sub: 'Last reboot: Aug 22', color: 'var(--c-info)' },
  ].forEach(s => {
    const card = createEl('div', { class: 'stat-card' });
    card.innerHTML = `
      <div class="stat-card__label">${s.label}</div>
      <div class="stat-card__value" style="color:${s.color}">${s.value}</div>
      <div class="stat-card__change">${s.sub}</div>
    `;
    stats.appendChild(card);
  });
  container.appendChild(stats);

  const grid = createEl('div', { class: 'grid grid--2', style: { marginBottom: 'var(--s-5)' } });

  const statusCard = createEl('div', { class: 'card' });
  statusCard.innerHTML = `
    <div class="card__head"><div class="card__title">System Status</div></div>
    <div style="display:flex;flex-direction:column;gap:var(--s-3);">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--s-2) 0;border-bottom:1px solid var(--c-border);">
        <span style="font-size:var(--text-sm);color:var(--c-text-2);">Status</span>
        <span class="badge badge--success">Active</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--s-2) 0;border-bottom:1px solid var(--c-border);">
        <span style="font-size:var(--text-sm);color:var(--c-text-2);">Registration</span>
        <div class="toggle toggle--on"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--s-2) 0;border-bottom:1px solid var(--c-border);">
        <span style="font-size:var(--text-sm);color:var(--c-text-2);">Scraper</span>
        <span class="badge badge--warn">Running</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--s-2) 0;">
        <span style="font-size:var(--text-sm);color:var(--c-text-2);">Last Scrape</span>
        <span style="font-size:var(--text-sm);font-weight:500;">15 min ago</span>
      </div>
    </div>
  `;
  grid.appendChild(statusCard);

  const dbCard = createEl('div', { class: 'card' });
  dbCard.innerHTML = `
    <div class="card__head"><div class="card__title">Database</div></div>
    <div style="display:flex;flex-direction:column;gap:var(--s-3);">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--s-2) 0;border-bottom:1px solid var(--c-border);">
        <span style="font-size:var(--text-sm);color:var(--c-text-2);">News Articles</span>
        <span style="font-weight:600;">142,893</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--s-2) 0;border-bottom:1px solid var(--c-border);">
        <span style="font-size:var(--text-sm);color:var(--c-text-2);">Stocks Tracked</span>
        <span style="font-weight:600;">890</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--s-2) 0;border-bottom:1px solid var(--c-border);">
        <span style="font-size:var(--text-sm);color:var(--c-text-2);">DB Size</span>
        <span style="font-weight:600;">1.2 GB</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--s-2) 0;">
        <span style="font-size:var(--text-sm);color:var(--c-text-2);">Users</span>
        <span style="font-weight:600;">24</span>
      </div>
    </div>
  `;
  grid.appendChild(dbCard);
  container.appendChild(grid);

  const actions = createEl('div', { class: 'card' });
  actions.innerHTML = `
    <div class="card__head"><div class="card__title">Quick Actions</div></div>
    <div style="display:flex;gap:var(--s-3);flex-wrap:wrap;">
      <button class="btn btn--secondary">${icons['refresh']} Run Scraper</button>
      <button class="btn btn--secondary">${icons['database']} Optimize DB</button>
      <button class="btn btn--secondary">${icons['upload']} Upload IDX</button>
      <button class="btn btn--danger">${icons['shield']} Maintenance Mode</button>
    </div>
  `;
  container.appendChild(actions);

  return container;
}
