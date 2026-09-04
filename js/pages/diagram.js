/* pages/diagram.js — Code Diagram (PlantUML Local Renderer) */
import { createEl } from '../utils/dom.js';
import { toast } from '../ui/toast.js';

// ═══════════════════════════════════════════════════════
// KONFIGURASI — Mencerminkan code_diagram_screen.dart & plantuml_local_renderer.dart
// ═══════════════════════════════════════════════════════
const INITIAL_SOURCE = `@startuml
Alice -> Bob: Authentication Request
Bob --> Alice: Authentication Response

Alice -> Bob: Another authentication Request
Alice <-- Bob: Another authentication Response
@enduml`;

const RENDERER_URL = 'assets/plantuml/renderer.html';
const STORAGE_KEY = 'diagram_source';

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════
function loadSavedSource() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw && raw.length > 0 ? raw : INITIAL_SOURCE;
  } catch {
    return INITIAL_SOURCE;
  }
}

function saveSource(source) {
  try {
    localStorage.setItem(STORAGE_KEY, source);
  } catch {}
}

function downloadSvg(svgContent, filename = 'diagram.svg') {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════
// MAIN RENDER — konsisten dengan Flutter CodeDiagramScreen
// ═══════════════════════════════════════════════════════
export function render() {
  const container = createEl('div', { class: 'diagram-page' });

  // ---- Header ----
  const header = createEl('div', { class: 'gacha-header' }, [
    createEl('h1', { class: 'gacha-title' }, ['Render Diagram']),
    createEl('p', { class: 'gacha-subtitle' }, [
      'Tulis kode PlantUML di samping, klik Render untuk melihat diagram secara lokal (offline).'
    ]),
  ]);
  container.appendChild(header);

  // ---- Grid: Input + Preview ----
  const grid = createEl('div', {
    class: 'grid grid--2',
    style: { alignItems: 'start' }
  });
  container.appendChild(grid);

  // ---- Input Panel ----
  const inputCard = createEl('div', { class: 'card' });
  inputCard.innerHTML = `
    <div class="card__head">
      <div class="card__title">Source (PlantUML)</div>
    </div>
  `;

  const textarea = createEl('textarea', {
    class: 'field__textarea',
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-sm)',
      resize: 'vertical',
      width: '100%',
      minHeight: '280px',
    }
  });
  textarea.textContent = loadSavedSource();
  textarea.setAttribute('spellcheck', 'false');
  textarea.setAttribute('placeholder', '@startuml\n...\n@enduml');

  // Real-time save on input
  textarea.addEventListener('input', () => {
    saveSource(textarea.value);
  });

  // Button row
  const btnRow = createEl('div', {
    class: 'card__foot',
    style: { marginTop: 'var(--s-3)' }
  });

  const renderBtn = createEl('button', {
    class: 'btn btn--primary',
    style: { flex: '1' }
  }, ['Render']);

  const clearBtn = createEl('button', {
    class: 'btn btn--secondary',
    style: { flex: '1' }
  }, ['Clear']);

  const saveSvgBtn = createEl('button', {
    class: 'btn btn--secondary',
    style: { flex: '1', display: 'none' }
  }, ['💾 Simpan SVG']);

  btnRow.appendChild(renderBtn);
  btnRow.appendChild(clearBtn);
  btnRow.appendChild(saveSvgBtn);

  const hint = createEl('div', {
    style: { fontSize: 'var(--text-xs)', color: 'var(--c-text-3)', marginTop: 'var(--s-1)' }
  }, ['Render lokal (offline, tanpa server).']);
  btnRow.appendChild(hint);

  inputCard.appendChild(textarea);
  inputCard.appendChild(btnRow);
  grid.appendChild(inputCard);

  // ---- Output Panel ----
  const outputCard = createEl('div', { class: 'card' });
  outputCard.innerHTML = `
    <div class="card__head">
      <div class="card__title">Preview</div>
      <div class="diagram-zoom-controls" style="display:none; gap: var(--s-1);">
        <button class="btn btn--ghost btn--sm" data-zoom="in" aria-label="Zoom in">+</button>
        <button class="btn btn--ghost btn--sm" data-zoom="reset" aria-label="Reset zoom">Reset</button>
        <button class="btn btn--ghost btn--sm" data-zoom="out" aria-label="Zoom out">−</button>
      </div>
    </div>
  `;

  const previewWrap = createEl('div', {
    class: 'diagram-preview-wrap',
    style: {
      minHeight: '260px',
      background: 'var(--c-surface-2)',
      borderRadius: 'var(--radius)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'auto',
      position: 'relative',
    }
  });

  const placeholder = createEl('div', {
    class: 'diagram-placeholder',
    style: { textAlign: 'center', color: 'var(--c-text-3)', fontSize: 'var(--text-sm)' }
  }, ['Tekan Render untuk melihat hasil diagram']);
  previewWrap.appendChild(placeholder);

  outputCard.appendChild(previewWrap);
  grid.appendChild(outputCard);

  // ---- Hidden iframe renderer (replaces hidden WebView in Flutter) ----
  const iframe = createEl('iframe', {
    style: {
      position: 'fixed',
      width: '1px',
      height: '1px',
      left: '-9999px',
      top: '0',
      visibility: 'hidden',
      border: '0',
    }
  });
  iframe.setAttribute('tabindex', '-1');
  iframe.setAttribute('aria-hidden', 'true');
  container.appendChild(iframe);

  // ═══════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════
  let iframeLoaded = false;
  let isLoading = false;
  let currentSvg = null;
  let scale = 1;
  let renderResolver = null;
  let pendingSource = null;

  // ═══════════════════════════════════════════════════════
  // IFRAME COMMUNICATION
  // ═══════════════════════════════════════════════════════

  // Listen for messages from the iframe (both render results and load confirmation)
  const messageHandler = (event) => {
    if (event.source !== iframe.contentWindow) return;

    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    if (data.type === 'ready') {
      iframeLoaded = true;
      toast('Engine PlantUML siap ✅', 'success');
      if (pendingSource !== null) {
        pendingSource = null;
        // Will be re-triggered by the user or we can auto-render
      }
      return;
    }

    if (data.ok === true && data.svg) {
      isLoading = false;
      currentSvg = data.svg;

      // Resolve pending promise if any
      if (renderResolver) {
        const resolve = renderResolver;
        renderResolver = null;
        resolve(data.svg);
      }

      showResult(data.svg);
      toast('Diagram berhasil dirender!', 'success');
    } else if (data.ok === false) {
      isLoading = false;
      if (renderResolver) {
        const resolve = renderResolver;
        renderResolver = null;
        resolve(null);
      }
      showError(data.err || 'Render error');
    }
  };

  window.addEventListener('message', messageHandler);

  // Set iframe source — loads renderer.html which loads the JS engines
  iframe.src = RENDERER_URL;

  // ═══════════════════════════════════════════════════════
  // RENDER HANDLERS
  // ═══════════════════════════════════════════════════════
  function doRender() {
    if (isLoading) {
      toast('Render masih berjalan, tunggu...', 'warn');
      return;
    }

    const source = textarea.value.trim();
    if (!source) {
      toast('Tulis kode PlantUML terlebih dahulu', 'warn');
      return;
    }

    if (!source.includes('@startuml') || !source.includes('@enduml')) {
      toast('Kode harus dimulai dengan @startuml dan diakhiri @enduml', 'warn');
      return;
    }

    isLoading = true;
    currentSvg = null;
    saveSvgBtn.style.display = 'none';

    // Show loading state using skeleton pattern
    placeholder.style.display = 'none';
    const loadingEl = createEl('div', {
      style: { textAlign: 'center', color: 'var(--c-text-3)', fontSize: 'var(--text-sm)' }
    }, ['⏳ Merender diagram...']);
    previewWrap.innerHTML = '';
    previewWrap.appendChild(loadingEl);
    previewWrap.style.cursor = 'wait';

    // Send to iframe
    if (iframeLoaded && iframe.contentWindow && typeof iframe.contentWindow.renderPlantUML === 'function') {
      const lines = source.split(/\r\n|\r|\n/);
      try {
        iframe.contentWindow.renderPlantUML(JSON.stringify(lines));
      } catch (e) {
        isLoading = false;
        showError(String(e));
      }
    } else if (!iframeLoaded && iframe.contentWindow) {
      // Iframe HTML loaded but JS engine not ready yet
      showError('Engine PlantUML belum siap. Tunggu beberapa detik, lalu coba lagi.');
      isLoading = false;
    } else {
      showError('Gagal mengakses renderer. Pastikan file assets tersedia.');
      isLoading = false;
    }
  }

  function showResult(svgString) {
    previewWrap.innerHTML = '';
    previewWrap.style.cursor = 'default';

    // Parse SVG to enable zoom and styling
    let svgEl = null;
    try {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = svgString.trim();
      svgEl = wrapper.querySelector('svg');
    } catch (e) {
      // Fallback
    }

    if (svgEl) {
      // Make SVG responsive
      svgEl.setAttribute('width', '100%');
      svgEl.setAttribute('height', 'auto');
      svgEl.style.maxWidth = '100%';
      svgEl.style.height = 'auto';
      previewWrap.appendChild(svgEl);

      // Setup zoom
      setupZoom(svgEl);
      scale = 1;
      updateZoomControlsVisibility();

      // Show save button
      saveSvgBtn.style.display = 'inline-flex';
      saveSvgBtn.onclick = () => {
        downloadSvg(currentSvg);
        toast('SVG berhasil disimpan!', 'success');
      };
    } else {
      // Fallback: raw HTML
      previewWrap.innerHTML = svgString;
    }
  }

  function showError(msg) {
    previewWrap.innerHTML = '';
    previewWrap.style.cursor = 'default';

    const errorEl = createEl('div', {
      class: 'empty',
      style: { textAlign: 'center', padding: 'var(--s-5)' }
    });
    errorEl.innerHTML = `
      <div style="font-size:40px;margin-bottom:var(--s-2);">⚠️</div>
      <div class="empty__title">Render Error</div>
      <div class="empty__desc" style="font-family:var(--font-mono);font-size:var(--text-sm);color:var(--c-danger);margin:var(--s-2) 0;white-space:pre-wrap;">
        ${escapeHtml(msg)}
      </div>
      <button class="btn btn--secondary btn--sm">Coba Lagi</button>
    `;
    const retryBtn = errorEl.querySelector('button');
    retryBtn.addEventListener('click', doRender);
    previewWrap.appendChild(errorEl);
  }

  function clearAll() {
    if (confirm('Hapus semua kode?')) {
      textarea.value = '';
      saveSource('');
      saveSvgBtn.style.display = 'none';
      previewWrap.innerHTML = '';
      previewWrap.style.cursor = 'default';
      placeholder.style.display = 'block';
      previewWrap.appendChild(placeholder);
      currentSvg = null;
      toast('Kode dihapus', 'info');
    }
  }

  // ═══════════════════════════════════════════════════════
  // ZOOM
  // ═══════════════════════════════════════════════════════
  function setupZoom(svgEl) {
    svgEl.style.transformOrigin = 'center center';
    svgEl.style.transition = 'transform 0.2s var(--ease)';
  }

  function resetZoom() {
    scale = 1;
    const svgEl = previewWrap.querySelector('svg');
    if (svgEl) {
      svgEl.style.transform = `scale(1)`;
    }
    toast('Zoom direset', 'info');
  }

  function zoomIn() {
    scale = Math.min(4, scale * 1.25);
    applyZoom();
  }

  function zoomOut() {
    scale = Math.max(0.2, scale * 0.8);
    applyZoom();
  }

  function applyZoom() {
    const svgEl = previewWrap.querySelector('svg');
    if (svgEl) {
      svgEl.style.transform = `scale(${scale})`;
    }
  }

  function updateZoomControlsVisibility() {
    const controls = outputCard.querySelector('.diagram-zoom-controls');
    if (controls) {
      controls.style.display = currentSvg ? 'flex' : 'none';
    }
  }

  // ═══════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════
  renderBtn.addEventListener('click', doRender);
  clearBtn.addEventListener('click', clearAll);

  // Setup zoom controls
  const zoomControls = outputCard.querySelector('.diagram-zoom-controls');
  if (zoomControls) {
    zoomControls.querySelector('[data-zoom="in"]').addEventListener('click', zoomIn);
    zoomControls.querySelector('[data-zoom="out"]').addEventListener('click', zoomOut);
    zoomControls.querySelector('[data-zoom="reset"]').addEventListener('click', resetZoom);
  }

  // ═══════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════
  container._cleanup = () => {
    window.removeEventListener('message', messageHandler);
    isLoading = false;
    iframeLoaded = false;
  };

  return container;
}

// ═══════════════════════════════════════════════════════
// DESTROY (called by router)
// ═══════════════════════════════════════════════════════
export async function destroy() {
  // Cleanup is handled by container._cleanup
}
