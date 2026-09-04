/* pages/video-history.js — Download History (Anti-Slop, Dart-parity) */
import { $, on, createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';
import Api from '../core/api.js';
import { toast } from '../ui/toast.js';
import { store } from '../core/state.js';
import { ApiConfig } from '../core/api-config.js';

/* ─── Helpers ─── */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dtStr) {
  if (!dtStr) return '';
  const dt = new Date(dtStr);
  if (isNaN(dt.getTime())) {
    // Try epoch seconds
    const epoch = parseInt(dtStr, 10);
    if (!isNaN(epoch)) {
      const d2 = new Date(epoch * 1000);
      if (!isNaN(d2.getTime())) return formatDateObj(d2);
    }
    return '';
  }
  return formatDateObj(dt);
}

function formatDateObj(dt) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function getExt(filename) {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toUpperCase() : '';
}

/* ─── State ─── */
const state = {
  records: [],
  loading: true,
  ws: null,
};

/* ─── API ─── */
async function loadHistory() {
  state.loading = true;
  renderList();
  try {
    const res = await Api.get('/video/history');
    const data = res?.data || res || [];
    state.records = data.map(e => ({
      id: e.id ?? (e.file_name?.hashCode?.() || 0),
      fileName: e.file_name,
      filePath: e.file_path,
      fileSize: e.file_size,
      createdAt: e.created_at,
    }));
    state.loading = false;
    renderList();
  } catch (e) {
    state.loading = false;
    toast('Gagal memuat riwayat: ' + (e.message || e), 'danger');
    renderList();
  }
}

async function deleteRecord(record) {
  if (!record.fileName) return;
  if (!confirm(`Hapus "${record.fileName}" dari perangkat?`)) return;
  try {
    await Api.delete('/video/' + encodeURIComponent(record.fileName));
    state.records = state.records.filter(r => r.fileName !== record.fileName);
    renderList();
    toast(`${record.fileName} dihapus`, 'success');
  } catch (e) {
    toast('Gagal menghapus: ' + (e.message || e), 'danger');
  }
}

function playVideo(record) {
  if (!record.fileName) return;
  const url = ApiConfig.baseUrl + ApiConfig.prefix + '/video/stream/' + encodeURIComponent(record.fileName);
  const token = store.token;
  const fullUrl = token ? `${url}?token=${token}` : url;
  window.open(fullUrl, '_blank');
}

/* ─── WebSocket ─── */
function connectWebSocket() {
  const userId = store.user?.user_id || store.username;
  if (!userId) return;
  const wsUrl = ApiConfig.baseUrl.replace(/^http/, 'ws') + '/ws/video-progress/' + userId;
  try {
    state.ws = new WebSocket(wsUrl);
    state.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.status === 'completed' || msg.status === 'finished') {
          loadHistory();
        }
      } catch (_) {}
    };
    state.ws.onerror = () => {};
    state.ws.onclose = () => {};
  } catch (_) {}
}

/* ─── DOM ─── */
let rootEl = null;
let listEl = null;

function renderHeader() {
  const header = createEl('div', { style: { marginBottom: 'var(--s-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--s-3)' } });
  header.innerHTML = `
    <div>
      <h1 style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--s-1);">Riwayat Download</h1>
      <p style="color:var(--c-text-2);font-size:var(--text-sm);">Daftar video yang telah diunduh.</p>
    </div>
    <div style="display:flex;gap:var(--s-2);">
      <button class="btn btn--secondary" id="vh-refresh" aria-label="Refresh">
        ${icons.refresh} <span>Refresh</span>
      </button>
      <a href="#/video" class="btn btn--ghost" style="font-size:var(--text-sm);">
        ${icons.download} <span>Downloader</span>
      </a>
    </div>
  `;
  on(header.querySelector('#vh-refresh'), 'click', loadHistory);
  rootEl.appendChild(header);
}

