/* pages/profile.js — User profile & password change */
import { store, subscribe } from '../core/state.js';
import { Auth } from '../core/auth.js';
import { navigate } from '../core/router.js';
import { ApiError } from '../core/api.js';
import { icons } from '../ui/icons.js';
import { toast } from '../ui/toast.js';

export function render() {
  const container = document.createElement('section');
  container.className = 'profile-page';
  container.style.cssText = `
    padding: var(--s-4);
    max-width: 600px;
    margin: 0 auto;
  `;

  const oldPass = document.createElement('input');
  oldPass.type = 'password';
  oldPass.placeholder = 'Password Lama';
  oldPass.style.cssText = `
    width: 100%; padding: var(--s-3); margin-bottom: var(--s-3);
    border: 1px solid var(--border-color, #ddd); border-radius: var(--s-2);
    font-size: 16px; background: var(--input-bg, #f9f9f9); color: var(--text-primary, #333);
  `;

  const newPass = document.createElement('input');
  newPass.type = 'password';
  newPass.placeholder = 'Password Baru';
  newPass.style.cssText = `
    width: 100%; padding: var(--s-3); margin-bottom: var(--s-3);
    border: 1px solid var(--border-color, #ddd); border-radius: var(--s-2);
    font-size: 16px; background: var(--input-bg, #f9f9f9); color: var(--text-primary, #333);
  `;

  const confirmPass = document.createElement('input');
  confirmPass.type = 'password';
  confirmPass.placeholder = 'Konfirmasi Password';
  confirmPass.style.cssText = `
    width: 100%; padding: var(--s-3); margin-bottom: var(--s-3);
    border: 1px solid var(--border-color, #ddd); border-radius: var(--s-2);
    font-size: 16px; background: var(--input-bg, #f9f9f9); color: var(--text-primary, #333);
  `;

  let changing = false;

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn--primary';
  saveBtn.style.cssText = `
    width: 100%; padding: var(--s-3); border: none; border-radius: var(--s-2);
    background: var(--c-primary, #007bff); color: white; font-size: 15px;
    font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
  `;

  const renderBtn = () => {
    if (changing) {
      saveBtn.innerHTML = `<span style="width:18px;height:18px;border:2px solid rgba(255,255,255,0.5);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;"></span>`;
      saveBtn.disabled = true;
    } else {
      saveBtn.innerHTML = `${icons['edit'] || ''} <span>Simpan Password Baru</span>`;
      saveBtn.disabled = false;
    }
  };

  saveBtn.addEventListener('click', async () => {
    if (changing) return;
    const op = oldPass.value.trim();
    const np = newPass.value.trim();
    const cp = confirmPass.value.trim();

    if (!op || !np || !cp) {
      toast('Semua field harus diisi', { type: 'error' });
      return;
    }
    if (np !== cp) {
      toast('Password baru tidak cocok', { type: 'error' });
      return;
    }
    if (np.length < 4) {
      toast('Password minimal 4 karakter', { type: 'error' });
      return;
    }

    changing = true;
    renderBtn();
    try {
      await Auth.changePassword(op, np);
      toast('Password berhasil diubah', { type: 'success' });
      oldPass.value = ''; newPass.value = ''; confirmPass.value = '';
    } catch (e) {
      toast((e instanceof ApiError ? e.message : e.message || 'Gagal'), { type: 'error' });
    } finally {
      changing = false;
      renderBtn();
    }
  });

  const renderContent = () => {
    container.innerHTML = '';

    const isLoggedIn = !!store.token;
    const username = store.username || 'User';
    const tier = store.tier;
    const isAdmin = tier === 'admin';
    const perms = store.permissions || [];

    const sectionTitle = (text) => {
      const h = document.createElement('h2');
      h.textContent = text;
      h.style.cssText = `font-size:18px;font-weight:600;margin:0 0 var(--s-3);color:var(--text-primary,#333);`;
      return h;
    };

    if (!isLoggedIn) {
      container.appendChild(sectionTitle('Profil'));
      const placeholder = document.createElement('div');
      placeholder.style.cssText = `
        text-align: center; padding: var(--s-6); border: 2px dashed var(--border-color,#ddd);
        border-radius: var(--s-3); color: var(--text-secondary,#999);
      `;
      placeholder.innerHTML = `
        <div style="font-size:48px;margin-bottom:var(--s-3);opacity:0.3;">${icons['user'] || ''}</div>
        <p style="margin:0 0 var(--s-3);">Belum login</p>
        <p style="font-size:14px;margin:0;">Silakan login untuk melihat profil dan mengatur akun Anda.</p>
        <button id="profile-login" class="btn btn--primary" style="margin-top:var(--s-3);padding:var(--s-2) var(--s-3);">
          LOGIN
        </button>
      `;
      container.appendChild(placeholder);

      const loginBtn = placeholder.querySelector('#profile-login');
      loginBtn.addEventListener('click', () => {
        navigate('/login');
      });
      return;
    }

    container.appendChild(sectionTitle('Profil'));

    // User card
    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--card-bg,#fff); border: 1px solid var(--border-color,#e0e0e0);
      border-radius: var(--s-3); padding: var(--s-5); margin-bottom: var(--s-4); text-align: center;
    `;
    const avatarColor = isAdmin ? '#00C87A' : '#ff9800';
    card.innerHTML = `
      <div style="width:72px;height:72px;border-radius:50%;background:${avatarColor};color:white;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:28px;font-weight:bold;">
        ${username.substring(0, 1).toUpperCase() || '?'}
      </div>
      <h3 style="margin:0 0 4px;font-size:20px;font-weight:600;">${username}</h3>
      <span style="display:inline-block;padding:2px 12px;border-radius:12px;font-size:12px;font-weight:600;
        ${isAdmin ? 'background:rgba(0,200,122,0.15);color:#00C87A;' : 'background:rgba(255,152,0,0.15);color:#ff9800;'}">
        ${isAdmin ? 'ADMIN' : 'GUEST'}
      </span>
    `;
    container.appendChild(card);

    // Permissions
    const permTitle = document.createElement('div');
    permTitle.textContent = 'IZIN AKSES';
    permTitle.style.cssText = `font-size:12px;font-weight:bold;color:var(--text-secondary,#888);letter-spacing:1px;margin-bottom:var(--s-2);`;
    container.appendChild(permTitle);

    const permList = document.createElement('div');
    permList.style.cssText = `
      display:flex;flex-wrap:gap;gap:8px;margin-bottom:var(--s-4);
    `;

    if (isAdmin) {
      const adminBadge = document.createElement('span');
      adminBadge.style.cssText = `
        background:rgba(0,200,122,0.1);color:#00C87A;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;
      `;
      adminBadge.textContent = 'Akses penuh ke semua fitur';
      permList.appendChild(adminBadge);
    } else if (perms.length === 0) {
      const noPerms = document.createElement('span');
      noPerms.style.cssText = `color:var(--text-secondary,#999);font-size:13px;`;
      noPerms.textContent = 'Tidak ada izin akses';
      permList.appendChild(noPerms);
    } else {
      perms.forEach((p) => {
        const badge = document.createElement('span');
        badge.style.cssText = `
          background:rgba(0,200,122,0.1);color:#00C87A;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;
        `;
        badge.textContent = p;
        permList.appendChild(badge);
      });
    }
    container.appendChild(permList);

    // Change Password section
    const pwTitle = document.createElement('div');
    pwTitle.textContent = 'UBAH PASSWORD';
    pwTitle.style.cssText = `font-size:12px;font-weight:bold;color:var(--text-secondary,#888);letter-spacing:1px;margin-bottom:var(--s-2);`;
    container.appendChild(pwTitle);

    container.appendChild(oldPass);
    container.appendChild(newPass);
    container.appendChild(confirmPass);
    container.appendChild(saveBtn);
    renderBtn();
  };

  // Subscribe and re-render on auth changes
  const unsub = subscribe('token', () => renderContent());
  const unsubUser = subscribe('username', () => renderContent());
  const unsubTier = subscribe('tier', () => renderContent());
  const unsubPerms = subscribe('permissions', () => renderContent());

  // Cleanup
  container._cleanup = () => {
    unsub(); unsubUser(); unsubTier(); unsubPerms();
  };

  renderContent();
  return container;
}

export function destroy() {
  // Cleanup handled via _cleanup
}
