/* pages/reports.js — Reports Generation with API integration */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';
import Api from '../core/api.js';
import { toast } from '../ui/toast.js';

const PERIOD_OPTIONS = [6, 12, 24, 48, 72];

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

function formatSize(f) {
  return f.size_kb != null ? formatBytes((f.size_kb || 0) * 1024) : '-';
}

function fileTypeIcon(f) {
  const isCsv = f.format === 'csv' || /\.csv$/i.test(f.filename || '');
  return isCsv ? icons['database'] : icons['file-text'];
}

function downloadUrl(path) {
  // Path berisi folder tanggal (mis. "2026-07-13/Original_....csv") —
  // encode per segmen biar garis miring tidak berubah jadi %2F.
  const enc = String(path).split('/').map(encodeURIComponent).join('/');
  return Api.getDownloadUrl('/reports/download/' + enc);
}

function fileRowHtml(f) {
  const name = f.filename || '-';
  return `
    <div class="reports-page__file">
      <span class="reports-page__file-icon">${fileTypeIcon(f)}</span>
      <div class="reports-page__file-info">
        <div title="${name}">${name}</div>
        <div>${formatSize(f)}</div>
      </div>
      <a href="${downloadUrl(f.path)}" class="btn btn--secondary btn--sm" title="Download" aria-label="Download ${name}">${icons['download']}</a>
    </div>
  `;
}

