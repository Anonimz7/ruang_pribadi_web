/* pages/admin/users.js — User Permissions Management */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';

const USERS = [
  { id: 1, username: 'xoot', tier: 'admin', permissions: 'all', last_login: '2 min ago' },
  { id: 2, username: 'alice', tier: 'guest', permissions: '8 apps', last_login: '1 hour ago' },
  { id: 3, username: 'bob', tier: 'guest', permissions: '5 apps', last_login: '3 hours ago' },
  { id: 4, username: 'charlie', tier: 'guest', permissions: '3 apps', last_login: '1 day ago' },
];

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['User Permissions']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Manage users, tiers, and app access.']));

  const toolbar = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', marginBottom: 'var(--s-4)', flexWrap: 'wrap' } });
  toolbar.innerHTML = `
    <div class="search" style="flex:1;min-width:200px;">
      <span class="search__icon">${icons['search']}</span>
      <input type="text" class="search__input" placeholder="Search users...">
    </div>
    <button class="btn btn--primary">${icons['plus']} Create User</button>
  `;
  container.appendChild(toolbar);

  const wrap = createEl('div', { class: 'table-wrap' });
  const table = createEl('table', { class: 'table' });
  table.innerHTML = `
    <thead><tr>
      <th>ID</th><th>Username</th><th>Tier</th><th>Permissions</th><th>Last Login</th><th></th>
    </tr></thead>
    <tbody>
      ${USERS.map(u => `
        <tr>
          <td>#${u.id}</td>
          <td style="font-weight:500;">${u.username}</td>
          <td><span class="badge badge--${u.tier === 'admin' ? 'danger' : 'neutral'}">${u.tier}</span></td>
          <td style="font-size:var(--text-sm);color:var(--c-text-2);">${u.permissions}</td>
          <td style="font-size:var(--text-sm);color:var(--c-text-3);">${u.last_login}</td>
          <td class="table__actions">
            <button class="btn btn--ghost btn--sm">${icons['edit']}</button>
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
