/* pages/rolling.js — Rolling Yes/No */
import { createEl } from '../utils/dom.js';

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['Rolling Yes/No']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Let fate decide for you.']));

  const card = createEl('div', { class: 'card', style: { maxWidth: '400px', margin: '0 auto', textAlign: 'center' } });

  // Wheel / Result
  const wheel = createEl('div', {
    style: {
      width: '200px', height: '200px',
      margin: '0 auto var(--s-5)',
      borderRadius: '50%',
      background: 'conic-gradient(var(--c-primary) 0deg 180deg, var(--c-danger) 180deg 360deg)',
      border: '4px solid var(--c-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }
  });
  wheel.innerHTML = `
    <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:14px solid var(--c-text);"></div>
    <div style="width:60px;height:60px;border-radius:50%;background:var(--c-surface);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--c-text-3);">?</div>
  `;
  card.appendChild(wheel);

  // Buttons
  const btnWrap = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', justifyContent: 'center' } });
  const rollBtn = createEl('button', { class: 'btn btn--primary btn--lg' }, ['Roll']);
  const resetBtn = createEl('button', { class: 'btn btn--secondary' }, ['Reset']);
  btnWrap.appendChild(rollBtn);
  btnWrap.appendChild(resetBtn);
  card.appendChild(btnWrap);

  // Stats
  const stats = createEl('div', { style: { display: 'flex', justifyContent: 'center', gap: 'var(--s-6)', marginTop: 'var(--s-5)', fontSize: 'var(--text-sm)' } });
  stats.innerHTML = `
    <div style="text-align:center;"><div style="font-weight:700;font-size:var(--text-lg);color:var(--c-primary);">12</div><div style="color:var(--c-text-3);">Yes</div></div>
    <div style="text-align:center;"><div style="font-weight:700;font-size:var(--text-lg);color:var(--c-danger);">8</div><div style="color:var(--c-text-3);">No</div></div>
  `;
  card.appendChild(stats);

  container.appendChild(card);
  return container;
}
