/* pages/dashboard.js — Dashboard home (dynamic grid from menu config) */
import { store, subscribe } from '../core/state.js';
import { Auth } from '../core/auth.js';
import { navigate } from '../core/router.js';
import { fetchMenuConfig, MENU_SECTIONS, ROUTE_MAP } from '../core/menu-config.js';
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';

export function render() {
  const container = createEl('div', { class: 'dashboard-page' });

  let menuConfig = [];

  const renderContent = () => {
    container.innerHTML = '';

    // Greeting
    const hero = createEl('div', { class: 'dashboard-hero' });
    const isLoggedIn = !!store.token;
    const name = isLoggedIn && store.username ? store.username : null;
    hero.appendChild(createEl('h1', {}, [name ? `Halo, ${name} 👋` : 'Selamat Datang 👋']));
    hero.appendChild(createEl('p', {}, [
      isLoggedIn
        ? 'Pilih fitur yang ingin kamu gunakan.'
        : 'Login untuk mengakses semua fitur Ruang Pribadi.',
    ]));
    container.appendChild(hero);

    if (!isLoggedIn) {
      container.appendChild(buildGuestCta());
      return;
    }

    // Section grids (filtering identik drawer.js)
    let renderedAny = false;
    for (const { value: sec, label: secLabel } of MENU_SECTIONS) {
      let items = menuConfig.filter(app => app.section === sec);

      if (sec === 'admin') {
        if (store.tier !== 'admin') continue;
        items = items.filter(app => Auth.canAccess(app.key));
      } else {
        items = items.filter(app => {
          if (app.defaultPermission && sec !== 'admin') return true;
          if (Auth.isMenuHidden(app.key)) return false;
          return Auth.canAccess(app.key);
        });
      }

      if (items.length === 0) continue;
      renderedAny = true;

      container.appendChild(createEl('div', { class: 'dashboard-section' }, [secLabel]));
      container.appendChild(buildGrid(items));
    }

    if (!renderedAny) {
      container.appendChild(buildEmpty());
    }
  };

  function buildGrid(items) {
    const grid = createEl('div', { class: 'dashboard-grid' });
    items.forEach(app => {
      const path = ROUTE_MAP[app.key] || '/';
      const card = createEl('a', {
        class: 'dashboard-card',
        href: '#' + path,
        title: path,
        'aria-label': app.label,
      }, []);
      card.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(path);
      });

      const icon = createEl('span', { class: 'dashboard-card__icon' });
      icon.innerHTML = icons[app.icon] || '';
      card.appendChild(icon);
      card.appendChild(createEl('span', { class: 'dashboard-card__label' }, [app.label]));
      grid.appendChild(card);
    });
    return grid;
  }

  function buildGuestCta() {
    const card = createEl('div', { class: 'card dashboard-cta' }, []);
    const icon = createEl('div', { class: 'dashboard-cta__icon' });
    icon.innerHTML = icons['user'];
    card.appendChild(icon);
    card.appendChild(createEl('p', { class: 'dashboard-cta__text' },
      ['Masuk untuk membuka semua aplikasi: latihan hitung, gacha, downloader video, berita, saham, dan lainnya.']));
    const btn = createEl('button', { class: 'btn btn--primary' }, ['Login']);
    btn.addEventListener('click', () => navigate('/login'));
    card.appendChild(btn);
    return card;
  }

  function buildEmpty() {
    const card = createEl('div', { class: 'card dashboard-cta' }, []);
    card.appendChild(createEl('p', { class: 'dashboard-cta__text' }, ['Tidak ada fitur yang bisa diakses.']));
    return card;
  }

  // Load menu config (lagi), lalu render ulang
  fetchMenuConfig()
    .then(cfg => {
      menuConfig = cfg;
      renderContent();
    })
    .catch(() => { /* renderContent tetap jalan dengan grid kosong */ });

  // Re-render saat auth state berubah
  const unsubs = ['token', 'username', 'tier', 'permissions', 'hiddenMenus'].map(k =>
    subscribe(k, () => renderContent())
  );

  container._cleanup = () => {
    unsubs.forEach(u => u());
  };

  renderContent();
  return container;
}