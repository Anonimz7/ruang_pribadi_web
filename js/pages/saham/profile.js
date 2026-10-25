/* pages/saham/profile.js — User profile (hero + akses tier + change password).
 * Dipakai sebagai halaman (/profile) maupun pop-up (openProfileModal). */
import { store, subscribe } from '../../core/state.js';
import { Auth } from '../../core/auth.js';
import { fetchMenuConfig } from '../../core/menu-config.js';
import { calcStrength } from '../../ui/password-strength.js';
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import { toast } from '../../ui/toast.js';
import { showLogin } from '../login-modal.js';
import { createModal } from '../../ui/modal.js';

// Cache akses tier: fitur yang terbuka untuk rank user saat ini
let accessCount = 0;
let accessTotal = 0;

async function refreshAccessData() {
  try {
    const cfg = await fetchMenuConfig();
    accessTotal = cfg.length;
    accessCount = cfg.filter(a => Auth.canAccess(a.key, a.minTier)).length;
  } catch {
    accessCount = 0;
    accessTotal = 0;
  }
}

export function render() {
  const container = createEl('div', { class: 'profile-page' });

  const renderContent = () => {
    container.innerHTML = '';
    if (!store.token) {
      container.appendChild(buildLoggedOut());
      return;
    }
    container.appendChild(createProfileBody());
  };

  // Subscribe re-render pada perubahan auth
  const unsubs = ['token', 'username', 'tier', 'rank'].map(k =>
    subscribe(k, () => renderContent())
  );

  container._cleanup = () => {
    unsubs.forEach(u => u());
  };

  refreshAccessData();
  renderContent();
  return container;
}

/** Buka pop-up profil (dipakai chip user di landing). */
export function openProfileModal() {
  if (!store.token) {
    showLogin();
    return;
  }
  refreshAccessData().then(() => {
    const modal = createModal({ title: 'Profile', content: createProfileBody(), width: '480px' });
    // Tombol login dari buildLoggedOut tidak dipakai di modal (sudah login).
    return modal;
  });
}

// ═══ LOGGED OUT ═══════════════════════════════════
function buildLoggedOut() {
  const card = createEl('div', { class: 'card profile-empty' }, []);
  const icon = createEl('div', { class: 'profile-empty__icon' });
  icon.innerHTML = icons['user'];
  card.appendChild(icon);
  card.appendChild(createEl('h2', { style: { margin: 'var(--s-3) 0 var(--s-1)', fontSize: 'var(--text-lg)' } }, ['Not Logged In']));
  card.appendChild(createEl('p', { class: 'profile-empty__desc' }, ['Please log in to view your profile and manage your account.']));

  const btn = createEl('button', { class: 'btn btn--primary' }, ['Login']);
  btn.addEventListener('click', () => showLogin());
  card.appendChild(btn);
  return card;
}

/** Isi profil (hero + akses + ubah password) — dipakai halaman & modal. */
export function createProfileBody() {
  const body = createEl('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' } });
  body.appendChild(buildHero());
  body.appendChild(buildAccessCard());
  body.appendChild(buildPasswordCard());
  return body;
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

// ═══ AKSES (murni tier) ═══════════════════════════
function buildAccessCard() {
  const card = createEl('div', { class: 'card' }, []);
  card.appendChild(createEl('div', { class: 'card__title', style: { marginBottom: 'var(--s-3)' } }, ['Your Access']));

  if (Auth.isAdmin()) {
    const badge = createEl('span', { class: 'badge badge--success' }, ['Full access to all features']);
    card.appendChild(badge);
  } else {
    card.appendChild(createEl('p', { class: 'profile-muted' },
      [`Tier ${(store.tier || 'guest').toUpperCase()} (rank ${store.rank}) unlocks ${accessCount} of ${accessTotal || '?'} features.`]));
  }
  return card;
}

// ═══ CHANGE PASSWORD ═══════════════════════════════
function buildPasswordCard() {
  const card = createEl('div', { class: 'card' }, []);
  card.appendChild(createEl('div', { class: 'card__title', style: { marginBottom: 'var(--s-4)' } }, ['Change Password']));

  const { wrap: oldWrap, input: oldInput } = pwInput('Old Password', 'old');
  const { wrap: newWrap, input: newInput } = pwInput('New Password', 'new');
  const { wrap: confirmWrap, input: confirmInput } = pwInput('Confirm Password', 'confirm');

  // Strength meter (reuse shared util + pw-strength CSS)
  const strengthWrap = createEl('div', { class: 'pw-strength', style: { marginBottom: 'var(--s-4)', marginTop: 'var(--s-2)' } });
  const strengthLabel = createEl('div', { class: 'pw-strength__label' });
  const strengthText = createEl('span', { class: 'pw-strength__text pw-strength__text--fair' }, ['—']);
  strengthLabel.append(createEl('span', {}, ['Password strength']), strengthText);
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
      ? '<span class="profile-pw__spin"></span> Saving...'
      : `${icons['edit']} Save New Password`;
  };

  const onSave = async () => {
    if (changing) return;
    const op = oldInput.value.trim();
    const np = newInput.value.trim();
    const cp = confirmInput.value.trim();

    if (!op || !np || !cp) { toast('All fields are required', { type: 'error' }); return; }
    if (np !== cp) { toast('New passwords do not match', { type: 'error' }); return; }
    if (np.length < 4) { toast('Password must be at least 4 characters', { type: 'error' }); return; }

    changing = true;
    renderBtn();
    try {
      await Auth.changePassword(op, np);
      toast('Password changed successfully', { type: 'success' });
      oldInput.value = ''; newInput.value = ''; confirmInput.value = '';
      strengthText.textContent = '—';
      strengthText.className = 'pw-strength__text pw-strength__text--fair';
      strengthBarFill.style.width = '0%';
      strengthBarFill.style.background = 'var(--c-text-3)';
    } catch (e) {
      toast(e?.message || 'Failed to change password', { type: 'error' });
    } finally {
      changing = false;
      renderBtn();
    }
  };

  saveBtn.addEventListener('click', onSave);
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
    title: 'Show/hide',
    'aria-label': 'Show/hide',
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