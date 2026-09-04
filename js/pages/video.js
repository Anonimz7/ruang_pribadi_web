/* pages/video.js — Video Downloader with API + WebSocket integration */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';
import Api, { ApiError } from '../core/api.js';
import { toast } from '../ui/toast.js';
import { store } from '../core/state.js';
import { ApiConfig } from '../core/api-config.js';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function render() {
  const state = {
    url: '',
    extractData: null,
    extracting: false,
    downloads: [],
    ws: null,
  };

  const container = createEl('div', { class: 'video-page' }, []);

  container.appendChild(createEl('h1', {}, ['Video Downloader']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Paste a URL to extract and download videos.']));

  // Extract section
  const extractCard = createEl('div', { class: 'card', style: { maxWidth: '720px', margin: '0 auto var(--s-5)' } });
  container.appendChild(extractCard);

  // Extract result
  const resultCard = createEl('div', { class: 'card', style: { maxWidth: '720px', margin: '0 auto var(--s-5)' } });
  container.appendChild(resultCard);

  // Active downloads
  const dlCard = createEl('div', { class: 'card', style: { maxWidth: '720px', margin: '0 auto' } });
  container.appendChild(dlCard);

  // ---- Functions ----

  function renderExtractSection() {
    extractCard.innerHTML = '';
    extractCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    extractCard.querySelector('.card__head').innerHTML = '<div class="card__title">Extract Video</div>';

    const body = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap' } });
    body.innerHTML = `
      <input type="url" class="field__input" placeholder="https://youtube.com/watch?v=..." style="flex:1;min-width:200px;" value="${state.url}">
      <button class="btn btn--primary" id="extract-btn" ${state.extracting ? 'disabled' : ''}>
        ${state.extracting ? icons['refresh'] : icons['search']} Extract
      </button>
    `;
    extractCard.appendChild(body);

    const urlInput = body.querySelector('input');
    urlInput.addEventListener('input', (e) => { state.url = e.target.value; });

    body.querySelector('#extract-btn').addEventListener('click', () => extractVideo());
  }

  async function extractVideo() {
    if (!state.url.trim()) {
      toast('Masukkan URL video terlebih dahulu', { type: 'error' });
      return;
    }

    state.extracting = true;
    renderExtractSection();

    try {
      const res = await Api.post('/video/extract', { url: state.url });
      if (res?.success && res.data) {
        state.extractData = res.data;
        renderResultSection();
      } else {
        toast('Extract gagal: ' + (res?.message || 'Unknown error'), { type: 'error' });
      }
    } catch (e) {
      toast('Gagal mengekstrak video: ' + (e.message || e), { type: 'error' });
    } finally {
      state.extracting = false;
      renderExtractSection();
    }
  }

  function renderResultSection() {
    resultCard.innerHTML = '';
    resultCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    resultCard.querySelector('.card__head').innerHTML = '<div class="card__title">Video Info</div>';

    const body = createEl('div', { style: { display: 'flex', gap: 'var(--s-4)', alignItems: 'flex-start', flexWrap: 'wrap' } });
    const d = state.extractData;

    body.innerHTML = `
      <div style="width:160px;height:90px;background:var(--c-surface-2);border-radius:var(--radius);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--c-text-3);font-size:var(--text-xs);">
        Thumbnail
      </div>
      <div style="flex:1;min-width:200px;">
        <div style="font-weight:600;margin-bottom:var(--s-2);">${d.title || 'Untitled'}</div>
        <div style="font-size:var(--text-sm);color:var(--c-text-2);margin-bottom:var(--s-3);">
          Duration: ${d.duration || '-'} • Channel: ${d.uploader || '-'}
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--s-2);" id="format-list">
          <div style="font-weight:500;margin-bottom:var(--s-2);">Available Formats:</div>
        </div>
      </div>
    `;
    resultCard.appendChild(body);

    // Render format buttons separately (avoids nested template literal complexity)
    const formatList = resultCard.querySelector('#format-list');
    (d.formats || []).forEach(f => {
      const btn = createEl('button', {
        class: 'btn btn--primary btn--sm',
        onclick: `window.downloadVideo('${encodeURIComponent(f.url || '')}', '${f.format_id || 'best'}', ${!!f.audio_only}, '${(d.title || 'video').replace(/'/g, "\\'").replace(/"/g, '&quot;')}')`,
        style: { marginBottom: '8px' }
      }, [
        createEl('span', {}, [icons['download']]),
        ` ${f.quality || f.format_id} - ${f.ext || 'mp4'} (${formatBytes(f.filesize)})`
      ]);
      formatList.appendChild(btn);
    });
  }

  function formatBytesLocal(bytes) {
    return formatBytes(bytes);
  }

  async function startDownload(url, formatId, audioOnly, title) {
    try {
      const res = await Api.post('/video/download', {
        url: decodeURIComponent(url),
        format_id: formatId,
        audio_only: audioOnly,
        title: title,
      });

      if (res?.success) {
        const downloadId = res.data?.download_id;
        state.downloads.push({
          id: downloadId,
          filename: downloadId,
          progress: 0,
          status: 'started',
          speed: null,
          eta: null,
        });
        toast(`Download dimulai: ${downloadId}`, { type: 'success' });

        // Connect WebSocket for progress
        initWebSocket();
        renderDownloads();
      } else {
        toast('Download gagal: ' + (res?.message || 'Unknown error'), { type: 'error' });
      }
    } catch (e) {
      toast('Gagal memulai download: ' + (e.message || e), { type: 'error' });
    }
  }

  function initWebSocket() {
    if (store.user?.user_id == null) return;

    const userId = store.user.user_id;
    const wsUrl = ApiConfig.baseUrl.replace(/^http/, 'ws') + '/ws/video/' + userId;

    if (state.ws && state.ws.readyState === WebSocket.OPEN) return;

    state.ws = new WebSocket(wsUrl);

    state.ws.onopen = () => {
      console.log('[Video] WebSocket connected');
    };

    state.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      updateDownloadProgress(data);
    };

    state.ws.onerror = (err) => {
      console.error('[Video] WebSocket error:', err);
    };

    state.ws.onclose = () => {
      console.log('[Video] WebSocket disconnected');
    };
  }

  function updateDownloadProgress(data) {
    const dl = state.downloads.find(d => d.filename === data.filename);
    if (!dl) return;

    if (data.status === 'downloading') {
      dl.progress = data.progress || 0;
      dl.speed = data.speed || null;
      dl.eta = data.eta || null;
      dl.status = 'downloading';
    } else if (data.status === 'completed') {
      dl.progress = 100;
      dl.status = 'completed';
      dl.file_name = data.file_name;
      dl.file_size = data.file_size;
    } else if (data.status === 'error') {
      dl.status = 'failed';
      dl.error = data.message;
    }

    renderDownloads();
  }

  function renderDownloads() {
    dlCard.innerHTML = '';
    dlCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    dlCard.querySelector('.card__head').innerHTML = '<div class="card__title">Active Downloads</div>';

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' } });

    if (state.downloads.length === 0) {
      body.innerHTML = '<p style="color:var(--c-text-3);font-size:var(--text-sm);">Belum ada download aktif.</p>';
    } else {
      state.downloads.forEach(dl => {
        const item = createEl('div');
        const isError = dl.status === 'failed';
        const isComplete = dl.status === 'completed';

        let statusHtml;
        if (isComplete) {
          statusHtml = `
            <div style="display:flex;justify-content:space-between;margin-bottom:var(--s-2);font-size:var(--text-sm);">
              <span style="font-weight:500;">${dl.file_name || dl.filename}</span>
              <span style="color:var(--c-accent);">Selesai</span>
            </div>
            <div class="progress progress--success"><div class="progress__bar" style="width:100%;"></div></div>
            ${dl.file_size ? `<div style="margin-top:var(--s-1);font-size:var(--text-xs);color:var(--c-text-3);">${formatBytes(dl.file_size)}</div>` : ''}
          `;
        } else if (isError) {
          statusHtml = `
            <div style="display:flex;justify-content:space-between;margin-bottom:var(--s-2);font-size:var(--text-sm);">
              <span style="font-weight:500;">${dl.filename}</span>
              <span style="color:var(--c-danger);">Gagal</span>
            </div>
            <div class="progress" style="background:var(--c-danger-bg);"><div class="progress__bar" style="width:100%;background:var(--c-danger);"></div></div>
            <div style="margin-top:var(--s-1);font-size:var(--text-xs);color:var(--c-danger);">${dl.error || 'Unknown error'}</div>
          `;
        } else {
          statusHtml = `
            <div style="display:flex;justify-content:space-between;margin-bottom:var(--s-2);font-size:var(--text-sm);">
              <span style="font-weight:500;">${dl.filename}</span>
              <span style="color:var(--c-text-3);">${dl.progress}%</span>
            </div>
            <div class="progress"><div class="progress__bar" style="width:${dl.progress}%;"></div></div>
            <div style="display:flex;justify-content:space-between;margin-top:var(--s-1);font-size:var(--text-xs);color:var(--c-text-3);">
              <span>${dl.speed || '-')}</span><span>ETA: ${dl.eta || '-')}</span>
            </div>
          `;
        }

        item.innerHTML = statusHtml;
        body.appendChild(item);
      });
    }

    dlCard.appendChild(body);
  }

  // Expose for inline onclick
  window.downloadVideo = (url, formatId, audioOnly, title) => {
    startDownload(url, formatId, audioOnly, title);
  };

  async function loadActiveDownloads() {
    try {
      const res = await Api.get('/video/active');
      if (res?.success && res.data) {
        res.data.forEach(d => {
          const exists = state.downloads.find(dl => dl.filename === d.filename);
          if (!exists) {
            state.downloads.push({
              id: d.filename,
              filename: d.filename,
              progress: d.progress || 0,
              status: d.status || 'downloading',
              speed: d.speed || null,
              eta: d.eta || null,
            });
          }
        });
        if (state.downloads.length > 0) initWebSocket();
        renderDownloads();
      }
    } catch (e) {
      console.error('[Video] Failed to load active downloads:', e);
    }
  }

  // Cleanup
  container._cleanup = () => {
    delete window.downloadVideo;
    if (state.ws) state.ws.close();
  };

  // Init
  renderExtractSection();
  loadActiveDownloads();

  return container;
}
