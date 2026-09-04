/* pages/admin/reports.js — Reports Admin with API */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api, { ApiError } from '../../core/api.js';
import { toast } from '../../ui/toast.js';

export function render() {
  const state = {
    prefs: { auto_send: false, last_report_at: null },
    saving: false,
  };

  const container = createEl('div', { class: 'admin-report-prefs' }, []);

  container.appendChild(createEl('h1', {}, ['Reports Admin']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Manage automated report generation settings.']));

  const card = createEl('div', { class: 'card', style: { maxWidth: '560px', margin: '0 auto' } });
  container.appendChild(card);

  // History card
  const historyCard = createEl('div', { class: 'card', style: { maxWidth: '560px', margin: 'var(--s-5) auto 0' } });
  container.appendChild(historyCard);

  async function loadPrefs() {
    try {
      const res = await Api.get('/reports/last');
      state.prefs = {
        auto_send: res?.auto_send || false,
        last_report_at: res?.last_report_at || null,
      };
    } catch (e) {
      state.prefs = { auto_send: false, last_report_at: null };
    }
    renderPrefs();
  }

  function renderPrefs() {
    card.innerHTML = '';
    card.appendChild(createEl('div', { class: 'card__head' }, [], []));
    card.querySelector('.card__head').innerHTML = '<div class="card__title">Report Preferences</div>';

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' } });
    body.innerHTML = `
      <div class="field field--inline" style="justify-content:space-between;">
        <label class="field__label">Auto-send reports to email</label>
        <div class="toggle ${state.prefs.auto_send ? 'toggle--on' : 'toggle--off'}" id="auto-send-toggle"></div>
      </div>
      <div style="${state.prefs.last_report_at ? '' : 'display:none;'}font-size:var(--text-sm);color:var(--c-text-3);">
        Last sent: ${state.prefs.last_report_at ? new Date(state.prefs.last_report_at).toLocaleString('id-ID') : '-'}
      </div>
      <div style="display:flex;gap:var(--s-3);">
        <button class="btn btn--primary" id="save-prefs" ${state.saving ? 'disabled' : ''}>
          ${state.saving ? '<span style="width:18px;height:18px;border:2px solid rgba(255,255,255,0.5);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;"></span> Saving...' : icons['save'] + ' Save Preferences'}
        </button>
      </div>
    `;
    card.appendChild(body);

    const toggle = body.querySelector('#auto-send-toggle');
    toggle.addEventListener('click', () => {
      state.prefs.auto_send = !state.prefs.auto_send;
      renderPrefs();
    });

    const saveBtn = body.querySelector('#save-prefs');
    saveBtn.addEventListener('click', async () => {
      state.saving = true;
      renderPrefs();
      try {
        const res = await Api.put('/reports/preferences', { auto_send: state.prefs.auto_send });
        if (res?.success) {
          toast('Preferensi berhasil disimpan', { type: 'success' });
          loadPrefs();
        }
      } catch (e) {
        toast('Gagal menyimpan: ' + (e.message || e), { type: 'error' });
        state.saving = false;
        renderPrefs();
      }
    });
  }

  async function loadReportFiles() {
    historyCard.innerHTML = '<div class="skeleton" style="height:80px;width:100%;border-radius:6px;"></div>';

    try {
      const res = await Api.get('/reports/files');
      const files = res?.files || [];
      renderHistory(files);
    } catch (e) {
      historyCard.innerHTML = '<div class="empty" style="padding:var(--s-4);color:var(--c-danger);"><p>Gagal memuat riwayat: ' + (e.message || e) + '</p></div>';
    }
  }

  function renderHistory(files) {
    historyCard.innerHTML = '';
    historyCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    historyCard.querySelector('.card__head').innerHTML = '<div class="card__title">Generated Report Files</div>';

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });

    if (files.length === 0) {
      body.innerHTML = '<p style="color:var(--c-text-3);font-size:var(--text-sm);">Belum ada file laporan.</p>';
    } else {
      files.forEach(f => {
        const row = createEl('div', {
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--s-3)', background: 'var(--c-surface-2)', borderRadius: 'var(--radius)' }
        });
        const fname = f.name || f.filename || 'report.csv';
        row.innerHTML = `
          <div>
            <div style="font-weight:500;font-size:var(--text-sm);">${fname}</div>
            <div style="font-size:var(--text-xs);color:var(--c-text-3);">${new Date(f.generated_at || f.created_at).toLocaleString('id-ID')}</div>
          </div>
          <a href="${Api.getDownloadUrl('/reports/download/' + encodeURIComponent(fname))}" class="btn btn--ghost btn--sm" title="Download">${icons['download']}</a>
        `;
        body.appendChild(row);
      });
    }

    historyCard.appendChild(body);
  }

  container._cleanup = () => {
    if (state._timer) clearTimeout(state._timer);
  };

  // Init
  loadPrefs();
  loadReportFiles();

  return container;
}
