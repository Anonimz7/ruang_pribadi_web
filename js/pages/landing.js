/* pages/landing.js — Landing pilih portal (Saham aktif, Tools/Quiz segera hadir) */
import { store, subscribe } from '../core/state.js';
import { Auth } from '../core/auth.js';
import { navigate } from '../core/router.js';
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';

// Status 'active' = bisa diklik, 'coming' = disabled "Segera hadir"
const MENUS = [
  { num: '1', label: 'Saham', desc: 'Stocks, berita, video & panel admin', small: 'Butuh login', route: '/saham', status: 'active' },
  { num: '2', label: 'Tools', desc: 'Kalkulator, konversi & produktivitas', small: 'Segera hadir', route: null, status: 'coming' },
  { num: '3', label: 'Quiz', desc: 'Kuis interaktif & games seru', small: 'Segera hadir', route: null, status: 'coming' },
];

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
      loginBtn.addEventListener('click', () => navigate('/login'));
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

  function renderMenu() {
    card.innerHTML = '';

    // Header
    const header = createEl('div', { class: 'landing-header' });
    header.appendChild(createEl('h1', {}, ['Pilih Menu']));
    header.appendChild(createEl('p', {}, ['Klik tombol untuk memulai']));
    card.appendChild(header);

    // Grid 3 menu
    const grid = createEl('div', { class: 'landing-grid' });
    MENUS.forEach((m) => {
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
        btn.addEventListener('click', () => navigate(m.route));
      }
      item.appendChild(btn);

      const desc = createEl('div', { class: 'landing-desc' }, [m.label]);
      desc.appendChild(createEl('small', {}, [m.small]));
      item.appendChild(desc);

      grid.appendChild(item);
    });
    card.appendChild(grid);
  }

  const unsubs = ['token', 'username'].map((k) => subscribe(k, () => {
    renderTopbar();
    renderMenu();
  }));

  renderTopbar();
  renderMenu();

  page._cleanup = () => {
    unsubs.forEach((u) => u());
  };

  return page;
}