/* pages/reports.js — Reports Generation with API integration */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';
import Api, { ApiError } from '../core/api.js';
import { toast } from '../ui/toast.js';
import { createModal } from '../ui/modal.js';

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
    lastReport: null,
    reportFiles: [],
    autoSend: false,
    generating: false,
    sinceHours: 24,
  };

  const container = createEl('div', {}, []);

  container.appendChild(createEl('h1', {}, ['Reports']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Generate and download news reports.']));

  // Generate report card
  const card = createEl('div', { class: 'card', style: { maxWidth: '560px', margin: '0 auto var(--s-5)' } });
  container.appendChild(card);

  // History
  const historyCard = createEl('div', { class: 'card', style: { maxWidth: '560px', margin: '0 auto' } });
  container.appendChild(historyCard);

  function renderGenerateCard() {
    card.innerHTML = '';
    card.appendChild(createEl('div', { class: 'card__head' }, [], []));
    card.querySelector('.card__head').innerHTML = '<div class="card__title">Generate Report</div>';

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
    body.innerHTML = `
      <div class="field">
        <label class="field__label">Time Range</label>
        <select class="field__select" id="range-select">
          <option value="24" ${state.sinceHours === 24 ? 'selected' : ''}>Last 24 hours</option>
          <option value="48" ${state.sinceHours === 48 ? 'selected' : ''}>Last 48 hours</option>
          <option value="168" ${state.sinceHours === 168 ? 'selected' : ''}>Last 7 days</option>
        </select>
      </div>
      <div class="field field--inline" style="justify-content:space-between;">
        <label class="field__label">Auto-send to email</label>
        <div class="toggle ${state.autoSend ? 'toggle--on' : ''}" id="auto-send-toggle"></div>
      </div>
      <button class="btn btn--primary btn--lg" id="generate-btn" ${state.generating ? 'disabled' : ''}>
        ${state.generating ? `<span style="width:18px;height:18px;border:2px solid rgba(255,255,255,0.5);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;"></span> Generating...` : icons['file-text'] + ' Generate Report'}
      </button>
    `;
    card.appendChild(body);

    const rangeSelect = body.querySelector('#range-select');
    rangeSelect.addEventListener('change', (e) => { state.sinceHours = parseInt(e.target.value); });

    const toggle = body.querySelector('#auto-send-toggle');
    toggle.addEventListener('click', () => {
      state.autoSend = !state.autoSend;
      renderGenerateCard();
    });

    const genBtn = body.querySelector('#generate-btn');
    genBtn.addEventListener('click', () => generateReport());
  }

  async function generateReport() {
    state.generating = true;
    renderGenerateCard();

    try {
      const res = await Api.post('/reports/generate', { since_hours: state.sinceHours });
      if (res?.success) {
        toast(`Laporan berhasil digenerate: ${res.total} artikel, ${res.reports?.length || 0} file`, { type: 'success' });
        loadReportFiles();
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

  async function loadLastReport() {
    try {
      const res = await Api.get('/reports/last');
      state.lastReport = res;
      state.autoSend = res?.auto_send || false;
    } catch (e) {
      console.error('[Reports] Failed to load last report:', e);
    }
    renderGenerateCard();
  }

  async function loadReportFiles() {
    historyCard.innerHTML = '<div class="skeleton" style="height:80px;width:100%;border-radius:6px;"></div>';

    try {
      const res = await Api.get('/reports/files');
      const files = res?.files || [];
      state.reportFiles = files;
      renderHistory();
    } catch (e) {
      historyCard.innerHTML = '<div class="empty" style="padding:var(--s-4);color:var(--c-danger);"><p>Gagal memuat riwayat: ' + (e.message || e) + '</p></div>';
    }
  }

  function renderHistory() {
    historyCard.innerHTML = '';
    historyCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    historyCard.querySelector('.card__head').innerHTML = '<div class="card__title">Recent Reports</div>';

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });

    if (state.reportFiles.length === 0) {
      body.innerHTML = '<p style="color:var(--c-text-3);font-size:var(--text-sm);">Belum ada laporan.</p>';
    } else {
      state.reportFiles.forEach(f => {
        const item = createEl('div', {
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--s-3)', background: 'var(--c-surface-2)', borderRadius: 'var(--radius)' }
        });
        const fileInfo = { name: f.name || f.filename || 'report.csv', size: f.size_bytes || 0, date: f.generated_at || f.created_at };
        item.innerHTML = `
          <div>
            <div style="font-weight:500;font-size:var(--text-sm);">${fileInfo.name}</div>
            <div style="font-size:var(--text-xs);color:var(--c-text-3);">${formatDate(fileInfo.date)} • ${formatBytes(fileInfo.size)}</div>
          </div>
          <a href="${Api.getDownloadUrl('/reports/download/' + encodeURIComponent(fileInfo.name))}" class="btn btn--ghost btn--sm" title="Download">${icons['download']}</a>
        `;
        body.appendChild(item);
      });
    }

    historyCard.appendChild(body);
  }

  container._cleanup = () => {
    if (state._wsCleanup) state._wsCleanup();
  };

  // Init
  loadLastReport();
  loadReportFiles();

  return container;
}
