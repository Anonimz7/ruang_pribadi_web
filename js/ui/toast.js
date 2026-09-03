/* ui/toast.js — Toast notifications */
import { $ } from '../utils/dom.js';

export function toast(message, type = 'info', duration = 3000) {
  const root = $('#toast-root');
  if (!root) return;

  const el = document.createElement('div');
  const colors = {
    info: 'var(--c-info-bg)',
    success: 'var(--c-success-bg)',
    warn: 'var(--c-warn-bg)',
    danger: 'var(--c-danger-bg)',
  };
  const textColors = {
    info: 'var(--c-info)',
    success: 'var(--c-success)',
    warn: 'var(--c-warn)',
    danger: 'var(--c-danger)',
  };

  el.style.cssText = `
    background: ${colors[type] || colors.info};
    color: ${textColors[type] || textColors.info};
    padding: var(--s-3) var(--s-4);
    border-radius: var(--radius);
    font-size: var(--text-sm);
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transform: translateY(-20px);
    opacity: 0;
    transition: all var(--dur-fast);
    cursor: pointer;
    max-width: 400px;
  `;
  el.textContent = message;
  el.setAttribute('role', 'alert');

  root.appendChild(el);

  // Animate in
  requestAnimationFrame(() => {
    el.style.transform = 'translateY(0)';
    el.style.opacity = '1';
  });

  // Auto dismiss
  const timer = setTimeout(dismiss, duration);
  el.addEventListener('click', dismiss);

  function dismiss() {
    clearTimeout(timer);
    el.style.transform = 'translateY(-20px)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }
}
