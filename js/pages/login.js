/* pages/login.js — Full-page login/register form (mirrors Flutter LoginDialog) */
import { Auth } from '../core/auth.js';
import { ApiError } from '../core/api.js';
import { store } from '../core/state.js';
import { navigate } from '../core/router.js';

export function render() {
  const wrapper = document.createElement('div');
  wrapper.className = 'login-page';

  const card = document.createElement('div');
  card.className = 'login-card';

  let isLogin = true;
  let loading = false;
  let errorMessage = '';

  const userField = document.createElement('input');
  userField.type = 'text';
  userField.placeholder = 'Username';
  userField.className = 'field__input';

  const passField = document.createElement('input');
  passField.type = 'password';
  passField.placeholder = 'Password';
  passField.className = 'field__input';

  const toggleLink = document.createElement('div');
  toggleLink.className = 'toggle-link';
  const toggleBtn = document.createElement('span');
  toggleBtn.textContent = 'Daftar';
  toggleBtn.addEventListener('click', () => {
    isLogin = !isLogin;
    updateContent();
  });
  toggleLink.textContent = isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? ';
  toggleLink.appendChild(toggleBtn);

  const errorEl = document.createElement('div');
  errorEl.className = 'login-error';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'btn btn--primary';

  // Enter di username/password = submit (shortcut login/register)
  const submitOnEnter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitBtn.click();
    }
  };
  userField.addEventListener('keydown', submitOnEnter);
  passField.addEventListener('keydown', submitOnEnter);

  const renderContent = () => {
    card.innerHTML = '';

    const title = document.createElement('h2');
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
