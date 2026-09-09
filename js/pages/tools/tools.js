/* pages/tools/tools.js — Hub Tools (publik, tidak wajib login).
 * Menampilkan grid seperangkat tool yang bisa dibuka kapan saja.
 * Tool tertentu mungkin tetap dicek permission saat user sudah login. */
import { createEl } from '../../utils/dom.js';
import { navigate } from '../../core/router.js';
import { icons } from '../../ui/icons.js';

const TOOLS = [
  { route: '/math-speed', icon: 'calculate', label: 'Math Speed', desc: 'Latihan hitung cepat dengan rekor' },
  { route: '/password', icon: 'key', label: 'Password Generator', desc: 'Buat password acak yang kuat' },
  { route: '/gacha', icon: 'dice', label: 'Gacha Luck', desc: 'Coba keberuntungan gacha' },
  { route: '/rolling', icon: 'target', label: 'Rolling Yes/No', desc: 'Putuskan dengan lempar acak' },
  { route: '/diagram', icon: 'git-branch', label: 'Render Diagram', desc: 'Buat & render diagram dari kode' },
  { route: '/bahasa', icon: 'globe', label: 'Bahasa', desc: 'Terjemahan & belajar bahasa' },
  { route: '/video', icon: 'download', label: 'Video Downloader', desc: 'Unduh video dari URL (butuh login)' },
];

export function render() {
  const page = createEl('div', { class: 'tools-page' });

  const header = createEl('div', { class: 'page-head' });
  header.appendChild(createEl('h1', {}, ['Tools']));
  header.appendChild(createEl('p', { class: 'page-head__sub' }, ['Kumpulan tool produktivitas. Gratis untuk semua.']));
  page.appendChild(header);

  const grid = createEl('div', { class: 'tool-grid' });

  TOOLS.forEach((t) => {
    const card = createEl('button', { class: 'tool-card' }, []);
    card.type = 'button';

    const icon = createEl('span', { class: 'tool-card__icon' });
    icon.innerHTML = icons[t.icon] || icons['help'];
    card.appendChild(icon);

    const body = createEl('span', { class: 'tool-card__body' }, []);
    body.appendChild(createEl('span', { class: 'tool-card__label' }, [t.label]));
    body.appendChild(createEl('span', { class: 'tool-card__desc' }, [t.desc]));
    card.appendChild(body);

    card.addEventListener('click', () => navigate(t.route));
    grid.appendChild(card);
  });

  page.appendChild(grid);
  return page;
}
