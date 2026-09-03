/* pages/dashboard.js — Dashboard / Home */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';

const FEATURES = [
  { key: 'math_speed', label: 'Math Speed', icon: 'calculate', desc: 'Test your arithmetic speed', color: '#2563eb', path: '/math-speed' },
  { key: 'password', label: 'Password Gen', icon: 'key', desc: 'Generate secure passwords', color: '#059669', path: '/password' },
  { key: 'gacha', label: 'Gacha Luck', icon: 'dice', desc: 'Test your luck', color: '#d97706', path: '/gacha' },
  { key: 'rolling', label: 'Rolling', icon: 'target', desc: 'Yes or No decision', color: '#dc2626', path: '/rolling' },
  { key: 'diagram', label: 'Diagram', icon: 'git-branch', desc: 'Render PlantUML diagrams', color: '#7c3aed', path: '/diagram' },
  { key: 'bahasa', label: 'Language', icon: 'globe', desc: 'Kamus pasangan kata', color: '#0891b2', path: '/bahasa' },
  { key: 'video', label: 'Video DL', icon: 'download', desc: 'Download videos', color: '#be123c', path: '/video' },
  { key: 'news', label: 'News', icon: 'newspaper', desc: 'News intelligence', color: '#4338ca', path: '/news' },
  { key: 'stocks', label: 'Stocks', icon: 'trending-up', desc: 'IDX stock analysis', color: '#047857', path: '/stocks' },
  { key: 'stock-list', label: 'Stock List', icon: 'list', desc: 'Browse all stocks', color: '#0369a1', path: '/stock-list' },
  { key: 'reports', label: 'Reports', icon: 'file-text', desc: 'Generate reports', color: '#c2410c', path: '/reports' },
];

export function render() {
  const container = createEl('div', {}, [
    createEl('h1', {}, ['Dashboard']),
    createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-6)' } }, ['Quick access to all features.']),
  ]);

  const grid = createEl('div', { class: 'grid grid--auto' });

  FEATURES.forEach(f => {
    const card = createEl('a', {
      href: '#' + f.path,
      class: 'card',
      style: {
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-3)',
        borderLeft: `4px solid ${f.color}`,
      }
    });

    const iconWrap = createEl('div', {
      style: {
        width: '40px', height: '40px',
        borderRadius: 'var(--radius)',
        background: f.color + '15',
        color: f.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }
    });
    iconWrap.innerHTML = icons[f.icon] || '';

    const title = createEl('div', {
      style: { fontWeight: '600', fontSize: 'var(--text-md)', color: 'var(--c-text)' }
    }, [f.label]);

    const desc = createEl('div', {
      style: { fontSize: 'var(--text-sm)', color: 'var(--c-text-2)' }
    }, [f.desc]);

    card.appendChild(iconWrap);
    card.appendChild(title);
    card.appendChild(desc);
    grid.appendChild(card);
  });

  container.appendChild(grid);
  return container;
}
