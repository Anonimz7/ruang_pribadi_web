/* core/router.js — Hash router with lazy page loading */
import { $ } from '../utils/dom.js';
import { store, subscribe } from './state.js';
import { loadSession, Auth } from './auth.js';

const cache = new Map();
let currentPageModule = null;

const PUBLIC_ROUTES = new Set([
  '/login',
  '/',
]);

const routes = {
  '/': () => import('../pages/dashboard.js'),
  '/login': () => import('../pages/login.js'),
  '/profile': () => import('../pages/profile.js'),
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

/**
 * Check if the current user can access the given route.
 * Returns { allowed: bool, reason: string|null }
 */
function checkAccess(path) {
  const loginPageModule = routes[path];
  if (!loginPageModule) return { allowed: false, reason: 'Halaman tidak ditemukan.' };

  // Public routes don't require authentication
  if (PUBLIC_ROUTES.has(path)) return { allowed: true, reason: null };

  // Determine the route's app key based on the path
  let appKey = null;
  const adminMatch = path.match(/^\/admin\/(.+)$/);
  if (adminMatch) {
    appKey = {
      users: 'user_permissions',
      dashboard: 'server_dashboard',
      sitemaps: 'sitemaps',
      proxies: 'proxies',
      backup: 'backup',
      reports: 'reports',
    }[adminMatch[1]];
  }
  if (!appKey) {
    const keyMap = {
      '/news': 'news',
      '/stocks': 'stocks',
      '/stock-list': 'stock_list',
      '/video': 'video_downloader',
      '/math-speed': 'math_speed',
      '/password': 'password_generator',
      '/gacha': 'gacha_luck',
      '/rolling': 'rolling',
      '/diagram': 'code_diagram',
      '/bahasa': 'language',
      '/reports': 'reports',
    };
    appKey = keyMap[path];
  }

  // Profile and Settings are accessible by all logged-in users

  if (!store.token) {
    return { allowed: false, reason: 'login_required' };
  }

  if (path === '/profile' || path === '/' || appKey === 'settings') {
    // Dashboard, Login, Profile, and Settings accessible by all logged-in users
    return { allowed: true, reason: null };
  }

  // Admin section requires admin tier
  if (path.startsWith('/admin') && store.tier !== 'admin') {
    return { allowed: false, reason: 'Anda tidak memiliki akses admin.' };
  }

  if (!Auth.canAccess(appKey)) {
    return { allowed: false, reason: 'Anda tidak memiliki izin untuk mengakses fitur ini.' };
  }

  if (Auth.isMenuHidden(appKey)) {
    return { allowed: false, reason: 'Menu ini disembunyikan.' };
  }

  return { allowed: true, reason: null };
}

export async function navigate(path, push = true) {
  const app = $('#page-root');
  if (!app) return;

  // Check access before proceeding
  const { allowed, reason } = checkAccess(path);
  if (!allowed) {
    if (reason === 'login_required') {
      // Redirect to login page, preserving the original destination
      store.pendingRoute = path;
      path = '/login';
    } else {
      app.innerHTML = `<div class="empty"><div class="empty__title">Akses Dibatasi</div><div class="empty__desc">${reason}</div></div>`;
      return;
    }
  }

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
    } else {
      console.warn('[Router] Page render returned null or no render function');
    }
    store.currentPage = path;
    if (push) window.location.hash = path;
    window.scrollTo(0, 0);
  } catch (err) {
    console.error('[Router] Page load error:', err);
    app.innerHTML = `<div class="empty"><div class="empty__title">Page Error</div><div class="empty__desc">${err.message}</div></div>`;
  }
}

export async function initRouter() {
  // Restore saved session on startup (mirrors Flutter's _client.loadSession())
  await loadSession();
  if (store.token) {
    await Auth.me().catch(() => {});
  }

  const handler = () => {
    const h = location.hash.slice(1) || '/';
    navigate(h, false);
  };
  window.addEventListener('hashchange', handler);
  await navigate(location.hash.slice(1) || '/', false);
}
