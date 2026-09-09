/* pages/admin/dashboard.js — Server Dashboard (Flutter parity: Dashboard + Logs tabs) */
import { createEl } from '../../../utils/dom.js';
import { icons } from '../../../ui/icons.js';
import Api from '../../../core/api.js';
import { toast } from '../../../ui/toast.js';
import { ApiConfig } from '../../../core/api-config.js';

const LOG_TYPES = ['scraping', 'bot', 'proxy', 'server'];

export function render() {
  const state = {
    stats: null,
    systemStatus: null,
    scraperRunning: false,
    ws: null,
    tab: 'dashboard',           // 'dashboard' | 'logs'
    logType: 'scraping',
    logLines: [],
    logFile: '',
    logsLoading: false,
  };

  const container = createEl('div', { class: 'admin-dashboard' }, []);

  container.appendChild(createEl('h1', {}, ['Server Dashboard']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['System overview and real-time metrics.']));

  // Tabs: Dashboard | Logs
  const tabs = createEl('div', { class: 'tabs' });
  const tabDashboard = createEl('button', { class: 'tabs__item tabs__item--active', type: 'button' }, ['Dashboard']);
  const tabLogs = createEl('button', { class: 'tabs__item', type: 'button' }, ['Logs']);
  tabs.append(tabDashboard, tabLogs);
  container.appendChild(tabs);

  // ── Panes ──
  const dashboardPane = createEl('div', { class: 'admin-dashboard__pane' });
  const logsPane = createEl('div', { class: 'admin-dashboard__pane', style: { display: 'none' } });
  container.append(dashboardPane, logsPane);
  logsPane.appendChild(buildLogsPane());

  tabDashboard.addEventListener('click', () => switchTab('dashboard'));
  tabLogs.addEventListener('click', () => switchTab('logs'));

  function switchTab(tab) {
    state.tab = tab;
    tabDashboard.classList.toggle('tabs__item--active', tab === 'dashboard');
    tabLogs.classList.toggle('tabs__item--active', tab === 'logs');
    dashboardPane.style.display = tab === 'dashboard' ? '' : 'none';
    logsPane.style.display = tab === 'logs' ? '' : 'none';
    if (tab === 'logs' && !state.logFile && !state.logsLoading) state.loadLogs?.();
  }

  // ═══ LOGS PANE ═══════════════════════════════════════════
  function buildLogsPane() {
    const wrap = createEl('div', {}, []);

    // Sub tabs: jenis log
    const logTabs = createEl('div', { class: 'admin-dashboard__logtabs' });
    LOG_TYPES.forEach(type => {
      const chip = createEl('button', {
        type: 'button',
        class: 'admin-dashboard__logtab' + (type === state.logType ? ' admin-dashboard__logtab--active' : ''),
      }, [type.charAt(0).toUpperCase() + type.slice(1)]);
      chip.addEventListener('click', () => {
        state.logType = type;
        logTabs.querySelectorAll('.admin-dashboard__logtab').forEach(c => c.classList.remove('admin-dashboard__logtab--active'));
        chip.classList.add('admin-dashboard__logtab--active');
        loadLogs();
      });
      logTabs.appendChild(chip);
    });
    wrap.appendChild(logTabs);

    // Header: file + baris + refresh
    const header = createEl('div', { class: 'admin-dashboard__logheader' });
    header.innerHTML = `<span class="admin-dashboard__logfile" title="${state.logFile}"></span>`;
    const fileEl = header.querySelector('.admin-dashboard__logfile');
    const countEl = createEl('span', { class: 'admin-dashboard__logcount' }, ['0 baris']);

    const refreshBtn = createEl('button', { class: 'btn btn--ghost btn--sm', title: 'Muat ulang log', type: 'button' }, []);
    refreshBtn.innerHTML = icons['refresh'];
    refreshBtn.addEventListener('click', loadLogs);

    const headerRight = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', alignItems: 'center', flexShrink: 0 } });
    const spinner = createEl('span', { class: 'admin-dashboard__spin', style: { display: 'none' } });
    headerRight.append(spinner, countEl, refreshBtn);
    header.append(fileEl, headerRight);
    wrap.appendChild(header);

    // Content
    const logBody = createEl('div', { class: 'admin-dashboard__log' });
    wrap.appendChild(logBody);

    function renderLogContent() {
      fileEl.textContent = state.logFile ? `${state.logFile} (${state.logType})` : 'Belum ada log';
      countEl.textContent = `${state.logLines.length} baris`;
      spinner.style.display = state.logsLoading ? '' : 'none';
      refreshBtn.disabled = state.logsLoading;

      logBody.innerHTML = '';
      if (!state.logLines.length) {
        const empty = createEl('div', { class: 'admin-dashboard__log-empty' }, []);
        empty.innerHTML = `<div style="width:40px;height:40px;margin:0 auto var(--s-2);color:var(--c-text-3);">${icons['file-text']}</div>`;
        empty.appendChild(createEl('p', { style: { color: 'var(--c-text-3)', fontSize: 'var(--text-sm)' } },
          ['Belum ada log. Tekan refresh untuk memuat.']));
        logBody.appendChild(empty);
        return;
      }
      state.logLines.forEach(line => {
        logBody.appendChild(createEl('div', { class: 'admin-dashboard__log-line ' + logLineClass(line) }, [line]));
      });
      logBody.scrollTop = logBody.scrollHeight;
    }

    async function loadLogs() {
      state.logsLoading = true;
      renderLogContent();
      try {
        const res = await Api.get(`/admin/logs/${state.logType}`, { lines: 120 });
        state.logLines = Array.isArray(res?.lines) ? res.lines : [];
        state.logFile = res?.file || '';
      } catch (e) {
        state.logLines = [];
        state.logFile = '';
      }
      state.logsLoading = false;
      renderLogContent();
    }

    state.loadLogs = loadLogs;
    return wrap;
  }

  function logLineClass(line) {
    if (line.includes('] OK ') || line.includes('OK')) return 'admin-dashboard__log-line--ok';
    if (line.includes('] FAIL ') || line.includes('FAIL') || line.includes('ERROR') || line.includes('error')) return 'admin-dashboard__log-line--err';
    if (line.includes('WARN') || line.includes('warn')) return 'admin-dashboard__log-line--warn';
    if (line.startsWith('[') || line.includes('─')) return 'admin-dashboard__log-line--meta';
    return 'admin-dashboard__log-line--ok';
  }

  // ═══ DASHBOARD PANE ══════════════════════════════════════
  renderDashboard();

  function renderDashboard() {
    dashboardPane.innerHTML = '';
    const st = state.systemStatus;
    const s = state.stats || {};
    const server = s.server || {};
    const dbNews = (s.database || {}).news || {};
    const dbIdx = (s.database || {}).idx || {};

    if (!state.stats || !st) {
      // Skeleton
      dashboardPane.appendChild(createEl('div', { class: 'skeleton', style: { height: '64px', borderRadius: 'var(--radius-lg)' } }));
      for (let i = 0; i < 6; i++) {
        dashboardPane.appendChild(createEl('div', {
          class: 'skeleton admin-dashboard__tile',
          style: { minHeight: '88px' },
        }));
      }
      return;
    }

    const maintenance = st.status === 'maintenance';
    const regEnabled = !!st.registration_enabled;

    // ── Scraper banner ──
    dashboardPane.appendChild(buildScraperBanner());

    // ── SISTEM ──
    dashboardPane.appendChild(sectionLabel('SISTEM'));
    const sysGrid = createEl('div', { class: 'grid grid--3', style: { marginBottom: 'var(--s-3)' } });
    sysGrid.append(
      tile('Status', maintenance ? 'MAINTENANCE' : 'ACTIVE', maintenance ? 'danger' : 'success'),
      tile('Registrasi', regEnabled ? 'ON' : 'OFF', regEnabled ? 'success' : 'warn'),
      tile('DB Size', st.db_size_mb > 0 ? `${st.db_size_mb} MB` : '—', 'info'),
    );
    dashboardPane.appendChild(sysGrid);

    // ── Toggle buttons ──
    const toggles = createEl('div', { class: 'grid grid--2', style: { marginBottom: 'var(--s-6)' } });
    const mtnBtn = createEl('button', {
      type: 'button',
      class: 'btn ' + (maintenance ? 'btn--accent' : 'btn--danger'),
    }, [maintenance ? 'Nonaktif Maintenance' : 'Aktifkan Maintenance']);
    mtnBtn.addEventListener('click', toggleMaintenance);
    const regBtn = createEl('button', {
      type: 'button',
      class: 'btn ' + (regEnabled ? 'btn--warn' : 'btn--accent'),
    }, [regEnabled ? 'Matikan Registrasi' : 'Hidupkan Registrasi']);
    regBtn.addEventListener('click', toggleRegistration);
    toggles.append(mtnBtn, regBtn);
    dashboardPane.appendChild(toggles);

    // ── SERVER ──
    dashboardPane.appendChild(sectionLabel('SERVER'));
    const serverGrid = createEl('div', { class: 'grid grid--3', style: { marginBottom: 'var(--s-6)' } });
    serverGrid.append(
      tile('CPU', `${server.cpu_percent ?? 0}%`, 'info'),
      tile('RAM', `${server.ram_used_gb ?? 0} / ${server.ram_total_gb ?? 0} GB`, 'primary'),
      tile('Disk', `${server.disk_used_gb ?? 0} / ${server.disk_total_gb ?? 0} GB`, 'warn'),
    );
    dashboardPane.appendChild(serverGrid);

    // ── DATABASE ──
    dashboardPane.appendChild(sectionLabel('DATABASE'));
    const dbGrid = createEl('div', { class: 'grid grid--3', style: { marginBottom: 'var(--s-6)' } });
    dbGrid.append(
      tile('Berita', dbNews.article_count ?? 0, 'primary'),
      tile('Saham', dbIdx.stock_count ?? 0, 'success'),
      tile('Trade Days', dbIdx.trade_days ?? 0, 'warn'),
    );
    dashboardPane.appendChild(dbGrid);

    // ── SCRAPER ──
    dashboardPane.appendChild(sectionLabel('SCRAPER'));
    const runBtn = createEl('button', {
      type: 'button',
      class: 'btn btn--accent admin-dashboard__run',
    }, []);
    const renderRunBtn = () => {
      runBtn.disabled = state.scraperRunning;
      runBtn.innerHTML = '';
      if (state.scraperRunning) {
        const spin = createEl('span', { class: 'admin-dashboard__spin' });
        runBtn.appendChild(spin);
        runBtn.appendChild(createEl('span', {}, ['Sedang Berjalan...']));
      } else {
        const icon = createEl('span', { style: { display: 'inline-flex' } });
        icon.innerHTML = icons['play'];
        runBtn.appendChild(icon);
        runBtn.appendChild(createEl('span', {}, ['Jalankan Scraper']));
      }
    };
    renderRunBtn();
    runBtn.addEventListener('click', async () => {
      try {
        const res = await Api.post('/admin/scraper/run');
        if (res?.success) {
          state.scraperRunning = true;
          renderRunBtn();
          renderDashboard();
          toast('Scraper dimulai', { type: 'success' });
        } else {
          toast(res?.message || 'Scraper sedang jalan', { type: 'info' });
        }
      } catch (e) {
        toast('Error: ' + (e.message || e), { type: 'error' });
      }
    });
    dashboardPane.appendChild(runBtn);
  }

  function sectionLabel(text) {
    return createEl('div', { class: 'admin-dashboard__section' }, [text]);
  }

  function tile(label, value, tone) {
    const el = createEl('div', { class: `admin-dashboard__tile admin-dashboard__tile--${tone}` });
    el.appendChild(createEl('div', { class: 'admin-dashboard__tile-label' }, [label]));
    el.appendChild(createEl('div', { class: 'admin-dashboard__tile-value' }, [String(value)]));
    return el;
  }

  function buildScraperBanner() {
    const banner = createEl('div', {
      class: 'admin-dashboard__banner ' + (state.scraperRunning ? 'admin-dashboard__banner--running' : 'admin-dashboard__banner--idle'),
    });

    const icon = createEl('span', { class: 'admin-dashboard__banner-icon' });
    icon.innerHTML = state.scraperRunning ? icons['refresh'] : icons['check'];

    const text = createEl('div', { class: 'admin-dashboard__banner-text' });
    text.appendChild(createEl('div', { class: 'admin-dashboard__banner-title' },
      [state.scraperRunning ? 'Scraper Sedang Berjalan' : 'Scraper Idle']));
    text.appendChild(createEl('div', { class: 'admin-dashboard__banner-sub' },
      [state.scraperRunning ? 'Menunggu selesai...' : 'Siap dijalankan']));

    const lastScrape = state.systemStatus?.last_scrape_time;
    if (!state.scraperRunning && lastScrape) {
      const src = state.systemStatus?.last_scrape_source;
      text.appendChild(createEl('div', { class: 'admin-dashboard__banner-last' },
        [`Terakhir: ${lastScrape}${src ? ` (${src})` : ''}`]));
    }

    banner.append(icon, text);
    if (state.scraperRunning) {
      banner.appendChild(createEl('span', { class: 'admin-dashboard__spin' }));
    }
    return banner;
  }

  async function toggleMaintenance() {
    try {
      await Api.post('/admin/maintenance');
      await loadSystemStatus();
    } catch (e) {
      toast('Error: ' + (e.message || e), { type: 'error' });
    }
  }

  async function toggleRegistration() {
    try {
      await Api.post('/admin/registration');
      await loadSystemStatus();
    } catch (e) {
      toast('Error: ' + (e.message || e), { type: 'error' });
    }
  }

  // ═══ DATA ═══════════════════════════════════════════════════
  async function loadStats() {
    try {
      const res = await Api.get('/admin/stats');
      state.stats = res;
    } catch (e) {
      state.stats = null;
    }
    renderDashboard();
  }

  async function loadSystemStatus() {
    try {
      const res = await Api.get('/admin/system-status');
      state.systemStatus = res;
      state.scraperRunning = !!res?.scraper_active;
    } catch (e) {
      state.systemStatus = null;
    }
    renderDashboard();
  }

  function initWebSocket() {
    const wsUrl = ApiConfig.baseUrl.replace(/^http/, 'ws') + '/ws/scraper-status';
    try {
      state.ws = new WebSocket(wsUrl);
    } catch (e) {
      console.error('[AdminDashboard] WS init failed:', e);
      return;
    }

    state.ws.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === 'scraper-status') {
        state.scraperRunning = data.status === 'running';
        renderDashboard();
      } else if (data.type === 'scraper-complete') {
        state.scraperRunning = false;
        loadStats();
        loadSystemStatus();
        toast('Scraping selesai!', { type: 'success' });
      }
    };
    state.ws.onerror = (err) => {
      console.error('[AdminDashboard] WebSocket error:', err);
    };
    state.ws.onclose = () => {
      console.log('[AdminDashboard] WebSocket disconnected');
    };
  }

  // Cleanup
  container._cleanup = () => {
    if (state.ws) state.ws.close();
  };

  // Init
  loadStats();
  loadSystemStatus();
  initWebSocket();

  return container;
}