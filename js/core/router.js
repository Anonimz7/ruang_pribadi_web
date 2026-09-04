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
  console.log('[Router] navigate called with path:', path, '(push:', push, ')');
  const app = $('#page-root');
  console.log('[Router] #page-root found:', !!app);
  console.log('[Router] #app innerHTML length:', $('#app')?.innerHTML?.length || 'N/A');
  if (!app) {
    console.warn('[Router] #page-root not found in DOM. Current body:', document.body.innerHTML.substring(0, 500));
    return;
  }

  // Check access before proceeding
  const { allowed, reason } = checkAccess(path);
  console.log('[Router] access check:', { allowed, reason });
  if (!allowed) {
    if (reason === 'login_required') {
      // Redirect to login page, preserving the original destination
      store.pendingRoute = path;
      path = '/login';
      console.log('[Router] Redirecting to login, pendingRoute:', store.pendingRoute);
    } else {
      app.innerHTML = `<div class="empty"><div class="empty__title">Akses Dibatasi</div><div class="empty__desc">${reason}</div></div>`;
      return;
    }
  }

  // Cleanup previous page module
  if (currentPageModule) {
    console.log('[Router] Cleaning up previous page module');
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
  console.log('[Router] Loading module for path:', path, '(cached:', cache.has(path), ')');
  try {
    const mod = cache.has(path) ? cache.get(path) : await loader();
    if (!cache.has(path)) cache.set(path, mod);
    currentPageModule = mod;
    app.innerHTML = '';
    const page = mod.render ? mod.render() : mod.default?.render?.();
    console.log('[Router] Page module loaded, render result:', page ? 'DOM element' : 'null');
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
    console.log('[Router] Navigation complete, page rendered');
  } catch (err) {
    console.error('[Router] Page load error:', err);
    app.innerHTML = `<div class="empty"><div class="empty__title">Page Error</div><div class="empty__desc">${err.message}</div></div>`;
  }
}

export async function initRouter() {
  console.log('[Router] Initializing router...');

  // Restore saved session on startup (mirrors Flutter's _client.loadSession())
  console.log('[Router] Loading session...');
  await loadSession();
  console.log('[Router] Session loaded, token:', store.token ? 'present' : 'none');

  if (store.token) {
    console.log('[Router] Validating session with /auth/me...');
    await Auth.me().catch((e) => console.warn('[Router] /auth/me failed:', e.message));
    console.log('[Router] Session validated, tier:', store.tier, ', permissions:', store.permissions.length);
  }

  const hash = location.hash.slice(1) || '/';
  console.log('[Router] Initial hash:', hash, '-> normalized path:', location.hash.slice(1));
  const handler = () => {
    const h = location.hash.slice(1) || '/';
    console.log('[Router] Hash change to:', h);
    navigate(h, false);
  };
  window.addEventListener('hashchange', handler);
  console.log('[Router] Starting initial navigation...');
  await navigate(hash, false);
  console.log('[Router] Initial navigation complete');
}
