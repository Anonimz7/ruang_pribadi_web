/* pages/video.js — Video Downloader (Anti-Slop, Dart-parity) */
import { $, $$, on, createEl, html } from '../utils/dom.js';
import { icons } from '../ui/icons.js';
import Api, { ApiError } from '../core/api.js';
import { toast } from '../ui/toast.js';
import { store } from '../core/state.js';
import { ApiConfig } from '../core/api-config.js';

/* ─── Constants ─── */
const PERSIST_KEY = 'video_downloader_active';
const POLL_INTERVAL = 10_000;

/* ─── Format helpers (mirrors download_model.dart) ─── */
function formatDuration(sec) {
  if (sec == null) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function vcodecLabel(vcodec) {
  if (!vcodec || vcodec === 'none') return '';
  const lc = vcodec.toLowerCase();
  if (lc.includes('av01')) return 'AV1';
  if (lc.includes('avc') || lc.includes('h264')) return 'H264';
  if (lc.includes('vp09')) return 'VP9';
  if (lc.includes('vp9')) return 'VP9';
  if (lc.includes('hevc') || lc.includes('h265')) return 'HEVC';
  if (lc.includes('av1')) return 'AV1';
  return vcodec.toUpperCase();
}

function acodecLabel(acodec) {
  if (!acodec || acodec === 'none') return '';
  const lc = acodec.toLowerCase();
  if (lc.includes('mp4a') || lc.includes('aac')) return 'AAC';
  if (lc.includes('opus')) return 'OPUS';
  if (lc.includes('mp3') || lc.includes('mpga')) return 'MP3';
  if (lc.includes('vorbis')) return 'VORBIS';
  if (lc.includes('flac')) return 'FLAC';
  return acodec.toUpperCase();
}

function isVideoOnly(f) {
  return f.vcodec && f.vcodec !== 'none' && (!f.acodec || f.acodec === 'none');
}

function isAudioOnly(f) {
  return f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none');
}

function hasBothCodecs(f) {
  return !isVideoOnly(f) && !isAudioOnly(f) && f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none';
}

function formatLabel(f) {
  const parts = [];
  if (f.resolution && f.resolution !== 'audio only') parts.push(f.resolution);
  if (f.ext) parts.push(f.ext.toUpperCase());
  if (f.fps && f.fps > 30) parts.push(`${f.fps}fps`);
  return parts.join(' · ') || (f.format_note || f.format_id || 'Unknown');
}

function groupByResolution(formats) {
  const groups = {};
  for (const f of formats) {
    if (isAudioOnly(f)) continue;
    const res = f.resolution || '';
    if (!res || res === 'audio only') continue;

    let key = null;
    const whMatch = /^\s*(\d{2,5})\s*x\s*(\d{2,5})\s*$/.exec(res);
    if (whMatch) {
      key = `${whMatch[1]}p`;
    } else {
      const noteMatch = /(\d{3,4})p/.exec(f.format_note || '');
      if (noteMatch) key = `${noteMatch[1]}p`;
    }
    key = key || 'Lainnya';
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }
  // Sort each group: combined first, then video-only
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => {
      const aC = hasBothCodecs(a) ? 1 : 0;
      const bC = hasBothCodecs(b) ? 1 : 0;
      return bC - aC;
    });
  }
  // Sort groups by width descending
  const sortedEntries = Object.entries(groups).sort((a, b) => {
    const aNum = parseInt(a[0].replace(/\D/g, ''), 10) || 0;
    const bNum = parseInt(b[0].replace(/\D/g, ''), 10) || 0;
    return bNum - aNum;
  });
  return Object.fromEntries(sortedEntries);
}

/* ─── State ─── */
const state = {
  url: '',
  extracting: false,
  videoInfo: null,
  selectedFormat: null,
  audioOnly: false,
  groupExpanded: {},
  audioExpanded: true,
  downloading: false,
  progress: 0,
  downloadStatus: '',
  downloadId: null,
  downloadSpeed: null,
  downloadEta: null,
  error: null,
  activeDownloads: [],
  ws: null,
  pollTimer: null,
  activePollTimer: null,
};

/* ─── Persistence ─── */
async function saveDownloadState(downloadId, url, formatId, audioOnly) {
  const payload = {
    download_id: downloadId,
    url,
    format_id: formatId,
    audio_only: audioOnly,
    started_at: new Date().toISOString(),
  };
  localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
}

