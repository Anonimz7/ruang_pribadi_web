/* ui/theme-toggle.js — Shared theme toggle button */
import { store, subscribe } from '../core/state.js';
import { resolveTheme } from '../core/theme.js';
import { icons } from './icons.js';

export function createThemeToggle() {
  const btn = document.createElement('button');
  btn.className = 'appbar__btn tooltip';
  btn.title = 'Ganti tema';
  btn.setAttribute('aria-label', 'Toggle theme');
  btn.innerHTML = icons[resolveTheme(store.theme) ? 'sun' : 'moon'];
  btn.addEventListener('click', () => {
    const modes = ['light', 'dark', 'system'];
    const idx = modes.indexOf(store.theme);
    store.theme = modes[(idx + 1) % modes.length];
  });
  const destroy = subscribe('theme', (mode) => {
    btn.innerHTML = icons[resolveTheme(mode) ? 'sun' : 'moon'];
  });
  return { el: btn, destroy };
}