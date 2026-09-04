/* core/state.js — Reactive store */
const listeners = new Map();

export const store = new Proxy({
  user: null,
  token: null,
  username: '',
  tier: 'guest',
  permissions: [],
  hiddenMenus: [],
  pendingRoute: null,
  theme: localStorage.getItem('rp-theme') || 'system',
  drawerOpen: false,
  currentPage: '/',
  isLoading: false,
  toast: null,
  modal: null,
}, {
  set(target, key, value) {
    const old = target[key];
    target[key] = value;
    if (old !== value && listeners.has(key)) {
      listeners.get(key).forEach(cb => cb(value, old));
    }
    return true;
  }
});

export function subscribe(key, cb) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(cb);
  return () => listeners.get(key).delete(cb);
}
