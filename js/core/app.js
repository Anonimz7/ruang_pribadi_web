/* core/app.js — App bootstrap */
import { $, on } from '../utils/dom.js';
import { store, subscribe } from './state.js';
import { initRouter, navigate } from './router.js';
import { createDrawer } from '../ui/drawer.js';
import { createAppBar } from '../ui/appbar.js';

function initTheme() {
  const apply = (mode) => {
    const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('rp-theme', mode);
  };
  apply(store.theme);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply(store.theme));
  subscribe('theme', apply);
}

function initDrawerToggle() {
  subscribe('drawerOpen', (open) => {
    const drawer = $('.drawer');
    const overlay = $('.drawer__overlay');
    if (!drawer) return;
    if (window.innerWidth <= 768) {
      drawer.classList.toggle('drawer--open', open);
      overlay?.classList.toggle('drawer__overlay--visible', open);
    }
  });
}

/**
 * Build the full app shell including drawer, appbar, and page container.
 * This replaces the initial loading state with the interactive UI.
 */
export async function initApp() {
  const root = $('#app');
  if (!root) {
    console.error('[RuangPribadi] #app element not found');
    return;
  }

  try {
    // Build shell inside #app
    root.innerHTML = '';
    const shell = document.createElement('div');
    shell.className = 'app-shell';

    // Overlay for mobile drawer
    const overlay = document.createElement('div');
    overlay.className = 'drawer__overlay';
    overlay.addEventListener('click', () => {
      store.drawerOpen = false;
    });
    shell.appendChild(overlay);

    // Drawer (async — waits for menu config)
    const drawer = await createDrawer();
    shell.appendChild(drawer);

    // Main area
    const mainArea = document.createElement('div');
    mainArea.className = 'main';
    mainArea.id = 'main-area';

    // AppBar
    const appbar = createAppBar();
    mainArea.appendChild(appbar);
    console.log('[RuangPribadi] AppBar created');

    // Page container
    const pageContainer = document.createElement('div');
    pageContainer.id = 'page-root';
    pageContainer.className = 'container';
    mainArea.appendChild(pageContainer);

    shell.appendChild(mainArea);
    root.appendChild(shell);

    // Modal & Toast containers (append to body, outside app)
    if (!document.getElementById('modal-root')) {
      const modalContainer = document.createElement('div');
      modalContainer.id = 'modal-root';
      document.body.appendChild(modalContainer);
    }
    if (!document.getElementById('toast-root')) {
      const toastContainer = document.createElement('div');
      toastContainer.id = 'toast-root';
      toastContainer.style.cssText =
        'position:fixed;top:16px;right:16px;z-index:400;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(toastContainer);
    }

    initTheme();
    initDrawerToggle();

    await initRouter();
    console.log('[RuangPribadi] App shell ready!');
  } catch (err) {
    console.error('[RuangPribadi] Failed to initialize app:', err);
    root.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;padding:var(--s-4);text-align:center;">
        <div>
          <h2 style="color:var(--c-danger);margin-bottom:var(--s-3);">Initialization Error</h2>
          <p style="color:var(--c-text-2);margin-bottom:var(--s-2);">${err.message || err}</p>
          <button onclick="window.location.reload()" style="padding:var(--s-2) var(--s-4);background:var(--c-primary);color:white;border:none;border-radius:var(--s-2);cursor:pointer;">
            Reload
          </button>
        </div>
      </div>
    `;
  }
}

// Bootstrap with error handling
initApp().catch((err) => {
  console.error('[RuangPribadi] Unhandled error in initApp:', err);
  document.body.innerHTML = `
    <div style="padding:var(--s-4);text-align:center;">
      <h2 style="color:var(--c-danger);">Fatal Error</h2>
      <p>${err.message || err}</p>
      <button onclick="window.location.reload()" style="margin-top:var(--s-3);padding:var(--s-2) var(--s-4);">Reload Page</button>
    </div>
  `;
});
