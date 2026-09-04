/* core/router.js — Hash router with lazy page loading */
import { $ } from '../utils/dom.js';
import { store, subscribe } from './state.js';

const cache = new Map();
let currentPageModule = null;

const routes = {
  '/': () => import('../pages/dashboard.js'),
  '/news': () => import('../pages/news.js'),
  '/stocks': () => import('../pages/stocks.js'),
  '/stock-list': () => import('../pages/stock-list.js'),
  '/video': () => import('../pages/video.js'),
  '/math-speed': () => import('../pages/math-speed.js'),
  '/password': () => import('../pages/password-gen.js'),
  '/gacha': () => import('../pages/gacha.js'),
  '/rolling': () => import('../pages/rolling.js'),
  '/diagram': () => import('../pages/diagram.js'),
  '/bahasa': () => import('../pages/bahasa.js'),
  '/reports': () => import('../pages/reports.js'),
  '/admin/dashboard': () => import('../pages/admin/dashboard.js'),
  '/admin/users': () => import('../pages/admin/users.js'),
  '/admin/backup': () => import('../pages/admin/backup.js'),
  '/admin/sitemaps': () => import('../pages/admin/sitemaps.js'),
  '/admin/proxies': () => import('../pages/admin/proxies.js'),
  '/admin/reports': () => import('../pages/admin/reports.js'),
};

export async function navigate(path, push = true) {
  const app = $('#page-root');
  if (!app) return;

  // Cleanup previous page module
  if (currentPageModule) {
    if (typeof currentPageModule.destroy === 'function') {
      currentPageModule.destroy();
    }
    if (app._cleanup) {
      app._cleanup();
      app._cleanup = null;
    }
  }

  app.innerHTML = '';
  const skeleton = document.createElement('div');
  skeleton.className = 'skeleton';
  skeleton.style.cssText = 'height:200px;width:100%;border-radius:10px;';
  app.appendChild(skeleton);

  const loader = routes[path] || routes['/'];
  try {
    const mod = cache.has(path) ? cache.get(path) : await loader();
    if (!cache.has(path)) cache.set(path, mod);
    currentPageModule = mod;
    app.innerHTML = '';
    const page = mod.render ? mod.render() : mod.default?.render?.();
    if (page) {
      app.appendChild(page);
      // Store cleanup if the page provides one via _cleanup
      if (typeof page._cleanup === 'function') {
        app._cleanup = page._cleanup;
      }
    }
    store.currentPage = path;
    if (push) window.location.hash = path;
    window.scrollTo(0, 0);
  } catch (err) {
    app.innerHTML = `<div class="empty"><div class="empty__title">Page Error</div><div class="empty__desc">${err.message}</div></div>`;
  }
}

export function initRouter() {
  const handler = () => navigate(location.hash.slice(1) || '/', false);
  window.addEventListener('hashchange', handler);
  handler();
}
