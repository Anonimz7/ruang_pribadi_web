/* pages/gacha.js — Gacha Luck */
import { createEl } from '../utils/dom.js';

const TIERS = [
  { name: 'SSR', color: '#fbbf24', bg: '#fef3c7', chance: '1%' },
  { name: 'SR', color: '#a78bfa', bg: '#ede9fe', chance: '5%' },
  { name: 'R', color: '#60a5fa', bg: '#dbeafe', chance: '20%' },
  { name: 'N', color: '#9ca3af', bg: '#f3f4f6', chance: '74%' },
];

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['Gacha Luck']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Test your luck with a gacha roll.']));

  const card = createEl('div', { class: 'card', style: { maxWidth: '480px', margin: '0 auto', textAlign: 'center' } });

  // Result display
  const resultBox = createEl('div', {
    style: {
      width: '160px', height: '160px',
      margin: '0 auto var(--s-5)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--c-surface-2)',
      border: '2px dashed var(--c-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 'var(--text-xl)', fontWeight: '700', color: 'var(--c-text-3)',
    }
  }, ['?']);
  card.appendChild(resultBox);

  // Roll button
  const rollBtn = createEl('button', { class: 'btn btn--primary btn--lg', style: { width: '100%', marginBottom: 'var(--s-5)' } }, ['Roll Once (×1)']);
  card.appendChild(rollBtn);

  const roll10Btn = createEl('button', { class: 'btn btn--secondary btn--lg', style: { width: '100%', marginBottom: 'var(--s-5)' } }, ['Roll Ten (×10)']);
  card.appendChild(roll10Btn);

  // Tier rates
  const rates = createEl('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s-2)' } });
  TIERS.forEach(t => {
    const tier = createEl('div', {
      style: {
        padding: 'var(--s-3)',
        borderRadius: 'var(--radius)',
        background: t.bg,
        border: `1px solid ${t.color}40`,
      }
    });
    tier.innerHTML = `
      <div style="font-weight:700;color:${t.color};font-size:var(--text-md);">${t.name}</div>
      <div style="font-size:var(--text-xs);color:var(--c-text-2);">${t.chance}</div>
    `;
    rates.appendChild(tier);
  });
  card.appendChild(rates);

  // History
  const history = createEl('div', { class: 'card', style: { maxWidth: '480px', margin: 'var(--s-5) auto 0' } });
  history.innerHTML = `
    <div class="card__head"><div class="card__title">History</div></div>
    <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;">
      <span class="badge badge--warn">SSR</span>
      <span class="badge badge--neutral">R</span>
      <span class="badge badge--primary">SR</span>
      <span class="badge badge--neutral">N</span>
      <span class="badge badge--neutral">N</span>
      <span class="badge badge--primary">SR</span>
      <span class="badge badge--neutral">R</span>
      <span class="badge badge--neutral">N</span>
      <span class="badge badge--neutral">N</span>
      <span class="badge badge--neutral">N</span>
    </div>
  `;

  container.appendChild(card);
  container.appendChild(history);
  return container;
}
