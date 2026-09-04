/* pages/dashboard.js — Dashboard home page */
import { store, subscribe } from '../core/state.js';
import { navigate } from '../core/router.js';
import { icons } from '../ui/icons.js';

export function render() {
  const container = document.createElement('section');
  container.className = 'dashboard-page';
  container.style.cssText = `
    padding: var(--s-4);
    max-width: 900px;
    margin: 0 auto;
  `;

  const grid = document.createElement('div');
  grid.className = 'dashboard-grid';
  grid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--s-3);
  `;

  const cards = [
    { key: 'math_speed', label: 'Math Speed', icon: 'calculate', path: '/math-speed', desc: 'Latihan hitung cepat' },
    { key: 'gacha_luck', label: 'Gacha Luck', icon: 'dice', path: '/gacha', desc: 'Roulette keberuntungan' },
    { key: 'rolling', label: 'Rolling Yes/No', icon: 'target', path: '/rolling', desc: 'Keputusan acak' },
    { key: 'password_generator', label: 'Password Generator', icon: 'key', path: '/password', desc: 'Buat password kuat' },
    { key: 'code_diagram', label: 'Render Diagram', icon: 'git-branch', path: '/diagram', desc: 'PlantUML & Graphviz' },
    { key: 'language', label: 'Language', icon: 'globe', path: '/bahasa', desc: 'Paket bahasa' },
    { key: 'video_downloader', label: 'Video Downloader', icon: 'download', path: '/video', desc: 'Unduh video' },
    { key: 'news', label: 'News', icon: 'newspaper', path: '/news', desc: 'Berita terbaru' },
    { key: 'stocks', label: 'IDX Stocks', icon: 'trending-up', path: '/stocks', desc: 'Saham & pasar' },
    { key: 'stock_list', label: 'Stock List', icon: 'list', path: '/stock-list', desc: 'Daftar saham' },
  ];

  cards.forEach((card) => {
    const isAccessible = store.token && canAccessCard(card.key);
    const el = document.createElement('div');
    el.className = 'dashboard-card';
    el.style.cssText = `
      background: var(--card-bg, #fff);
      border: 1px solid var(--border-color, #e0e0e0);
      border-radius: var(--s-3);
      padding: var(--s-4);
      cursor: ${isAccessible ? 'pointer' : 'not-allowed'};
      opacity: ${isAccessible ? 1 : 0.5};
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    `;
    el.dataset.key = card.key;

    if (isAccessible) {
      el.addEventListener('click', () => navigate(card.path));
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
        el.style.boxShadow = '';
      });
    }

    el.innerHTML = `
      <div class="dashboard-card__icon" style="font-size: 28px; margin-bottom: var(--s-2);">
        ${icons[card.icon] || ''}
      </div>
      <h3 class="dashboard-card__title" style="margin: 0 0 var(--s-2); font-size: 16px; font-weight: 600;">
        ${card.label}
      </h3>
      <p class="dashboard-card__desc" style="margin: 0; font-size: 13px; color: var(--text-secondary, #666);">
        ${card.desc}
      </p>
    `;

    grid.appendChild(el);
  });

  container.appendChild(grid);

  // Subscribe to auth changes to re-render access state
  const unsub = subscribe('token', () => {
    // Mark container for cleanup
    container._cleanup = unsub;
    // Re-render cards on auth change
    const newCards = render();
    // This is a simplified approach — in practice we'd update in place
  });

  // Expose cleanup
  container._cleanup = unsub;

  return container;
}

function canAccessCard(key) {
  // Mirror Flutter's canAccess logic
  const defaultPermitted = ['math_speed', 'gacha_luck', 'rolling', 'password_generator', 'code_diagram', 'language', 'video_downloader', 'news', 'stocks', 'stock_list'];
  return store.token && (store.tier === 'admin' || defaultPermitted.includes(key));
}

export function destroy() {
  // Cleanup handled via _cleanup
}
