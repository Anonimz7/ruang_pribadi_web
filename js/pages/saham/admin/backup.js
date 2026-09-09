/* pages/admin/backup.js — Backup System (Flutter parity: GDrive + progress + history) */
import { createEl } from '../../../utils/dom.js';
import { icons } from '../../../ui/icons.js';
import Api from '../../../core/api.js';
import { toast } from '../../../ui/toast.js';
import { createModal } from '../../../ui/modal.js';
import { ApiConfig } from '../../../core/api-config.js';

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
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

const PHASE_LABEL = {
  dumping: 'MySQL Dump',
  zipping: 'Membuat ZIP',
  uploading: 'Upload ke GDrive',
  done: 'Selesai',
  failed: 'Gagal',
};

export function render() {
  const state = {
    gdriveConnected: false,
    gdriveStorage: null,      // {limit_gb, usage_gb, remaining_mb}
    phase: 'idle',
    percent: 0,
    statusMessage: '',
    history: [],
    ws: null,
  };

  const container = createEl('div', { class: 'admin-backup' }, []);
  container.appendChild(createEl('h1', {}, ['Backup System']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Kelola backup database dan integrasi Google Drive.']));

  // ── GDrive card ──
  const gdriveCard = createEl('div', { class: 'card' });
  container.appendChild(gdriveCard);

  // ── Backup button ──
  const backupBtn = createEl('button', { type: 'button', class: 'btn btn--accent admin-backup__run' }, []);
  container.appendChild(backupBtn);

  // ── Progress card ──
  const progressCard = createEl('div', { class: 'card', style: { display: 'none' } });
  container.appendChild(progressCard);

  // ── History ──
  const historyWrap = createEl('div', { class: 'card' });
  container.appendChild(historyWrap);

  // ═══ RENDER: GDRIVE ═══════════════════════════════════
  function renderGdrive() {
    gdriveCard.innerHTML = '';
    gdriveCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    gdriveCard.querySelector('.card__head').innerHTML = '<div class="card__title">Google Drive</div>';

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' } });
    const connected = state.gdriveConnected;

    const row = createEl('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--s-3)' } });
    const iconBox = createEl('div', {
      class: 'admin-backup__gdrive-icon ' + (connected ? 'admin-backup__gdrive-icon--ok' : 'admin-backup__gdrive-icon--off'),
    });
    iconBox.innerHTML = connected ? icons['cloud'] : icons['cloud-off'];
    row.appendChild(iconBox);

    const textWrap = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } });
    textWrap.appendChild(createEl('div', {
      style: { fontWeight: 600, color: connected ? 'var(--c-success)' : 'var(--c-warn)' },
    }, [connected ? 'Google Drive Connected' : 'Google Drive Disconnected']));
    textWrap.appendChild(createEl('p', { class: 'field__hint' },
      [connected ? 'Backup otomatis ter-upload' : 'Klik Hubungkan untuk otorisasi']));
    row.appendChild(textWrap);
    body.appendChild(row);

    // Storage progress
    const storage = state.gdriveStorage;
    if (connected && storage && storage.limit_gb > 0) {
      const pct = Math.min(100, ((storage.usage_gb || 0) / storage.limit_gb) * 100);
      const progress = createEl('div', {});
      progress.appendChild(createEl('div', { class: 'progress' }, [], []));
      progress.querySelector('.progress').appendChild(createEl('div', {
        class: 'progress__bar',
        style: { width: pct + '%', background: 'var(--c-success)' },
      }));
      const info = createEl('div', {
        style: { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-1)' },
      });
      info.append(
        createEl('span', {}, [`${(storage.usage_gb || 0).toFixed(1)} / ${storage.limit_gb.toFixed(1)} GB`]),
        createEl('span', {}, [`${Math.round(storage.remaining_mb || 0)} MB tersisa`]),
      );
      progress.appendChild(info);
      body.appendChild(progress);
    }

    // Buttons
    const btns = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)' } });
    if (connected) {
      const terhubung = createEl('button', { type: 'button', class: 'btn btn--secondary', disabled: true }, ['Terhubung']);
      const putuskan = createEl('button', { type: 'button', class: 'btn btn--ghost', style: { color: 'var(--c-danger)' } }, ['Putuskan']);
      putuskan.addEventListener('click', confirmDisconnect);
      btns.append(terhubung, putuskan);
    } else {
      const hubungkan = createEl('button', { type: 'button', class: 'btn btn--primary' }, []);
      hubungkan.innerHTML = `${icons['link']} Hubungkan`;
      hubungkan.addEventListener('click', connectGdrive);
      btns.append(hubungkan);
    }
    body.appendChild(btns);

    gdriveCard.appendChild(body);
  }

  async function connectGdrive() {
    try {
      const res = await Api.post('/admin/backup/gdrive/auth');
      if (!res?.auth_url) { toast('Gagal mendapatkan auth URL', { type: 'error' }); return; }

      const content = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
      const steps = createEl('div', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)', lineHeight: 1.7 } });
      steps.append(
        createEl('div', {}, ['1. Buka link di bawah & login Google']),
        createEl('div', {}, ['2. Setelah grant, browser redirect ke localhost']),
        createEl('div', {}, ['3. Salin kode dari URL (bagian ?code=XXX)']),
        createEl('div', {}, ['4. Paste kode di bawah ini']),
      );
      content.appendChild(steps);

      const link = createEl('a', { href: res.auth_url, target: '_blank', rel: 'noopener', class: 'admin-backup__authlink' }, [res.auth_url]);
      content.appendChild(link);

      const field = createEl('div', { class: 'field' });
      field.appendChild(createEl('label', { class: 'field__label' }, ['Authorization Code']));
      const codeInput = createEl('input', { type: 'text', class: 'field__input', placeholder: 'Paste code dari URL...' });
      field.appendChild(codeInput);
      content.appendChild(field);

      const footer = createEl('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)' } });
      const modal = createModal({ title: '🔐 Google Drive Auth', content, width: '440px' });

      const cancelBtn = createEl('button', { type: 'button', class: 'btn btn--secondary' }, ['Batal']);
      cancelBtn.addEventListener('click', () => modal.close());

      const hubungkanBtn = createEl('button', { type: 'button', class: 'btn btn--primary' }, ['Hubungkan']);
      hubungkanBtn.addEventListener('click', async () => {
        const code = codeInput.value.trim();
        if (!code) { toast('Masukkan kode otorisasi', { type: 'error' }); return; }
        try {
          await Api.post('/admin/backup/gdrive/code', { code });
          toast('Google Drive terhubung!', { type: 'success' });
          modal.close();
          loadAll();
        } catch (e) {
          toast('Gagal menghubungkan: ' + (e.message || e), { type: 'error' });
        }
      });

      footer.append(cancelBtn, hubungkanBtn);
      content.appendChild(footer);
    } catch (e) {
      toast('Gagal mendapatkan auth URL: ' + (e.message || e), { type: 'error' });
    }
  }

  async function confirmDisconnect() {
    const content = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
    content.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } },
      ['Backup tidak akan bisa di-upload ke Google Drive.']));
    const footer = createEl('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)', marginTop: 'var(--s-2)' } });
    const modal = createModal({ title: 'Putuskan GDrive?', content, width: '380px' });

    const cancelBtn = createEl('button', { class: 'btn btn--secondary' }, ['Batal']);
    cancelBtn.addEventListener('click', () => modal.close());
    const putusBtn = createEl('button', { class: 'btn btn--danger' }, ['Putuskan']);
    putusBtn.addEventListener('click', async () => {
      try {
        await Api.post('/admin/backup/gdrive/disconnect');
        toast('Google Drive diputuskan', { type: 'success' });
        modal.close();
        loadAll();
      } catch (e) {
        toast('Gagal: ' + (e.message || e), { type: 'error' });
      }
    });
    footer.append(cancelBtn, putusBtn);
    content.appendChild(footer);
  }

  // ═══ RENDER: BACKUP BUTTON + PROGRESS ═══════════════════
  const running = () => ['dumping', 'zipping', 'uploading'].includes(state.phase);

  function renderBackupButton() {
    backupBtn.innerHTML = '';
    backupBtn.disabled = running();
    if (running()) {
      backupBtn.appendChild(createEl('span', { class: 'admin-backup__spin' }));
      backupBtn.appendChild(createEl('span', {}, ['Sedang Berjalan...']));
    } else {
      backupBtn.innerHTML = `${icons['database']} Mulai Backup Sekarang`;
    }
  }

  function renderProgress() {
    if (state.phase === 'idle') {
      progressCard.style.display = 'none';
      return;
    }
    progressCard.style.display = '';
    progressCard.innerHTML = '';
    progressCard.appendChild(createEl('div', { class: 'card__head' }, [], []));

    const done = state.phase === 'done';
    const failed = state.phase === 'failed';
    const tone = done ? 'ok' : failed ? 'err' : 'run';

    progressCard.querySelector('.card__head').innerHTML =
      `<div class="card__title" style="color:var(--c-${done ? 'success' : failed ? 'danger' : 'primary'});">${icons[done ? 'check' : failed ? 'alert-circle' : 'refresh']} ${PHASE_LABEL[state.phase] || state.phase}</div>`;

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });

    const pctRow = createEl('div', {
      style: { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' },
    });
    pctRow.append(
      createEl('span', { style: { color: 'var(--c-text-3)' } }, [state.statusMessage]),
      createEl('span', { style: { fontWeight: 700, color: `var(--c-${done ? 'success' : failed ? 'danger' : 'primary'})` } }, [`${state.percent}%`]),
    );
    body.appendChild(pctRow);

    const progress = createEl('div', { class: 'progress' });
    progress.appendChild(createEl('div', {
      class: 'progress__bar',
      style: {
        width: (state.percent || 0) + '%',
        background: `var(--c-${done ? 'success' : failed ? 'danger' : 'primary'})`,
        transition: 'width var(--dur-slow) var(--ease)',
      },
    }));
    body.appendChild(progress);

    progressCard.appendChild(body);
  }

  // ═══ RENDER: HISTORY ═══════════════════════════════════
  function renderHistory() {
    historyWrap.innerHTML = '';
    historyWrap.appendChild(createEl('div', { class: 'card__head' }, [], []));
    historyWrap.querySelector('.card__head').innerHTML = `
      <div>
        <div class="card__title">Riwayat Backup</div>
        <div class="card__subtitle">${state.history.length} item</div>
      </div>
    `;

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' } });

    if (state.history.length === 0) {
      body.appendChild(createEl('p', { class: 'admin-backup__empty' }, ['Belum ada backup']));
    } else {
      state.history.forEach(h => body.appendChild(buildHistoryItem(h)));
    }
    historyWrap.appendChild(body);
  }

  function buildHistoryItem(h) {
    const filename = h.filename || 'backup.zip';
    const row = createEl('div', { class: 'admin-backup__row' });

    // Icon box
    const iconBox = createEl('div', { class: 'admin-backup__row-icon' });
    iconBox.innerHTML = icons['database'];
    row.appendChild(iconBox);

    // Text
    const text = createEl('div', { class: 'admin-backup__row-text' });
    text.appendChild(createEl('div', { class: 'admin-backup__row-name', title: filename }, [filename]));
    const meta = createEl('div', { class: 'admin-backup__row-meta' });
    const gdriveSpan = createEl('span', {
      style: { color: h.gdrive_uploaded ? 'var(--c-success)' : 'var(--c-warn)', display: 'inline-flex', alignItems: 'center', gap: 4 },
      title: h.gdrive_uploaded ? 'Ter-upload ke GDrive' : 'Tidak di-upload ke GDrive',
    }, []);
    gdriveSpan.innerHTML = h.gdrive_uploaded ? `${icons['cloud']} GDrive` : `${icons['cloud-off']} lokal`;
    meta.append(
      createEl('span', {}, [h.date_str || formatDate(h.timestamp)]),
      createEl('span', {}, ['•']),
      createEl('span', {}, [h.size_mb ? `${h.size_mb} MB` : formatBytes(h.size_bytes || 0)]),
      createEl('span', {}, ['•']),
      gdriveSpan,
    );
    text.appendChild(meta);
    row.appendChild(text);

    // Actions
    const actions = createEl('div', { style: { display: 'flex', gap: 'var(--s-1)', flexShrink: 0 } });
    const dlBtn = createEl('a', {
      class: 'btn btn--ghost btn--sm',
      href: Api.getDownloadUrl('/admin/backup/download/' + encodeURIComponent(filename)),
      title: 'Download',
      download: filename,
    }, []);
    dlBtn.innerHTML = icons['download'];
    dlBtn.style.color = 'var(--c-text-2)';
    actions.appendChild(dlBtn);

    const delBtn = createEl('button', { type: 'button', class: 'btn btn--ghost btn--sm', title: 'Hapus', style: { color: 'var(--c-danger)' } }, []);
    delBtn.innerHTML = icons['trash'];
    delBtn.addEventListener('click', () => confirmDelete(filename));
    actions.appendChild(delBtn);
    row.appendChild(actions);

    return row;
  }

  async function confirmDelete(filename) {
    const content = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
    content.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } },
      [`Hapus "${filename}" secara permanen?`]));
    const footer = createEl('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)', marginTop: 'var(--s-2)' } });
    const modal = createModal({ title: 'Hapus Backup?', content, width: '380px' });

    const cancelBtn = createEl('button', { class: 'btn btn--secondary' }, ['Batal']);
    cancelBtn.addEventListener('click', () => modal.close());
    const delBtn = createEl('button', { class: 'btn btn--danger' }, ['Hapus']);
    delBtn.addEventListener('click', async () => {
      try {
        await Api.delete(`/admin/backup/${encodeURIComponent(filename)}`);
        toast(`${filename} dihapus`, { type: 'success' });
        modal.close();
        loadHistory();
      } catch (e) {
        toast('Gagal menghapus: ' + (e.message || e), { type: 'error' });
      }
    });
    footer.append(cancelBtn, delBtn);
    content.appendChild(footer);
  }

  // ═══ ACTIONS ═══════════════════════════════════════════
  function startBackup() {
    const content = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
    content.appendChild(createEl('p', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' } },
      ['Ini akan melakukan dump database MySQL, membuat ZIP archive, dan meng-upload ke Google Drive (jika terhubung).']));
    const footer = createEl('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)', marginTop: 'var(--s-2)' } });
    const modal = createModal({ title: 'Mulai Backup?', content, width: '400px' });

    const cancelBtn = createEl('button', { class: 'btn btn--secondary' }, ['Batal']);
    cancelBtn.addEventListener('click', () => modal.close());
    const mulaiBtn = createEl('button', { class: 'btn btn--primary' }, ['Mulai']);
    mulaiBtn.addEventListener('click', async () => {
      try {
        const res = await Api.post('/admin/backup/run');
        if (!res?.success) throw new Error(res?.message || 'unknown');
        toast('Backup dimulai!', { type: 'success' });
        modal.close();
        loadStatus();
        initWebSocket();
      } catch (e) {
        toast('Gagal memulai backup: ' + (e.message || e), { type: 'error' });
      }
    });
    footer.append(cancelBtn, mulaiBtn);
    content.appendChild(footer);
  }

  backupBtn.addEventListener('click', startBackup);

  // ═══ DATA ═══════════════════════════════════════════════
  async function loadAll() {
    await Promise.all([loadStatus(), loadGdrive(), loadHistory()]);
  }

  async function loadStatus() {
    try {
      const res = await Api.get('/admin/backup/status');
      state.phase = res?.phase || 'idle';
      state.percent = res?.percent || 0;
      state.statusMessage = res?.message || '';
    } catch (e) {
      state.phase = 'idle';
    }
    renderBackupButton();
    renderProgress();
  }

  async function loadGdrive() {
    try {
      const res = await Api.get('/admin/backup/gdrive/info');
      state.gdriveConnected = !!res?.connected;
      state.gdriveStorage = res?.storage || null;
    } catch (e) {
      state.gdriveConnected = false;
      state.gdriveStorage = null;
    }
    renderGdrive();
  }

  async function loadHistory() {
    try {
      const res = await Api.get('/admin/backup/history');
      state.history = Array.isArray(res?.history) ? res.history : [];
    } catch (e) {
      state.history = [];
    }
    renderHistory();
  }

  // ═══ WEBSOCKET ══════════════════════════════════════════
  function initWebSocket() {
    const wsUrl = ApiConfig.baseUrl.replace(/^http/, 'ws') + '/ws/backup-progress';
    try {
      state.ws = new WebSocket(wsUrl);
    } catch (e) {
      console.error('[AdminBackup] WS init failed:', e);
      return;
    }

    state.ws.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type !== 'backup-status') return;
      state.phase = data.phase || 'idle';
      state.percent = data.percent || 0;
      state.statusMessage = data.message || '';
      renderBackupButton();
      renderProgress();

      if (state.phase === 'done' || state.phase === 'failed') {
        loadHistory();
        loadGdrive();
        toast(state.phase === 'done' ? 'Backup selesai!' : `Backup gagal: ${data.error || 'Unknown error'}`, {
          type: state.phase === 'done' ? 'success' : 'error',
        });
      }
    };
    state.ws.onerror = (err) => console.error('[AdminBackup] WebSocket error:', err);
    state.ws.onclose = () => console.log('[AdminBackup] WebSocket disconnected');
  }

  // Cleanup
  container._cleanup = () => {
    if (state.ws) state.ws.close();
  };

  // Init
  loadAll();
  initWebSocket();

  return container;
}