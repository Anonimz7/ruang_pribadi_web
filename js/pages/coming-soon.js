/* pages/coming-soon.js — Placeholder "Coming Soon" untuk menu yang belum tersedia.
 * Dipakai oleh /quiz dan /games. Judul ditentukan dari hash aktif saat render. */
import { createEl } from '../../utils/dom.js';
import { navigate } from '../../core/router.js';

export function render() {
  const hash = (location.hash || '').slice(1);
  const isQuiz = hash.startsWith('/quiz');
  const label = isQuiz ? 'Quiz' : 'Games';
  const desc = isQuiz
    ? 'Kuis interaktif sedang disiapkan. Nantikan segera!'
    : 'Koleksi games sedang disiapkan. Nantikan segera!';

  const page = createEl('div', { class: 'coming-soon' });

  const card = createEl('div', { class: 'coming-soon__card' });
  card.appendChild(createEl('div', { class: 'coming-soon__emoji' }, ['🚧']));
  card.appendChild(createEl('h1', {}, [label]));
  card.appendChild(createEl('p', {}, [desc]));

  const back = createEl('button', { class: 'btn btn--secondary' }, ['Kembali ke Beranda']);
  back.addEventListener('click', () => navigate('/'));
  card.appendChild(back);

  page.appendChild(card);
  return page;
}
