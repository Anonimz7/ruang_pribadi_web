/* ui/appbar.js — Top app bar */
import { store, subscribe } from '../core/state.js';
import { icons } from './icons.js';

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

  // Notification
  const notifBtn = document.createElement('button');
  notifBtn.className = 'appbar__btn tooltip';
  notifBtn.innerHTML = icons['bell'];
  notifBtn.setAttribute('aria-label', 'Notifications');
  notifBtn.innerHTML += '<span class="appbar__btn-badge"></span>';
  actions.appendChild(notifBtn);

  // Login
  const loginBtn = document.createElement('button');
  loginBtn.className = 'btn btn--primary btn--sm';
  loginBtn.innerHTML = '<span class="login-text">Login</span>';
  loginBtn.addEventListener('click', () => {
    import('./login.js').then(m => m.showLogin());
  });
  actions.appendChild(loginBtn);

  el.appendChild(actions);

  // Update title based on page
  subscribe('currentPage', (path) => {
    const map = {
      '/': 'Dashboard',
      '/news': 'News Intelligence',
      '/stocks': 'IDX Stocks',
      '/stock-list': 'Stock List',
      '/video': 'Video Downloader',
      '/math-speed': 'Math Speed',
      '/password': 'Password Generator',
      '/gacha': 'Gacha Luck',
      '/rolling': 'Rolling Yes/No',
      '/diagram': 'Code Diagram',
      '/bahasa': 'Language',
      '/reports': 'Reports',
      '/admin/dashboard': 'Server Dashboard',
      '/admin/users': 'User Permissions',
      '/admin/backup': 'Backup System',
      '/admin/sitemaps': 'Sitemaps',
      '/admin/proxies': 'Proxy Scraper',
      '/admin/reports': 'Reports Admin',
    };
    title.textContent = map[path] || 'Ruang Pribadi';
  });

  // Theme icon sync
  subscribe('theme', (mode) => {
    themeBtn.innerHTML = icons[mode === 'dark' ? 'sun' : 'moon'];
  });

  return el;
}
