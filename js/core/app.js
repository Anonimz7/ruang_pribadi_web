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

export function initApp() {
  const root = $('#app');
  if (!root) return;

  // Build shell inside #app
  root.innerHTML = '';
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  // Overlay for mobile drawer
  const overlay = document.createElement('div');
  overlay.className = 'drawer__overlay';
  overlay.addEventListener('click', () => { store.drawerOpen = false; });
  shell.appendChild(overlay);

  // Drawer
  const drawer = createDrawer();
  shell.appendChild(drawer);

  // Main area
  const mainArea = document.createElement('div');
  mainArea.className = 'main';
  mainArea.id = 'main-area';

  // AppBar
  const appbar = createAppBar();
  mainArea.appendChild(appbar);

  // Page container — use unique ID
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
    toastContainer.style.cssText = 'position:fixed;top:16px;right:16px;z-index:400;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(toastContainer);
  }

  initTheme();
  initDrawerToggle();
  initRouter();
}

initApp();
