/* pages/admin/idx-upload.js — IDX XLSX Upload (Flutter parity) */
import { createEl } from '../../../utils/dom.js';
import { icons } from '../../../ui/icons.js';
import Api from '../../../core/api.js';
import { toast } from '../../../ui/toast.js';

export function render() {
  const state = {
    file: null,
    uploading: false,
    uploadResult: null,
    status: null,
    statusLoading: true,
  };

  const container = createEl('div', { class: 'admin-idx-upload' }, []);

  container.appendChild(createEl('h1', {}, ['IDX Upload']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Upload IDX stock data in XLSX format.']));

  // Cards
  const statusCard = createEl('div', { class: 'card' }, []);
  const infoCard = createEl('div', { class: 'card' }, []);
  const uploadCard = createEl('div', { class: 'card' }, []);
  const resultCard = createEl('div', { class: 'card' }, []);
  container.append(statusCard, infoCard, uploadCard, resultCard);

  // Hidden file input (triggered by the pick button, like Flutter FilePicker)
  const fileInput = createEl('input', { type: 'file', accept: '.xlsx' }, []);
  fileInput.style.display = 'none';
  container.appendChild(fileInput);
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f && !f.name.toLowerCase().endsWith('.xlsx')) {
      toast('File must be in .xlsx format', { type: 'error' });
      fileInput.value = '';
      return;
    }
    state.file = f || null;
    state.uploadResult = null;
    renderUpload();
    renderResult();
  });

  // ── Status card ────────────────────────────────────────────────
  async function loadStatus() {
    state.statusLoading = true;
    renderStatus();
    try {
      state.status = await Api.get('/idx/status');
    } catch {
      state.status = null;
    }
    state.statusLoading = false;
    renderStatus();
  }

  function renderStatus() {
    statusCard.innerHTML = '';
    statusCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    statusCard.querySelector('.card__head').innerHTML = `
      <div>
        <div class="card__title">IDX Database Status</div>
        <div class="card__subtitle">IDX stock data &amp; database condition.</div>
      </div>
    `;

    const refreshBtn = createEl('button', { class: 'btn btn--ghost btn--sm', title: 'Reload status' }, []);
    refreshBtn.innerHTML = icons['refresh'];
    refreshBtn.addEventListener('click', loadStatus);
    statusCard.querySelector('.card__head').appendChild(refreshBtn);

    const body = createEl('div', {}, []);

    if (state.statusLoading) {
      body.innerHTML = `
        <div class="idx-upload__loading">
          <span class="idx-upload__spinner"></span> Loading status...
        </div>`;
    } else if (!state.status) {
      body.innerHTML = '<p style="color:var(--c-text-3);font-size:var(--text-sm);">Failed to load IDX status.</p>';
    } else {
      const s = state.status;
      const items = [
        { icon: 'grid', label: 'Last Update', value: s.last_update || 'N/A' },
        { icon: 'trending-up', label: 'Stocks', value: String(s.stock_count ?? 0) },
        { icon: 'list', label: 'Trading Days', value: String(s.trade_days ?? 0) },
        { icon: 'database', label: 'DB Size', value: s.db_size_mb ? `${s.db_size_mb} MB` : '—' },
      ];
      const grid = createEl('div', { class: 'idx-upload__status-grid' }, []);
      items.forEach(it => {
        const tile = createEl('div', { class: 'idx-upload__status-item' }, []);
        tile.innerHTML = `
          <div class="idx-upload__status-icon">${icons[it.icon]}</div>
          <div>
            <div class="idx-upload__status-label">${it.label}</div>
            <div class="idx-upload__status-value">${it.value}</div>
          </div>`;
        grid.appendChild(tile);
      });
      body.appendChild(grid);
    }

    statusCard.appendChild(body);
  }

  // ── Info card ───────────────────────────────────────────────────
  function renderInfo() {
    infoCard.innerHTML = '';
    infoCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    infoCard.querySelector('.card__head').innerHTML = `
      <div class="card__title">File Format</div>
    `;
    const list = createEl('ul', { class: 'idx-upload__format-list' }, []);
    [
      'File must be in .xlsx (Excel) format',
      'File name must contain a YYYYMMDD date',
      'Example: 20240115_idx_data.xlsx',
    ].forEach(t => list.appendChild(createEl('li', {}, [t])));
    infoCard.appendChild(list);
  }

  // ── Upload card ─────────────────────────────────────────────────
  function renderUpload() {
    uploadCard.innerHTML = '';
    uploadCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    uploadCard.querySelector('.card__head').innerHTML = `
      <div class="card__title">Upload XLSX File</div>
    `;

    const body = createEl('div', { class: 'idx-upload__actions' }, []);

    // Pick button (green, like Flutter ElevatedButton picker)
    const pickBtn = createEl('button', {
      class: 'btn btn--accent idx-upload__btn-block',
      ...(state.uploading ? { disabled: true } : {}),
    }, []);
    pickBtn.innerHTML = `${icons['upload']} Choose Excel File`;
    pickBtn.addEventListener('click', () => fileInput.click());
    body.appendChild(pickBtn);

    // Selected file row
    if (state.file) {
      const fileRow = createEl('div', { class: 'idx-upload__file' }, []);
      fileRow.innerHTML = `
        <span class="idx-upload__file-icon">${icons['file-text']}</span>
        <span class="idx-upload__file-name">${state.file.name}</span>`;
      const clearBtn = createEl('button', { class: 'btn btn--ghost btn--sm', title: 'Remove file' }, []);
      clearBtn.innerHTML = icons['x'];
      clearBtn.addEventListener('click', () => {
        state.file = null;
        state.uploadResult = null;
        fileInput.value = '';
        renderUpload();
        renderResult();
      });
      fileRow.appendChild(clearBtn);
      body.appendChild(fileRow);
    }

    // Upload button (blue, like Flutter ElevatedButton upload)
    const uploadBtn = createEl('button', {
      class: 'btn btn--primary idx-upload__btn-block',
      ...(!state.file || state.uploading ? { disabled: true } : {}),
    }, []);
    uploadBtn.innerHTML = state.uploading
      ? '<span class="idx-upload__spinner idx-upload__spinner--light"></span> Uploading...'
      : `${icons['upload']} Upload to Server`;
    uploadBtn.addEventListener('click', uploadFile);
    body.appendChild(uploadBtn);

    uploadCard.appendChild(body);
  }

  async function uploadFile() {
    if (!state.file || state.uploading) return;

    state.uploading = true;
    state.uploadResult = null;
    renderUpload();
    renderResult();

    try {
      const res = await Api.multipartPost('/idx/upload', state.file, { fieldName: 'file' });

      if (res == null) {
        state.uploadResult = { success: false, message: 'Session expired. Please log in again.' };
      } else if (res?.success) {
        state.uploadResult = {
          success: true,
          message: res.message || '',
          trade_date: res.trade_date,
          is_new: res.is_new,
        };
        toast('✅ Upload successful!', { type: 'success' });
        loadStatus(); // refresh status setelah upload (parity Flutter)
      } else {
        state.uploadResult = { success: false, message: res?.message || 'Upload failed' };
        toast('Upload failed', { type: 'error' });
      }
    } catch (e) {
      state.uploadResult = { success: false, message: e.message || String(e) };
      toast('Error: ' + (e.message || e), { type: 'error' });
    }

    state.uploading = false;
    renderUpload();
    renderResult();
  }

  // ── Result card ─────────────────────────────────────────────────
  function renderResult() {
    resultCard.innerHTML = '';
    resultCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    resultCard.querySelector('.card__head').innerHTML = `
      <div class="card__title">Upload Result</div>
    `;

    const body = createEl('div', {}, []);

    if (!state.uploadResult) {
      body.innerHTML = '<p style="color:var(--c-text-3);font-size:var(--text-sm);">No uploads yet.</p>';
    } else {
      const r = state.uploadResult;
      const ok = r.success === true;
      const box = createEl('div', {
        class: `idx-upload__result ${ok ? 'idx-upload__result--success' : 'idx-upload__result--error'}`,
      }, []);
      box.innerHTML = `
        <span class="idx-upload__result-icon">${ok ? icons['check'] : icons['alert-circle']}</span>
        <div class="idx-upload__result-body">
          <div class="idx-upload__result-title">${ok ? 'Successful' : 'Failed'}</div>
          ${r.message ? `<div>${r.message}</div>` : ''}
          ${r.trade_date ? `<div class="idx-upload__result-meta">📅 Date: ${r.trade_date}</div>` : ''}
          ${r.is_new !== undefined ? `<div class="idx-upload__result-meta">${r.is_new ? '✨ New data added' : 'ℹ️ Data already exists (consistent)'}</div>` : ''}
        </div>`;
      body.appendChild(box);
    }

    resultCard.appendChild(body);
  }

  // Init
  renderStatus();
  renderInfo();
  renderUpload();
  renderResult();
  loadStatus();

  return container;
}