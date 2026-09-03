/* pages/news.js — News Intelligence */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';

const DOMAINS = ['kompas.com', 'detik.com', 'cnnindonesia.com', 'liputan6.com', 'tirto.id'];
const ARTICLES = [
  { title: 'IHSG Menguat di Awal Pekan', domain: 'kompas.com', time: '2 jam lalu', lang: 'id' },
  { title: 'Tech Giants Report Strong Earnings', domain: 'detik.com', time: '3 jam lalu', lang: 'en' },
  { title: 'Pasar Crypto Volatile Hari Ini', domain: 'cnnindonesia.com', time: '5 jam lalu', lang: 'id' },
  { title: 'New AI Model Released by OpenAI', domain: 'detik.com', time: '6 jam lalu', lang: 'en' },
  { title: 'Bank Indonesia Tahan Suku Bunga', domain: 'liputan6.com', time: '8 jam lalu', lang: 'id' },
  { title: 'Startup Indonesia Raih Funding', domain: 'tirto.id', time: '10 jam lalu', lang: 'id' },
];

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['News Intelligence']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Aggregated news from multiple sources.']));

  // Toolbar — mobile stack
  const toolbar = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', marginBottom: 'var(--s-5)', flexWrap: 'wrap', alignItems: 'center' } });
  toolbar.innerHTML = `
    <div class="search" style="flex:1;min-width:260px;">
      <span class="search__icon">${icons['search']}</span>
      <input type="text" class="search__input" placeholder="Search articles...">
    </div>
    <select class="field__select" style="width:140px;min-width:140px;">
      <option>Last 24h</option>
      <option>Last 48h</option>
      <option>Last 7 days</option>
    </select>
    <select class="field__select" style="width:160px;min-width:160px;">
      <option>All Domains</option>
      ${DOMAINS.map(d => `<option>${d}</option>`).join('')}
    </select>
    <button class="btn btn--secondary">${icons['refresh']} Refresh</button>
  `;
  container.appendChild(toolbar);

  // Tabs
  const tabs = createEl('div', { class: 'tabs' });
  ['All Articles', 'Grouped by Domain', 'Trending'].forEach((t, i) => {
    const tab = createEl('button', { class: 'tabs__item' + (i === 0 ? ' tabs__item--active' : '') }, [t]);
    tabs.appendChild(tab);
  });
  container.appendChild(tabs);

  // Articles list
  const list = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
  ARTICLES.forEach(a => {
    const item = createEl('div', {
      class: 'card',
      style: { padding: 'var(--s-4)', display: 'flex', gap: 'var(--s-4)', alignItems: 'flex-start' }
    });
    item.innerHTML = `
      <div style="width:40px;height:40px;border-radius:var(--radius);background:var(--c-surface-2);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--c-text-3);">
        ${icons['newspaper']}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;color:var(--c-text);margin-bottom:var(--s-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.title}</div>
        <div style="display:flex;gap:var(--s-3);align-items:center;font-size:var(--text-xs);color:var(--c-text-3);flex-wrap:wrap;">
          <span class="badge badge--neutral">${a.domain}</span>
          <span>${a.time}</span>
          <span class="badge badge--primary">${a.lang}</span>
        </div>
      </div>
      <button class="btn btn--ghost btn--sm">${icons['chevron-right']}</button>
    `;
    list.appendChild(item);
  });
  container.appendChild(list);

  // Pagination
  const pag = createEl('div', { style: { display: 'flex', justifyContent: 'center', gap: 'var(--s-2)', marginTop: 'var(--s-5)', flexWrap: 'wrap' } });
  pag.innerHTML = `
    <button class="btn btn--ghost btn--sm">Prev</button>
    <button class="btn btn--primary btn--sm">1</button>
    <button class="btn btn--ghost btn--sm">2</button>
    <button class="btn btn--ghost btn--sm">3</button>
    <button class="btn btn--ghost btn--sm">Next</button>
  `;
  container.appendChild(pag);

  return container;
}