export function render() {
  const state = {
    lastReport: null,
    reportGroups: [],
    generated: null,
    autoSend: false,
    generating: false,
    sinceHours: 24,
  };

  const container = createEl('div', { class: 'reports-page', style: { maxWidth: '760px', margin: '0 auto', padding: 'var(--s-4)' } });

  container.appendChild(createEl('h1', {}, ['Reports']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Generate and download news reports.']));

  // Laporan terakhir
  const lastCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-4)' } });
  container.appendChild(lastCard);

  // Generate
  const genCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-4)' } });
  container.appendChild(genCard);

  // Hasil generate (baru tampil setelah generate)
  const resultCard = createEl('div', { class: 'card', style: { marginBottom: 'var(--s-4)', display: 'none' } });
  container.appendChild(resultCard);

  // Riwayat
  const historyCard = createEl('div', { class: 'card' });
  container.appendChild(historyCard);

  // ── Laporan Terakhir + Auto-Send ──
  function renderLastCard() {
    lastCard.innerHTML = '';
    lastCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    lastCard.querySelector('.card__head').innerHTML = '<div class="card__title">Laporan Terakhir</div>';

    const hasLast = !!(state.lastReport && state.lastReport.last_report_at);
    const body = createEl('div', {}, []);
    body.innerHTML = `
      <div class="reports-page__last-status">
        <span class="reports-page__last-icon">${icons['file-text']}</span>
        <div>
          <div style="font-weight:600;font-size:var(--text-sm);color:${hasLast ? 'var(--c-accent)' : 'var(--c-text-3)'};">${hasLast ? 'Sudah pernah dikirim' : 'Belum ada laporan'}</div>
          ${hasLast ? `<div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:2px;">Terakhir: ${formatDate(state.lastReport.last_report_at)}</div>` : ''}
        </div>
      </div>
      <label class="reports-page__autosend">
        <span>
          <span class="reports-page__autosend-title">Auto-Send Laporan</span>
          <span class="reports-page__autosend-sub">Kirim laporan otomatis setiap 24 jam</span>
        </span>
        <span class="toggle ${state.autoSend ? 'toggle--on' : ''}" id="auto-send-toggle" role="switch" aria-checked="${state.autoSend}" aria-label="Auto-send"></span>
      </label>
    `;
    lastCard.appendChild(body);
    body.querySelector('#auto-send-toggle').addEventListener('click', toggleAutoSend);
  }

  // ── Periode + Tombol Generate ──
  function renderGenerateCard() {
    genCard.innerHTML = '';
    genCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    genCard.querySelector('.card__head').innerHTML = '<div class="card__title">Generate Laporan</div>';

    const body = createEl('div', {}, []);
    body.innerHTML = `
      <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:var(--s-2);">Periode Laporan</div>
      <div class="reports-page__periods">
        ${PERIOD_OPTIONS.map(h => `<button type="button" class="reports-page__chip${state.sinceHours === h ? ' reports-page__chip--active' : ''}" data-hours="${h}">${h}j</button>`).join('')}
      </div>
      <button class="btn btn--primary" id="generate-btn" ${state.generating ? 'disabled' : ''} style="width:100%;margin-top:var(--s-4);">
        ${state.generating ? `<span style="width:18px;height:18px;border:2px solid rgba(255,255,255,0.5);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;"></span> Generating...` : 'Generate Laporan'}
      </button>
    `;
    genCard.appendChild(body);

    body.querySelectorAll('.reports-page__chip').forEach(chip => {
      chip.addEventListener('click', () => {
        state.sinceHours = parseInt(chip.dataset.hours, 10);
        renderGenerateCard();
      });
    });
    body.querySelector('#generate-btn').addEventListener('click', generateReport);
  }

  // ── Hasil Generate (4 kategori, file + download) ──
  function renderResult() {
    resultCard.style.display = state.generated ? '' : 'none';
    resultCard.innerHTML = '';
    if (!state.generated) return;

    resultCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    resultCard.querySelector('.card__head').innerHTML = '<div class="card__title">Hasil</div>';

    const body = createEl('div', {}, []);
    const cats = state.generated.reports || [];
    const total = state.generated.total || 0;

    if (!cats.length) {
      body.innerHTML = `<p style="color:var(--c-text-3);font-size:var(--text-sm);">${total ? total + ' artikel dikumpulkan, tanpa laporan.' : 'Tidak ada artikel baru pada periode ini.'}</p>`;
    } else {
      body.innerHTML = `
        <div class="reports-page__result-head">
          <span style="color:var(--c-accent);">${icons['newspaper']}</span>
          <span>${total} artikel dikumpulkan</span>
        </div>
      `;
      cats.forEach(cat => {
        body.innerHTML += `
          <div class="reports-page__category">
            <div style="font-weight:700;font-size:var(--text-sm);">${cat.label || ''}</div>
            ${cat.description ? `<div style="font-size:var(--text-xs);color:var(--c-text-3);margin:var(--s-1) 0 var(--s-2);">${cat.description}</div>` : ''}
            ${(cat.files || []).map(fileRowHtml).join('')}
          </div>
        `;
      });
    }
    resultCard.appendChild(body);
  }

  // ── Riwayat (dikelompokkan per tanggal) ──
  function renderHistory() {
    historyCard.innerHTML = '';
    historyCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    historyCard.querySelector('.card__head').innerHTML = '<div class="card__title">Laporan Sebelumnya</div>';

    const body = createEl('div', {}, []);
    if (!state.reportGroups.length) {
      body.innerHTML = '<p style="color:var(--c-text-3);font-size:var(--text-sm);">Belum ada laporan.</p>';
    } else {
      state.reportGroups.forEach(g => {
        const files = g.files || [];
        body.innerHTML += `
          <div class="reports-page__group">
            <div class="reports-page__group-head">
              <span style="color:var(--c-accent);">${icons['file-text']}</span>
              <span>${g.date}</span>
              <span class="reports-page__group-count">${files.length} file</span>
            </div>
            ${files.map(fileRowHtml).join('')}
          </div>
        `;
      });
    }
    historyCard.appendChild(body);
  }

  // ── Actions ──
  async function toggleAutoSend() {
    const val = !state.autoSend;
    state.autoSend = val;
    renderLastCard();
    try {
      // Backend membaca auto_send sebagai query param (bukan body)
      await Api.put('/reports/preferences?auto_send=' + val);
      toast(val ? 'Auto-send aktif' : 'Auto-send dinonaktifkan', { type: 'success' });
    } catch (e) {
      state.autoSend = !val;
      renderLastCard();
      toast('Gagal simpan preferensi: ' + (e.message || e), { type: 'error' });
    }
  }

  async function generateReport() {
    if (state.generating) return;
    state.generating = true;
    renderGenerateCard();

    try {
      // since_hours juga query param di backend; body dikirim untuk parity Flutter
      const res = await Api.post('/reports/generate?since_hours=' + state.sinceHours, { since_hours: state.sinceHours });
      if (res?.success) {
        const cats = res.reports || [];
        const fileCount = cats.reduce((n, c) => n + ((c.files || []).length), 0);
        state.generated = res;
        renderResult();
        toast(`Laporan berhasil digenerate: ${res.total} artikel, ${fileCount} file`, { type: 'success' });
        loadReportFiles();
        loadLastReport();
      } else {
        toast('Gagal generate laporan', { type: 'error' });
      }
    } catch (err) {
      toast('Error: ' + (err.message || err), { type: 'error' });
    } finally {
      state.generating = false;
      renderGenerateCard();
    }
  }

  // ── Data loading ──
  async function loadLastReport() {
    try {
      const res = await Api.get('/reports/last');
      state.lastReport = res;
      state.autoSend = res?.auto_send || false;
    } catch (e) {
      console.error('[Reports] Failed to load last report:', e);
    }
    renderLastCard();
  }

  async function loadReportFiles() {
    historyCard.innerHTML = '<div class="skeleton" style="height:80px;width:100%;border-radius:6px;"></div>';

    try {
      const res = await Api.get('/reports/files');
      state.reportGroups = res?.files || [];
      renderHistory();
    } catch (e) {
      historyCard.innerHTML = '<div class="empty" style="padding:var(--s-4);color:var(--c-danger);"><p>Gagal memuat riwayat: ' + (e.message || e) + '</p></div>';
    }
  }

  // Init
  renderGenerateCard();
  loadLastReport();
  loadReportFiles();

  return container;
}

export function destroy() {
  // Cleanup handled per-render
}