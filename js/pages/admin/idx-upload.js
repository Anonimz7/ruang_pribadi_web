/* pages/admin/idx-upload.js — IDX XLSX Upload */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api, { ApiError } from '../../core/api.js';
import { toast } from '../../ui/toast.js';

export function render() {
  const state = {
    uploading: false,
    uploadResult: null,
  };

  const container = createEl('div', { class: 'admin-idx-upload' }, []);

  container.appendChild(createEl('h1', {}, ['IDX Upload']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Upload IDX stock data in XLSX format.']));

  // Upload form card
  const formCard = createEl('div', { class: 'card', style: { maxWidth: '560px', margin: '0 auto var(--s-5)' } });
  container.appendChild(formCard);

  // Result card
  const resultCard = createEl('div', { class: 'card', style: { maxWidth: '560px', margin: '0 auto' } });
  container.appendChild(resultCard);

  function renderForm() {
    formCard.innerHTML = '';
    formCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    formCard.querySelector('.card__head').innerHTML = '<div class="card__title">Upload XLSX File</div>';

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' } });
    body.innerHTML = `
      <div class="field">
        <label class="field__label">File (must be .xlsx, filename must contain YYYYMMDD)</label>
        <input type="file" id="idx-file" accept=".xlsx,.xls" style="width:100%;">
      </div>
      <button class="btn btn--primary btn--lg" id="upload-btn" ${state.uploading ? 'disabled' : ''}>
        ${state.uploading
          ? `<span style="width:18px;height:18px;border:2px solid rgba(255,255,255,0.5);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;"></span> Uploading...`
          : icons['upload'] + ' Upload IDX Data'}
      </button>
    `;
    formCard.appendChild(body);

    const uploadBtn = body.querySelector('#upload-btn');
    uploadBtn.addEventListener('click', uploadFile);
  }

  async function uploadFile() {
    const fileInput = document.getElementById('idx-file');
    if (!fileInput.files || !fileInput.files[0]) {
      toast('Pilih file XLSX terlebih dahulu', { type: 'error' });
      return;
    }

    const file = fileInput.files[0];
    if (!file.name.endsWith('.xlsx')) {
      toast('File harus berformat .xlsx', { type: 'error' });
      return;
    }

    state.uploading = true;
    renderForm();

    try {
      // Use multipart upload via Api.multipartPost
      const res = await Api.multipartPost('/idx/upload', file);
      state.uploadResult = res;
      if (res?.success) {
        toast(`Upload berhasil! ${res.message || ''}`, { type: 'success' });
      } else {
        toast('Upload gagal', { type: 'error' });
      }
    } catch (e) {
      toast('Error: ' + (e.message || e), { type: 'error' });
      state.uploadResult = null;
    }

    state.uploading = false;
    renderForm();
    renderResult();
  }

  function renderResult() {
    resultCard.innerHTML = '';
    resultCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    resultCard.querySelector('.card__head').innerHTML = '<div class="card__title">Upload Result</div>';

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });

    if (!state.uploadResult) {
      body.innerHTML = '<p style="color:var(--c-text-3);font-size:var(--text-sm);">Belum ada upload.</p>';
    } else {
      const r = state.uploadResult;
      body.innerHTML = `
        <div style="padding:var(--s-3);background:var(--c-surface-2);border-radius:var(--radius);">
          <div style="font-weight:600;margin-bottom:var(--s-2);">${r.success ? '✅ Berhasil' : '❌ Gagal'}</div>
          <div style="font-size:var(--text-sm);color:var(--c-text-2);">${r.message || ''}</div>
          ${r.trade_date ? `<div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:var(--s-1);">Tanggal perdagangan: ${r.trade_date}</div>` : ''}
          ${r.is_new !== undefined ? `<div style="font-size:var(--text-xs);color:var(--c-text-3);">Data baru: ${r.is_new ? 'Ya' : 'Tidak'}</div>` : ''}
        </div>
      `;
    }

    resultCard.appendChild(body);
  }

  container._cleanup = () => {
    if (state._timer) clearTimeout(state._timer);
  };

  // Init
  renderForm();
  renderResult();

  return container;
}
