/* pages/login.js — Full-page login/register form (mirrors Flutter LoginDialog) */
import { Auth } from '../core/auth.js';
import { ApiError } from '../core/api.js';
import { store } from '../core/state.js';
import { navigate } from '../core/router.js';
import { icons } from '../ui/icons.js';

export function render() {
  const wrapper = document.createElement('div');
  wrapper.className = 'login-page';
  wrapper.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 120px);
    padding: var(--s-4);
  `;

  const card = document.createElement('div');
  card.className = 'login-card';
  card.style.cssText = `
    background: var(--card-bg, #fff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: var(--s-3);
    padding: var(--s-5);
    width: 100%;
    max-width: 360px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
  `;

  let isLogin = true;
  let loading = false;
  let errorMessage = '';

  const userField = document.createElement('input');
  userField.type = 'text';
  userField.placeholder = 'Username';
  userField.className = 'field__input';
  userField.style.cssText = `
    width: 100%;
    padding: var(--s-3);
    margin-bottom: var(--s-3);
    border: 1px solid var(--border-color, #ddd);
    border-radius: var(--s-2);
    font-size: 16px;
    background: var(--input-bg, #f9f9f9);
    color: var(--text-primary, #333);
  `;

  const passField = document.createElement('input');
  passField.type = 'password';
  passField.placeholder = 'Password';
  passField.className = 'field__input';
  passField.style.cssText = `
    width: 100%;
    padding: var(--s-3);
    margin-bottom: var(--s-3);
    border: 1px solid var(--border-color, #ddd);
    border-radius: var(--s-2);
    font-size: 16px;
    background: var(--input-bg, #f9f9f9);
    color: var(--text-primary, #333);
  `;

  const toggleLink = document.createElement('div');
  toggleLink.style.cssText = `
    text-align: center;
    margin: var(--s-3) 0;
    font-size: 14px;
  `;
  const toggleBtn = document.createElement('span');
  toggleBtn.style.cssText = `
    color: var(--c-primary, #007bff);
    cursor: pointer;
    text-decoration: underline;
  `;
  toggleBtn.textContent = 'Daftar';
  toggleBtn.addEventListener('click', () => {
    isLogin = !isLogin;
    updateContent();
  });
  toggleLink.textContent = isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? ';
  toggleLink.appendChild(toggleBtn);

  const errorEl = document.createElement('div');
  errorEl.className = 'login-error';
  errorEl.style.cssText = `
    color: var(--c-error, #e74c3c);
    font-size: 13px;
    text-align: center;
    margin-bottom: var(--s-3);
    min-height: 18px;
  `;

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'btn btn--primary';
  submitBtn.style.cssText = `
    width: 100%;
    padding: var(--s-3);
    border: none;
    border-radius: var(--s-2);
    background: var(--c-primary, #007bff);
    color: white;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  `;

  const renderContent = () => {
    card.innerHTML = '';

    const title = document.createElement('h2');
    title.style.cssText = `
      text-align: center;
      margin: 0 0 var(--s-4);
      font-size: 22px;
      font-weight: 600;
      color: var(--text-primary, #333);
    `;
    title.textContent = isLogin ? 'Login' : 'Register';
    card.appendChild(title);

    card.appendChild(userField);
    card.appendChild(passField);

    errorEl.textContent = errorMessage;
    card.appendChild(errorEl);

    submitBtn.innerHTML = '';
    if (loading) {
      const spinner = document.createElement('span');
      spinner.style.cssText = `
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255,255,255,0.5);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      `;
      submitBtn.appendChild(spinner);
    } else {
      submitBtn.textContent = isLogin ? 'LOGIN' : 'REGISTER';
    }
    card.appendChild(submitBtn);

    card.appendChild(toggleLink);
    // Re-attach toggle listener with fresh text
    toggleLink.firstChild.textContent = isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? ';
    toggleBtn.textContent = isLogin ? 'Daftar' : 'Login';
    toggleBtn.onclick = null;
    toggleBtn.addEventListener('click', () => {
      isLogin = !isLogin;
      errorMessage = '';
      renderContent();
    });
  };

  const updateContent = () => {
    renderContent();
  };

  submitBtn.addEventListener('click', async () => {
    if (loading) return;
    loading = true;
    errorMessage = '';
    renderContent();

    try {
      if (isLogin) {
        await Auth.login(userField.value.trim(), passField.value);
      } else {
        await Auth.register(userField.value.trim(), passField.value);
        // Switch to login mode after successful register
        isLogin = true;
        errorMessage = 'Registrasi berhasil! Silakan login.';
        renderContent();
        loading = false;
        return;
      }

      // Redirect back to the page that triggered login, or dashboard
      const dest = store.pendingRoute || '/';
      delete store.pendingRoute;
      navigate(dest);
    } catch (e) {
      errorMessage = (e instanceof ApiError ? e.message : e.toString()).replace('Exception: ', '');
      loading = false;
      renderContent();
    }
  });

  // Append card to wrapper
  wrapper.appendChild(card);

  // Initial render of form content
  renderContent();

  return wrapper;
}

export function showLogin() {
  // Trigger login page navigation
  window.location.hash = '/login';
}

export function destroy() {
  // Cleanup handled per-render
}
