/* pages/admin/backup.js — Backup System */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['Backup System']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Manage database backups and Google Drive integration.']));

  const status = createEl('div', { class: 'card', style: { maxWidth: '640px', margin: '0 auto var(--s-5)' } });
  status.innerHTML = `
    <div class="card__head"><div class="card__title">Backup Status</div></div>
    <div style="display:flex;flex-direction:column;gap:var(--s-4);">
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--s-2);font-size:var(--text-sm);">
          <span style="font-weight:500;">Idle</span>
          <span style="color:var(--c-text-3);">Ready</span>
        </div>
        <div class="progress"><div class="progress__bar" style="width:0%"></div></div>
      </div>
      <div style="display:flex;gap:var(--s-3);">
        <button class="btn btn--primary" style="flex:1;">${icons['database']} Run Backup</button>
        <button class="btn btn--secondary">${icons['refresh']} Refresh</button>
      </div>
    </div>
  `;
  container.appendChild(status);

  const gdrive = createEl('div', { class: 'card', style: { maxWidth: '640px', margin: '0 auto var(--s-5)' } });
  gdrive.innerHTML = `
    <div class="card__head"><div class="card__title">Google Drive</div></div>
    <div style="display:flex;align-items:center;gap:var(--s-4);margin-bottom:var(--s-4);">
      <div style="width:48px;height:48px;border-radius:var(--radius);background:var(--c-success-bg);color:var(--c-success);display:flex;align-items:center;justify-content:center;">
        ${icons['check']}
      </div>
      <div>
        <div style="font-weight:600;">Connected</div>
        <div style="font-size:var(--text-sm);color:var(--c-text-3);">user@gmail.com • 12.4 GB used</div>
      </div>
    </div>
    <div style="display:flex;gap:var(--s-3);">
      <button class="btn btn--secondary">Disconnect</button>
      <button class="btn btn--secondary">Test Upload</button>
    </div>
  `;
  container.appendChild(gdrive);

  const history = createEl('div', { class: 'card', style: { maxWidth: '640px', margin: '0 auto' } });
  history.innerHTML = `
    <div class="card__head"><div class="card__title">Backup History</div></div>
    <div style="display:flex;flex-direction:column;gap:var(--s-3);">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--s-3);background:var(--c-surface-2);border-radius:var(--radius);">
        <div>
          <div style="font-weight:500;font-size:var(--text-sm);">backup_20240903_001.zip</div>
          <div style="font-size:var(--text-xs);color:var(--c-text-3);">3.2 MB • GDrive ✓</div>
        </div>
        <div style="display:flex;gap:var(--s-2);">
          <button class="btn btn--ghost btn--sm">${icons['download']}</button>
          <button class="btn btn--ghost btn--sm" style="color:var(--c-danger);">${icons['trash']}</button>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--s-3);background:var(--c-surface-2);border-radius:var(--radius);">
        <div>
          <div style="font-weight:500;font-size:var(--text-sm);">backup_20240902_001.zip</div>
          <div style="font-size:var(--text-xs);color:var(--c-text-3);">3.1 MB • GDrive ✓</div>
        </div>
        <div style="display:flex;gap:var(--s-2);">
          <button class="btn btn--ghost btn--sm">${icons['download']}</button>
          <button class="btn btn--ghost btn--sm" style="color:var(--c-danger);">${icons['trash']}</button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(history);

  return container;
}