async function clearDownloadState() {
  localStorage.removeItem(PERSIST_KEY);
}

async function restorePersistedDownload() {
  const raw = localStorage.getItem(PERSIST_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    const downloadId = data.download_id;
    if (!downloadId) { await clearDownloadState(); return; }

    const status = await Api.get('/video/status/' + downloadId);
    const st = status?.status || 'not_found';

    if (st === 'downloading' || st === 'interrupted') {
      state.downloading = true;
      state.downloadId = downloadId;
      state.progress = status?.progress || 0;
      state.downloadStatus = st === 'interrupted' ? 'Menyambung ulang...' : 'Mengunduh...';
      state.error = null;
      startStatusPolling(downloadId);
      connectProgressWebSocket();
    } else if (st === 'completed') {
      await clearDownloadState();
      state.downloading = false;
      state.progress = 100;
      state.downloadStatus = 'Selesai!';
      toast('Download selesai: ' + (status?.file_name || ''), 'success');
    } else if (st === 'failed') {
      await clearDownloadState();
      state.downloading = false;
      state.error = 'Download gagal: ' + (status?.error || 'Unknown error');
    } else {
      await clearDownloadState();
    }
  } catch (_) {
    // Network error — keep persisted state, will retry on next check
  }
}

/* ─── API: Active downloads ─── */
async function checkActiveDownloads() {
  try {
    const res = await Api.get('/video/active');
    const items = (res?.data || res || []).map(e => ({ ...e }));
    state.activeDownloads = items;
    if (items.length === 0) {
      if (state.activePollTimer) { clearInterval(state.activePollTimer); state.activePollTimer = null; }
    }
    renderActiveDownloads();
  } catch (_) {}
}

function startActiveDownloadsPolling() {
  if (state.activePollTimer) clearInterval(state.activePollTimer);
  state.activePollTimer = setInterval(checkActiveDownloads, POLL_INTERVAL);
}

/* ─── WebSocket ─── */
function connectProgressWebSocket() {
  if (state.ws) { try { state.ws.close(); } catch (_) {} }
  const userId = store.user?.user_id || store.username;
  if (!userId) return;
  const wsUrl = ApiConfig.baseUrl.replace(/^http/, 'ws') + '/ws/video-progress/' + userId;
  try {
    state.ws = new WebSocket(wsUrl);
    state.ws.onopen = () => {};
    state.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const status = msg.status;
        const fn = msg.filename;
        if (state.downloadId && fn && fn !== state.downloadId) return;

        if (status === 'downloading') {
          state.progress = msg.progress || 0;
          state.downloadSpeed = msg.speed || null;
          state.downloadEta = msg.eta || null;
          state.downloadStatus = `Mengunduh... ${state.progress.toFixed(1)}%`;
          renderProgress();
        } else if (status === 'completed') {
          clearDownloadState();
          state.downloading = false;
          state.progress = 100;
          state.downloadStatus = 'Selesai!';
          state.downloadId = null;
          state.downloadSpeed = null;
          state.downloadEta = null;
          stopPolling();
          checkActiveDownloads();
          toast('Download selesai!', 'success');
          renderAll();
        } else if (status === 'error') {
          clearDownloadState();
          state.downloading = false;
          state.error = 'Download gagal: ' + (msg.message || 'Unknown');
          state.downloadId = null;
          state.downloadSpeed = null;
          state.downloadEta = null;
          stopPolling();
          checkActiveDownloads();
          renderAll();
        } else if (status === 'cancelled') {
          clearDownloadState();
          state.downloading = false;
          state.downloadStatus = 'Dibatalkan';
          state.downloadId = null;
          state.downloadSpeed = null;
          state.downloadEta = null;
          stopPolling();
          checkActiveDownloads();
          renderAll();
        }
      } catch (_) {}
    };
    state.ws.onerror = () => {};
    state.ws.onclose = () => {};
  } catch (_) {}
}

