/* pages/tools/tools.js — Hub Tools (paket tier: Premium+).
 * Kartu difilter oleh Auth.canAccess(key, minTier) dari menu config —
 * jadi akses tiap tool bisa diatur lewat minTier / grant per-user. */
import { createEl } from '../../utils/dom.js';
import { navigate } from '../../core/router.js';
import { icons } from '../../ui/icons.js';
import { Auth } from '../../core/auth.js';
import { store, subscribe } from '../../core/state.js';
import { fetchMenuConfig, ROUTE_MAP } from '../../core/menu-config.js';

// route -> app key (dibalik dari ROUTE_MAP)
const ROUTE_TO_KEY = {};
for (const [key, route] of Object.entries(ROUTE_MAP)) {
  ROUTE_TO_KEY[route] = key;
}

const TOOLS = [
  { route: '/math-speed', icon: 'calculate', label: 'Math Speed', desc: 'Latihan hitung cepat dengan rekor' },
  { route: '/math-speed-legacy', icon: 'calculate', label: 'Math Speed (Old)', desc: 'Versi lama Math Speed' },
  { route: '/password', icon: 'key', label: 'Password Generator', desc: 'Buat password acak yang kuat' },
  { route: '/gacha', icon: 'dice', label: 'Gacha Luck', desc: 'Coba keberuntungan gacha' },
  { route: '/rolling', icon: 'target', label: 'Rolling Yes/No', desc: 'Putuskan dengan lempar acak' },
  { route: '/diagram', icon: 'git-branch', label: 'Render Diagram', desc: 'Buat & render diagram dari kode' },
  { route: '/bahasa', icon: 'globe', label: 'Bahasa', desc: 'Terjemahan & belajar bahasa' },
  { route: '/video', icon: 'download', label: 'Video Downloader', desc: 'Unduh video dari URL' },
  { route: '/color-palate', icon: 'grid', label: 'Color Palate', desc: 'Kumpulan warna & referensi' },
  { route: '/math-dasar', icon: 'calculate', label: 'Math Dasar', desc: 'Tabel matematika interaktif' },
  { route: '/bacak', icon: 'grid', label: 'CSV Shuffler', desc: 'Acak & filter data CSV' },
  { route: '/tint-shade', icon: 'grid', label: 'Tint & Shade', desc: 'Buat gradasi warna' },
  { route: '/color-blind', icon: 'grid', label: 'Edukasi Warna', desc: 'Simulasi & pencampuran warna' },
  { route: '/jepunese', icon: 'globe', label: 'Jepunese', desc: 'Belajar karakter Jepang' },
  { route: '/bahasa-interaktif', icon: 'book-open', label: 'Bahasa Interaktif', desc: 'Latihan bahasa drag & drop' },
  { route: '/type-writing', icon: 'article', label: 'Type Writing', desc: 'Mode pengetik natural' },
];

// Tool yang dibuka di tab baru (standalone HTML)
const EXTERNAL_TOOL = {
  key: 'deck_of_cards',
  url: '/js/pages/tools/deck-of-cards-old/index.html',
  icon: 'grid',
  label: 'Deck of Cards',
  desc: 'Main kartu remi interaktif',
};

export function render() {
  const page = createEl('div', { class: 'tools-page' });

  const header = createEl('div', { class: 'page-head' });
  header.appendChild(createEl('h1', {}, ['Tools']));
  header.appendChild(createEl('p', { class: 'page-head__sub' }, ['Kumpulan tool produktivitas.']));
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
    const externalVisible = Auth.canAccess(EXTERNAL_TOOL.key, minTierMap[EXTERNAL_TOOL.key] ?? 1);

    if (visible.length === 0 && !externalVisible) {
      grid.appendChild(createEl('p', { class: 'empty' },
        [store.token
          ? 'Akses Tools membutuhkan tier Premium ke atas.'
          : 'Login dengan akun Premium untuk mengakses Tools.']));
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
    if (externalVisible) buildCard(EXTERNAL_TOOL, true);
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