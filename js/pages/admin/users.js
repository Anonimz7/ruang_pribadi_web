/* pages/admin/users.js — User Permissions Management with API */
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import Api, { ApiError } from '../../core/api.js';
import { toast } from '../../ui/toast.js';
import { createModal } from '../../ui/modal.js';

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID');
}

export function render() {
  const state = {
    users: [],
    allApps: [],
    loading: true,
    searchTerm: '',
  };

  const container = createEl('div', { class: 'admin-users' }, []);

  container.appendChild(createEl('h1', {}, ['User Permissions']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } },
    ['Manage users, tiers, and app access.']));

  // Toolbar
  const toolbar = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', marginBottom: 'var(--s-4)', flexWrap: 'wrap' } });
  toolbar.innerHTML = `
    <div class="search" style="flex:1;min-width:200px;">
      <span class="search__icon">${icons['search']}</span>
      <input type="text" class="search__input" placeholder="Search users...">
    </div>
    <button class="btn btn--primary" id="create-user">${icons['plus']} Create User</button>
  `;
  container.appendChild(toolbar);

  // Table container
  const tableWrap = createEl('div', { class: 'table-wrap' });
  container.appendChild(tableWrap);

  // ---- Functions ----

  const searchInput = toolbar.querySelector('.search__input');
  let searchDebounce;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.searchTerm = e.target.value;
      loadUsers();
    }, 400);
  });

  toolbar.querySelector('#create-user').addEventListener('click', () => openCreateModal());

  async function loadApps() {
    try {
      const res = await Api.get('/admin/apps');
      state.allApps = res?.apps || [];
    } catch (e) {
      console.error('[AdminUsers] Failed to load apps:', e);
      state.allApps = [];
    }
  }

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
      tableWrap.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--s-6);">
          <div style="font-size:48px;margin-bottom:var(--s-4);opacity:0.3;">${icons['users']}</div>
          <p style="color:var(--c-text-2);">Tidak ada pengguna.</p>
        </div>
      `;
      return;
    }

    const table = createEl('table', { class: 'table' });
    table.innerHTML = `
      <thead><tr>
        <th>ID</th><th>Username</th><th>Tier</th><th>Permissions</th><th>Last Login</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>
        ${state.users.map(u => `
          <tr>
            <td>#${u.id}</td>
            <td style="font-weight:500;">${u.username}</td>
            <td><span class="badge badge--${u.tier === 'admin' ? 'danger' : 'neutral'}">${u.tier}</span></td>
            <td style="font-size:var(--text-sm);color:var(--c-text-2);">
              ${u.permissions?.length ? u.permissions.join(', ') : 'none'}
            </td>
            <td style="font-size:var(--text-sm);color:var(--c-text-3);">${formatDate(u.last_login)}</td>
            <td>${u.hidden_menus?.length ? `<span class="badge badge--warn">${u.hidden_menus.length} hidden</span>` : '<span class="badge badge--success">visible</span>'}</td>
            <td class="table__actions">
              <button class="btn btn--ghost btn--sm" title="Edit" onclick="window.adminEditUser(${u.id})">${icons['edit']}</button>
              <button class="btn btn--ghost btn--sm" title="Delete" onclick="window.adminDeleteUser(${u.id}, '${u.username}')" style="color:var(--c-danger);">${icons['trash']}</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    tableWrap.appendChild(table);
  }

  async function openCreateModal(id = null) {
    const isEdit = id !== null;
    let user = null;

    if (isEdit) {
      try {
        user = await Api.get(`/admin/users/${id}`);
      } catch (e) {
        toast('Gagal memuat user', { type: 'error' });
        return;
      }
    }

    const form = createEl('form', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' } });
    form.innerHTML = `
      <div class="field">
        <label class="field__label">Username</label>
        <input type="text" name="username" class="field__input" value="${user?.username || ''}" ${isEdit ? 'readonly' : ''} required>
      </div>
      ${!isEdit ? `
      <div class="field">
        <label class="field__label">Password</label>
        <input type="password" name="password" class="field__input" required>
      </div>` : ''}
      <div class="field">
        <label class="field__label">Tier</label>
        <select name="tier" class="field__select">
          <option value="admin" ${user?.tier === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="guest" ${user?.tier === 'guest' ? 'selected' : ''}>Guest</option>
        </select>
      </div>
      <div class="field">
        <label class="field__label">Permissions (comma-separated app keys)</label>
        <input type="text" name="permissions" class="field__input" value="${user?.permissions?.join(', ') || ''}" placeholder="e.g. news,stocks,math_speed">
      </div>
      <div class="field">
        <label class="field__label">Hidden Menus (comma-separated)</label>
        <input type="text" name="hidden_menus" class="field__input" value="${user?.hidden_menus?.join(', ') || ''}" placeholder="e.g. news,stocks">
      </div>
      <div class="field field--inline" style="justify-content:space-between;">
        <button type="button" class="btn btn--ghost" id="cancel">Batal</button>
        <button type="submit" class="btn btn--primary">${icons['plus']} ${isEdit ? 'Update' : 'Buat'}</button>
      </div>
    `;

    const modal = createModal({
      title: isEdit ? 'Edit User' : 'Create User',
      content: form,
      width: '480px',
    });

    form.querySelector('#cancel').addEventListener('click', () => modal.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const perms = formData.get('permissions').split(',').map(p => p.trim()).filter(Boolean);
      const hidden = formData.get('hidden_menus').split(',').map(p => p.trim()).filter(Boolean);

      if (!isEdit && !formData.get('password')) {
        toast('Password wajib diisi untuk user baru', { type: 'error' });
        return;
      }

      try {
        if (isEdit) {
          // Update tier
          await Api.put(`/admin/users/${id}/permissions`, { permissions: perms });
          await Api.put(`/admin/users/${id}/visibility`, { hidden_menus: hidden });
          toast('User berhasil diupdate', { type: 'success' });
        } else {
          await Api.post('/admin/users', {
            username: formData.get('username'),
            password: formData.get('password'),
            tier: formData.get('tier'),
            permissions: perms,
          });
          toast('User berhasil dibuat', { type: 'success' });
        }
        modal.close();
        loadUsers();
      } catch (err) {
        toast('Error: ' + (err.message || err), { type: 'error' });
      }
    });
  }

  async function deleteUser(id, username) {
    if (!confirm(`Yakin ingin menghapus user "${username}"?`)) return;
    try {
      await Api.delete(`/admin/users/${id}`);
      toast(`User ${username} berhasil dihapus`, { type: 'success' });
      loadUsers();
    } catch (e) {
      toast('Error: ' + (e.message || e), { type: 'error' });
    }
  }

  // Expose for inline onclick
  window.adminEditUser = (id) => openCreateModal(id);
  window.adminDeleteUser = (id, username) => deleteUser(id, username);

  container._cleanup = () => {
    delete window.adminEditUser;
    delete window.adminDeleteUser;
    if (state._searchDebounce) clearTimeout(state._searchDebounce);
  };

  // Init
  async function init() {
    await loadApps();
    await loadUsers();
  }
  init();

  return container;
}
