/* core/theme.js — Theme resolution & application */
import { store, subscribe } from './state.js';

export function resolveTheme(mode) {
  return mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export function applyTheme(mode) {
  const isDark = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  localStorage.setItem('rp-theme', mode);
  return isDark;
}

export function initTheme() {
  applyTheme(store.theme);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(store.theme));
  subscribe('theme', applyTheme);
}