/* ui/modal.js — Generic modal shell */
import { $ } from '../utils/dom.js';
import { icons } from './icons.js';

export function createModal({ title, content, onClose, width = '480px' } = {}) {
  const root = $('#modal-root');
  if (!root) return;

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
    position: fixed; inset: 0; z-index: 300;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    padding: var(--s-4);
    opacity: 0; transition: opacity var(--dur-fast);
  `;

  // Modal box
  const box = document.createElement('div');
  box.style.cssText = `
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--radius-lg);
    width: 100%; max-width: ${width};
    max-height: 90vh; overflow-y: auto;
    transform: scale(0.95); transition: transform var(--dur-fast);
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex; align-items: center; justify-content: space-between;
    padding: var(--s-4); border-bottom: 1px solid var(--c-border);
  `;
  header.innerHTML = `<h3 style="font-size:var(--text-md);font-weight:600;">${title || ''}</h3>`;

  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'padding:var(--s-2);border-radius:var(--radius);color:var(--c-text-3);';
  closeBtn.innerHTML = icons['x'];
  closeBtn.addEventListener('click', close);
  header.appendChild(closeBtn);
  box.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.style.padding = 'var(--s-4)';
  if (content) body.appendChild(content);
  box.appendChild(body);

  backdrop.appendChild(box);
  root.appendChild(backdrop);

  // Animate in
  requestAnimationFrame(() => {
    backdrop.style.opacity = '1';
    box.style.transform = 'scale(1)';
  });

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  // Close on Escape
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  function close() {
    backdrop.style.opacity = '0';
    box.style.transform = 'scale(0.95)';
    setTimeout(() => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      onClose?.();
    }, 200);
  }

  return { close, body };
}
