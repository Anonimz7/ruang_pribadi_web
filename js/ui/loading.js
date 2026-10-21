/* ui/loading.js — Indikator muat bersama: baris skeleton untuk tabel
   admin dan kartu spinner untuk halaman analisis. */
import { createEl } from '../utils/dom.js';

export function renderSkeletonRows(wrap, { count = 5, height = '48px' } = {}) {
  wrap.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const row = createEl('div', { class: 'skeleton', style: { height, borderRadius: '6px', marginBottom: '8px' } });
    wrap.appendChild(row);
  }
}

export function spinnerCardHtml(text, { marginTop = false } = {}) {
  return `<div class="card" style="padding:var(--s-6);text-align:center;${marginTop ? 'margin-top:var(--s-4);' : ''}">
    <div class="spinner" style="width:32px;height:32px;border:3px solid var(--c-border);border-top-color:var(--c-primary);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto var(--s-3);"></div>
    <div style="font-size:var(--text-sm);color:var(--c-text-2);">${text}</div>
  </div>`;
}
