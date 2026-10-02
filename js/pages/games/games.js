/* pages/games/games.js — Hub Games (paket tier: Premium+).
 * Kartu difilter oleh Auth.canAccess(key, minTier) dari menu config —
 * jadi akses tiap game bisa diatur lewat minTier / grant per-user. */
import { createEl } from '../../utils/dom.js';
import { navigate } from '../../core/router.js';
import { icons } from '../../ui/icons.js';
import { Auth } from '../../core/auth.js';
import { store, subscribe } from '../../core/state.js';
import { fetchMenuConfig, ROUTE_MAP, EXTERNAL_URLS } from '../../core/menu-config.js';
import { showLogin } from '../login-modal.js';

// route -> app key (dibalik dari ROUTE_MAP)
const ROUTE_TO_KEY = {};
for (const [key, route] of Object.entries(ROUTE_MAP)) {
  ROUTE_TO_KEY[route] = key;
}

const GAMES = [
  { route: '/gacha', icon: 'dice', label: 'Gacha Luck', desc: 'Coba keberuntungan gacha' },
  { route: '/rolling', icon: 'target', label: 'Rolling Yes/No', desc: 'Putuskan dengan lempar acak' },
];

// Game yang dibuka di tab baru (standalone HTML)
const EXTERNAL_GAME = {
  key: 'deck_of_cards',
  url: EXTERNAL_URLS.deck_of_cards,
  icon: 'grid',
  label: 'Deck of Cards',
  desc: 'Main kartu remi interaktif',
};

export function render() {
  const page = createEl('div', { class: 'tools-page' });

  const header = createEl('div', { class: 'page-head' });
  header.appendChild(createEl('h1', {}, ['Games']));
  header.appendChild(createEl('p', { class: 'page-head__sub' }, ['Kumpulan game untuk mengisi waktu.']));
  page.appendChild(header);

  const grid = createEl('div', { class: 'tool-grid' });
  page.appendChild(grid);

  function keyOf(route) {
    return ROUTE_TO_KEY[route] || route;
  }

  function renderGrid(minTierMap) {
    grid.innerHTML = '';

    const visible = GAMES.filter((t) =>
      Auth.canAccess(keyOf(t.route), minTierMap[keyOf(t.route)] ?? 1));
    const externalVisible = Auth.canAccess(EXTERNAL_GAME.key, minTierMap[EXTERNAL_GAME.key] ?? 1);

    if (visible.length === 0 && !externalVisible) {
      if (!store.token) {
        const empty = createEl('div', { class: 'tools-empty' }, []);
        empty.appendChild(createEl('p', { class: 'empty' },
          ['Login dengan akun Premium untuk mengakses Games.']));
        const loginBtn = createEl('button', { class: 'btn btn--primary' }, ['Login']);
        loginBtn.addEventListener('click', () => showLogin());
        empty.appendChild(loginBtn);
        grid.appendChild(empty);
      } else {
        grid.appendChild(createEl('p', { class: 'empty' },
          ['Akses Games membutuhkan tier Premium ke atas.']));
      }
      return;
    }

    const buildCard = (t, external) => {
      const card = createEl('button', { class: 'tool-card' }, []);
      card.type = 'button';
      const icon = createEl('span', { class: 'tool-card__icon' });
      icon.innerHTML = icons[t.icon] || icons['help'];
      card.appendChild(icon);
      const body = createEl('span', { class: 'tool-card__body' }, []);
      body.appendChild(createEl('span', { class: 'tool-card__label' }, [t.label]));
      body.appendChild(createEl('span', { class: 'tool-card__desc' }, [t.desc]));
      card.appendChild(body);
      if (external) {
        card.addEventListener('click', () => window.open(t.url, '_blank', 'noopener'));
      } else {
        card.addEventListener('click', () => navigate(t.route));
      }
      grid.appendChild(card);
    };

    visible.forEach((t) => buildCard(t, false));
    if (externalVisible) buildCard(EXTERNAL_GAME, true);
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
