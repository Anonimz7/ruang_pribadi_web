/* pages/admin/dashboard.js — Server Dashboard with API + WebSocket */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api, { ApiError } from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { ApiConfig } from '../../core/api-config.js';

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function render() {
  const state = {
    stats: null,
    systemStatus: null,
    ws: null,
    scraperActive: false,
  };

  const container = createEl('div', { class: 'admin-dashboard' }, []);

  container.appendChild(createEl('h1', {}, ['Server Dashboard']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['System overview and real-time metrics.']));

  // Stats grid
  const statsGrid = createEl('div', { class: 'grid grid--4', style: { marginBottom: 'var(--s-5)' } });
  container.appendChild(statsGrid);

  // Main content grid
  const mainGrid = createEl('div', { class: 'grid grid--2', style: { marginBottom: 'var(--s-5)' } });
  container.appendChild(mainGrid);

  // System status card
  const statusCard = createEl('div', { class: 'card' });
  mainGrid.appendChild(statusCard);

  // Database card
  const dbCard = createEl('div', { class: 'card' });
  mainGrid.appendChild(dbCard);

  // Actions card
  const actionsCard = createEl('div', { class: 'card' });
  container.appendChild(actionsCard);

  function renderStats() {
    statsGrid.innerHTML = '';

    if (!state.stats) {
      for (let i = 0; i < 4; i++) {
        const card = createEl('div', { class: 'skeleton', style: { height: '120px', borderRadius: '6px' } });
        statsGrid.appendChild(card);
      }
      return;
    }

    const s = state.stats;
    const server = s.server || {};
    const db = s.database || {};

    const items = [
      { label: 'CPU Usage', value: `${server.cpu_percent || 0}%`, sub: `${server.cpu_cores || 0} cores`, color: 'var(--c-primary)' },
      { label: 'Memory', value: formatMemory(server.mem_used_mb || 0), sub: `/ ${formatMemory(server.mem_total_mb || 0)} used`, color: 'var(--c-accent)' },
      { label: 'Disk', value: server.disk_percent ? `${server.disk_percent}%` : '-', sub: server.disk_free_gb ? `${server.disk_free_gb} GB free` : '', color: 'var(--c-warn)' },
      { label: 'Uptime', value: server.uptime || '-', sub: '-', color: 'var(--c-info)' },
      { label: 'News Articles', value: (db.news || {}).articles || 0, sub: '-', color: 'var(--c-primary)' },
      { label: 'Stocks Tracked', value: (db.idx || {}).stocks || 0, sub: '-', color: 'var(--c-accent)' },
      { label: 'DB Size', value: ((db.news || {}).db_size_mb || (db.idx || {}).db_size_mb || 0) + ' MB', sub: '-', color: 'var(--c-warn)' },
      { label: 'Users', value: server.users || 0, sub: '-', color: 'var(--c-info)' },
    ];

    items.forEach(item => {
      const card = createEl('div', { class: 'stat-card' });
      card.innerHTML = `
        <div class="stat-card__label">${item.label}</div>
        <div class="stat-card__value" style="color:${item.color}">${item.value}</div>
        <div class="stat-card__change">${item.sub}</div>
      `;
      statsGrid.appendChild(card);
    });
  }

  function renderStatusCard() {
    statusCard.innerHTML = '';
    statusCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    statusCard.querySelector('.card__head').innerHTML = '<div class="card__title">System Status</div>';

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });

    if (!state.systemStatus) {
      for (let i = 0; i < 4; i++) {
        const row = createEl('div', { class: 'skeleton', style: { height: '40px', borderRadius: '6px' } });
        body.appendChild(row);
      }
    } else {
      const st = state.systemStatus;
      const rows = [
        { label: 'Status', value: st.status === 'maintenance' ? '<span class="badge badge--warn">Maintenance</span>' : '<span class="badge badge--success">Active</span>' },
        { label: 'Registration', value: st.registration_enabled ? '<span class="badge badge--success">Enabled</span>' : '<span class="badge badge--danger">Disabled</span>' },
        { label: 'Scraper', value: state.scraperActive ? '<span class="badge badge--warn">Running</span>' : '<span class="badge badge--neutral">Idle</span>' },
        { label: 'Last Scrape', value: formatDate(st.last_scrape_time) },
        { label: 'DB Size', value: `${st.db_size_mb || 0} MB` },
      ];

      rows.forEach(r => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:var(--s-2) 0;border-bottom:1px solid var(--c-border);';
        row.innerHTML = `<span style="font-size:var(--text-sm);color:var(--c-text-2);">${r.label}</span><span>${r.value}</span>`;
        body.appendChild(row);
      });
    }

    statusCard.appendChild(body);
  }

  function renderDbCard() {
    dbCard.innerHTML = '';
    dbCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    dbCard.querySelector('.card__head').innerHTML = '<div class="card__title">Database</div>';

    const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });

    if (!state.stats?.database) {
      for (let i = 0; i < 4; i++) {
        const row = createEl('div', { class: 'skeleton', style: { height: '40px', borderRadius: '6px' } });
        body.appendChild(row);
      }
    } else {
      const db = state.stats.database;
      const rows = [
        { label: 'News Articles', value: (db.news || {}).articles || 0 },
        { label: 'News Domains', value: (db.news || {}).domains || 0 },
        { label: 'Stocks Tracked', value: (db.idx || {}).stocks || 0 },
        { label: 'Users', value: (db.news || {}).users || 0 },
      ];

      rows.forEach(r => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:var(--s-2) 0;border-bottom:1px solid var(--c-border);';
        row.innerHTML = `<span style="font-size:var(--text-sm);color:var(--c-text-2);">${r.label}</span><span style="font-weight:600;">${r.value}</span>`;
        body.appendChild(row);
      });
    }

    dbCard.appendChild(body);
  }

  function renderActions() {
    actionsCard.innerHTML = '';
    actionsCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    actionsCard.querySelector('.card__head').innerHTML = '<div class="card__title">Quick Actions</div>';

    const body = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap' } });
    body.innerHTML = `
      <button class="btn btn--secondary" id="run-scraper">${icons['refresh']} Run Scraper</button>
      <button class="btn btn--secondary" id="optimize-db">${icons['database']} Optimize DB</button>
      <button class="btn btn--secondary" id="upload-idx">${icons['upload']} Upload IDX</button>
      <button class="btn btn--danger" id="maintenance-mode">${icons['shield']} Maintenance Mode</button>
    `;
    actionsCard.appendChild(body);

    body.querySelector('#run-scraper').addEventListener('click', async () => {
      try {
        const res = await Api.post('/admin/scraper/run');
        if (res?.success) {
          toast('Scraper started', { type: 'success' });
          state.scraperActive = true;
          renderStatusCard();
        } else {
          toast('Gagal memulai scraper', { type: 'error' });
        }
      } catch (e) {
        toast('Error: ' + (e.message || e), { type: 'error' });
      }
    });

    body.querySelector('#optimize-db').addEventListener('click', () => {
      toast('Optimize DB - fitur ini akan datang', { type: 'info' });
    });

    body.querySelector('#upload-idx').addEventListener('click', () => {
      toast('Upload IDX - fitur ini akan datang', { type: 'info' });
    });

    body.querySelector('#maintenance-mode').addEventListener('click', async () => {
      try {
        const res = await Api.post('/admin/maintenance');
        toast(`Maintenance mode: ${res?.status || 'updated'}`, { type: 'success' });
        loadSystemStatus();
      } catch (e) {
        toast('Error: ' + (e.message || e), { type: 'error' });
      }
    });
  }

  function initWebSocket() {
    const wsUrl = ApiConfig.baseUrl.replace(/^http/, 'ws') + '/ws/scraper-status';

    state.ws = new WebSocket(wsUrl);

    state.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'scraper-status') {
        state.scraperActive = data.status === 'running';
        renderStatusCard();
      } else if (data.type === 'scraper-complete') {
        state.scraperActive = false;
        renderStatusCard();
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

  async function loadStats() {
    try {
      const res = await Api.get('/admin/stats');
      state.stats = res;
      renderStats();
      renderDbCard();
    } catch (e) {
      state.stats = null;
      renderStats();
      renderDbCard();
    }
  }

  async function loadSystemStatus() {
    try {
      const res = await Api.get('/admin/system-status');
      state.systemStatus = res;
      renderStatusCard();
    } catch (e) {
      state.systemStatus = null;
      renderStatusCard();
    }
  }

  function formatMemory(mb) {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${Math.round(mb)} MB`;
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
