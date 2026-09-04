/* pages/admin/proxies.js — Proxy Scraper Settings with API */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api, { ApiError } from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { createModal } from '../../ui/modal.js';

function formatLatency(ms) {
  if (ms == null) return '-';
  return `${ms} ms`;
}

export function render() {
  const state = {
    proxies: '',
    webshareKey: '',
    webshareConfigured: false,
    testResults: [],
    saving: false,
  };

  const container = createEl('div', { class: 'admin-proxies' }, []);

  container.appendChild(createEl('h1', {}, ['Proxy Scraper']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Configure proxy rotation for scrapers.']));

  const card = createEl('div', { class: 'card', style: { maxWidth: '720px', margin: '0 auto' } });
  container.appendChild(card);

  // Test results card
  const testCard = createEl('div', { class: 'card', style: { maxWidth: '720px', margin: '0 auto var(--s-5)' } });
  container.appendChild(testCard);

  async function loadProxySettings() {
    card.innerHTML = '<div class="skeleton" style="height:200px;width:100%;border-radius:6px;"></div>';

    try {
      const res = await Api.get('/admin/proxies');
      state.proxies = res.proxies || '';
      state.webshareKey = res.webshare_key_masked || '';
      state.webshareConfigured = res.webshare_key_configured || false;
    } catch (e) {
      console.error('[Proxies] Failed to load settings:', e);
    }

    renderForm();
  }

  function renderForm() {
    card.innerHTML = '';
    card.appendChild(createEl('div', { class: 'card__head' }, [], []));
    card.querySelector('.card__head').innerHTML = '<div class="card__title">Proxy List</div>';

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' } });
    body.innerHTML = `
      <div class="field">
        <label class="field__label">Proxies (one per line: host:port or host:port:user:pass)</label>
        <textarea class="field__textarea" id="proxy-list" rows="8" style="font-family:var(--font-mono);font-size:var(--text-sm);">${state.proxies}</textarea>
      </div>
      <div class="field">
        <label class="field__label">Webshare API Key (optional)</label>
        <input type="password" class="field__input" id="webshare-key" placeholder="ws_xxxxxxxx" value="${state.webshareConfigured ? '••••••••' + state.webshareKey : ''}">
        ${state.webshareConfigured ? '<div class="field__hint">Key sudah terkonfigurasi (masukkan ulang untuk mengganti)</div>' : ''}
      </div>
      <div style="display:flex;gap:var(--s-3);justify-content:flex-end;">
        <button class="btn btn--secondary" id="test-proxies">${icons['refresh']} Test Proxies</button>
        <button class="btn btn--primary" id="save-proxies" ${state.saving ? 'disabled' : ''}>Save Settings</button>
      </div>
    `;
    card.appendChild(body);

    const proxyInput = body.querySelector('#proxy-list');
    const keyInput = body.querySelector('#webshare-key');
    const saveBtn = body.querySelector('#save-proxies');
    const testBtn = body.querySelector('#test-proxies');

    saveBtn.addEventListener('click', async () => {
      const proxies = proxyInput.value.trim();
      let webshareKey = keyInput.value.trim();
      if (webshareKey && webshareKey.startsWith('••••••••')) {
        webshareKey = ''; // Keep existing
      }

      state.saving = true;
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span style="width:18px;height:18px;border:2px solid rgba(255,255,255,0.5);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;"></span> Saving...`;

      try {
        const body = { proxies, webshare_api_key: webshareKey };
        const res = await Api.put('/admin/proxies', body);
        state.webshareConfigured = res?.webshare_key_configured || false;
        toast(`Proxy disimpan: ${res?.proxy_count || 0} proxies`, { type: 'success' });
      } catch (e) {
        toast('Gagal menyimpan: ' + (e.message || e), { type: 'error' });
      } finally {
        state.saving = false;
        renderForm();
      }
    });

    testBtn.addEventListener('click', async () => {
      try {
        toast('Menguji proxy...', { type: 'info', duration: 5000 });
        const res = await Api.post('/admin/proxies/test');
        renderTestResults(res);
      } catch (e) {
        toast('Gagal menguji proxy: ' + (e.message || e), { type: 'error' });
      }
    });
  }

  function renderTestResults(result) {
    testCard.innerHTML = '';
    testCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    testCard.querySelector('.card__head').innerHTML = `<div class="card__title">Proxy Test Results (${result.total} total, ${result.working} working)</div>`;

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });

    (result.results || []).forEach(r => {
      const row = createEl('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--s-3)', background: 'var(--c-surface-2)', borderRadius: 'var(--radius)' }
      });
      const statusClass = r.working ? 'badge--success' : 'badge--danger';
      const statusText = r.working ? 'OK' : 'FAIL';
      row.innerHTML = `
        <div style="font-family:var(--font-mono);font-size:var(--text-sm);">${r.proxy}</div>
        <div style="display:flex;align-items:center;gap:var(--s-2);">
          <span style="font-size:var(--text-sm);color:var(--c-text-3);">${formatLatency(r.latency_ms)}</span>
          <span class="badge ${statusClass}">${statusText}</span>
        </div>
      `;
      body.appendChild(row);
    });

    testCard.appendChild(body);
  }

  container._cleanup = () => {
    if (state._timer) clearTimeout(state._timer);
  };

  // Init
  loadProxySettings();

  return container;
}
