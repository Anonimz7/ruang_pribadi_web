/* pages/admin/proxies.js — Proxy Scraper Settings */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['Proxy Scraper']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Configure proxy rotation for scrapers.']));

  const card = createEl('div', { class: 'card', style: { maxWidth: '720px', margin: '0 auto' } });
  card.innerHTML = `
    <div class="card__head"><div class="card__title">Proxy List</div></div>
    <div class="field" style="margin-bottom:var(--s-4);">
      <label class="field__label">Proxies (one per line: host:port or host:port:user:pass)</label>
      <textarea class="field__textarea" rows="8" style="font-family:var(--font-mono);font-size:var(--text-sm);">proxy1.example.com:8080
proxy2.example.com:3128:user:pass</textarea>
    </div>
    <div class="field" style="margin-bottom:var(--s-4);">
      <label class="field__label">Webshare API Key (optional)</label>
      <input type="password" class="field__input" placeholder="ws_xxxxxxxx">
    </div>
    <div style="display:flex;gap:var(--s-3);justify-content:flex-end;">
      <button class="btn btn--secondary">${icons['refresh']} Test Proxies</button>
      <button class="btn btn--primary">Save Settings</button>
    </div>
  `;
  container.appendChild(card);

  return container;
}
