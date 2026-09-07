/* pages/admin/proxies.js — Proxy Scraper Settings (Flutter parity: 3 tabs) */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api from '../../core/api.js';
import { toast } from '../../ui/toast.js';

function formatLatency(ms) {
  if (ms == null) return '-';
  return `${ms} ms`;
}

export function render() {
  const state = {
    proxies: '',
    keyConfigured: false,
    keyMasked: '',
    saving: false,
    tab: 'webshare',            // 'webshare' | 'proxy' | 'log'
    testResult: null,           // POST /proxies/test
    keyTestResult: null,        // POST /proxies/webshare/test
    logLines: [],
    logFile: '',
    logsLoading: false,
  };

  const container = createEl('div', { class: 'admin-proxies' }, []);
  container.appendChild(createEl('h1', {}, ['Proxy Scraper']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Konfigurasi rotasi proxy untuk scraper.']));

  // ── Tabs ──
  const tabs = createEl('div', { class: 'tabs' });
  const tabWeb = createEl('button', { type: 'button', class: 'tabs__item tabs__item--active' }, ['Webshare']);
  const tabProxy = createEl('button', { type: 'button', class: 'tabs__item' }, ['Proxy']);
  const tabLog = createEl('button', { type: 'button', class: 'tabs__item' }, ['Log']);
  tabs.append(tabWeb, tabProxy, tabLog);
  container.appendChild(tabs);

  // ── Panes ──
  const paneWeb = createEl('div', { class: 'admin-proxies__pane' });
  const paneProxy = createEl('div', { class: 'admin-proxies__pane', style: { display: 'none' } });
  const paneLog = createEl('div', { class: 'admin-proxies__pane', style: { display: 'none' } });
  container.append(paneWeb, paneProxy, paneLog);

  function switchTab(tab) {
    state.tab = tab;
    tabWeb.classList.toggle('tabs__item--active', tab === 'webshare');
    tabProxy.classList.toggle('tabs__item--active', tab === 'proxy');
    tabLog.classList.toggle('tabs__item--active', tab === 'log');
    paneWeb.style.display = tab === 'webshare' ? '' : 'none';
    paneProxy.style.display = tab === 'proxy' ? '' : 'none';
    paneLog.style.display = tab === 'log' ? '' : 'none';
    if (tab === 'log' && !state.logFile && !state.logsLoading) loadLogs();
  }
  tabWeb.addEventListener('click', () => switchTab('webshare'));
  tabProxy.addEventListener('click', () => switchTab('proxy'));
  tabLog.addEventListener('click', () => switchTab('log'));

  // ═══ TAB: WEBSHARE ═════════════════════════════════════
  function buildWebsharePane() {
    const card = createEl('div', { class: 'card admin-proxies__card' });

    // Status header
    const statusRow = createEl('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--s-2)', flexWrap: 'wrap' } });
    const statusIcon = createEl('span', { style: { display: 'inline-flex' } });
    const statusText = createEl('span', { style: { fontWeight: 600 } });
    const statusBadge = createEl('span', {});

    function renderStatus() {
      statusIcon.innerHTML = icons['key'];
      if (state.keyConfigured) {
        statusIcon.style.color = 'var(--c-success)';
        statusText.textContent = 'API Key Terkonfigurasi';
        statusText.style.color = 'var(--c-success)';
        statusBadge.className = 'badge badge--success';
        statusBadge.textContent = 'Aktif';
      } else {
        statusIcon.style.color = 'var(--c-warn)';
        statusText.textContent = 'Belum Ada API Key';
        statusText.style.color = 'var(--c-warn)';
        statusBadge.className = 'badge badge--warn';
        statusBadge.textContent = 'Belum';
      }
    }
    statusRow.append(statusIcon, statusText, statusBadge);
    card.appendChild(statusRow);

    // Masked key box
    const maskBox = createEl('div', { class: 'admin-proxies__mask', style: { display: 'none' } });
    maskBox.innerHTML = `<span style="display:inline-flex;color:var(--c-text-3);">${icons['key']}</span>`;
    const maskText = createEl('span', { class: 'admin-proxies__mask-text' }, []);
    maskBox.appendChild(maskText);
    card.appendChild(maskBox);

    // Input key baru
    const keyInput = createEl('input', {
      type: 'password',
      class: 'field__input',
      placeholder: 'Tempel API key Webshare (ws_xxxx)',
      autocomplete: 'off',
      style: { marginTop: 'var(--s-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' },
    });
    card.appendChild(keyInput);

    const keyHint = createEl('p', { class: 'field__hint' }, []);
    card.appendChild(keyHint);

    // Actions
    const actions = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', marginTop: 'var(--s-3)' } });
    const testKeyBtn = createEl('button', { type: 'button', class: 'btn btn--secondary' }, []);
    const syncBtn = createEl('button', { type: 'button', class: 'btn btn--accent' }, []);

    function renderButtons() {
      testKeyBtn.innerHTML = `${icons['key']} Uji Koneksi`;
      syncBtn.innerHTML = `${icons['download']} Sinkronkan`;
      syncBtn.disabled = !state.keyConfigured;
      testKeyBtn.disabled = state.saving || testKeyBtn._busy;
      syncBtn.disabled = state.saving || !state.keyConfigured || syncBtn._busy;
    }
    testKeyBtn.addEventListener('click', async () => {
      testKeyBtn._busy = true;
      renderButtons();
      try {
        const res = await Api.post('/admin/proxies/webshare/test');
        state.keyTestResult = res;
        if (res?.success) toast(res.message || 'API key valid', { type: 'success' });
        else toast(res?.message || 'Test gagal', { type: 'error' });
      } catch (e) {
        state.keyTestResult = { success: false, message: e.message || String(e) };
        toast('Gagal uji koneksi: ' + (e.message || e), { type: 'error' });
      } finally {
        testKeyBtn._busy = false;
        renderButtons();
        renderKeyTestResult();
      }
    });

    syncBtn.addEventListener('click', async () => {
      syncBtn._busy = true;
      renderButtons();
      try {
        const res = await Api.post('/admin/proxies/webshare/sync');
        toast(res?.message || 'Proxy Webshare disinkronkan', { type: 'success' });
        await loadProxySettings();
      } catch (e) {
        toast('Gagal sinkron: ' + (e.message || e), { type: 'error' });
      } finally {
        syncBtn._busy = false;
        renderButtons();
      }
    });

    actions.append(testKeyBtn, syncBtn);
    card.appendChild(actions);

    // Key test result banner
    const keyResultBox = createEl('div', { class: 'admin-proxies__result', style: { display: 'none' } });
    const keyResultIcon = createEl('span', { style: { display: 'inline-flex', flexShrink: 0 } });
    const keyResultMsg = createEl('span', {});
    keyResultBox.append(keyResultIcon, keyResultMsg);
    card.appendChild(keyResultBox);

    function renderKeyTestResult() {
      if (!state.keyTestResult) {
        keyResultBox.style.display = 'none';
        return;
      }
      const ok = state.keyTestResult.success === true;
      keyResultBox.style.display = '';
      keyResultBox.className = 'admin-proxies__result ' + (ok ? 'admin-proxies__result--ok' : 'admin-proxies__result--err');
      keyResultIcon.innerHTML = ok ? icons['check'] : icons['alert-circle'];
      keyResultMsg.textContent = state.keyTestResult.message || (ok ? 'API key valid' : 'API key tidak valid');
    }

    function renderWebshare() {
      renderStatus();
      maskBox.style.display = state.keyConfigured && state.keyMasked ? '' : 'none';
      maskText.textContent = state.keyMasked || '';
      keyInput.placeholder = state.keyConfigured ? 'Ketik key baru untuk mengganti' : 'Tempel API key Webshare (ws_xxxx)';
      keyHint.textContent = state.keyConfigured
        ? 'Key tersimpan di backend. Ketik key baru lalu tekan Simpan di tab Proxy untuk mengganti, atau langsung sinkronkan.'
        : 'Simpan API key terlebih dahulu sebelum sinkronisasi (tab Proxy → Simpan).';
      renderButtons();
      renderKeyTestResult();
    }

    card._render = renderWebshare;
    card._keyInput = keyInput;
    return card;
  }

  // ═══ TAB: PROXY ═══════════════════════════════════════
  function buildProxyPane() {
    const card = createEl('div', { class: 'card admin-proxies__card' });

    const textarea = createEl('textarea', {
      class: 'field__textarea',
      rows: 10,
      spellcheck: 'false',
      style: { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' },
    });
    textarea.value = state.proxies;
    card.appendChild(textarea);
    card.appendChild(createEl('p', { class: 'field__hint' }, ['Satu proxy per baris: IP:PORT atau IP:PORT:USERNAME:PASSWORD']));

    // Actions
    const actions = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', marginTop: 'var(--s-3)' } });
    const saveBtn = createEl('button', { type: 'button', class: 'btn btn--primary' }, []);
    const testBtn = createEl('button', { type: 'button', class: 'btn btn--secondary' }, []);

    function renderButtons() {
      saveBtn.innerHTML = `${icons['check']} Simpan`;
      testBtn.innerHTML = `${icons['refresh']} Tes Semua`;
      saveBtn.disabled = state.saving;
      testBtn.disabled = state.saving;
      progress.style.display = state.saving ? '' : 'none';
      if (state.saving) {
        saveBtn.innerHTML = '<span class="admin-proxies__spin"></span> Menyimpan...';
        testBtn.innerHTML = '<span class="admin-proxies__spin"></span> Menguji...';
      }
    }

    saveBtn.addEventListener('click', async () => {
      const proxies = textarea.value.trim();
      let webshareKey = card._keyInput.value.trim();
      if (webshareKey.startsWith('••')) webshareKey = '';
      state.saving = true;
      renderButtons();
      try {
        const res = await Api.put('/admin/proxies', {
          proxies,
          webshare_api_key: webshareKey || null,
        });
        state.keyConfigured = !!res?.webshare_key_configured;
        card._keyInput.value = '';
        toast(`${res?.proxy_count ?? 0} proxy disimpan`, { type: 'success' });
        card._render();
      } catch (e) {
        toast('Gagal menyimpan: ' + (e.message || e), { type: 'error' });
      } finally {
        state.saving = false;
        renderButtons();
      }
    });

    testBtn.addEventListener('click', async () => {
      state.saving = true;
      renderButtons();
      try {
        const res = await Api.post('/admin/proxies/test');
        state.testResult = res;
        renderTestResults();
        await state.loadLogs?.();
      } catch (e) {
        toast('Gagal menguji proxy: ' + (e.message || e), { type: 'error' });
      } finally {
        state.saving = false;
        renderButtons();
      }
    });

    actions.append(saveBtn, testBtn);
    card.appendChild(actions);

    // Progress bar saat saving (paritas Flutter LinearProgressIndicator)
    const progress = createEl('div', { class: 'progress', style: { marginTop: 'var(--s-3)', display: 'none' } });
    const progressBar = createEl('div', { class: 'progress__bar', style: { width: '100%' } });
    progress.appendChild(progressBar);
    card.appendChild(progress);

    // Results section
    const resultWrap = createEl('div', { style: { display: 'none' } });
    card.appendChild(resultWrap);

    function renderTestResults() {
      const r = state.testResult;
      if (!r) { resultWrap.style.display = 'none'; return; }
      resultWrap.innerHTML = '';
      resultWrap.style.display = '';

      const total = r.total ?? 0;
      const working = r.working ?? 0;
      const failed = Math.max(0, total - working);

      // Summary section label
      resultWrap.appendChild(createEl('div', { class: 'admin-proxies__section' }, ['HASIL PENGUJIAN']));

      // Summary chips row
      const chips = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', marginTop: 'var(--s-2)' } });
      chips.append(
        resultChip(`${total} Total`, 'info'),
        resultChip(`${working} Aktif`, 'success'),
        resultChip(`${failed} Gagal`, 'danger'),
      );
      resultWrap.appendChild(chips);

      // Detail per proxy
      (r.results || []).forEach(item => {
        const ok = item.working === true;
        const row = createEl('div', {
          class: 'admin-proxies__testerow',
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s-3)' },
        });
        row.innerHTML = `
          <span style="display:inline-flex;flex-shrink:0;color:${ok ? 'var(--c-success)' : 'var(--c-danger)'};">${ok ? icons['check'] : icons['alert-circle']}</span>
          <span class="admin-proxies__proxy">${item.proxy}</span>
          <span class="admin-proxies__latency" style="color:${ok ? 'var(--c-success)' : 'var(--c-danger)'};">${ok ? (item.latency_ms != null ? formatLatency(item.latency_ms) : 'Aktif') : 'Gagal'}</span>
        `;
        resultWrap.appendChild(row);
      });
    }

    card._render = renderButtons;
    card._renderResults = renderTestResults;
    return card;
  }

  function resultChip(label, tone) {
    const el = createEl('div', { class: `admin-proxies__chip admin-proxies__chip--${tone}` }, [label]);
    return el;
  }

  // ═══ TAB: LOG ═════════════════════════════════════════
  function buildLogPane() {
    const wrap = createEl('div', {}, []);

    const header = createEl('div', { class: 'admin-proxies__logheader' });
    const fileEl = createEl('span', { class: 'admin-proxies__logfile' }, ['Belum ada log']);
    const countEl = createEl('span', { class: 'admin-proxies__logcount' }, ['0 baris']);
    const spinner = createEl('span', { class: 'admin-proxies__spin', style: { display: 'none' } });
    const refreshBtn = createEl('button', { class: 'btn btn--ghost btn--sm', title: 'Muat ulang log', type: 'button' }, []);
    refreshBtn.innerHTML = icons['refresh'];
    refreshBtn.addEventListener('click', loadLogs);
    const headerRight = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', alignItems: 'center', flexShrink: 0 } });
    headerRight.append(spinner, countEl, refreshBtn);
    header.append(fileEl, headerRight);
    wrap.appendChild(header);

    const logBody = createEl('div', { class: 'admin-proxies__log' });
    wrap.appendChild(logBody);

    function render() {
      fileEl.textContent = state.logFile ? `${state.logFile} (${state.logLines.length} baris)` : 'Belum ada log';
      countEl.textContent = `${state.logLines.length} baris`;
      spinner.style.display = state.logsLoading ? '' : 'none';
      refreshBtn.disabled = state.logsLoading;

      logBody.innerHTML = '';
      if (!state.logLines.length) {
        logBody.appendChild(createEl('div', { class: 'admin-proxies__log-empty' }, ['Belum ada log pengujian proxy.\nJalankan "Tes Semua" untuk melihat hasilnya.']));
        return;
      }
      state.logLines.forEach(line => {
        const isOk = line.includes('] OK ');
        const isFail = line.includes('] FAIL ');
        logBody.appendChild(createEl('div', {
          class: 'admin-proxies__log-line ' +
            (isOk ? 'admin-proxies__log-line--ok' : isFail ? 'admin-proxies__log-line--err' : 'admin-proxies__log-line--meta'),
        }, [line]));
      });
      logBody.scrollTop = logBody.scrollHeight;
    }

    async function loadLogs() {
      state.logsLoading = true;
      render();
      try {
        const res = await Api.get('/admin/proxies/logs', { lines: 120 });
        state.logLines = Array.isArray(res?.lines) ? res.lines : [];
        state.logFile = res?.current_file || '';
      } catch (e) {
        state.logLines = [];
        state.logFile = '';
      }
      state.logsLoading = false;
      render();
    }

    state.loadLogs = loadLogs;
    return wrap;
  }

  // ═══ BUILD ═════════════════════════════════════════════
  const webshareCard = buildWebsharePane();
  const proxyCard = buildProxyPane();
  const logPane = buildLogPane();
  paneWeb.appendChild(webshareCard);
  paneProxy.appendChild(proxyCard);
  paneLog.appendChild(logPane);

  async function loadProxySettings() {
    container.classList.add('admin-proxies--loading');
    try {
      const res = await Api.get('/admin/proxies');
      state.proxies = res?.proxies || '';
      state.keyConfigured = !!res?.webshare_key_configured;
      state.keyMasked = res?.webshare_key_masked || '';
      state.testResult = null;
      state.keyTestResult = null;
    } catch (e) {
      console.error('[Proxies] Failed to load settings:', e);
    }
    container.classList.remove('admin-proxies--loading');
    webshareCard._render();
    proxyCard.querySelector('textarea').value = state.proxies;
    proxyCard._render();
    proxyCard._renderResults();
  }

  container._cleanup = () => {};

  // Init
  loadProxySettings();

  return container;
}