/* pages/login-modal.js — Modal login/register (pop-up style) */
import { Auth } from '../core/auth.js';
import { ApiError } from '../core/api.js';
import { store } from '../core/state.js';
import { navigate } from '../core/router.js';
import { createModal } from '../ui/modal.js';
import { icons } from '../ui/icons.js';

let currentModal = null;

export function showLogin() {
  // Jika sudah ada modal terbuka, tutup dulu
  if (currentModal) {
    currentModal.close();
  }

  // Buat form content
  const content = document.createElement('form');
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.gap = 'var(--s-3)';

  // Username field
  const usernameInput = document.createElement('input');
  usernameInput.type = 'text';
  usernameInput.placeholder = 'Nama Pengguna';
  usernameInput.className = 'field__input';
  usernameInput.autocomplete = 'username';

  // Password field
  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.placeholder = 'Sandi';
  passwordInput.className = 'field__input';
  passwordInput.autocomplete = 'current-password';

  // Toggle checkbox (Register mode)
  const toggleWrapper = document.createElement('div');
  toggleWrapper.style.display = 'flex';
  toggleWrapper.style.justifyContent = 'space-between';
  toggleWrapper.style.alignItems = 'center';
  toggleWrapper.style.fontSize = 'var(--text-sm)';

  const toggleLabel = document.createElement('span');
  toggleLabel.textContent = 'Belum punya akun?';

  const toggleLink = document.createElement('span');
  toggleLink.textContent = 'Daftar';
  toggleLink.style.cssText = 'color: var(--c-primary); cursor: pointer; font-weight: bold;';

  const toggleCheckbox = document.createElement('input');
  toggleCheckbox.type = 'checkbox';
  toggleCheckbox.id = 'toggle-register';
  toggleCheckbox.style.display = 'none';

  toggleLink.addEventListener('click', () => {
    toggleCheckbox.checked = !toggleCheckbox.checked;
    toggleCheckbox.dispatchEvent(new Event('change'));
  });

  toggleWrapper.append(toggleLabel, toggleCheckbox, toggleLink);

  // Submit button
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn--primary';
  submitBtn.style.width = '100%';
  submitBtn.textContent = 'LOGIN';

  // Error message
  const errorEl = document.createElement('div');
  errorEl.className = 'error';
  errorEl.style.cssText = `
    color: var(--c-error);
    font-size: var(--text-xs);
    text-align: center;
    min-height: 1.2em;
  `;

  content.append(usernameInput, passwordInput, toggleWrapper, submitBtn, errorEl);

  // Buat modal
  const modal = createModal({
    title: 'Login / Daftar',
    content,
    width: '400px',
    onClose: () => {
      currentModal = null;
    }
  });

  currentModal = modal;

  // Fokus ke username
  setTimeout(() => usernameInput.focus(), 100);

  // Handle toggle change
  let isLogin = true;
  toggleCheckbox.addEventListener('change', () => {
    isLogin = !toggleCheckbox.checked;
    toggleLabel.textContent = isLogin ? 'Belum punya akun?' : 'Sudah punya akun?';
    toggleLink.textContent = isLogin ? 'Daftar' : 'Login';
    submitBtn.textContent = isLogin ? 'LOGIN' : 'DAFTAR';
    errorEl.textContent = '';
  });

  // Form submit
  let loading = false;
  content.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (loading) return;
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    if (!username || !password) {
      errorEl.textContent = 'Harap isi semua field';
      return;
    }

    loading = true;
    submitBtn.disabled = true;
    errorEl.textContent = '';
    submitBtn.innerHTML = '<span class="spinner"></span> Memproses...';

    try {
      if (isLogin) {
        await Auth.login(username, password);
      } else {
        await Auth.register(username, password);
        // Set ke login setelah register sukses
        toggleCheckbox.checked = false;
        toggleCheckbox.dispatchEvent(new Event('change'));
        errorEl.style.color = 'var(--c-success)';
        errorEl.textContent = 'Registrasi berhasil! Silakan login.';
        return;
      }

      // Tutup modal setelah login sukses
      modal.close();

      // Jika ada pending route, navigasikan ke sana
      const dest = store.pendingRoute || '/';
      delete store.pendingRoute;
      navigate(dest);

    } catch (err) {
      errorEl.textContent = (err instanceof ApiError ? err.message : err.toString()).replace('Exception: ', '');
    } finally {
      loading = false;
      if (!isLogin && errorEl.textContent.includes('berhasil')) return;
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? 'LOGIN' : 'DAFTAR';
    }
  });
}

export function closeLogin() {
  if (currentModal) {
    currentModal.close();
  }
}

export function destroy() {
  closeLogin();
}