function renderList() {
  if (!listEl) {
    listEl = createEl('div', { class: 'video-history__list' });
    rootEl.appendChild(listEl);
  }

  if (state.loading) {
    listEl.innerHTML = `
      <div class="card" style="padding:var(--s-6);text-align:center;">
        <div class="spinner" style="width:32px;height:32px;border:3px solid var(--c-border);border-top-color:var(--c-primary);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto var(--s-3);"></div>
        <div style="font-size:var(--text-sm);color:var(--c-text-2);">Memuat riwayat...</div>
      </div>
    `;
    return;
  }

  if (state.records.length === 0) {
    listEl.innerHTML = `
      <div class="empty">
        <div class="empty__icon">${icons.download}</div>
        <div class="empty__title">Belum ada download</div>
        <div class="empty__desc">Video yang berhasil diunduh akan muncul di sini.</div>
        <a href="#/video" class="btn btn--primary">Mulai Download</a>
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';
  state.records.forEach(record => {
    const ext = getExt(record.fileName);
    const size = formatBytes(record.fileSize);
    const date = formatDate(record.createdAt);

    const card = createEl('div', {
      class: 'card',
      style: {
        marginBottom: 'var(--s-3)',
        padding: 'var(--s-3) var(--s-4)',
        cursor: 'pointer',
        transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
      },
      tabindex: '0',
      role: 'button',
      'aria-label': `Putar video ${record.fileName || 'video'}`,
    });

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--s-3);">
        <div style="width:48px;height:48px;background:var(--c-success-bg);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--c-success);">
          ${icons.play}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:var(--text-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:var(--s-1);">${record.fileName || 'Video'}</div>
          <div style="display:flex;align-items:center;gap:var(--s-2);flex-wrap:wrap;">
            ${ext ? `<span class="badge badge--primary">${ext}</span>` : ''}
            <span style="font-size:var(--text-xs);color:var(--c-text-3);">${size}</span>
            <span style="font-size:var(--text-xs);color:var(--c-text-3);">${date}</span>
          </div>
        </div>
        <div style="display:flex;gap:var(--s-1);flex-shrink:0;">
          <button class="btn btn--ghost btn--sm" style="padding:var(--s-2);width:36px;height:36px;min-width:36px;min-height:36px;color:var(--c-success);" aria-label="Putar video" data-play="${record.fileName || ''}">
            ${icons.play}
          </button>
          <button class="btn btn--ghost btn--sm" style="padding:var(--s-2);width:36px;height:36px;min-width:36px;min-height:36px;color:var(--c-danger);" aria-label="Hapus video" data-delete="${record.fileName || ''}">
            ${icons.trash}
          </button>
        </div>
      </div>
    `;

    // Click card to play
    on(card, 'click', (e) => {
      if (e.target.closest('button')) return;
      playVideo(record);
    });
    on(card, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        playVideo(record);
      }
    });

    // Button handlers
    const playBtn = card.querySelector('[data-play]');
    if (playBtn) on(playBtn, 'click', (e) => { e.stopPropagation(); playVideo(record); });

    const delBtn = card.querySelector('[data-delete]');
    if (delBtn) on(delBtn, 'click', (e) => { e.stopPropagation(); deleteRecord(record); });

    listEl.appendChild(card);
  });
}

/* ─── Cleanup ─── */
function cleanup() {
  if (state.ws) { try { state.ws.close(); } catch (_) {} state.ws = null; }
  rootEl = null;
  listEl = null;
}

/* ─── Export ─── */
export function render() {
  state.records = [];
  state.loading = true;
  state.ws = null;

  rootEl = createEl('div', { class: 'video-history-page', style: { maxWidth: '720px', margin: '0 auto', padding: 'var(--s-4)' } });

  // Add spinner keyframe if missing
  if (!document.getElementById('video-page-keyframes')) {
    const style = createEl('style', { id: 'video-page-keyframes' });
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  renderHeader();
  renderList();

  loadHistory();
  connectWebSocket();

  rootEl._cleanup = cleanup;
  return rootEl;
}
