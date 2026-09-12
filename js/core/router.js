/* core/router.js — Hash router with lazy page loading (portal-aware) */
import { $ } from '../utils/dom.js';
import { store, subscribe } from './state.js';
import { loadSession, Auth } from './auth.js';
import { getPortal } from './menu-config.js';
import { showLogin } from '../pages/login-modal.js';

const cache = new Map();
let currentPageModule = null;

const PUBLIC_ROUTES = new Set([
  '/',
  '/tools',
  '/quiz',
  '/games',
]); // /login tidak lagi route publik (menggunakan modal pop-up)

const routes = {
  '/': () => import('../pages/saham/landing.js'),
  '/profile': () => import('../pages/saham/profile.js'),
  // Landing menu (hub Tools + placeholder Quiz/Games)
  '/tools': () => import('../pages/tools/tools.js'),
  '/quiz': () => import('../pages/coming-soon.js'),
  '/games': () => import('../pages/coming-soon.js'),
  // Tools & Quiz — tetap flat (belum di-portal-kan)
  '/math-speed': () => import('../pages/tools/math-speed-2/math-speed.js'),
  '/password': () => import('../pages/tools/password-gen/password-gen.js'),
  '/gacha': () => import('../pages/tools/gacha/gacha.js'),
  '/rolling': () => import('../pages/tools/rolling/rolling.js'),
  '/diagram': () => import('../pages/tools/diagram/diagram.js'),
  '/bahasa': () => import('../pages/tools/bahasa/bahasa.js'),
  '/video': () => import('../pages/tools/video/video.js'),
  '/video-history': () => import('../pages/tools/video/video-history.js'),
  // Portal Saham
  '/saham/news': () => import('../pages/saham/news.js'),
  '/saham/stocks': () => import('../pages/saham/stocks.js'),
  '/saham/stock-list': () => import('../pages/saham/stock-list.js'),
  '/saham/market': () => import('../pages/saham/market.js'),
  '/saham/reports': () => import('../pages/saham/reports.js'),
  '/saham/index': () => import('../pages/saham/index-saham.js'),
  '/saham/admin/dashboard': () => import('../pages/saham/admin/dashboard.js'),
  '/saham/admin/users': () => import('../pages/saham/admin/users.js'),
  '/saham/admin/backup': () => import('../pages/saham/admin/backup.js'),
  '/saham/admin/sitemaps': () => import('../pages/saham/admin/sitemaps.js'),
  '/saham/admin/proxies': () => import('../pages/saham/admin/proxies.js'),
  '/saham/admin/reports': () => import('../pages/saham/admin/reports.js'),
  '/saham/admin/stock-status': () => import('../pages/saham/admin/stock-status.js'),
  '/saham/admin/idx-upload': () => import('../pages/saham/admin/idx-upload.js'),
  // Tools — dikonversi dari HTML standalone ke ES module
  '/color-palate': () => import('../pages/tools/Color-Palate/color-palate.js'),
  '/math-dasar': () => import('../pages/tools/Math-Dasar/math-dasar.js'),
  '/bacak': () => import('../pages/tools/bacak/bacak.js'),
  '/tint-shade': () => import('../pages/tools/Color-Tint-Shade/color-tint-shade.js'),
  '/color-blind': () => import('../pages/tools/color-blind/color-blind.js'),
  '/jepunese': () => import('../pages/tools/jepunese/jepunese.js'),
  '/bahasa-interaktif': () => import('../pages/tools/Pembelajaran-Bahasa-Interaktif/bahasa-interaktif.js'),
  '/type-writing': () => import('../pages/tools/type-writing/type-writing.js'),
  '/math-speed-legacy': () => import('../pages/tools/math-speed/math-speed.js'),
};

/**
 * Normalize a path: '/saham' dan '/saham/admin' → halaman default portal.
 */
function normalizePath(path) {
  if (path === '/saham') {
    const portal = getPortal('saham');
    return (portal && portal.defaultPage) || '/saham/news';
  }
  if (path === '/saham/admin') return '/saham/admin/dashboard';
  return path;
}

/**
 * Check if the current user can access the given route.
 * Returns { allowed: bool, reason: string|null }
 */
function checkAccess(path) {
  const routeModule = routes[path];
  if (!routeModule) return { allowed: false, reason: 'Halaman tidak ditemukan.' };

  // Public routes don't require authentication
  if (PUBLIC_ROUTES.has(path)) return { allowed: true, reason: null };

  // Portal Saham: seluruh isi butuh login; /saham/admin/* butuh tier admin
  if (path.startsWith('/saham')) {
    if (!store.token) return { allowed: false, reason: 'login_required' };
    if (path.startsWith('/saham/admin') && !Auth.isAdmin()) {
      return { allowed: false, reason: 'Anda tidak memiliki akses admin.' };
    }
    return { allowed: true, reason: null };
  }

  // /profile butuh login
  if (path === '/profile') {
    if (!store.token) return { allowed: false, reason: 'login_required' };
    return { allowed: true, reason: null };
  }

  // Tools non-portal: tamu boleh akses bebas (tanpa paksa login).
  // User yang sudah login tetap dicek terhadap permission & hidden menu.
  const keyMap = {
    '/math-speed': 'math_speed',
    '/password': 'password_generator',
    '/gacha': 'gacha_luck',
    '/rolling': 'rolling',
    '/diagram': 'code_diagram',
    '/bahasa': 'language',
    '/video': 'video_downloader',
    '/video-history': 'video_history',
    '/color-palate': 'color_palate',
    '/math-dasar': 'math_dasar',
    '/bacak': 'csv_shuffler',
    '/tint-shade': 'tint_shade',
    '/color-blind': 'color_vision',
    '/jepunese': 'jepunese',
    '/bahasa-interaktif': 'bahasa_interaktif',
    '/type-writing': 'type_writing',
    '/math-speed-legacy': 'math_speed_legacy',
  };

  // Beberapa tool butuh login karena mengakses backend/akun.
  // Saat guest membukanya, tampilkan pop-up login (lalu lanjut ke tool setelah login).
  const TOOLS_REQUIRE_LOGIN = new Set(['/bahasa', '/video', '/video-history']);
  if (TOOLS_REQUIRE_LOGIN.has(path) && !store.token) {
    return { allowed: false, reason: 'login_required' };
  }

  // Tools non-portal: area tools dirancang bebas (sebagian butuh login saja),
  // sehingga TIDAK digate oleh permission backend. Yang membatasi hanya hidden menu.
  const appKey = keyMap[path];

  if (store.token) {
    if (appKey && Auth.isMenuHidden(appKey)) {
      return { allowed: false, reason: 'Menu ini disembunyikan.' };
    }
  }

  return { allowed: true, reason: null };
}

export async function navigate(path, push = true) {
  const app = $('#page-root');
  if (!app) return;

  path = normalizePath(path);

  // Sinkronkan portal aktif (drawer menyempit saat berada di dalam portal)
  store.activePortal = path.startsWith('/saham') ? 'saham' : null;

  // Check access before proceeding
  const { allowed, reason } = checkAccess(path);
  if (!allowed) {
    if (reason === 'login_required') {
      // Show login modal directly (no page redirect)
      store.pendingRoute = path;
      store.activePortal = null;
      showLogin();
      return;
    } else {
      app.innerHTML = `<div class="empty"><div class="empty__title">Akses Dibatasi</div><div class="empty__desc">${reason}</div></div>`;
      return;
    }
  }

  // Close login modal if open (it lives in body, not page-root)
  const existingModal = document.querySelector('.login-modal');
  if (existingModal) {
    existingModal.remove();
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