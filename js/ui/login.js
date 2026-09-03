/* ui/login.js — Login modal */
import { createModal } from './modal.js';
import { icons } from './icons.js';

export function showLogin() {
  const content = document.createElement('div');
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.gap = 'var(--s-4)';

  content.innerHTML = `
    <div class="field">
      <label class="field__label">Username</label>
      <input type="text" class="field__input" placeholder="Enter username" autocomplete="username">
    </div>
    <div class="field">
      <label class="field__label">Password</label>
      <input type="password" class="field__input" placeholder="Enter password" autocomplete="current-password">
    </div>
    <div style="display:flex;gap:var(--s-3);justify-content:flex-end;margin-top:var(--s-2);">
      <button class="btn btn--ghost" id="login-cancel">Cancel</button>
      <button class="btn btn--primary" id="login-submit">Login</button>
    </div>
    <div style="text-align:center;font-size:var(--text-xs);color:var(--c-text-3);">
      Don't have an account? <a href="#" style="color:var(--c-primary);">Register</a>
    </div>
  `;

  const modal = createModal({ title: 'Login', content, width: '400px' });

  content.querySelector('#login-cancel').addEventListener('click', modal.close);
  content.querySelector('#login-submit').addEventListener('click', () => {
    // Placeholder — no real logic
    modal.close();
  });
}
