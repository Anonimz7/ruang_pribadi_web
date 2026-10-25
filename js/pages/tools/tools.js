/* pages/tools/tools.js — Hub Tools (paket tier: Premium+).
 * Kartu difilter oleh Auth.canAccess(key, minTier) dari menu config —
 * jadi akses tiap tool bisa diatur lewat minTier / grant per-user. */
import { createEl } from '../../utils/dom.js';
import { navigate } from '../../core/router.js';
import { icons } from '../../ui/icons.js';
import { Auth } from '../../core/auth.js';
import { store, subscribe } from '../../core/state.js';
import { fetchMenuConfig, ROUTE_MAP } from '../../core/menu-config.js';
import { showLogin } from '../login-modal.js';

// route -> app key (dibalik dari ROUTE_MAP)
const ROUTE_TO_KEY = {};
for (const [key, route] of Object.entries(ROUTE_MAP)) {
  ROUTE_TO_KEY[route] = key;
}

const TOOLS = [
  { route: '/password', icon: 'key', label: 'Password Generator', desc: 'Create strong random passwords' },
  { route: '/diagram', icon: 'git-branch', label: 'Render Diagram', desc: 'Create & render diagrams from code' },
  { route: '/video', icon: 'download', label: 'Video Downloader', desc: 'Download videos from a URL' },
  { route: '/color-palate', icon: 'grid', label: 'Color Palate', desc: 'Color collection & reference' },
  { route: '/bacak', icon: 'grid', label: 'CSV Shuffler', desc: 'Shuffle & filter CSV data' },
  { route: '/tint-shade', icon: 'grid', label: 'Tint & Shade', desc: 'Create color gradients' },
  { route: '/color-blind', icon: 'grid', label: 'Edukasi Warna', desc: 'Color simulation & mixing' },
  { route: '/jepunese', icon: 'globe', label: 'Jepunese', desc: 'Learn Japanese characters' },
  { route: '/bahasa-interaktif', icon: 'book-open', label: 'Bahasa Interaktif', desc: 'Drag & drop language exercises' },
  { route: '/type-writing', icon: 'article', label: 'Type Writing', desc: 'Natural typer modes' },
];

export function render() {
  const page = createEl('div', { class: 'tools-page' });

  const header = createEl('div', { class: 'page-head' });
  header.appendChild(createEl('h1', {}, ['Tools']));
  header.appendChild(createEl('p', { class: 'page-head__sub' }, ['A collection of productivity tools.']));
  page.appendChild(header);

  const grid = createEl('div', { class: 'tool-grid' });
  page.appendChild(grid);

  function keyOf(route) {
    return ROUTE_TO_KEY[route] || route;
  }

  function renderGrid(minTierMap) {
    grid.innerHTML = '';

    const visible = TOOLS.filter((t) =>
      Auth.canAccess(keyOf(t.route), minTierMap[keyOf(t.route)] ?? 1));

    if (visible.length === 0) {
      if (!store.token) {
        const empty = createEl('div', { class: 'tools-empty' }, []);
        empty.appendChild(createEl('p', { class: 'empty' },
          ['Log in with a Premium account to access Tools.']));
        const loginBtn = createEl('button', { class: 'btn btn--primary' }, ['Login']);
        loginBtn.addEventListener('click', () => showLogin());
        empty.appendChild(loginBtn);
        grid.appendChild(empty);
      } else {
        grid.appendChild(createEl('p', { class: 'empty' },
          ['Accessing Tools requires Premium tier or higher.']));
      }
      return;
    }

    visible.forEach((t) => {
      const card = createEl('button', { class: 'tool-card' }, []);
      card.type = 'button';
      const icon = createEl('span', { class: 'tool-card__icon' });
      icon.innerHTML = icons[t.icon] || icons['help'];
      card.appendChild(icon);
      const body = createEl('span', { class: 'tool-card__body' }, []);
      body.appendChild(createEl('span', { class: 'tool-card__label' }, [t.label]));
      body.appendChild(createEl('span', { class: 'tool-card__desc' }, [t.desc]));
      card.appendChild(body);
      card.addEventListener('click', () => navigate(t.route));
      grid.appendChild(card);
    });
  }

  // Render awal + re-render saat sesi berubah
  const load = () => {
    fetchMenuConfig()
      .then((menu) => renderGrid(Object.fromEntries(menu.map((a) => [a.key, a.minTier]))))
      .catch(() => renderGrid({}));
  };
  load();

  const unsubs = ['token', 'tier', 'rank'].map((k) => subscribe(k, load));
  page._cleanup = () => unsubs.forEach((u) => u());

  return page;
}