/* ─── Polling fallback ─── */
function startStatusPolling(downloadId) {
  stopPolling();
  state.pollTimer = setInterval(async () => {
    if (!state.downloading || !state.downloadId) { stopPolling(); return; }
    try {
      const status = await Api.get('/video/status/' + state.downloadId);
      const st = status?.status || 'not_found';
      const pct = status?.progress || 0;
      const speed = status?.speed || null;
      const eta = status?.eta || null;

      if (st === 'downloading' || st === 'interrupted') {
        state.progress = pct;
        state.downloadSpeed = speed;
        state.downloadEta = eta;
        state.downloadStatus = `Mengunduh... ${pct.toFixed(1)}%`;
        renderProgress();
      } else if (st === 'completed') {
        stopPolling();
        await clearDownloadState();
        state.downloading = false;
        state.progress = 100;
        state.downloadStatus = 'Selesai!';
        state.downloadId = null;
        state.downloadSpeed = null;
        state.downloadEta = null;
        toast('Download selesai: ' + (status?.file_name || ''), 'success');
        renderAll();
      } else if (st === 'failed') {
        stopPolling();
        await clearDownloadState();
        state.downloading = false;
        state.error = 'Download gagal: ' + (status?.error || 'Unknown error');
        state.downloadId = null;
        state.downloadSpeed = null;
        state.downloadEta = null;
        renderAll();
      }
    } catch (_) {}
  }, POLL_INTERVAL);
}

function stopPolling() {
  if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
}

/* ─── Cancel ─── */
async function cancelDownload(downloadId) {
  if (!confirm('Batalkan Download?\nFile temp/fragment akan dibersihkan.')) return;
  try {
    await Api.post('/video/cancel/' + downloadId, {});
    if (state.downloadId === downloadId) {
      await clearDownloadState();
      state.downloading = false;
      state.downloadId = null;
      state.downloadSpeed = null;
      state.downloadEta = null;
      state.downloadStatus = '';
      stopPolling();
    }
    await checkActiveDownloads();
    toast('Download dibatalkan', 'warn');
    renderAll();
  } catch (e) {
    toast('Gagal membatalkan: ' + (e.message || e), 'danger');
  }
}

/* ─── Extract ─── */
async function doExtract() {
  const url = state.url.trim();
  if (!url) { state.error = 'Masukkan URL video'; renderError(); return; }

  state.extracting = true;
  state.error = null;
  state.videoInfo = null;
  state.selectedFormat = null;
  state.groupExpanded = {};
  renderAll();

  try {
    const res = await Api.post('/video/extract', { url });
    const data = res?.data || res;
    if (!data) throw new Error('Respons kosong dari server');

    state.videoInfo = data;
    state.extracting = false;

    const formats = data.formats || [];
    const resGroups = groupByResolution(formats);

    // Find best format: prefer 1280p, then highest resolution
    let best = null;
    if (resGroups['1280p']) best = resGroups['1280p'][0];
    if (!best) {
      const firstKey = Object.keys(resGroups)[0];
      if (firstKey) best = resGroups[firstKey][0];
    }
    state.selectedFormat = best;

    // Default expand 1280p or highest
    let expandKey = Object.keys(resGroups)[0];
    if (resGroups['1280p']) expandKey = '1280p';
    if (expandKey) state.groupExpanded[expandKey] = true;

    renderAll();
  } catch (e) {
    state.extracting = false;
    state.error = 'Gagal: ' + (e.message || e).replace(/^Exception: /, '');
    renderAll();
  }
}

/* ─── Download ─── */
async function doDownload() {
  if (!state.selectedFormat && !state.audioOnly) return;
  const url = state.url.trim();
  const formatId = state.audioOnly ? 'bestaudio' : (state.selectedFormat?.format_id || 'best');

  state.downloading = true;
  state.progress = 0;
  state.downloadStatus = 'Memulai...';
  state.downloadSpeed = null;
  state.downloadEta = null;
  state.error = null;
  renderAll();

  connectProgressWebSocket();

  try {
    const res = await Api.post('/video/download', {
      url,
      format_id: formatId,
      audio_only: state.audioOnly,
      title: state.videoInfo?.title,
    });
    const data = res?.data || res;
    const downloadId = data?.download_id;

    if (downloadId) {
      state.downloadId = downloadId;
      await saveDownloadState(downloadId, url, formatId, state.audioOnly);
      startStatusPolling(downloadId);
      startActiveDownloadsPolling();
    }
    renderAll();
  } catch (e) {
    stopPolling();
    const errMsg = 'Download gagal: ' + (e.message || e).replace(/^Exception: /, '');
    state.downloading = false;
    state.error = errMsg;
    state.downloadSpeed = null;
    state.downloadEta = null;
    state.downloadId = null;
    await clearDownloadState();
    toast(errMsg, 'danger');
    renderAll();
  }
}

