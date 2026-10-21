/* core/ws.js — Koneksi WebSocket bersama untuk halaman admin.
   Membangun URL dari ApiConfig + token sesi, memasang handler pesan
   JSON, dan menyamakan log gagal/error/putus. Logika per halaman
   tinggal di callback onMessage masing-masing. */
import { store } from './state.js';
import { ApiConfig } from './api-config.js';

export function connectWebSocket(path, { tag, onMessage }) {
  let wsUrl = ApiConfig.baseUrl.replace(/^http/, 'ws') + path;
  const token = store.token;
  if (token) wsUrl += '?token=' + encodeURIComponent(token);

  let ws;
  try {
    ws = new WebSocket(wsUrl);
  } catch (e) {
    console.error(`[${tag}] WS init failed:`, e);
    return null;
  }

  ws.onmessage = (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    onMessage(data);
  };
  ws.onerror = (err) => console.error(`[${tag}] WebSocket error:`, err);
  ws.onclose = () => console.log(`[${tag}] WebSocket disconnected`);
  return ws;
}
