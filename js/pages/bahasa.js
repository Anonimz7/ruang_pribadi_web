/* pages/bahasa.js — Language / Kamus (Full conversion from 4 Dart screens)
 *
 * Views:
 *   1. HOME   → list pasangan bahasa (bahasa_home_screen.dart)
 *   2. LIST   → list dokumen per pasangan (bahasa_list_screen.dart)
 *   3. DETAIL → 3-mode Vinculum reader (bahasa_detail_screen.dart)
 *   4. FORM   → create/edit dengan validasi & panduan (bahasa_form_screen.dart)
 */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';
import Api, { ApiError } from '../core/api.js';
import { toast } from '../ui/toast.js';
import { createModal } from '../ui/modal.js';
import { store } from '../core/state.js';

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const LANG_LABELS = {
  'id-jp': 'Indonesia → Jepang',
  'id-en': 'Indonesia → Inggris',
  'id-es': 'Indonesia → Spanyol',
  'id-fr': 'Indonesia → Prancis',
  'id-de': 'Indonesia → Jerman',
  'id-ar': 'Indonesia → Arab',
  'id-ko': 'Indonesia → Korea',
  'id-th': 'Indonesia → Thai',
  'id-vi': 'Indonesia → Vietnam',
  'id-cn': 'Indonesia → Mandarin',
  'id-jp-en': 'Jepang → Indonesia',
  'en-id': 'Inggris → Indonesia',
};

const PANDUAN_TEXT = `Buatlah terjemahan teks Inggris ke Indonesia dalam format JSON array dengan objek {"a": "teks sumber", "b": "terjemahan"}.

Aturan wajib yang harus diikuti:

1. Format:
   - Contoh yang benar: {"a": "Higher energy prices", "b": "Kenaikan harga energi"}
   - "a" adalah teks sumber (Inggris).
   - "b" adalah terjemahan (Indonesia).

2. Aturan penggabungan kata/frasa:
   - Jika kata sifat dan kata benda membentuk SATU konsep/frasa benda utuh, maka GABUNGKAN menjadi satu entri "a".
   - Contoh: "Higher energy prices" → SATU entri
   - "central banks", "overall demand", "inflationary pressures" → satu entri

3. Aturan pemisahan:
   - Kata kerja, kata keterangan, kata sambung, dan kata depan dipisahkan per kata.
   - Frasa "to rise", "to increase", "to control" → tetap digabung.

4. Kata kerja bantu (am, is, are):
   - Tidak diterjemahkan terpisah. Contoh: "I am" → {"a": "I am", "b": "saya"}.

5. Urutan array harus mengikuti urutan kemunculan kata/frasa dalam teks sumber.

6. Array tidak boleh kosong.

7. Tanda baca tidak dibuat entri JSON terpisah, melainkan menempel pada kata/frasa sebelumnya.`;

const GAP = 10; // px spacing between terms (matches Dart _gap)

// ═══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function langLabel(key) { return LANG_LABELS[key] || key; }

function parseLangSource(raw) {
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) return null;
    const entries = [];
    for (const item of data) {
      if (typeof item !== 'object' || item === null) return null;
      const a = item.a;
      const b = item.b;
      if (typeof a !== 'string' || !a.trim() || typeof b !== 'string' || !b.trim()) return null;
      entries.push({ a: a.trim(), b: b.trim() });
    }
    return entries;
  } catch {
    return null;
  }
}

function isAdmin() { return store.tier === 'admin'; }

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Canvas text measurement (mirrors Flutter TextPainter)
function measureTextWidth(text, font) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  return ctx.measureText(text).width;
}

function termWidth(entry, fontA = '600 13px system-ui', fontB = 'italic 11px system-ui') {
  const wa = measureTextWidth(entry.a, fontA);
  const wb = measureTextWidth(entry.b, fontB);
  return Math.max(wa, wb) + GAP;
}

