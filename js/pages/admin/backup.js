/* pages/admin/backup.js — Backup System with API + WebSocket */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api, { ApiError } from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { ApiConfig } from '../../core/api-config.js';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function render() {
  const state = {
    backupStatus: null,
    backupHistory: [],
    gdriveConnected: false,
    gdriveInfo: null,
    ws: null,
  };

  const container = createEl('div', { class: 'admin-backup' }, []);

  container.appendChild(createEl('h1', {}, ['Backup System']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Manage database backups and Google Drive integration.']));

  // Status card
  const statusCard = createEl('div', { class: 'card', style: { maxWidth: '640px', margin: '0 auto var(--s-5)' } });
  container.appendChild(statusCard);

  // Google Drive card
  const gdriveCard = createEl('div', { class: 'card', style: { maxWidth: '640px', margin: '0 auto var(--s-5)' } });
  container.appendChild(gdriveCard);

  // History card
  const historyCard = createEl('div', { class: 'card', style: { maxWidth: '640px', margin: '0 auto' } });
  container.appendChild(historyCard);

  // ---- Functions ----

  async function loadBackupStatus() {
    try {
      const res = await Api.get('/admin/backup/status');
      state.backupStatus = res;
      renderStatusCard();
    } catch (e) {
      state.backupStatus = null;
      renderStatusCard();
    }
  }

  function renderStatusCard() {
    statusCard.innerHTML = '';
    statusCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    statusCard.querySelector('.card__head').innerHTML = '<div class="card__title">Backup Status</div>';

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' } });

    const phase = state.backupStatus?.phase || 'idle';
    const percent = state.backupStatus?.percent || 0;
    const message = state.backupStatus?.message || 'Ready';

    const phaseLabel = {
      idle: 'Idle',
      running: 'Running',
      done: 'Completed',
      failed: 'Failed',
    }[phase] || phase;

    body.innerHTML = `
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--s-2);font-size:var(--text-sm);">
          <span style="font-weight:500;">${phaseLabel}</span>
          <span style="color:var(--c-text-3);">${message}</span>
        </div>
        <div class="progress"><div class="progress__bar" style="width:${percent}%"></div></div>
      </div>
      <div style="display:flex;gap:var(--s-3);">
        <button class="btn btn--primary" style="flex:1;" id="run-backup" ${phase === 'running' ? 'disabled' : ''}>
          ${icons['database']} Run Backup
        </button>
        <button class="btn btn--secondary" id="refresh-backup">${icons['refresh']} Refresh</button>
      </div>
    `;
    body.querySelector('#run-backup').addEventListener('click', runBackup);
    body.querySelector('#refresh-backup').addEventListener('click', loadBackupStatus);
    statusCard.appendChild(body);
  }

  async function runBackup() {
    try {
      const res = await Api.post('/admin/backup/run');
      if (res?.success) {
        toast('Backup dimulai', { type: 'success' });
        loadBackupStatus();
        initWebSocket();
      }
    } catch (e) {
      toast('Gagal memulai backup: ' + (e.message || e), { type: 'error' });
    }
  }

  async function loadGdriveInfo() {
    try {
      const res = await Api.get('/admin/backup/gdrive/info');
      state.gdriveConnected = res?.connected || false;
      state.gdriveInfo = res;
      renderGdriveCard();
    } catch (e) {
      state.gdriveConnected = false;
      renderGdriveCard();
    }
  }

  function renderGdriveCard() {
    gdriveCard.innerHTML = '';
    gdriveCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    gdriveCard.querySelector('.card__head').innerHTML = '<div class="card__title">Google Drive</div>';

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' } });

    if (state.gdriveConnected && state.gdriveInfo) {
      const storage = state.gdriveInfo.storage || {};
      body.innerHTML = `
        <div style="display:flex;align-items:center;gap:var(--s-4);">
          <div style="width:48px;height:48px;border-radius:var(--radius);background:var(--c-success-bg);color:var(--c-success);display:flex;align-items:center;justify-content:center;">
            ${icons['check']}
          </div>
          <div>
            <div style="font-weight:600;">Connected</div>
            <div style="font-size:var(--text-sm);color:var(--c-text-3);">
              ${storage.used && storage.total
                ? `${formatBytes(storage.used)} / ${formatBytes(storage.total)} used`
                : '-'}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:var(--s-3);">
          <button class="btn btn--secondary" id="gdrive-disconnect">${icons['shield']} Disconnect</button>
        </div>
      `;
      body.querySelector('#gdrive-disconnect').addEventListener('click', disconnectGdrive);
    } else {
      body.innerHTML = `
        <div style="display:flex;align-items:center;gap:var(--s-4);">
          <div style="width:48px;height:48px;border-radius:var(--radius);background:var(--c-surface-2);color:var(--c-text-3);display:flex;align-items:center;justify-content:center;">
            ${icons['upload']}
          </div>
          <div>
            <div style="font-weight:600;">Not Connected</div>
            <div style="font-size:var(--text-sm);color:var(--c-text-3);">Connect to Google Drive for automatic backup uploads</div>
          </div>
        </div>
        <div style="display:flex;gap:var(--s-3);">
          <button class="btn btn--primary" id="gdrive-connect">${icons['upload']} Connect to GDrive</button>
        </div>
      `;
      body.querySelector('#gdrive-connect').addEventListener('click', connectGdrive);
    }

    gdriveCard.appendChild(body);
  }

  async function connectGdrive() {
    try {
      const res = await Api.post('/admin/backup/gdrive/auth');
      if (res?.auth_url) {
        window.open(res.auth_url, '_blank', 'width=600,height=700');
        toast('Buka browser untuk otorisasi GDrive. Salin kode setelah redirect.', { type: 'info', duration: 8000 });
      }
    } catch (e) {
      toast('Gagal mendapatkan auth URL: ' + (e.message || e), { type: 'error' });
    }
  }

  async function disconnectGdrive() {
    try {
      await Api.post('/admin/backup/gdrive/disconnect');
      toast('Google Drive berhasil dilepas', { type: 'success' });
      state.gdriveConnected = false;
      state.gdriveInfo = null;
      renderGdriveCard();
    } catch (e) {
      toast('Gagal: ' + (e.message || e), { type: 'error' });
    }
  }

  async function loadHistory() {
    historyCard.innerHTML = '<div class="skeleton" style="height:100px;width:100%;border-radius:6px;"></div>';

    try {
      const res = await Api.get('/admin/backup/history');
      state.backupHistory = res?.history || [];
      renderHistory();
    } catch (e) {
      historyCard.innerHTML = '<div class="empty" style="padding:var(--s-4);color:var(--c-danger);"><p>Gagal memuat riwayat: ' + (e.message || e) + '</p></div>';
    }
  }

  function renderHistory() {
    historyCard.innerHTML = '';
    historyCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    historyCard.querySelector('.card__head').innerHTML = '<div class="card__title">Backup History</div>';

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });

    if (state.backupHistory.length === 0) {
      body.innerHTML = '<p style="color:var(--c-text-3);font-size:var(--text-sm);">Belum ada riwayat backup.</p>';
    } else {
      state.backupHistory.forEach(h => {
        const row = createEl('div', {
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--s-3)', background: 'var(--c-surface-2)', borderRadius: 'var(--radius)' }
        });
        const phase = h.phase || 'done';
        const statusBadge = phase === 'failed' ? 'badge--danger' : phase === 'running' ? 'badge--warn' : 'badge--success';
        row.innerHTML = `
          <div>
            <div style="font-weight:500;font-size:var(--text-sm);">${h.filename || 'backup.zip'}</div>
            <div style="font-size:var(--text-xs);color:var(--c-text-3);">
              ${formatDate(h.timestamp)} • ${formatBytes(h.size_bytes || 0)} • 
              <span class="badge ${statusBadge}">${phase}</span>
            </div>
          </div>
          <div style="display:flex;gap:var(--s-2);">
            ${h.filename && h.filename.startsWith('backup_v2_') ? 
              `<a href="${Api.getDownloadUrl('/admin/backup/download/' + encodeURIComponent(h.filename))}" class="btn btn--ghost btn--sm" title="Download">${icons['download']}</a>` : 
              '<span></span>'
            }
            <button class="btn btn--ghost btn--sm" title="Delete" onclick="window.adminDeleteBackup('${h.filename}')" style="color:var(--c-danger);">${icons['trash']}</button>
          </div>
        `;
        body.appendChild(row);
      });
    }

    historyCard.appendChild(body);
  }

  window.adminDeleteBackup = async (filename) => {
    if (!confirm(`Delete backup ${filename}?`)) return;
    try {
      await Api.delete(`/admin/backup/${encodeURIComponent(filename)}`);
      toast('Backup berhasil dihapus', { type: 'success' });
      loadHistory();
    } catch (e) {
      toast('Gagal menghapus: ' + (e.message || e), { type: 'error' });
    }
  };

  function initWebSocket() {
    const wsUrl = ApiConfig.baseUrl.replace(/^http/, 'ws') + '/ws/backup-progress';

    state.ws = new WebSocket(wsUrl);

    state.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'backup-status') {
        state.backupStatus = {
          phase: data.phase,
          percent: data.percent,
          message: data.message,
        };
        renderStatusCard();
      }
    };

    state.ws.onerror = (err) => {
      console.error('[AdminBackup] WebSocket error:', err);
    };

    state.ws.onclose = () => {
      console.log('[AdminBackup] WebSocket disconnected');
    };
  }

  // Cleanup
  container._cleanup = () => {
    delete window.adminDeleteBackup;
    if (state.ws) state.ws.close();
  };

  // Init
  loadBackupStatus();
  loadGdriveInfo();
  loadHistory();

  return container;
}
