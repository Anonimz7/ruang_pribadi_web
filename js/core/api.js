/* core/api.js — Centralized API client (mirrors Flutter ApiClient) */
import { store } from './state.js';
import { ApiConfig } from './api-config.js';

const TIMEOUT = 30_000;

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function _triggerSessionExpired() {
  store.token = null;
  store.user = null;
  store.permissions = [];
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user_data');
}

/**
 * Build request headers, including Authorization if a token is stored.
 */
async function _buildHeaders(extra = {}) {
  const h = new Headers({ 'Content-Type': 'application/json', ...extra });
  const token = store.token;
  if (token) h.set('Authorization', `Bearer ${token}`);
  return h;
}

/**
 * Core request handler — all HTTP methods funnel through here.
 */
async function _request(method, path, { params, body, isMultipart = false, file, fieldName = 'file' } = {}) {
  const url = new URL(ApiConfig.baseUrl + ApiConfig.prefix + path);
  if (params) url.search = new URLSearchParams(params).toString();

  let options = { method, headers: await _buildHeaders() };

  if (isMultipart && file) {
    const form = new FormData();
    form.append(fieldName, file);
    if (body) {
      for (const [k, v] of Object.entries(body)) form.append(k, v);
    }
    options = { method, body: form }; // Browser sets correct multipart headers
    delete options.headers['Content-Type'];
  } else if (body) {
    options.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT);

  let res;
  try {
    res = await fetch(url.toString(), { ...options, signal: controller.signal });
  } catch (e) {
    clearTimeout(id);
    if (e.name === 'AbortError') {
      throw new ApiError('Tidak dapat terhubung ke server. Silakan coba lagi.', 408);
    }
    throw new ApiError('Tidak dapat terhubung ke server. Cek koneksi internet.', 0);
  }
  clearTimeout(id);

  let data;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (res.ok) return data;
  if (res.status === 401) {
    _triggerSessionExpired(); // Auto-logout on expired/invalid token
    return null;
  }
  const msg = data?.detail || `Error ${res.status}`;
  throw new ApiError(msg, res.status);
}

const Api = {
  get: (path, params) => _request('GET', path, { params }),
  post: (path, body) => _request('POST', path, { body }),
  put: (path, body) => _request('PUT', path, { body }),
  delete: (path) => _request('DELETE', path),

  // Special: authenticated download URL builder (like Flutter getDownloadUrl)
  getDownloadUrl(path) {
    const token = store.token;
    return token
      ? `${ApiConfig.baseUrl}${ApiConfig.prefix}${path}?token=${token}`
      : `${ApiConfig.baseUrl}${ApiConfig.prefix}${path}`;
  },

  // Special: multipart form upload (admin backup/proxy upload)
  multipartPost: (path, file, opts = {}) =>
    _request('POST', path, {
      isMultipart: true,
      file,
      fieldName: opts.fieldName,
      body: opts.extraFields || {},
    }),
};

export { ApiError };
export default Api;