// Greedy line-breaking (mirrors Dart _lines)
function splitToLines(entries, maxWidth) {
  const lines = [];
  let cur = [];
  let w = 0;
  for (const entry of entries) {
    const tw = termWidth(entry);
    if (cur.length > 0 && w + tw > maxWidth) {
      lines.push(cur);
      cur = [];
      w = 0;
    }
    cur.push(entry);
    w += tw;
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

function entryColor(index, isDark) {
  if (index % 2 === 0) return isDark ? '#e5e5e5' : '#1a1a1a';
  return isDark ? '#93c5fd' : '#2563eb';
}

// ═══════════════════════════════════════════════════════════════════════════════
//  INLINE SVGs (not in central registry)
// ═══════════════════════════════════════════════════════════════════════════════

const svg = {
  translate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>`,
  menuBook: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  viewAgenda: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
  touchApp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`,
  article: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
};

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLE INJECTION (page-specific, cleaned up on unmount)
// ═══════════════════════════════════════════════════════════════════════════════

function injectStyles() {
  if (document.getElementById('bahasa-styles')) return;
  const style = document.createElement('style');
  style.id = 'bahasa-styles';
  style.textContent = `
    .bahasa-page { max-width: var(--max-w); margin: 0 auto; }
    .bahasa-page__header { margin-bottom: var(--s-5); }
    .bahasa-page__title { font-size: var(--text-lg); font-weight: 600; color: var(--c-text); }
    .bahasa-page__subtitle { font-size: var(--text-sm); color: var(--c-text-2); margin-top: var(--s-1); }

    /* ── Home: Pairs ── */
    .bahasa-pairs { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--s-4); }
    .bahasa-pair {
      background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-lg);
      padding: var(--s-4); display: flex; align-items: center; gap: var(--s-4);
      cursor: pointer; transition: all var(--dur-fast);
    }
    .bahasa-pair:hover { border-color: var(--c-border-hi); background: var(--c-surface-2); }
    .bahasa-pair__avatar {
      width: 44px; height: 44px; border-radius: 50%; background: rgba(0,200,122,0.12);
      color: #00c87a; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .bahasa-pair__avatar svg { width: 20px; height: 20px; }
    .bahasa-pair__info { flex: 1; min-width: 0; }
    .bahasa-pair__lang { font-weight: 600; font-size: var(--text-base); color: var(--c-text); }
    .bahasa-pair__count { font-size: var(--text-sm); color: var(--c-text-2); }
    .bahasa-pair__chevron { color: var(--c-text-3); flex-shrink: 0; }

    /* ── List: Docs ── */
    .bahasa-docs { display: flex; flex-direction: column; gap: var(--s-3); }
    .bahasa-doc {
      background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-lg);
      padding: var(--s-4); display: flex; align-items: center; gap: var(--s-4);
      cursor: pointer; transition: all var(--dur-fast);
    }
    .bahasa-doc:hover { border-color: var(--c-border-hi); background: var(--c-surface-2); }
    .bahasa-doc__avatar {
      width: 44px; height: 44px; border-radius: 50%; background: rgba(0,200,122,0.12);
      color: #00c87a; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: var(--text-sm); flex-shrink: 0;
    }
    .bahasa-doc__info { flex: 1; min-width: 0; }
    .bahasa-doc__title { font-weight: 600; font-size: var(--text-base); color: var(--c-text); }
    .bahasa-doc__meta { font-size: var(--text-sm); color: var(--c-text-2); }
    .bahasa-doc__actions { display: flex; gap: var(--s-1); flex-shrink: 0; }

    /* ── Detail: Vinculum ── */
    .bahasa-detail__header { text-align: center; margin-bottom: var(--s-4); }
    .bahasa-detail__meta { font-size: var(--text-sm); color: var(--c-text-2); }
    .bahasa-detail__mode-switch { display: flex; gap: var(--s-1); justify-content: center; margin-top: var(--s-3); flex-wrap: wrap; }
    .bahasa-detail__mode-btn {
      display: inline-flex; align-items: center; gap: var(--s-2);
      padding: var(--s-2) var(--s-3); border-radius: var(--radius);
      font-size: var(--text-xs); font-weight: 500; color: var(--c-text-2);
      background: var(--c-surface-2); border: 1px solid var(--c-border);
      cursor: pointer; transition: all var(--dur-fast); min-height: 36px;
    }
    .bahasa-detail__mode-btn:hover { background: var(--c-surface-3); }
    .bahasa-detail__mode-btn--active { color: var(--c-primary); border-color: var(--c-primary); background: var(--c-primary-bg); }
    .bahasa-detail__hint { text-align: center; font-size: var(--text-xs); color: var(--c-text-3); margin-bottom: var(--s-3); }

    .vinculum-view { padding: var(--s-4) 0; }
    .vinculum-line { margin-bottom: var(--s-4); }
    .vinculum-line__row { display: flex; gap: var(--s-3); flex-wrap: wrap; }
    .vinculum-line__divider { height: 1px; background: var(--c-border-hi); margin: 2px 0; width: 100%; }
    .vinculum-term { display: flex; flex-direction: column; align-items: center; min-width: 40px; }
    .vinculum-a { font-weight: 600; font-size: 13px; line-height: 1.2; text-align: center; white-space: nowrap; }
    .vinculum-b { font-size: 11px; color: #00c87a; font-style: italic; line-height: 1.2; text-align: center; white-space: nowrap; }
    [data-theme="dark"] .vinculum-b { color: #34d399; }

    .vinculum-hold { display: flex; flex-wrap: wrap; gap: 6px; }
    .vinculum-hold__term {
      position: relative; display: inline-block; padding: 2px 6px;
      border-radius: var(--radius); cursor: help;
      font-weight: 600; font-size: 13px;
      transition: background var(--dur-fast);
    }
    .vinculum-hold__term:hover { background: var(--c-surface-2); }
    .vinculum-hold__tooltip {
      position: absolute; bottom: calc(100% + 6px); left: 50%;
      transform: translateX(-50%) scale(0.95);
      padding: var(--s-2) var(--s-3);
      background: #00c87a; color: #fff;
      font-size: var(--text-xs); font-style: italic;
      border-radius: var(--radius); white-space: nowrap;
      opacity: 0; pointer-events: none; transition: all var(--dur-fast); z-index: 10;
    }
    .vinculum-hold__term:hover .vinculum-hold__tooltip { opacity: 1; transform: translateX(-50%) scale(1); }

    .vinculum-paragraph__source { font-size: 15px; line-height: 1.5; font-weight: 600; }
    .vinculum-paragraph__divider { height: 1px; background: var(--c-border-hi); margin: var(--s-3) 0; }
    .vinculum-paragraph__target { font-size: 13px; line-height: 1.5; font-style: italic; }

    /* ── Form ── */
    .bahasa-form__panduan { max-height: 60vh; overflow: auto; font-family: var(--font-mono); font-size: var(--text-sm); white-space: pre-wrap; line-height: 1.6; }
    .bahasa-toolbar { display: flex; gap: var(--s-3); margin-bottom: var(--s-5); flex-wrap: wrap; align-items: center; }
    .bahasa-back { display: inline-flex; align-items: center; gap: var(--s-2); color: var(--c-text-2); font-size: var(--text-sm); margin-bottom: var(--s-4); cursor: pointer; background: none; border: none; padding: 0; }
    .bahasa-back:hover { color: var(--c-text); }
    .bahasa-back svg { width: 16px; height: 16px; }

    @media (max-width: 768px) {
      .bahasa-pairs { grid-template-columns: 1fr; }
      .bahasa-doc { padding: var(--s-3); }
      .bahasa-doc__actions { flex-direction: column; }
      .vinculum-line__row { gap: var(--s-2); }
      .bahasa-detail__mode-switch { gap: var(--s-1); }
    }
  `;
  document.head.appendChild(style);
}

function removeStyles() {
  const s = document.getElementById('bahasa-styles');
  if (s) s.remove();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════════════════════════════════

export function render() {
  injectStyles();

  const pageState = {
    view: 'home',       // 'home' | 'list' | 'detail' | 'form'
    pairs: [],
    docs: [],
    selectedLang: '',
    selectedDoc: null,
    detailMode: 0,      // 0=FULL, 1=HOLD, 2=PARAGRAF
    loading: true,
    formEditId: null,
    formInitialLang: '',
  };

  const container = createEl('div', { class: 'bahasa-page' });
  const contentWrap = createEl('div', { id: 'bahasa-content' });
  container.appendChild(contentWrap);

  // ── Navigation helpers ──
  function goHome() {
    pageState.view = 'home';
    pageState.selectedLang = '';
    pageState.selectedDoc = null;
    pageState.formEditId = null;
    renderCurrentView();
  }
  function goList(lang) {
    pageState.view = 'list';
    pageState.selectedLang = lang;
    pageState.selectedDoc = null;
    pageState.formEditId = null;
    loadDocs();
  }
  function goDetail(doc) {
    pageState.view = 'detail';
    pageState.selectedDoc = doc;
    pageState.detailMode = 0;
    renderCurrentView();
  }
  function goForm(editId = null, initialLang = '') {
    pageState.view = 'form';
    pageState.formEditId = editId;
    pageState.formInitialLang = initialLang;
    renderCurrentView();
  }

  // ── API ──
  async function loadPairs() {
    pageState.loading = true;
    try {
      const data = await Api.get('/bahasa/pairs');
      pageState.pairs = data || [];
    } catch (e) {
      console.error('[Bahasa] pairs:', e);
      pageState.pairs = [];
      toast('Gagal memuat pasangan bahasa', { type: 'error' });
    }
  }

  async function loadDocs() {
    pageState.loading = true;
    renderCurrentView();
    try {
      const data = await Api.get('/bahasa', { lang: pageState.selectedLang });
      pageState.docs = data || [];
    } catch (e) {
      console.error('[Bahasa] docs:', e);
      pageState.docs = [];
      toast('Gagal memuat dokumen', { type: 'error' });
    } finally {
      pageState.loading = false;
      renderCurrentView();
    }
  }

  async function loadDocDetail(id) {
    try {
      const doc = await Api.get(`/bahasa/${id}`);
      if (!doc) throw new Error('Not found');
      goDetail(doc);
    } catch (e) {
      toast('Gagal memuat dokumen: ' + (e.message || e), { type: 'error' });
      goList(pageState.selectedLang);
    }
  }

  async function deleteDoc(id) {
    const modal = createModal({
      title: 'Hapus Dokumen',
      content: createEl('p', {}, ['Yakin ingin menghapus dokumen ini?']),
      width: '360px',
    });
    const btnWrap = createEl('div', { style: { display: 'flex', gap: 'var(--s-2)', marginTop: 'var(--s-3)' } });
    btnWrap.innerHTML = `
      <button class="btn btn--ghost" id="bd-cancel">Batal</button>
      <button class="btn btn--danger" id="bd-confirm">${icons.trash} Hapus</button>
    `;
    modal.body.appendChild(btnWrap);
    btnWrap.querySelector('#bd-cancel').addEventListener('click', () => modal.close());
    btnWrap.querySelector('#bd-confirm').addEventListener('click', async () => {
      try {
        await Api.delete(`/bahasa/${id}`);
        toast('Dokumen dihapus', { type: 'success' });
        modal.close();
        loadDocs();
      } catch (err) {
        toast('Gagal menghapus: ' + (err.message || err), { type: 'error' });
      }
    });
  }

  // ── View Renderers ──

  function renderSkeleton(count = 5) {
    const wrap = createEl('div');
    for (let i = 0; i < count; i++) {
      wrap.appendChild(createEl('div', {
        class: 'skeleton',
        style: { height: '72px', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--s-3)' }
      }));
    }
    return wrap;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  VIEW: HOME (pairs)
  // ═══════════════════════════════════════════════════════════════════════════
  function buildHome() {
    const frag = document.createDocumentFragment();

    // Header
    const header = createEl('div', { class: 'bahasa-page__header' });
    header.innerHTML = `
      <h1 class="bahasa-page__title">Bahasa</h1>
      <p class="bahasa-page__subtitle">Kamus pasangan kata</p>
    `;
    frag.appendChild(header);

    if (pageState.loading && pageState.pairs.length === 0) {
      frag.appendChild(renderSkeleton(4));
      return frag;
    }

    if (pageState.pairs.length === 0) {
      const empty = createEl('div', { class: 'empty' });
      empty.innerHTML = `
        <div class="empty__icon">${svg.menuBook}</div>
        <div class="empty__title">Belum ada pasangan bahasa</div>
        ${isAdmin() ? '<p class="empty__desc">Tekan tombol + di kanan atas untuk tambah</p>' : ''}
      `;
      frag.appendChild(empty);
      return frag;
    }

    const grid = createEl('div', { class: 'bahasa-pairs' });
    pageState.pairs.forEach(p => {
      const lang = p.string_lang || '?';
      const count = p.jumlah || 0;
      const card = createEl('div', { class: 'bahasa-pair', 'data-lang': lang });
      card.innerHTML = `
        <div class="bahasa-pair__avatar">${svg.translate}</div>
        <div class="bahasa-pair__info">
          <div class="bahasa-pair__lang">${langLabel(lang)}</div>
          <div class="bahasa-pair__count">${count} dokumen tersimpan</div>
        </div>
        <div class="bahasa-pair__chevron">${icons['chevron-right']}</div>
      `;
      card.addEventListener('click', () => goList(lang));
      grid.appendChild(card);
    });
    frag.appendChild(grid);
    return frag;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  VIEW: LIST (docs per lang)
  // ═══════════════════════════════════════════════════════════════════════════
  function buildList() {
    const frag = document.createDocumentFragment();

    // Back + Header
    const back = createEl('button', { class: 'bahasa-back' });
    back.innerHTML = `<span style="display:inline-block;transform:rotate(180deg);">${icons['chevron-right']}</span> Kembali`;
    back.addEventListener('click', goHome);
    frag.appendChild(back);

    const header = createEl('div', { class: 'bahasa-page__header' });
    header.innerHTML = `
      <h1 class="bahasa-page__title">${langLabel(pageState.selectedLang)}</h1>
      <p class="bahasa-page__subtitle">Daftar dokumen kamus</p>
    `;
    frag.appendChild(header);

    // Toolbar
    const toolbar = createEl('div', { class: 'bahasa-toolbar' });
    if (isAdmin()) {
      const addBtn = createEl('button', { class: 'btn btn--primary' });
      addBtn.innerHTML = `${icons.plus} Tambah Dokumen`;
      addBtn.addEventListener('click', () => goForm(null, pageState.selectedLang));
      toolbar.appendChild(addBtn);
    }
    frag.appendChild(toolbar);

    if (pageState.loading) {
      frag.appendChild(renderSkeleton(4));
      return frag;
    }

    if (pageState.docs.length === 0) {
      const empty = createEl('div', { class: 'empty' });
      empty.innerHTML = `
        <div class="empty__icon">${svg.menuBook}</div>
        <div class="empty__title">Belum ada dokumen</div>
        <p class="empty__desc">Untuk pasangan bahasa ini belum ada dokumen tersimpan.</p>
      `;
      frag.appendChild(empty);
      return frag;
    }

    const list = createEl('div', { class: 'bahasa-docs' });
    pageState.docs.forEach(d => {
      const count = d.jumlah_entri || 0;
      const tgl = d.updated_at || d.created_at || '';
      const item = createEl('div', { class: 'bahasa-doc', 'data-id': d.id });
      item.innerHTML = `
        <div class="bahasa-doc__avatar">${count}</div>
        <div class="bahasa-doc__info">
          <div class="bahasa-doc__title">${escapeHtml(d.judul) || 'Tanpa Judul'}</div>
          <div class="bahasa-doc__meta">${count} entri${tgl ? ' • ' + escapeHtml(tgl) : ''}</div>
        </div>
        ${isAdmin() ? `
          <div class="bahasa-doc__actions">
            <button class="btn btn--ghost btn--sm" data-action="edit" data-id="${d.id}" aria-label="Ubah">${icons.edit}</button>
            <button class="btn btn--ghost btn--sm" data-action="delete" data-id="${d.id}" aria-label="Hapus" style="color:var(--c-danger);">${icons.trash}</button>
          </div>
        ` : `<div class="bahasa-doc__actions" style="color:var(--c-text-3);">${icons['chevron-right']}</div>`}
      `;
      item.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        loadDocDetail(d.id);
      });
      list.appendChild(item);
    });

    // Event delegation for edit/delete
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = parseInt(btn.dataset.id);
      if (btn.dataset.action === 'edit') goForm(id, pageState.selectedLang);
      else if (btn.dataset.action === 'delete') deleteDoc(id);
    });

    frag.appendChild(list);
    return frag;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  VIEW: DETAIL (3-mode Vinculum)
  // ═══════════════════════════════════════════════════════════════════════════
  function buildDetail() {
    const doc = pageState.selectedDoc;
    const entries = (doc?.entries) || [];
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const frag = document.createDocumentFragment();

    // Back
    const back = createEl('button', { class: 'bahasa-back' });
    back.innerHTML = `<span style="display:inline-block;transform:rotate(180deg);">${icons['chevron-right']}</span> Kembali`;
    back.addEventListener('click', () => goList(pageState.selectedLang));
    frag.appendChild(back);

    // Header
    const header = createEl('div', { class: 'bahasa-detail__header' });
    header.innerHTML = `
      <h1 class="bahasa-page__title">${escapeHtml(doc?.judul) || 'Detail'}</h1>
      <div class="bahasa-detail__meta">${escapeHtml(doc?.string_lang) || ''} • ${entries.length} entri</div>
      <div class="bahasa-detail__mode-switch">
        <button class="bahasa-detail__mode-btn ${pageState.detailMode === 0 ? 'bahasa-detail__mode-btn--active' : ''}" data-mode="0" aria-label="Mode Full">
          ${svg.viewAgenda} Full
        </button>
        <button class="bahasa-detail__mode-btn ${pageState.detailMode === 1 ? 'bahasa-detail__mode-btn--active' : ''}" data-mode="1" aria-label="Mode Hold">
          ${svg.touchApp} Hold
        </button>
        <button class="bahasa-detail__mode-btn ${pageState.detailMode === 2 ? 'bahasa-detail__mode-btn--active' : ''}" data-mode="2" aria-label="Mode Paragraf">
          ${svg.article} Paragraf
        </button>
      </div>
    `;
    header.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        pageState.detailMode = parseInt(btn.dataset.mode);
        renderCurrentView();
      });
    });
    frag.appendChild(header);

    if (pageState.detailMode === 1) {
      frag.appendChild(createEl('p', { class: 'bahasa-detail__hint' },
        ['Tekan & tahan kata untuk melihat terjemahan (hover)']));
    }

    if (entries.length === 0) {
      frag.appendChild(createEl('div', { class: 'empty' },
        [createEl('p', {}, ['Dokumen kosong'])]));
      return frag;
    }

    const view = createEl('div', { class: 'vinculum-view' });

    if (pageState.detailMode === 0) {
      // ── Mode FULL ──
      const maxWidth = Math.min(800, window.innerWidth - 64);
      const lines = splitToLines(entries, maxWidth);
      let idx = 0;
      lines.forEach(line => {
        const lineEl = createEl('div', { class: 'vinculum-line' });
        const widths = line.map(e => termWidth(e));

        // Row A
        const rowA = createEl('div', { class: 'vinculum-line__row' });
        line.forEach((e, i) => {
          const term = createEl('div', { class: 'vinculum-term' });
          term.style.width = Math.max(0, widths[i] - GAP) + 'px';
          term.innerHTML = `<span class="vinculum-a" style="color:${entryColor(idx + i, isDark)}">${escapeHtml(e.a)}</span>`;
          rowA.appendChild(term);
        });

        // Divider
        const divider = createEl('div', { class: 'vinculum-line__divider' });

        // Row B
        const rowB = createEl('div', { class: 'vinculum-line__row' });
        line.forEach((e, i) => {
          const term = createEl('div', { class: 'vinculum-term' });
          term.style.width = Math.max(0, widths[i] - GAP) + 'px';
          term.innerHTML = `<span class="vinculum-b">${escapeHtml(e.b)}</span>`;
          rowB.appendChild(term);
        });

        lineEl.appendChild(rowA);
        lineEl.appendChild(divider);
        lineEl.appendChild(rowB);
        view.appendChild(lineEl);
        idx += line.length;
      });

    } else if (pageState.detailMode === 1) {
      // ── Mode HOLD ──
      const holdWrap = createEl('div', { class: 'vinculum-hold' });
      entries.forEach((e, i) => {
        const term = createEl('span', { class: 'vinculum-hold__term' });
        term.style.color = entryColor(i, isDark);
        term.innerHTML = `${escapeHtml(e.a)}<span class="vinculum-hold__tooltip">${escapeHtml(e.b)}</span>`;
        holdWrap.appendChild(term);
      });
      view.appendChild(holdWrap);

    } else {
      // ── Mode PARAGRAF ──
      const para = createEl('div');
      const sourceSpans = entries.map((e, i) =>
        `<span style="color:${entryColor(i, isDark)}">${escapeHtml(e.a)}</span>`
      ).join(' ');
      const targetSpans = entries.map((e, i) =>
        `<span style="color:${entryColor(i, isDark)}">${escapeHtml(e.b)}</span>`
      ).join(' ');

      para.innerHTML = `
        <div class="vinculum-paragraph__source">${sourceSpans}</div>
        <div class="vinculum-paragraph__divider"></div>
        <div class="vinculum-paragraph__target">${targetSpans}</div>
      `;
      view.appendChild(para);
    }

    frag.appendChild(view);
    return frag;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  VIEW: FORM (create/edit)
  // ═══════════════════════════════════════════════════════════════════════════
  function buildForm() {
    const isEdit = pageState.formEditId !== null;
    const frag = document.createDocumentFragment();

    // Back
    const back = createEl('button', { class: 'bahasa-back' });
    back.innerHTML = `<span style="display:inline-block;transform:rotate(180deg);">${icons['chevron-right']}</span> Kembali`;
    back.addEventListener('click', () => {
      if (pageState.selectedLang) goList(pageState.selectedLang);
      else goHome();
    });
    frag.appendChild(back);

    // Header
    const header = createEl('div', { class: 'bahasa-page__header' });
    header.innerHTML = `
      <h1 class="bahasa-page__title">${isEdit ? 'Ubah Dokumen' : 'Tambah Dokumen Bahasa'}</h1>
    `;
    frag.appendChild(header);

    const formCard = createEl('div', { class: 'card' });
    const form = createEl('form', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' } });

    // ── Lang field ──
    const langWrap = createEl('div', { class: 'field' });
    const langLabelEl = createEl('label', { class: 'field__label' }, ['Pasangan Bahasa']);
    langWrap.appendChild(langLabelEl);

    // Check if selected lang exists in pairs
    const knownLangs = pageState.pairs.map(p => p.string_lang);
    const initialLang = pageState.formInitialLang || '';
    const isNewLang = initialLang && !knownLangs.includes(initialLang);

    let langSelect, langInput;
    if (!isNewLang && knownLangs.length > 0) {
      langSelect = createEl('select', { class: 'field__select', name: 'string_lang', required: true });
      langSelect.innerHTML = `<option value="">Pilih pasangan bahasa</option>` +
        knownLangs.map(l => `<option value="${l}" ${l === initialLang ? 'selected' : ''}>${langLabel(l)}</option>`).join('') +
        `<option value="__baru__">➕ Ketik bahasa baru...</option>`;
      langWrap.appendChild(langSelect);
    } else {
      langInput = createEl('input', {
        class: 'field__input', name: 'string_lang', required: true,
        placeholder: 'contoh: indonesia-jerman', value: initialLang
      });
      langWrap.appendChild(langInput);
    }
    form.appendChild(langWrap);

    // ── Judul field ──
    const judulWrap = createEl('div', { class: 'field' });
    judulWrap.innerHTML = `
      <label class="field__label">Judul</label>
      <input type="text" name="judul" class="field__input" placeholder="contoh: Artikel 1" required>
    `;
    form.appendChild(judulWrap);

    // ── Source field ──
    const sourceWrap = createEl('div', { class: 'field' });
    const sourceHeader = createEl('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } });
    sourceHeader.innerHTML = `<label class="field__label">Isi (lang_source)</label>`;
    const helpBtn = createEl('button', {
      type: 'button',
      class: 'btn btn--ghost btn--sm',
      'aria-label': 'Panduan format'
    });
    helpBtn.innerHTML = `${icons.help} Panduan`;
    helpBtn.addEventListener('click', showPanduan);
    sourceHeader.appendChild(helpBtn);
    sourceWrap.appendChild(sourceHeader);

    const sourceArea = createEl('textarea', {
      class: 'field__input',
      name: 'lang_source',
      rows: 10,
      placeholder: '[{"a":"Higher energy prices","b":"Kenaikan harga energi"}, ...]',
      required: true,
      style: 'font-family:var(--font-mono);font-size:var(--text-sm);'
    });
    sourceWrap.appendChild(sourceArea);
    sourceWrap.appendChild(createEl('div', { class: 'field__hint' },
      ['Format: JSON array of {"a":"kata","b":"terjemahan"}']));
    form.appendChild(sourceWrap);

    // ── Actions ──
    const actions = createEl('div', { style: { display: 'flex', gap: 'var(--s-3)', justifyContent: 'flex-end', marginTop: 'var(--s-2)' } });
    const cancelBtn = createEl('button', { type: 'button', class: 'btn btn--ghost' }, ['Batal']);
    cancelBtn.addEventListener('click', () => {
      if (pageState.selectedLang) goList(pageState.selectedLang);
      else goHome();
    });
    const saveBtn = createEl('button', { type: 'submit', class: 'btn btn--primary' });
    saveBtn.innerHTML = `${icons.check} Simpan`;
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    form.appendChild(actions);

    // ── Submit handler ──
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      let stringLang = fd.get('string_lang');
      if (stringLang === '__baru__') {
        toast('Masukkan nama pasangan bahasa baru', { type: 'error' });
        return;
      }
      const judul = fd.get('judul').trim();
      const src = fd.get('lang_source').trim();

      if (!stringLang || !judul || !src) {
        toast('Semua field wajib diisi', { type: 'error' });
        return;
      }

      const parsed = parseLangSource(src);
      if (!parsed) {
        toast('lang_source tidak valid — cek format JSON (lihat panduan)', { type: 'error' });
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML = 'Menyimpan...';

      try {
        const body = { string_lang: stringLang, judul, lang_source: src };
        if (isEdit) {
          await Api.put(`/bahasa/${pageState.formEditId}`, body);
          toast('Dokumen berhasil diupdate', { type: 'success' });
        } else {
          await Api.post('/bahasa', body);
          toast('Dokumen berhasil ditambahkan', { type: 'success' });
        }
        if (pageState.selectedLang) goList(pageState.selectedLang);
        else goHome();
      } catch (err) {
        toast('Gagal menyimpan: ' + (err.message || err), { type: 'error' });
        saveBtn.disabled = false;
        saveBtn.innerHTML = `${icons.check} Simpan`;
      }
    });

    formCard.appendChild(form);
    frag.appendChild(formCard);

    // ── Prefill for edit ──
    if (isEdit) {
      (async () => {
        try {
          const doc = await Api.get(`/bahasa/${pageState.formEditId}`);
          if (!doc) return;
          const jInput = form.querySelector('[name="judul"]');
          const sInput = form.querySelector('[name="lang_source"]');
          if (jInput) jInput.value = doc.judul || '';
          if (sInput) {
            const entries = (doc.entries) || [];
            sInput.value = entries.length > 0 ? JSON.stringify(entries, null, 2) : '';
          }
          if (langSelect) {
            if (!knownLangs.includes(doc.string_lang)) {
              // Switch to input mode if lang not in dropdown
              langSelect.value = '__baru__';
              langSelect.dispatchEvent(new Event('change'));
            } else {
              langSelect.value = doc.string_lang;
            }
          }
          if (langInput) langInput.value = doc.string_lang || '';
        } catch (e) {
          toast('Gagal memuat data dokumen', { type: 'error' });
        }
      })();
    }

    // ── Dropdown "new lang" handler ──
    if (langSelect) {
      langSelect.addEventListener('change', () => {
        if (langSelect.value === '__baru__') {
          const input = createEl('input', {
            class: 'field__input', name: 'string_lang', required: true,
            placeholder: 'contoh: indonesia-jerman'
          });
          langSelect.replaceWith(input);
          input.focus();
        }
      });
    }

    return frag;
  }

  // ── Panduan Modal ──
  function showPanduan() {
    const content = createEl('div');
    content.innerHTML = `
      <div class="bahasa-form__panduan">${escapeHtml(PANDUAN_TEXT)}</div>
      <div style="display:flex;justify-content:flex-end;margin-top:var(--s-3);">
        <button class="btn btn--secondary btn--sm" id="copy-panduan">${icons.copy} Salin</button>
      </div>
    `;
    const modal = createModal({ title: 'Panduan Format', content, width: '560px' });
    content.querySelector('#copy-panduan').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(PANDUAN_TEXT);
        toast('Panduan disalin', { type: 'success' });
      } catch {
        toast('Gagal menyalin', { type: 'error' });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  DISPATCHER
  // ═══════════════════════════════════════════════════════════════════════════
  function renderCurrentView() {
    contentWrap.innerHTML = '';
    let frag;
    switch (pageState.view) {
      case 'home': frag = buildHome(); break;
      case 'list': frag = buildList(); break;
      case 'detail': frag = buildDetail(); break;
      case 'form': frag = buildForm(); break;
      default: frag = buildHome();
    }
    contentWrap.appendChild(frag);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════════════════════════
  async function init() {
    await loadPairs();
    pageState.loading = false;
    renderCurrentView();
  }
  init();

  // Cleanup
  container._cleanup = () => {
    removeStyles();
  };

  return container;
}
