/* ui/appbar.js — Top app bar */
import { store, subscribe } from '../core/state.js';
import { navigate } from '../core/router.js';
import { Auth } from '../core/auth.js';
import { icons } from './icons.js';
import { showLogin } from '../pages/login-modal.js';

export function createAppBar() {
  const el = document.createElement('header');
  el.className = 'appbar';

  // Menu button (mobile)
  const menuBtn = document.createElement('button');
  menuBtn.className = 'appbar__menu-btn';
  menuBtn.innerHTML = icons['menu'];
  menuBtn.setAttribute('aria-label', 'Open menu');
  menuBtn.addEventListener('click', () => {
    store.drawerOpen = !store.drawerOpen;
  });
  el.appendChild(menuBtn);

  // Title
  const title = document.createElement('div');
  title.className = 'appbar__title';
  title.textContent = 'Ruang Pribadi';
  el.appendChild(title);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'appbar__actions';

  // Theme toggle
  const themeBtn = document.createElement('button');
  themeBtn.className = 'appbar__btn tooltip';
  themeBtn.innerHTML = icons['moon'];
  themeBtn.setAttribute('aria-label', 'Toggle theme');
  themeBtn.addEventListener('click', () => {
    const modes = ['light', 'dark', 'system'];
    const idx = modes.indexOf(store.theme);
    store.theme = modes[(idx + 1) % modes.length];
  });
  actions.appendChild(themeBtn);

  // Login/Logout button (reactive)
  const loginBtn = document.createElement('button');
  loginBtn.className = 'btn btn--primary btn--sm';
  loginBtn.setAttribute('aria-label', 'Login / Logout');

  const updateLoginBtn = () => {
    if (store.token) {
      const displayName = store.username || 'User';
      loginBtn.innerHTML = `
        <span style="font-size:13px;font-weight:500;">${displayName}</span>
        <span style="margin-left:4px;">${icons['log-out']}</span>
      `;
      loginBtn.title = 'Logout';
      loginBtn.onclick = null;
      loginBtn.addEventListener('click', async () => {
        await Auth.logout();
        window.location.hash = '/';
        window.location.reload();
      });
    } else {
      loginBtn.innerHTML = `<span class="login-text">Login</span>`;
      loginBtn.title = 'Login';
      loginBtn.onclick = null;
      loginBtn.addEventListener('click', () => {
        showLogin();
      });
    }
  };

  updateLoginBtn();
  actions.appendChild(loginBtn);

  // React to auth changes
  subscribe('token', updateLoginBtn);
  subscribe('username', updateLoginBtn);

  el.appendChild(actions);

  // Update title based on page
  subscribe('currentPage', (path) => {
    const map = {
      '/': 'Beranda',
      '/profile': 'Profile',
      '/math-speed': 'Math Speed',
      '/password': 'Password Generator',
      '/gacha': 'Gacha Luck',
      '/rolling': 'Rolling Yes/No',
      '/diagram': 'Code Diagram',
      '/bahasa': 'Language',
      '/saham/news': 'News Intelligence',
      '/saham/stocks': 'IDX Stocks',
      '/saham/stock-list': 'Stock List',
      '/saham/market': 'IHSG Radar',
      '/saham/reports': 'Reports',
      '/saham/video': 'Video Downloader',
      '/saham/video-history': 'Video History',
      '/saham/admin/dashboard': 'Server Dashboard',
      '/saham/admin/users': 'User Permissions',
      '/saham/admin/backup': 'Backup System',
      '/saham/admin/sitemaps': 'Sitemaps',
      '/saham/admin/proxies': 'Proxy Scraper',
      '/saham/admin/reports': 'Reports Admin',
      '/saham/admin/stock-status': 'Stock Status',
      '/saham/admin/idx-upload': 'IDX Upload',
    };
    title.textContent = map[path] || 'Ruang Pribadi';
  });

  // Theme icon sync
  subscribe('theme', (mode) => {
    themeBtn.innerHTML = icons[mode === 'dark' ? 'sun' : 'moon'];
  });

  return el;
}
