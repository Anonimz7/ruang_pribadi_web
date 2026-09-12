/* pages/profile.js — User profile (redesigned: hero + permissions + change password) */
import { store, subscribe } from '../../core/state.js';
import { Auth } from '../../core/auth.js';
import { navigate } from '../../core/router.js';
import { fetchMenuConfig } from '../../core/menu-config.js';
import { calcStrength } from '../../ui/password-strength.js';
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import { toast } from '../../ui/toast.js';
import { showLogin } from '../login-modal.js';

export function render() {
  const container = createEl('div', { class: 'profile-page' });

  // Cache label aplikasi untuk permissions yang readable
  let appLabels = {};
  fetchMenuConfig()
    .then(cfg => {
      appLabels = Object.fromEntries(cfg.map(a => [a.key, a.label]));
      renderContent();
    })
    .catch(() => { /* biarkan labels kosong, fallback raw key */ });

  const renderContent = () => {
    container.innerHTML = '';

    if (!store.token) {
      container.appendChild(buildLoggedOut());
      return;
    }

    container.appendChild(buildHero());
    container.appendChild(buildPermissionsCard());
    container.appendChild(buildPasswordCard());
  };

  // ═══ LOGGED OUT ═══════════════════════════════════
  function buildLoggedOut() {
    const card = createEl('div', { class: 'card profile-empty' }, []);
    const icon = createEl('div', { class: 'profile-empty__icon' });
    icon.innerHTML = icons['user'];
    card.appendChild(icon);
    card.appendChild(createEl('h2', { style: { margin: 'var(--s-3) 0 var(--s-1)', fontSize: 'var(--text-lg)' } }, ['Belum Login']));
    card.appendChild(createEl('p', { class: 'profile-empty__desc' }, ['Silakan login untuk melihat profil dan mengatur akun Anda.']));

    const btn = createEl('button', { class: 'btn btn--primary' }, ['Login']);
    btn.addEventListener('click', () => showLogin());
    card.appendChild(btn);
    return card;
  }

  // ═══ HERO ═════════════════════════════════════════
  function buildHero() {
    const card = createEl('div', { class: 'card profile-hero' }, []);

    const username = store.username || 'User';
    const isAdmin = Auth.isAdmin();

    const avatar = createEl('div', { class: 'profile-hero__avatar ' + (isAdmin ? 'profile-hero__avatar--admin' : 'profile-hero__avatar--guest') },
      [username.substring(0, 1).toUpperCase()]);

    const info = createEl('div', { class: 'profile-hero__info' });
    info.appendChild(createEl('div', { class: 'profile-hero__name' }, [username]));

    const badgeTone = isAdmin ? 'badge--success' : store.tier === 'premium' ? 'badge--primary' : 'badge--warn';
    const badge = createEl('span', {
      class: 'badge ' + badgeTone,
      style: { marginTop: 'var(--s-1)' },
    }, [(store.tier || 'guest').toUpperCase()]);
    info.appendChild(badge);

    card.append(avatar, info);
    return card;
  }

  // ═══ PERMISSIONS ══════════════════════════════════
  function buildPermissionsCard() {
    const card = createEl('div', { class: 'card' }, []);
    card.appendChild(createEl('div', { class: 'card__title', style: { marginBottom: 'var(--s-3)' } }, ['Izin Akses']));

    const perms = store.permissions || [];
    const isAdmin = Auth.isAdmin();

    if (isAdmin) {
      const badge = createEl('span', { class: 'badge badge--success' }, ['Akses penuh ke semua fitur']);
      card.appendChild(badge);
    } else if (perms.length === 0) {
      card.appendChild(createEl('p', { class: 'profile-muted' }, ['Tidak ada izin akses']));
    } else {
      const chips = createEl('div', { class: 'profile-chips' });
      perms.forEach(p => {
        chips.appendChild(createEl('span', { class: 'profile-chip', title: p }, [appLabels[p] || p]));
      });
      card.appendChild(chips);
    }
    return card;
  }

  // ═══ CHANGE PASSWORD ═══════════════════════════════
  function buildPasswordCard() {
    const card = createEl('div', { class: 'card' }, []);
    card.appendChild(createEl('div', { class: 'card__title', style: { marginBottom: 'var(--s-4)' } }, ['Ubah Password']));

    const { wrap: oldWrap, input: oldInput } = pwInput('Password Lama', 'old');
    const { wrap: newWrap, input: newInput } = pwInput('Password Baru', 'new');
    const { wrap: confirmWrap, input: confirmInput } = pwInput('Konfirmasi Password', 'confirm');

    // Strength meter (reuse shared util + pw-strength CSS)
    const strengthWrap = createEl('div', { class: 'pw-strength', style: { marginBottom: 'var(--s-4)', marginTop: 'var(--s-2)' } });
    const strengthLabel = createEl('div', { class: 'pw-strength__label' });
    const strengthText = createEl('span', { class: 'pw-strength__text pw-strength__text--fair' }, ['—']);
    strengthLabel.append(createEl('span', {}, ['Kekuatan password']), strengthText);
    strengthWrap.appendChild(strengthLabel);

    const strengthBar = createEl('div', { class: 'progress' });
    const strengthBarFill = createEl('div', { class: 'progress__bar', style: { width: '0%', background: 'var(--c-text-3)' } });
    strengthBar.appendChild(strengthBarFill);
    strengthWrap.appendChild(strengthBar);

    newInput.addEventListener('input', () => {
      const s = calcStrength(newInput.value);
      strengthText.textContent = s.label;
      strengthText.className = 'pw-strength__text ' + s.cls;
      strengthBarFill.style.width = s.pct + '%';
      strengthBarFill.style.background = s.cls.includes('weak') ? 'var(--c-danger)' : s.cls.includes('fair') ? 'var(--c-warn)' : s.cls.includes('good') ? 'var(--c-info)' : 'var(--c-accent)';
    });

    let changing = false;
    const saveBtn = createEl('button', { type: 'button', class: 'btn btn--primary profile-pw__submit' }, []);
    const renderBtn = () => {
      saveBtn.disabled = changing;
      saveBtn.innerHTML = changing
        ? '<span class="profile-pw__spin"></span> Menyimpan...'
        : `${icons['edit']} Simpan Password Baru`;
    };

    saveBtn.addEventListener('click', async () => {
      if (changing) return;
      const op = oldInput.value.trim();
      const np = newInput.value.trim();
      const cp = confirmInput.value.trim();

      if (!op || !np || !cp) { toast('Semua field harus diisi', { type: 'error' }); return; }
      if (np !== cp) { toast('Password baru tidak cocok', { type: 'error' }); return; }
      if (np.length < 4) { toast('Password minimal 4 karakter', { type: 'error' }); return; }

      changing = true;
      renderBtn();
      try {
        await Auth.changePassword(op, np);
        toast('Password berhasil diubah', { type: 'success' });
        oldInput.value = ''; newInput.value = ''; confirmInput.value = '';
        strengthText.textContent = '—';
        strengthText.className = 'pw-strength__text pw-strength__text--fair';
        strengthBarFill.style.width = '0%';
        strengthBarFill.style.background = 'var(--c-text-3)';
      } catch (e) {
        toast(e?.message || 'Gagal mengubah password', { type: 'error' });
      } finally {
        changing = false;
        renderBtn();
      }
    });
    renderBtn();

    card.append(oldWrap, newWrap, strengthWrap, confirmWrap, saveBtn);
    return card;
  }

  function pwInput(placeholder, name) {
    const wrap = createEl('div', { class: 'profile-pw__field' });
    const input = createEl('input', {
      type: 'password',
      class: 'field__input',
      placeholder,
      autocomplete: name === 'old' ? 'current-password' : name === 'new' ? 'new-password' : 'new-password',
    });
    const toggle = createEl('button', {
      type: 'button',
      class: 'profile-pw__toggle',
      title: 'Tampilkan/sembunyikan',
      'aria-label': 'Tampilkan/sembunyikan',
    }, []);
    toggle.innerHTML = icons['eye'];
    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.innerHTML = show ? icons['eye-off'] : icons['eye'];
    });
    wrap.append(input, toggle);
    return { wrap, input };
  }

  // Subscribe re-render pada perubahan auth
  const unsubs = ['token', 'username', 'tier', 'permissions'].map(k =>
    subscribe(k, () => renderContent())
  );

  container._cleanup = () => {
    unsubs.forEach(u => u());
  };

  renderContent();
  return container;
}