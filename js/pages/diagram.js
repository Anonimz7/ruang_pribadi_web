/* pages/diagram.js — Code Diagram (PlantUML) */
import { createEl } from '../utils/dom.js';

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['Render Diagram']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Write PlantUML syntax and render it instantly.']));

  const grid = createEl('div', { class: 'grid grid--2', style: { alignItems: 'start' } });

  // Input panel
  const inputCard = createEl('div', { class: 'card' });
  inputCard.innerHTML = `
    <div class="card__head"><div class="card__title">Source</div></div>
    <textarea class="field__textarea" rows="16" style="font-family:var(--font-mono);font-size:var(--text-sm);resize:vertical;">@startuml
Alice -> Bob: Authentication Request
Bob --> Alice: Authentication Response

Alice -> Bob: Another authentication Request
Alice <-- Bob: Another authentication Response
@enduml</textarea>
    <div class="card__foot">
      <button class="btn btn--primary">Render</button>
      <button class="btn btn--secondary">Clear</button>
    </div>
  `;
  grid.appendChild(inputCard);

  // Output panel
  const outputCard = createEl('div', { class: 'card' });
  outputCard.innerHTML = `
    <div class="card__head"><div class="card__title">Preview</div></div>
    <div style="min-height:300px;background:var(--c-surface-2);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;color:var(--c-text-3);font-size:var(--text-sm);">
      Diagram preview will appear here
    </div>
  `;
  grid.appendChild(outputCard);

  container.appendChild(grid);
  return container;
}
