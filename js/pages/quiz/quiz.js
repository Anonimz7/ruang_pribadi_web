/* pages/quiz/quiz.js — Hub Quiz (paket tier: Premium+).
 * Kartu difilter oleh Auth.canAccess(key, minTier) dari menu config —
 * jadi akses tiap kuis bisa diatur lewat minTier / grant per-user. */
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

const QUIZ = [
  { route: '/math-speed', icon: 'calculate', label: 'Math Speed', desc: 'Latihan hitung cepat dengan rekor' },
  { route: '/math-speed-legacy', icon: 'calculate', label: 'Math Speed (Old)', desc: 'Versi lama Math Speed' },
  { route: '/math-dasar', icon: 'calculate', label: 'Math Dasar', desc: 'Tabel matematika interaktif' },
];

export function render() {
  const page = createEl('div', { class: 'tools-page' });

  const header = createEl('div', { class: 'page-head' });
  header.appendChild(createEl('h1', {}, ['Quiz']));
  header.appendChild(createEl('p', { class: 'page-head__sub' }, ['Latihan & kuis matematika.']));
  page.appendChild(header);

  const grid = createEl('div', { class: 'tool-grid' });
  page.appendChild(grid);

  function keyOf(route) {
    return ROUTE_TO_KEY[route] || route;
  }

  function renderGrid(minTierMap) {
    grid.innerHTML = '';

    const visible = QUIZ.filter((t) =>
      Auth.canAccess(keyOf(t.route), minTierMap[keyOf(t.route)] ?? 1));

    if (visible.length === 0) {
      if (!store.token) {
        const empty = createEl('div', { class: 'tools-empty' }, []);
        empty.appendChild(createEl('p', { class: 'empty' },
          ['Login dengan akun Premium untuk mengakses Quiz.']));
        const loginBtn = createEl('button', { class: 'btn btn--primary' }, ['Login']);
        loginBtn.addEventListener('click', () => showLogin());
        empty.appendChild(loginBtn);
        grid.appendChild(empty);
      } else {
        grid.appendChild(createEl('p', { class: 'empty' },
          ['Akses Quiz membutuhkan tier Premium ke atas.']));
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
