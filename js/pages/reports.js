/* pages/reports.js — Reports Generation */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['Reports']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Generate and download news reports.']));

  const card = createEl('div', { class: 'card', style: { maxWidth: '560px', margin: '0 auto' } });
  card.innerHTML = `
    <div class="card__head"><div class="card__title">Generate Report</div></div>
    <div style="display:flex;flex-direction:column;gap:var(--s-4);">
      <div class="field">
        <label class="field__label">Time Range</label>
        <select class="field__select">
          <option>Last 24 hours</option>
          <option>Last 48 hours</option>
          <option>Last 7 days</option>
        </select>
      </div>
      <div class="field field--inline" style="justify-content:space-between;">
        <label class="field__label">Auto-send to email</label>
        <div class="toggle toggle--on"></div>
      </div>
      <button class="btn btn--primary btn--lg">${icons['file-text']} Generate Report</button>
    </div>
  `;
  container.appendChild(card);

  // History
  const history = createEl('div', { class: 'card', style: { maxWidth: '560px', margin: 'var(--s-5) auto 0' } });
  history.innerHTML = `
    <div class="card__head"><div class="card__title">Recent Reports</div></div>
    <div style="display:flex;flex-direction:column;gap:var(--s-3);">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--s-3);background:var(--c-surface-2);border-radius:var(--radius);">
        <div>
          <div style="font-weight:500;font-size:var(--text-sm);">Report_20240903_001.zip</div>
          <div style="font-size:var(--text-xs);color:var(--c-text-3);">Generated 2 hours ago • 1.2 MB</div>
        </div>
        <button class="btn btn--ghost btn--sm">${icons['download']}</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--s-3);background:var(--c-surface-2);border-radius:var(--radius);">
        <div>
          <div style="font-weight:500;font-size:var(--text-sm);">Report_20240902_004.zip</div>
          <div style="font-size:var(--text-xs);color:var(--c-text-3);">Generated 1 day ago • 980 KB</div>
        </div>
        <button class="btn btn--ghost btn--sm">${icons['download']}</button>
      </div>
    </div>
  `;
  container.appendChild(history);

  return container;
}
