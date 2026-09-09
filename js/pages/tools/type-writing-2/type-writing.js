/* pages/tools/type-writing-2/type-writing.js — Pilih Mode Pengetik Alami (hub)
 * Konversi dari tools/type-writing/index.html ke module SPA.
 * Klik mode memuat type-bahasa.js / type-coder.js secara dinamis (tanpa partikel). */
import { createEl } from '../../../utils/dom.js';

function ensureFontAwesome() {
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
    document.head.appendChild(l);
  }
}

const CSS = `
  .tw-root { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; padding: var(--s-5) var(--s-2); }
  .tw-container {
    background: var(--c-surface); padding: var(--s-5); border-radius: var(--radius);
    box-shadow: var(--shadow); text-align: center; max-width: 520px; margin: var(--s-4) auto; border: 1px solid var(--c-border);
  }
  .tw-container h1 { color: var(--c-primary); margin: 0 0 var(--s-5); font-size: 1.6em; }
  .tw-nav { display: flex; flex-direction: column; gap: var(--s-4); }
  .tw-btn {
    display: flex; align-items: center; justify-content: center; gap: 12px;
    background: var(--c-primary); color: #fff; text-decoration: none; padding: 15px 25px;
    border-radius: var(--radius); font-size: 1.05em; cursor: pointer; border: none;
    transition: background-color .3s, transform .2s, box-shadow .2s; box-shadow: var(--shadow);
  }
  .tw-btn:hover { filter: brightness(1.08); transform: translateY(-2px); box-shadow: var(--shadow-lg, var(--shadow)); }
  .tw-btn i { font-size: 1.3em; }
  .tw-back { margin-top: var(--s-4); background: none; border: 1px solid var(--c-border); color: var(--c-text-2); }
  .tw-root footer { margin-top: var(--s-4); font-size: .9em; color: var(--c-text-2); text-align: center; }
  .tw-mount { margin-top: var(--s-3); }
`;

export function render() {
  ensureFontAwesome();
  const page = createEl('div', { class: 'tw-root' });

  const style = document.createElement('style');
  style.textContent = CSS;
  page.appendChild(style);

  const container = createEl('div', { class: 'tw-container' });
  const mountPoint = createEl('div', { class: 'tw-mount' });
  container.appendChild(mountPoint);

  function loadMode(moduleName) {
    import('./' + moduleName + '.js')
      .then((mod) => {
        mountPoint.innerHTML = '';
        const backBtn = createEl('button', { class: 'tw-btn tw-back', type: 'button' }, ['← Kembali ke Pilihan Mode']);
        backBtn.addEventListener('click', () => renderMenu());
        mountPoint.appendChild(backBtn);
        mountPoint.appendChild(mod.render());
      })
      .catch(() => {
        mountPoint.innerHTML = '<p style="color:var(--c-danger, #f56565);">Gagal memuat mode. Coba lagi.</p>';
      });
  }

  function renderMenu() {
    mountPoint.innerHTML = '';
    const h1 = createEl('h1', {}, ['Pilih Mode Pengetik Alami']);
    const nav = createEl('div', { class: 'tw-nav' });

    const btnBahasa = createEl('button', { class: 'tw-btn', type: 'button' });
    btnBahasa.innerHTML = '<i class="fas fa-language"></i> Mode Bahasa';
    btnBahasa.addEventListener('click', () => loadMode('type-bahasa'));

    const btnCoder = createEl('button', { class: 'tw-btn', type: 'button' });
    btnCoder.innerHTML = '<i class="fas fa-code"></i> Mode Coder';
    btnCoder.addEventListener('click', () => loadMode('type-coder'));

    nav.append(btnBahasa, btnCoder);
    mountPoint.append(h1, nav);
  }

  const footer = createEl('footer', {}, ['© 2025 Natural Typewriter. All rights reserved.']);
  container.appendChild(mountPoint);
  container.appendChild(footer);
  page.appendChild(container);

  renderMenu();
  return page;
}