/* ─── Paste ─── */
async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      state.url = text;
      const input = $('.video-page__url-input');
      if (input) input.value = text;
    }
  } catch (_) {
    toast('Tidak bisa mengakses clipboard', 'warn');
  }
}

/* ─── DOM Refs ─── */
let rootEl = null;
let sections = {};

/* ─── Render orchestrator ─── */
function renderAll() {
  if (!rootEl) return;
  renderToolbar();
  renderError();
  renderActiveDownloads();
  renderExtracting();
  renderVideoInfo();
  renderFormatSelector();
  renderProgress();
  renderDownloadButton();
}

/* ─── Section renderers ─── */
function renderToolbar() {
  let el = sections.toolbar;
  if (!el) {
    el = createEl('div', { class: 'video-page__toolbar' });
    sections.toolbar = el;
    rootEl.appendChild(el);
  }
  el.innerHTML = '';

  const row = createEl('div', {
    style: {
      display: 'flex',
      gap: 'var(--s-3)',
      flexWrap: 'wrap',
      alignItems: 'stretch',
    }
  });

  // URL input
  const inputWrap = createEl('div', { style: { flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 'var(--s-1)' } });
  const input = createEl('input', {
    type: 'url',
    class: 'field__input video-page__url-input',
    placeholder: 'Paste URL video di sini...',
    value: state.url,
    'aria-label': 'URL Video',
  });
  on(input, 'input', (e) => { state.url = e.target.value; });
  on(input, 'keydown', (e) => { if (e.key === 'Enter') doExtract(); });
  inputWrap.appendChild(input);
  row.appendChild(inputWrap);

  // Paste button
  const pasteBtn = createEl('button', {
    class: 'btn btn--secondary',
    'aria-label': 'Paste dari clipboard',
    title: 'Paste dari clipboard',
  });
  pasteBtn.innerHTML = `${icons.copy} <span>Paste</span>`;
  on(pasteBtn, 'click', pasteFromClipboard);
  row.appendChild(pasteBtn);

  // Extract button
  const extractBtn = createEl('button', {
    class: 'btn btn--primary',
    disabled: state.extracting,
    'aria-label': 'Extract video',
  });
  extractBtn.innerHTML = state.extracting
    ? `<span class="spinner" style="width:18px;height:18px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite;display:inline-block;vertical-align:middle;margin-right:6px;"></span> Extract`
    : `${icons.search} <span>Extract</span>`;
  on(extractBtn, 'click', doExtract);
  row.appendChild(extractBtn);

  el.appendChild(row);

  // Nav links
  const navRow = createEl('div', {
    style: {
      display: 'flex',
      gap: 'var(--s-3)',
      marginTop: 'var(--s-3)',
      flexWrap: 'wrap',
    }
  });

  const historyLink = createEl('a', {
    href: '#/video-history',
    class: 'btn btn--ghost',
    style: { padding: 'var(--s-2) var(--s-3)', fontSize: 'var(--text-sm)' },
  });
  historyLink.innerHTML = `${icons['book']} <span>Riwayat Download</span>`;
  navRow.appendChild(historyLink);

  el.appendChild(navRow);
}

function renderError() {
  let el = sections.error;
  if (!state.error) {
    if (el) { el.remove(); sections.error = null; }
    return;
  }
  if (!el) {
    el = createEl('div', { class: 'video-page__error' });
    sections.error = el;
    rootEl.appendChild(el);
  }
  el.innerHTML = '';
  el.style.cssText = `
    display: flex; align-items: flex-start; gap: var(--s-3);
    padding: var(--s-3); background: var(--c-danger-bg);
    border: 1px solid var(--c-danger); border-radius: var(--radius);
    margin-top: var(--s-4);
  `;
  el.innerHTML = `
    <span style="color:var(--c-danger);flex-shrink:0;margin-top:1px;">${icons['alert-circle']}</span>
    <span style="color:var(--c-danger);font-size:var(--text-sm);line-height:1.5;">${state.error}</span>
  `;
}

