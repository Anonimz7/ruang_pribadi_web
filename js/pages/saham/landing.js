/* pages/landing.js — Landing pilih portal (kartu diatur config).
 * Entri dibaca dari menu_config.json -> 'landing' (fetchLandingConfig).
 * Keempat kartu selalu tampil, terlepas login/tier — gate terjadi saat
 * klik: router meminta login (guest) atau menolak (tier kurang).
 */
import { store, subscribe } from '../../core/state.js';
import { Auth } from '../../core/auth.js';
import { navigate } from '../../core/router.js';
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import { fetchLandingConfig } from '../../core/menu-config.js';
import { showLogin } from '../login-modal.js';

export function render() {
  const page = createEl('div', { class: 'landing-page' });

  // Topbar: login/logout mini (karena drawer & appbar tersembunyi di landing)
  const topbar = createEl('div', { class: 'landing-topbar' });
  page.appendChild(topbar);

  // Card utama
  const card = createEl('div', { class: 'landing-card' });
  page.appendChild(card);

  function renderTopbar() {
    topbar.innerHTML = '';
    const isLoggedIn = !!store.token;

    if (!isLoggedIn) {
      const loginBtn = createEl('button', { class: 'btn btn--primary btn--sm' }, ['Login']);
      loginBtn.addEventListener('click', () => showLogin());
      topbar.appendChild(loginBtn);
      return;
    }

    const chip = createEl('button', { class: 'landing-user' }, []);
    const name = store.username || 'User';
    chip.innerHTML = `
      <span class="landing-user__avatar">${name.substring(0, 1).toUpperCase()}</span>
      <span class="landing-user__name">${name}</span>
    `;
    chip.addEventListener('click', () => navigate('/profile'));
    topbar.appendChild(chip);

    const logoutBtn = createEl('button', { class: 'btn btn--ghost btn--sm', title: 'Logout' }, []);
    logoutBtn.innerHTML = icons['log-out'];
    logoutBtn.addEventListener('click', async () => {
      await Auth.logout();
      window.location.reload();
    });
    topbar.appendChild(logoutBtn);
  }

  function renderMenu(menus) {
    card.innerHTML = '';

    // Header
    const header = createEl('div', { class: 'landing-header' });
    header.appendChild(createEl('h1', {}, ['Pilih Menu']));
    header.appendChild(createEl('p', {}, ['Klik tombol untuk memulai']));
    card.appendChild(header);

    // Grid menu — semua kartu tampil; akses dicek saat klik (router)
    const grid = createEl('div', { class: 'landing-grid' });
    menus.forEach((m) => {
      const item = createEl('div', {
        class: 'landing-item' + (m.status === 'coming' ? ' landing-item--coming' : ''),
      }, []);

      const btn = createEl('button', {
        class: 'landing-btn',
        'aria-label': m.label,
      }, [m.num]);
      if (m.status === 'coming') {
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => {
          // Belum login: langsung pop-up login, tanpa redirect ke halaman.
          if (!store.token) {
            store.pendingRoute = m.route;
            showLogin();
            return;
          }
          navigate(m.route);
        });
      }
      item.appendChild(btn);

      const desc = createEl('div', { class: 'landing-desc' }, [m.label]);
      desc.appendChild(createEl('small', {}, [m.small]));
      item.appendChild(desc);

      grid.appendChild(item);
    });
    card.appendChild(grid);
  }

  // Muat kartu dari config; bila gagal, landing tetap tampil tanpa grid.
  fetchLandingConfig()
    .then((menus) => renderMenu(menus))
    .catch(() => {
      console.warn('[Landing] Gagal memuat landing config');
      renderMenu([]);
    });

  const unsubs = ['token', 'username', 'tier', 'rank'].map((k) => subscribe(k, () => {
    renderTopbar();
    fetchLandingConfig().then(renderMenu).catch(() => {});
  }));

  renderTopbar();

  page._cleanup = () => {
    unsubs.forEach((u) => u());
  };

  return page;
}