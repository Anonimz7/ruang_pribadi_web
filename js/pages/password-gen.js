/* pages/password-gen.js — Password Generator */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['Password Generator']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Generate strong, secure passwords.']));

  const card = createEl('div', { class: 'card', style: { maxWidth: '560px', margin: '0 auto' } });

  // Output
  const outputWrap = createEl('div', { style: { position: 'relative', marginBottom: 'var(--s-4)' } });
  const output = createEl('div', {
    class: 'field__input',
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-md)',
      paddingRight: '80px',
      wordBreak: 'break-all',
      minHeight: '52px',
      display: 'flex',
      alignItems: 'center',
    }
  }, ['Tr0ub4dor&3']);

  const copyBtn = createEl('button', {
    class: 'btn btn--ghost',
    style: { position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }
  });
  copyBtn.innerHTML = icons['copy'];
  outputWrap.appendChild(output);
  outputWrap.appendChild(copyBtn);
  card.appendChild(outputWrap);

  // Strength bar
  const strengthLabel = createEl('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginBottom: 'var(--s-1)', textTransform: 'uppercase', letterSpacing: '0.05em' } }, ['Strength']);
  card.appendChild(strengthLabel);
  const strengthBar = createEl('div', { class: 'progress', style: { marginBottom: 'var(--s-4)' } });
  const strengthFill = createEl('div', { class: 'progress__bar progress--success', style: { width: '85%' } });
  strengthBar.appendChild(strengthFill);
  card.appendChild(strengthBar);

  // Options
  const opts = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', marginBottom: 'var(--s-5)' } });

  // Length slider
  const lenRow = createEl('div', { class: 'field field--inline', style: { justifyContent: 'space-between' } });
  lenRow.innerHTML = `
    <label class="field__label">Length</label>
    <div style="display:flex;align-items:center;gap:var(--s-3);flex:1;justify-content:flex-end;">
      <input type="range" min="6" max="64" value="16" style="width:160px;">
      <span style="font-family:var(--font-mono);font-weight:600;min-width:28px;text-align:right;">16</span>
    </div>
  `;
  opts.appendChild(lenRow);

  // Toggles
  [
    { label: 'Uppercase (A-Z)', checked: true },
    { label: 'Lowercase (a-z)', checked: true },
    { label: 'Numbers (0-9)', checked: true },
    { label: 'Symbols (!@#$)', checked: true },
  ].forEach(opt => {
    const row = createEl('div', { class: 'field field--inline', style: { justifyContent: 'space-between' } });
    row.innerHTML = `
      <label class="field__label" style="font-weight:400;color:var(--c-text-2);">${opt.label}</label>
      <div class="toggle ${opt.checked ? 'toggle--on' : ''}"></div>
    `;
    opts.appendChild(row);
  });

  card.appendChild(opts);

  // Generate button
  const genBtn = createEl('button', { class: 'btn btn--primary btn--lg', style: { width: '100%' } }, ['Generate Password']);
  card.appendChild(genBtn);

  container.appendChild(card);
  return container;
}