function renderActiveDownloads() {
  let el = sections.active;
  if (state.activeDownloads.length === 0) {
    if (el) { el.remove(); sections.active = null; }
    return;
  }
  if (!el) {
    el = createEl('div', { class: 'card', style: { marginTop: 'var(--s-4)', background: 'var(--c-primary-bg)' } });
    sections.active = el;
    rootEl.appendChild(el);
  }

  const itemsHtml = state.activeDownloads.map(dl => {
    const fn = dl.filename || '...';
    const pct = (dl.progress || 0).toFixed(1);
    const speed = dl.speed || '';
    const eta = dl.eta || '';
    const status = dl.status || 'downloading';
    const isInterrupted = status === 'interrupted';
    const iconColor = isInterrupted ? 'var(--c-warn)' : 'var(--c-primary)';
    const iconSvg = isInterrupted ? icons['refresh'] : icons['download'];

    return `
      <div style="margin-top:var(--s-3);padding-top:var(--s-3);border-top:1px solid var(--c-border);">
        <div style="display:flex;align-items:center;gap:var(--s-2);margin-bottom:var(--s-2);">
          <span style="color:${iconColor};flex-shrink:0;">${iconSvg}</span>
          <span style="font-size:var(--text-sm);font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${fn}</span>
          <span style="font-size:var(--text-sm);font-weight:600;">${pct}%</span>
          <button class="btn btn--ghost btn--sm" style="padding:var(--s-1);width:28px;height:28px;min-width:28px;min-height:28px;color:var(--c-danger);" aria-label="Batalkan download" data-cancel="${fn}">
            ${icons['x']}
          </button>
        </div>
        <div class="progress"><div class="progress__bar" style="width:${pct}%;"></div></div>
        ${(speed || eta) ? `<div style="display:flex;justify-content:space-between;margin-top:var(--s-1);font-size:var(--text-xs);color:var(--c-text-3);">
          <span>${speed}</span><span>Sisa ${eta}</span>
        </div>` : ''}
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="card__head" style="margin-bottom:var(--s-3);">
      <div style="display:flex;align-items:center;gap:var(--s-2);font-size:var(--text-sm);font-weight:600;">
        <span class="spinner" style="width:16px;height:16px;border:2px solid var(--c-border);border-top-color:var(--c-primary);border-radius:50%;animation:spin 1s linear infinite;display:inline-block;"></span>
        ${state.activeDownloads.length} download sedang berjalan
      </div>
      <a href="#/video-history" class="btn btn--ghost btn--sm" style="font-size:var(--text-xs);">Lihat Riwayat</a>
    </div>
    ${itemsHtml}
  `;

  // Attach cancel handlers
  el.querySelectorAll('[data-cancel]').forEach(btn => {
    on(btn, 'click', () => cancelDownload(btn.dataset.cancel));
  });
}

function renderExtracting() {
  let el = sections.extracting;
  if (!state.extracting) {
    if (el) { el.remove(); sections.extracting = null; }
    return;
  }
  if (!el) {
    el = createEl('div', { class: 'card', style: { marginTop: 'var(--s-4)', textAlign: 'center', padding: 'var(--s-6)' } });
    sections.extracting = el;
    rootEl.appendChild(el);
  }
  el.innerHTML = `
    <div class="spinner" style="width:32px;height:32px;border:3px solid var(--c-border);border-top-color:var(--c-primary);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto var(--s-3);"></div>
    <div style="font-size:var(--text-sm);color:var(--c-text-2);">Menganalisis video...</div>
  `;
}

function renderVideoInfo() {
  let el = sections.info;
  if (!state.videoInfo || state.extracting) {
    if (el) { el.remove(); sections.info = null; }
    return;
  }
  if (!el) {
    el = createEl('div', { class: 'card', style: { marginTop: 'var(--s-4)', overflow: 'hidden' } });
    sections.info = el;
    rootEl.appendChild(el);
  }

  const info = state.videoInfo;
  const thumb = info.thumbnail;
  const duration = formatDuration(info.duration);
  const uploader = info.uploader || '';
  const formatCount = (info.formats || []).length;

  el.innerHTML = '';

  // Thumbnail section
  const thumbWrap = createEl('div', { style: { position: 'relative', width: '100%', height: '200px', background: 'var(--c-surface-2)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 'var(--s-3)' } });
  if (thumb) {
    const img = createEl('img', {
      src: thumb,
      alt: 'Thumbnail',
      style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
      loading: 'lazy',
    });
    on(img, 'error', () => {
      thumbWrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-3);"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>`;
    });
    thumbWrap.appendChild(img);
  } else {
    thumbWrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-3);"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>`;
  }

  if (duration) {
    const badge = createEl('div', {
      style: {
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        background: 'rgba(0,0,0,0.85)',
        color: '#fff',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: 'var(--text-xs)',
        fontWeight: 500,
      }
    });
    badge.textContent = duration;
    thumbWrap.appendChild(badge);
  }
  el.appendChild(thumbWrap);

  // Info text
  const body = createEl('div', { style: { padding: '0 var(--s-1)' } });
  body.innerHTML = `
    <div style="font-weight:600;font-size:var(--text-md);line-height:1.3;margin-bottom:var(--s-2);word-break:break-word;">${info.title || 'Unknown'}</div>
    <div style="display:flex;align-items:center;gap:var(--s-2);flex-wrap:wrap;">
      ${uploader ? `<span style="font-size:var(--text-sm);color:var(--c-text-2);display:flex;align-items:center;gap:var(--s-1);"><span style="color:var(--c-text-3);">${icons.user}</span>${uploader}</span>` : ''}
      <span class="badge badge--neutral">${formatCount} format</span>
    </div>
  `;
  el.appendChild(body);
}

function renderFormatSelector() {
  let el = sections.formats;
  if (!state.videoInfo || state.extracting || state.downloading) {
    if (el) { el.remove(); sections.formats = null; }
    return;
  }
  if (!el) {
    el = createEl('div', { class: 'card', style: { marginTop: 'var(--s-4)' } });
    sections.formats = el;
    rootEl.appendChild(el);
  }

  const formats = state.videoInfo.formats || [];
  const audioFormats = formats.filter(isAudioOnly);
  const resGroups = groupByResolution(formats);

  // Build audio toggle
  const toggleId = 'audio-only-toggle-' + Math.random().toString(36).slice(2, 7);
  let htmlStr = `
    <div class="card__head" style="margin-bottom:var(--s-4);">
      <div class="card__title">Pilih Format</div>
    </div>
    <label for="${toggleId}" style="display:flex;align-items:center;gap:var(--s-3);cursor:pointer;padding:var(--s-2) 0;margin-bottom:var(--s-4);border-bottom:1px solid var(--c-border);">
      <div class="toggle ${state.audioOnly ? 'toggle--on' : ''}" id="${toggleId}" role="switch" aria-checked="${state.audioOnly}" tabindex="0"></div>
      <div>
        <div style="font-size:var(--text-sm);font-weight:500;">Audio Saja</div>
        <div style="font-size:var(--text-xs);color:var(--c-text-3);">Download hanya audio</div>
      </div>
    </label>
  `;

  // Audio-only formats
  if (state.audioOnly && audioFormats.length > 0) {
    htmlStr += buildCollapsibleGroup('Audio Formats', audioFormats.length, state.audioExpanded, 'audio', audioFormats.map(f => buildFormatTile(f)).join(''));
  }

  // Video formats by resolution
  if (!state.audioOnly) {
    if (Object.keys(resGroups).length === 0) {
      htmlStr += `<p style="color:var(--c-text-3);font-size:var(--text-sm);padding:var(--s-4) 0;text-align:center;">Tidak ada format video tersedia</p>`;
    } else {
      for (const [key, list] of Object.entries(resGroups)) {
        const expanded = !!state.groupExpanded[key];
        htmlStr += buildCollapsibleGroup(key, list.length, expanded, key, buildFormatTilesWithSeparator(list));
      }
    }
  }

  el.innerHTML = htmlStr;

  // Toggle interaction
  const toggleEl = el.querySelector('.toggle');
  if (toggleEl) {
    const toggleHandler = () => {
      state.audioOnly = !state.audioOnly;
      state.selectedFormat = null;
      renderFormatSelector();
    };
    on(toggleEl, 'click', toggleHandler);
    on(toggleEl, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHandler(); } });
  }

  // Collapsible interactions
  el.querySelectorAll('[data-group-key]').forEach(header => {
    on(header, 'click', () => {
      const key = header.dataset.groupKey;
      if (key === 'audio') {
        state.audioExpanded = !state.audioExpanded;
      } else {
        state.groupExpanded[key] = !state.groupExpanded[key];
      }
      renderFormatSelector();
    });
  });

  // Radio interactions
  el.querySelectorAll('input[type="radio"][name="format"]').forEach(radio => {
    on(radio, 'change', () => {
      const fmtStr = radio.dataset.format;
      try {
        state.selectedFormat = JSON.parse(decodeURIComponent(fmtStr));
      } catch (_) {}
      // Re-render to update visual selection
      renderFormatSelector();
    });
  });
}

function buildCollapsibleGroup(title, count, expanded, key, childrenHtml) {
  const chevron = expanded ? icons['chevron-down'] : icons['chevron-right'];
  return `
    <div style="margin-bottom:var(--s-3);">
      <button data-group-key="${key}" style="display:flex;align-items:center;gap:var(--s-2);width:100%;padding:var(--s-2) var(--s-1);background:none;border:none;color:var(--c-text-2);font-size:var(--text-sm);font-weight:600;cursor:pointer;text-align:left;border-radius:var(--radius);" onmouseover="this.style.background='var(--c-surface-2)'" onmouseout="this.style.background='none'">
        <span style="display:inline-flex;transition:transform var(--dur-fast);transform:rotate(${expanded ? '0deg' : '-90deg'});">${chevron}</span>
        <span>${title}</span>
        <span class="badge badge--primary" style="margin-left:var(--s-1);">${count}</span>
        <span style="margin-left:auto;color:var(--c-text-3);">${expanded ? 'Sembunyikan' : 'Tampilkan'}</span>
      </button>
      <div style="overflow:hidden;transition:all var(--dur-fast);${expanded ? '' : 'max-height:0;opacity:0;'}" aria-hidden="${!expanded}">
        <div style="padding-top:var(--s-2);">${childrenHtml}</div>
      </div>
    </div>
  `;
}

function buildFormatTilesWithSeparator(formats) {
  let lastWasCombined = null;
  const parts = [];
  for (const f of formats) {
    const combined = hasBothCodecs(f);
    if (lastWasCombined === true && !combined) {
      parts.push(`
        <div style="display:flex;align-items:center;gap:var(--s-2);padding:var(--s-2) 0;">
          <div style="flex:1;height:1px;background:var(--c-border);"></div>
          <span style="font-size:var(--text-xs);color:var(--c-text-3);white-space:nowrap;">Video Only (auto-merge)</span>
          <div style="flex:1;height:1px;background:var(--c-border);"></div>
        </div>
      `);
    }
    parts.push(buildFormatTile(f));
    lastWasCombined = combined;
  }
  return parts.join('');
}

function buildFormatTile(f) {
  const isSelected = state.selectedFormat && state.selectedFormat.format_id === f.format_id;
  const vLabel = vcodecLabel(f.vcodec);
  const aLabel = acodecLabel(f.acodec);
  const size = formatBytes(f.filesize);
  const note = f.format_note || '';
  const abr = f.abr && f.abr > 0 ? `${Math.round(f.abr)} kbps` : '';
  const fmtJson = encodeURIComponent(JSON.stringify(f));

  return `
    <label style="display:flex;align-items:flex-start;gap:var(--s-3);padding:var(--s-2) var(--s-1);cursor:pointer;border-radius:var(--radius);${isSelected ? 'background:var(--c-primary-bg);' : ''}" onmouseover="this.style.background='${isSelected ? 'var(--c-primary-bg)' : 'var(--c-surface-2)'}'" onmouseout="this.style.background='${isSelected ? 'var(--c-primary-bg)' : 'transparent'}'">
      <input type="radio" name="format" data-format="${fmtJson}" ${isSelected ? 'checked' : ''} style="margin-top:3px;flex-shrink:0;accent-color:var(--c-primary);">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:var(--s-2);flex-wrap:wrap;margin-bottom:2px;">
          <span style="font-size:var(--text-sm);font-weight:500;">${formatLabel(f)}</span>
          ${vLabel ? `<span class="badge" style="background:rgba(37,99,235,0.1);color:var(--c-primary);border:1px solid rgba(37,99,235,0.2);">${vLabel}</span>` : ''}
          ${aLabel ? `<span class="badge" style="background:rgba(5,150,105,0.1);color:var(--c-accent);border:1px solid rgba(5,150,105,0.2);">${aLabel}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:var(--s-2);flex-wrap:wrap;font-size:var(--text-xs);color:var(--c-text-3);">
          <span>${size}</span>
          ${note ? `<span>${note}</span>` : ''}
          ${abr ? `<span>${abr}</span>` : ''}
        </div>
      </div>
    </label>
  `;
}

function renderProgress() {
  let el = sections.progress;
  if (!state.downloading) {
    if (el) { el.remove(); sections.progress = null; }
    return;
  }
  if (!el) {
    el = createEl('div', { class: 'card', style: { marginTop: 'var(--s-4)' } });
    sections.progress = el;
    rootEl.appendChild(el);
  }

  const isComplete = state.progress >= 100;
  const icon = isComplete ? icons.check : icons.download;
  const iconColor = isComplete ? 'var(--c-accent)' : 'var(--c-primary)';

  el.innerHTML = `
    <div class="card__head" style="margin-bottom:var(--s-3);">
      <div style="display:flex;align-items:center;gap:var(--s-2);font-weight:600;">
        <span style="color:${iconColor};">${icon}</span>
        ${isComplete ? 'Selesai!' : 'Mengunduh...'}
      </div>
      <span style="font-weight:600;font-size:var(--text-sm);">${state.progress.toFixed(1)}%</span>
    </div>
    <div class="progress" style="margin-bottom:var(--s-3);"><div class="progress__bar ${isComplete ? 'progress--success' : ''}" style="width:${state.progress}%;"></div></div>
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:var(--text-xs);color:var(--c-text-3);">
      <span>${state.downloadStatus}</span>
      <div style="display:flex;gap:var(--s-2);">
        ${state.downloadSpeed ? `<span style="font-weight:600;color:var(--c-primary);">${state.downloadSpeed}</span>` : ''}
        ${state.downloadSpeed && state.downloadEta ? '<span>·</span>' : ''}
        ${state.downloadEta ? `<span>Sisa ${state.downloadEta}</span>` : ''}
      </div>
    </div>
  `;
}

function renderDownloadButton() {
  let el = sections.actions;
  if (!state.videoInfo || state.extracting || state.downloading) {
    if (el) { el.remove(); sections.actions = null; }
    return;
  }
  if (!el) {
    el = createEl('div', { style: { marginTop: 'var(--s-4)' } });
    sections.actions = el;
    rootEl.appendChild(el);
  }

  const isVideoOnly = state.selectedFormat && isVideoOnly(state.selectedFormat);
  const label = state.audioOnly
    ? 'Download Audio'
    : isVideoOnly
      ? 'Download Video + Audio (Merge)'
      : 'Download Video';

  el.innerHTML = '';
  const btn = createEl('button', {
    class: 'btn btn--primary btn--lg',
    style: { width: '100%' },
    'aria-label': label,
  });
  btn.innerHTML = `${icons.download} <span>${label}</span>`;
  on(btn, 'click', doDownload);
  el.appendChild(btn);
}

/* ─── Cleanup ─── */
function cleanup() {
  stopPolling();
  if (state.activePollTimer) { clearInterval(state.activePollTimer); state.activePollTimer = null; }
  if (state.ws) { try { state.ws.close(); } catch (_) {} state.ws = null; }
  rootEl = null;
  sections = {};
}

/* ─── Export render ─── */
export function render() {
  // Reset state for fresh render
  state.url = '';
  state.extracting = false;
  state.videoInfo = null;
  state.selectedFormat = null;
  state.audioOnly = false;
  state.groupExpanded = {};
  state.audioExpanded = true;
  state.downloading = false;
  state.progress = 0;
  state.downloadStatus = '';
  state.downloadId = null;
  state.downloadSpeed = null;
  state.downloadEta = null;
  state.error = null;
  state.activeDownloads = [];
  state.ws = null;
  state.pollTimer = null;
  state.activePollTimer = null;

  rootEl = createEl('div', { class: 'video-page', style: { maxWidth: '720px', margin: '0 auto', padding: 'var(--s-4)' } });
  sections = {};

  // Add keyframe for spinner if not present
  if (!document.getElementById('video-page-keyframes')) {
    const style = createEl('style', { id: 'video-page-keyframes' });
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  // Header
  const header = createEl('div', { style: { marginBottom: 'var(--s-5)' } });
  header.innerHTML = `
    <h1 style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--s-1);">Video Downloader</h1>
    <p style="color:var(--c-text-2);font-size:var(--text-sm);">Paste URL video untuk mengekstrak dan mengunduh.</p>
  `;
  rootEl.appendChild(header);

  renderAll();

  // Init async
  restorePersistedDownload().then(() => {
    checkActiveDownloads();
    startActiveDownloadsPolling();
  });

  rootEl._cleanup = cleanup;
  return rootEl;
}
