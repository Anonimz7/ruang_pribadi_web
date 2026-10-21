/* ui/pagination.js — Aritmetika & markup pagination bersama.
   Kontrak global window.*Next/Prev tetap milik halaman masing-masing
   (adaptor tipis di halaman); modul ini menyediakan hitungan halamannya
   dan HTML kontrolnya. */

export function pageInfo(page, perPage, total) {
  return {
    totalPages: Math.ceil(total / perPage),
    first: (page - 1) * perPage + 1,
    last: Math.min(page * perPage, total),
  };
}

export function pageInfoText(page, perPage, total, noun = 'saham', suffix = '') {
  const { first, last } = pageInfo(page, perPage, total);
  return `Menampilkan ${first}–${last} dari ${total} ${noun}${suffix}`;
}

export function pagerHtml({ page, perPage, total, prevGlobal, nextGlobal, indicatorClass, infoHtml, infoStyle = 'font-size:var(--text-sm);color:var(--c-text-3);', buttonType = false }) {
  const { totalPages } = pageInfo(page, perPage, total);
  const typeAttr = buttonType ? ' type="button"' : '';
  return `
      <span style="${infoStyle}">
        ${infoHtml}
      </span>
      <div style="display:flex;gap:var(--s-2);align-items:center;">
        <button${typeAttr} class="btn btn--ghost btn--sm" ${page <= 1 ? 'disabled' : ''} onclick="window.${prevGlobal}()">Prev</button>
        <span class="${indicatorClass}" aria-label="Halaman ${page} dari ${totalPages}">${page} / ${totalPages}</span>
        <button${typeAttr} class="btn btn--ghost btn--sm" ${page >= totalPages ? 'disabled' : ''} onclick="window.${nextGlobal}()">Next</button>
      </div>
    `;
}
