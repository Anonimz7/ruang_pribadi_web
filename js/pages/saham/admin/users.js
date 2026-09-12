/* pages/admin/users.js — User Permissions Management (Flutter parity) */
import { createEl } from '../../../utils/dom.js';
import { icons } from '../../../ui/icons.js';
import Api from '../../../core/api.js';
import { toast } from '../../../ui/toast.js';
import { createModal } from '../../../ui/modal.js';
import { fetchMenuConfig } from '../../../core/menu-config.js';

const MAIN_ADMIN = 'xoot';

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID');
}

export function render() {
  const state = {
    users: [],
    apps: [],              // [{ key, label }]
    defaultPerms: [],      // [key, ...]
    loading: true,
    searchTerm: '',
    searchDebounce: null,
  };

  const container = createEl('div', { class: 'admin-users' }, []);

  container.appendChild(createEl('h1', {}, ['User Permissions']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Manage users, tiers, and app access.']));

  // ── Default for New Users card ──
  const defaultCard = createEl('div', { class: 'card admin-users__default' });
  container.appendChild(defaultCard);

  // Toolbar
  const toolbar = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', marginBottom: 'var(--s-4)', flexWrap: 'wrap' } });
  toolbar.innerHTML = `
    <div class="search" style="flex:1;min-width:200px;">
      <span class="search__icon">${icons['search']}</span>
      <input type="text" class="search__input" placeholder="Cari username...">
      <button type="button" class="search__clear" aria-label="Bersihkan pencarian">${icons['x']}</button>
    </div>
    <button class="btn btn--primary" id="create-user">${icons['plus']} Create User</button>
  `;
  container.appendChild(toolbar);

  // Table container
  const tableWrap = createEl('div', { class: 'table-wrap' });
  container.appendChild(tableWrap);

  // ---- Toolbar wiring ----
  const searchWrap = toolbar.querySelector('.search');
  const searchInput = searchWrap.querySelector('.search__input');
  const searchClear = searchWrap.querySelector('.search__clear');

  searchInput.addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    searchWrap.classList.toggle('has-clear', state.searchTerm !== '');
    clearTimeout(state.searchDebounce);
    state.searchDebounce = setTimeout(loadUsers, 300);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    state.searchTerm = '';
    searchWrap.classList.remove('has-clear');
    loadUsers();
    searchInput.focus();
  });

  toolbar.querySelector('#create-user').addEventListener('click', openCreateModal);

  // ---- Apps & default permissions ----
  async function loadApps() {
    try {
      const res = await Api.get('/admin/apps');
      const keys = res?.apps || [];

      let labels = {};
      try {
        const cfg = await fetchMenuConfig();
        cfg.forEach(a => { labels[a.key] = a.label; });
      } catch { /* fallback: pakai key sebagai label */ }

      state.apps = keys.map(k => ({ key: k, label: labels[k] || k }));
    } catch (e) {
      console.error('[AdminUsers] Failed to load apps:', e);
      state.apps = [];
    }
    renderDefaultCard();
  }

  async function loadDefaultPerms() {
    try {
      const res = await Api.get('/admin/default-permissions');
      if (Array.isArray(res?.default_permissions)) state.defaultPerms = res.default_permissions;
      if (Array.isArray(res?.all_apps) && state.apps.length === 0) {
        state.apps = res.all_apps.map(k => ({ key: k, label: k }));
      }
    } catch (e) {
      console.error('[AdminUsers] Failed to load default perms:', e);
    }
    renderDefaultCard();
  }

  function appLabel(key) {
    return state.apps.find(a => a.key === key)?.label || key;
  }

  function renderDefaultCard() {
    defaultCard.innerHTML = '';
    defaultCard.appendChild(createEl('div', { class: 'card__head' }, [], []));
    defaultCard.querySelector('.card__head').innerHTML = `
      <div>
        <div class="card__title">Default for New Users</div>
        <div class="card__subtitle">${state.defaultPerms.length} dari ${state.apps.length} fitur aktif — diterapkan otomatis saat user baru dibuat.</div>
      </div>
    `;

    const chips = createEl('div', { class: 'admin-users__chips' });
    state.apps.forEach(({ key }) => {
      const chip = createEl('button', {
        type: 'button',
        class: 'admin-users__chip' + (state.defaultPerms.includes(key) ? ' admin-users__chip--active' : ''),
      }, [appLabel(key)]);
      chip.addEventListener('click', () => toggleDefaultPerm(key));
      chips.appendChild(chip);
    });
    defaultCard.appendChild(chips);
  }

  async function toggleDefaultPerm(key) {
    const next = state.defaultPerms.includes(key)
      ? state.defaultPerms.filter(k => k !== key)
      : [...state.defaultPerms, key];
    try {
      const res = await Api.put('/admin/default-permissions', { permissions: next });
      state.defaultPerms = res?.default_permissions || next;
      renderDefaultCard();
    } catch (e) {
      toast('Gagal simpan default: ' + (e.message || e), { type: 'error' });
    }
  }

  // ---- Users list ----
  async function loadUsers() {
    state.loading = true;
    renderLoading();

    try {
      const params = state.searchTerm ? { q: state.searchTerm } : undefined;
      const data = await Api.get('/admin/users', params);
      state.users = Array.isArray(data) ? data : [];
    } catch (e) {
      state.users = [];
      toast('Gagal memuat users: ' + (e.message || e), { type: 'error' });
    }

    state.loading = false;
    renderTable();
  }

  function renderLoading() {
    tableWrap.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const row = createEl('div', { class: 'skeleton', style: { height: '56px', borderRadius: '6px', marginBottom: '8px' } });
      tableWrap.appendChild(row);
    }
  }

  function renderTable() {
    tableWrap.innerHTML = '';

    if (state.users.length === 0) {
      const empty = createEl('div', { class: 'admin-users__empty' }, []);
      empty.innerHTML = `
        <div class="admin-users__empty-icon">${icons['users']}</div>
        <p style="color:var(--c-text-2);font-size:var(--text-sm);">Tidak ada pengguna ditemukan.</p>
      `;
      tableWrap.appendChild(empty);
      return;
    }

    const table = createEl('table', { class: 'table' });
    table.innerHTML = `
      <thead><tr>
        <th>Username</th><th>Tier</th><th>Permissions</th><th>Last Login</th><th>Status</th><th></th>
      </tr></thead>
    `;
    const tbody = createEl('tbody');
    state.users.forEach(u => tbody.appendChild(buildRow(u)));
    table.appendChild(tbody);
    tableWrap.appendChild(table);
  }

  function buildRow(u) {
    const isMain = u.username === MAIN_ADMIN;
    const tr = createEl('tr', {});

    const tdUser = createEl('td');
    tdUser.innerHTML = `<span style="font-weight:500;white-space:nowrap;">${u.username}</span>${isMain ? ' <span class="badge badge--neutral" title="Main admin">main</span>' : ''}`;
    tr.appendChild(tdUser);

    const tdTier = createEl('td');
    const tierTone = { admin: 'danger', premium: 'primary', member: 'success', guest: 'neutral' }[u.tier] || 'neutral';
    tdTier.innerHTML = `<span class="badge badge--${tierTone}">${u.tier}</span>`;
    tr.appendChild(tdTier);

    const tdPerms = createEl('td');
    const permCount = u.permissions?.length || 0;
    const permList = u.permissions?.join(', ') || 'tidak ada';
    const isFull = (u.rank ?? (u.tier === 'admin' ? 0 : 3)) <= 0;
    tdPerms.innerHTML = isFull
      ? '<span class="badge badge--success">full access</span>'
      : `<span class="badge badge--neutral" title="${permList}">${permCount} / ${state.apps.length} fitur</span>`;
    tr.appendChild(tdPerms);

    const tdLogin = createEl('td');
    tdLogin.appendChild(createEl('span', { style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-3)' } }, [formatDate(u.last_login)]));
    tr.appendChild(tdLogin);

    const tdStatus = createEl('td');
    tdStatus.innerHTML = u.hidden_menus?.length
      ? `<span class="badge badge--warn" title="${u.hidden_menus.join(', ')}">${u.hidden_menus.length} hidden</span>`
      : '<span class="badge badge--success">visible</span>';
    tr.appendChild(tdStatus);

    // Actions — div wrapper agar td tetap table-cell
    const tdActions = createEl('td');
    const actionsWrap = createEl('div', { class: 'table__actions' });

    const editBtn = createEl('button', { class: 'btn btn--ghost btn--sm', title: 'Edit' }, []);
    editBtn.innerHTML = icons['edit'];
    editBtn.addEventListener('click', () => openEditModal(u.id));
    actionsWrap.appendChild(editBtn);

    const deleteBtn = createEl('button', {
      class: 'btn btn--ghost btn--sm',
      title: isMain ? 'Main admin tidak bisa dihapus' : 'Delete',
    }, []);
    deleteBtn.innerHTML = icons['trash'];
    deleteBtn.style.color = 'var(--c-danger)';
    if (isMain) {
      deleteBtn.disabled = true;
      deleteBtn.style.opacity = 0.35;
    } else {
      deleteBtn.addEventListener('click', () => openDeleteConfirm(u));
    }
    actionsWrap.appendChild(deleteBtn);

    tdActions.appendChild(actionsWrap);
    tr.appendChild(tdActions);

    return tr;
  }

  // ---- Create modal (parity Flutter: username + password + tier) ----
  function openCreateModal() {
    const form = createEl('form', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
    form.innerHTML = `
      <div class="field">
        <label class="field__label">Username</label>
        <input type="text" name="username" class="field__input" required>
      </div>
      <div class="field">
        <label class="field__label">Password</label>
        <input type="password" name="password" class="field__input" placeholder="Minimal 4 karakter" required>
      </div>
      <div class="field">
        <label class="field__label">Tier</label>
        <select name="tier" class="field__select">
          <option value="guest" selected>Guest (3)</option>
          <option value="member">Member (2)</option>
          <option value="premium">Premium (1)</option>
          <option value="admin">Admin (0)</option>
        </select>
      </div>
      <p class="admin-users__hint">Permissions mengikuti "Default for New Users" (${state.defaultPerms.length} fitur aktif) — atur lewat kartu di atas.</p>
      <div class="field field--inline" style="justify-content:space-between;margin-top:var(--s-2);">
        <button type="button" class="btn btn--secondary" id="cancel">Batal</button>
        <button type="submit" class="btn btn--primary">${icons['plus']} Buat</button>
      </div>
    `;

    const modal = createModal({ title: 'Create New User', content: form, width: '420px' });
    form.querySelector('#cancel').addEventListener('click', () => modal.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {
        username: fd.get('username').trim(),
        password: fd.get('password'),
        tier: fd.get('tier'),
      };
      try {
        await Api.post('/admin/users', data);
        toast(`User ${data.username} berhasil dibuat`, { type: 'success' });
        modal.close();
        loadUsers();
      } catch (err) {
        toast('Error: ' + (err.message || err), { type: 'error' });
      }
    });
  }

  // ---- Edit modal (tier + permissions chips + hidden menus chips) ----
  async function openEditModal(userId) {
    let user;
    try {
      user = await Api.get(`/admin/users/${userId}`);
    } catch (e) {
      toast('Gagal memuat user: ' + (e.message || e), { type: 'error' });
      return;
    }

    const isMain = user.username === MAIN_ADMIN;
    const permsSet = new Set(user.permissions || []);
    const hiddenSet = new Set(user.hidden_menus || []);
    const tierVal = user.tier || 'guest';

    const form = createEl('form', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
    form.innerHTML = `
      <div class="field">
        <label class="field__label">Username</label>
        <input type="text" class="field__input" value="${user.username}" readonly>
      </div>
      <div class="field">
        <label class="field__label">Tier</label>
        <select class="field__select" id="edit-tier" ${isMain ? 'disabled title="Main admin tidak bisa diubah tier-nya"' : ''}>
          <option value="guest" ${tierVal === 'guest' ? 'selected' : ''}>Guest (3)</option>
          <option value="member" ${tierVal === 'member' ? 'selected' : ''}>Member (2)</option>
          <option value="premium" ${tierVal === 'premium' ? 'selected' : ''}>Premium (1)</option>
          <option value="admin" ${tierVal === 'admin' ? 'selected' : ''}>Admin (0)</option>
        </select>
      </div>
      <div class="field">
        <label class="field__label">Permissions</label>
        <div class="admin-users__chips" id="edit-perms-chips"></div>
      </div>
      <div class="field">
        <label class="field__label">Sembunyikan dari drawer</label>
        <div class="admin-users__chips" id="edit-hidden-chips"></div>
      </div>
      <div class="field field--inline" style="justify-content:space-between;margin-top:var(--s-2);">
        <button type="button" class="btn btn--secondary" id="cancel">Batal</button>
        <button type="submit" class="btn btn--primary">${icons['check']} Simpan</button>
      </div>
    `;

    const permsChipsEl = form.querySelector('#edit-perms-chips');
    const hiddenChipsEl = form.querySelector('#edit-hidden-chips');

    state.apps.forEach(({ key }) => buildToggleChip(key, permsSet, permsChipsEl));
    state.apps.forEach(({ key }) => buildToggleChip(key, hiddenSet, hiddenChipsEl, 'Sembunyikan'));

    const modal = createModal({
      title: `Edit User: ${user.username}`,
      content: form,
      width: '480px',
    });
    form.querySelector('#cancel').addEventListener('click', () => modal.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const tier = form.querySelector('#edit-tier').value;
        if (tier !== user.tier) {
          await Api.put(`/admin/users/${userId}/tier`, { tier });
        }
        await Api.put(`/admin/users/${userId}/permissions`, { permissions: [...permsSet] });
        await Api.put(`/admin/users/${userId}/visibility`, { hidden_menus: [...hiddenSet] });
        toast('User berhasil diupdate', { type: 'success' });
        modal.close();
        loadUsers();
      } catch (err) {
        toast('Error: ' + (err.message || err), { type: 'error' });
      }
    });
  }

  function buildToggleChip(key, valueSet, containerEl, activeTitle) {
    const chip = createEl('button', {
      type: 'button',
      class: 'admin-users__chip' + (valueSet.has(key) ? ' admin-users__chip--active' : ''),
      ...(activeTitle ? { title: activeTitle } : {}),
    }, [appLabel(key)]);
    chip.addEventListener('click', () => {
      if (valueSet.has(key)) {
        valueSet.delete(key);
        chip.classList.remove('admin-users__chip--active');
      } else {
        valueSet.add(key);
        chip.classList.add('admin-users__chip--active');
      }
    });
    containerEl.appendChild(chip);
  }

  // ---- Delete confirm (modal, bukan confirm() native) ----
  function openDeleteConfirm(user) {
    const content = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
    content.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', fontSize: 'var(--text-sm)' } },
      [`Yakin ingin menghapus user "${user.username}"? Tindakan ini tidak bisa dibatalkan.`]));

    const footer = createEl('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)', marginTop: 'var(--s-2)' } });
    const modal = createModal({ title: 'Hapus User', content, width: '400px' });

    const cancelBtn = createEl('button', { class: 'btn btn--secondary' }, ['Batal']);
    cancelBtn.addEventListener('click', () => modal.close());

    const delBtn = createEl('button', { class: 'btn btn--danger' }, ['Hapus']);
    delBtn.addEventListener('click', async () => {
      try {
        await Api.delete(`/admin/users/${user.id}`);
        toast(`User ${user.username} berhasil dihapus`, { type: 'success' });
        modal.close();
        loadUsers();
      } catch (e) {
        toast('Error: ' + (e.message || e), { type: 'error' });
      }
    });

    footer.append(cancelBtn, delBtn);
    content.appendChild(footer);
  }

  container._cleanup = () => {
    clearTimeout(state.searchDebounce);
  };

  // Init
  loadApps();
  loadDefaultPerms();
  loadUsers();

  return container;
}