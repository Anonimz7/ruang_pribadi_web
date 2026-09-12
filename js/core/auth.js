/* core/auth.js — Authentication layer (mirrors Flutter AuthApi) */
import Api, { ApiError } from './api.js';
import { store } from './state.js';
import { tierRank, isAdminRank } from './tiers.js';

/**
 * Decode JWT token payload (base64url) without external libraries.
 */
function decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Check if token is expired (with 30s buffer).
 */
function isTokenExpired(token) {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return true;
  return Date.now() >= (payload.exp * 1000 - 30_000);
}

/**
 * Derive effective rank from user payload (backend-provided rank wins).
 */
function userRank(user) {
  const rank = Number(user?.rank);
  return Number.isFinite(rank) && rank >= 0 ? rank : tierRank(user?.tier);
}

/**
 * Persist user data + token to localStorage + Proxy store.
 */
function saveSession(token, user) {
  localStorage.setItem('jwt_token', token);
  localStorage.setItem('user_data', JSON.stringify(user));
  store.token = token;
  store.user = user;
  store.username = user.username ?? '';
  store.tier = user.tier ?? 'guest';
  store.rank = userRank(user);
  store.permissions = (user.permissions ?? []).map(String);
  store.hiddenMenus = (user.hidden_menus ?? []).map(String);
}

/**
 * Load session from localStorage into Proxy store.
 */
export async function loadSession() {
  const token = localStorage.getItem('jwt_token');
  const raw = localStorage.getItem('user_data');
  if (token && raw) {
    try {
      const user = JSON.parse(raw);
      store.token = token;
      store.user = user;
      store.username = user.username ?? '';
      store.tier = user.tier ?? 'guest';
      store.rank = userRank(user);
      store.permissions = (user.permissions ?? []).map(String);
      store.hiddenMenus = (user.hidden_menus ?? []).map(String);
      return true;
    } catch {
      clearSession();
      return false;
    }
  }
  return false;
}

export function clearSession() {
  store.token = null;
  store.user = null;
  store.username = '';
  store.tier = 'guest';
  store.rank = 3;
  store.permissions = [];
  store.hiddenMenus = [];
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user_data');
}

export const Auth = {
  /**
   * Login with username/password.
   * Returns the user object on success.
   */
  async login(username, password) {
    const r = await Api.post('/auth/login', { username, password });
    if (!r?.access_token) {
      throw new ApiError(r?.detail || 'Login gagal', 401);
    }
    saveSession(r.access_token, r.user ?? {});
    return store.user;
  },

  /**
   * Register a new account.
   */
  async register(username, password) {
    await Api.post('/auth/register', { username, password });
  },

  /**
   * Fetch /auth/me and refresh stored session data.
   * Handles auto-refresh if needed.
   */
  async me() {
    let token = store.token;
    if (token && isTokenExpired(token)) {
      // Attempt token refresh before calling /me
      token = await refreshToken();
      if (!token) throw new Error('Sesi telah berakhir. Silakan login kembali.');
    }
    const r = await Api.get('/auth/me');
    if (!r) throw new Error('Anda harus login untuk mengakses fitur ini.');
    saveSession(token || store.token || '', r);
    return store.user;
  },

  async logout() {
    await clearSession();
  },

  async changePassword(oldPassword, newPassword) {
    return await Api.put('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },

  /**
   * Rank-based access check (rank 0 = tertinggi):
   *   rank <= minTier (basis tier)  atau  app di permissions user (grant custom).
   * minTier default = tier dasar -> semua user login (rank <= max) lolos.
   */
  canAccess(appKey, minTier = 3) {
    const need = Number.isFinite(minTier) ? minTier : 3;
    if (store.rank <= need) return true;
    if (store.rank <= tierRank('admin')) return true;
    return store.permissions.includes(appKey);
  },

  // Bacaan cepat: apakah user berguna admin (rank tertinggi).
  isAdmin() {
    return isAdminRank(store.rank);
  },

  isMenuHidden(appKey) {
    return store.hiddenMenus.includes(appKey);
  },

  isLoggedIn() {
    return !!store.token;
  },
};

let refreshPromise = null;

/**
 * Refresh JWT token — returns new token or null.
 * Mirrors the implicit token rotation pattern used in Flutter's ApiClient.
 */
async function refreshToken() {
  if (refreshPromise) return refreshPromise; // Deduplicate concurrent refresh calls
  refreshPromise = _doRefresh();
  const result = await refreshPromise;
  refreshPromise = null;
  return result;
}

async function _doRefresh() {
  const token = store.token;
  if (!token) return null;
  try {
    // Backend uses /auth/refresh to issue a new token
    const r = await Api.post('/auth/refresh', { token });
    if (r?.access_token && !isTokenExpired(r.access_token)) {
      saveSession(r.access_token, store.user || {});
      return r.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

// Menu config loading is handled separately by drawer.js
// to avoid circular dependencies (menu-config imports ui/icons)