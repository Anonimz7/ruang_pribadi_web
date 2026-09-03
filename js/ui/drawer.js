/* ui/drawer.js — Side navigation */
import { store, subscribe } from '../core/state.js';
import { icons } from './icons.js';

const MENU_ITEMS = [
  { section: 'menu', label: 'Menu', items: [
    { key: 'math_speed', label: 'Math Speed', icon: 'calculate', path: '/math-speed' },
    { key: 'password_generator', label: 'Password Generator', icon: 'key', path: '/password' },
    { key: 'gacha_luck', label: 'Gacha Luck', icon: 'dice', path: '/gacha' },
    { key: 'rolling', label: 'Rolling Yes/No', icon: 'target', path: '/rolling' },
    { key: 'code_diagram', label: 'Render Diagram', icon: 'git-branch', path: '/diagram' },
    { key: 'language', label: 'Language', icon: 'globe', path: '/bahasa' },
    { key: 'video_downloader', label: 'Video Downloader', icon: 'download', path: '/video' },
  ]},
  { section: 'market', label: 'Market', items: [
    { key: 'news', label: 'News', icon: 'newspaper', path: '/news' },
    { key: 'stocks', label: 'IDX Stocks', icon: 'trending-up', path: '/stocks' },
    { key: 'stock_list', label: 'Stock List', icon: 'list', path: '/stock-list' },
    { key: 'ihsg_radar', label: 'IHSG Radar', icon: 'radar', path: '/stocks' },
    { key: 'reports', label: 'Reports', icon: 'file-text', path: '/reports' },
  ]},
  { section: 'admin', label: 'Admin', items: [
    { key: 'user_permissions', label: 'User Permissions', icon: 'users', path: '/admin/users' },
    { key: 'server_dashboard', label: 'Server Dashboard', icon: 'monitor', path: '/admin/dashboard' },
    { key: 'sitemaps', label: 'Sitemaps', icon: 'map', path: '/admin/sitemaps' },
    { key: 'proxies', label: 'Proxy Scraper', icon: 'link', path: '/admin/proxies' },
    { key: 'backup', label: 'Backup System', icon: 'database', path: '/admin/backup' },
    { key: 'stock_status', label: 'Stock Status', icon: 'shield', path: '/admin/dashboard' },
    { key: 'idx_upload', label: 'IDX Upload', icon: 'upload', path: '/admin/dashboard' },
  ]},
  { section: 'system', label: 'System', items: [
    { key: 'settings', label: 'Settings', icon: 'settings', path: '/' },
    { key: 'profile', label: 'Profile', icon: 'user', path: '/' },
  ]},
];

export function createDrawer() {
  const el = document.createElement('aside');
  el.className = 'drawer';
  el.id = 'drawer';

  // User card
  const userCard = document.createElement('div');
  userCard.className = 'drawer__user';
  userCard.innerHTML = `
    <div class="drawer__avatar">G</div>
    <div class="drawer__user-info">
      <div class="drawer__user-name">Guest</div>
      <div class="drawer__user-tier">guest</div>
    </div>
  `;
  el.appendChild(userCard);

  // Nav sections
  const nav = document.createElement('nav');
  nav.className = 'drawer__nav';
  nav.style.paddingBottom = 'var(--s-4)';

  MENU_ITEMS.forEach(group => {
    const label = document.createElement('div');
    label.className = 'drawer__section-label';
    label.textContent = group.label;
    nav.appendChild(label);

    group.items.forEach(item => {
      const a = document.createElement('a');
      a.href = '#' + item.path;
      a.className = 'drawer__item';
      a.dataset.key = item.key;
      a.dataset.path = item.path;
      a.innerHTML = `
        <span class="drawer__icon">${icons[item.icon] || ''}</span>
        <span class="drawer__label">${item.label}</span>
      `;
      a.addEventListener('click', () => {
        if (window.innerWidth <= 768) store.drawerOpen = false;
      });
      nav.appendChild(a);
    });
  });

  // Logout at bottom
  const logoutWrap = document.createElement('div');
  logoutWrap.style.marginTop = 'auto';
  logoutWrap.style.padding = 'var(--s-3) var(--s-4)';
  logoutWrap.innerHTML = `
    <button class="drawer__item" style="width:100%;margin:0;">
      <span class="drawer__icon">${icons['log-out']}</span>
      <span class="drawer__label">Logout</span>
    </button>
  `;
  nav.appendChild(logoutWrap);

  el.appendChild(nav);

  // Active state sync
  subscribe('currentPage', (path) => {
    el.querySelectorAll('.drawer__item').forEach(item => {
      item.classList.toggle('drawer__item--active', item.dataset.path === path);
    });
  });

  // Touch swipe to close on mobile
  let touchStartX = 0;
  el.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    const diff = e.touches[0].clientX - touchStartX;
    if (diff < -60 && window.innerWidth <= 768) {
      store.drawerOpen = false;
    }
  }, { passive: true });

  return el;
}
