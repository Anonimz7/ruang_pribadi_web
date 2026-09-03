/* pages/admin/reports.js — Reports Admin */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['Reports Admin']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Manage automated report generation settings.']));

  const card = createEl('div', { class: 'card', style: { maxWidth: '560px', margin: '0 auto' } });
  card.innerHTML = `
    <div class="card__head"><div class="card__title">Report Preferences</div></div>
    <div style="display:flex;flex-direction:column;gap:var(--s-4);">
      <div class="field field--inline" style="justify-content:space-between;">
        <label class="field__label">Auto-generate daily reports</label>
        <div class="toggle toggle--on"></div>
      </div>
      <div class="field field--inline" style="justify-content:space-between;">
        <label class="field__label">Include IDX analysis</label>
        <div class="toggle toggle--on"></div>
      </div>
      <div class="field field--inline" style="justify-content:space-between;">
        <label class="field__label">Include News summary</label>
        <div class="toggle toggle--on"></div>
      </div>
      <div class="field field--inline" style="justify-content:space-between;">
        <label class="field__label">Email notifications</label>
        <div class="toggle toggle--off"></div>
      </div>
      <hr>
      <button class="btn btn--primary">Save Preferences</button>
    </div>
  `;
  container.appendChild(card);

  return container;
}
