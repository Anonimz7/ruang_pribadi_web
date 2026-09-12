/* pages/saham/hub.js — Hub portal Saham (setara halaman /tools).
 * Menampilkan kartu pilihan fitur portal (market + admin) yang diizinkan
 * tier user saat ini. Klik kartu -> navigate ke route fitur. */
import { store, subscribe } from '../../core/state.js';
import { Auth } from '../../core/auth.js';
import { navigate } from '../../core/router.js';
import { createEl } from '../../utils/dom.js';
import { icons } from '../../ui/icons.js';
import { fetchMenuConfig, ROUTE_MAP } from '../../core/menu-config.js';

export function render() {
  const page = createEl('div', { class: 'saham-hub' });

  const header = createEl('div', { class: 'page-head' });
  header.appendChild(createEl('h1', {}, ['Saham']));
  header.appendChild(createEl('p', { class: 'page-head__sub' }, ['Portal pasar IDX — pilih fitur untuk memulai.']));
  page.appendChild(header);

  const content = createEl('div', { class: 'saham-hub__content' });
  page.appendChild(content);

  function renderGroups(menu) {
    content.innerHTML = '';

    const labels = { market: 'Market', admin: 'Admin' };
    const groups = [];

    for (const sec of ['market', 'admin']) {
      let items = menu.filter((a) => a.portal === 'saham' && a.section === sec);
      if (sec === 'admin') {
        if (!Auth.isAdmin()) continue;
        items = items.filter((a) => Auth.canAccess(a.key, a.minTier));
      } else {
        items = items.filter((a) => Auth.canAccess(a.key, a.minTier));
      }
      if (items.length === 0) continue;
      groups.push({ label: labels[sec] || sec, items });
    }

    if (groups.length === 0) {
      content.appendChild(createEl('p', { class: 'empty' },
        ['Tidak ada fitur Saham yang dapat diakses untuk tier Anda.']));
      return;
    }

    groups.forEach((group) => {
      const secLabel = createEl('div', { class: 'saham-hub__section' }, [group.label]);
      content.appendChild(secLabel);

      const grid = createEl('div', { class: 'tool-grid' });
      group.items.forEach((app) => {
        const card = createEl('button', { class: 'tool-card' }, []);
        card.type = 'button';

        const icon = createEl('span', { class: 'tool-card__icon' });
        icon.innerHTML = icons[app.icon] || icons['help-circle'] || '';
        card.appendChild(icon);

        const body = createEl('span', { class: 'tool-card__body' }, []);
        body.appendChild(createEl('span', { class: 'tool-card__label' }, [app.label]));
        card.appendChild(body);

        card.addEventListener('click', () => navigate(ROUTE_MAP[app.key] || '/saham'));
        grid.appendChild(card);
      });

      content.appendChild(grid);
    });
  }

  const load = () => {
    fetchMenuConfig()
      .then(renderGroups)
      .catch(() => renderGroups([]));
  };
  load();

  const unsubs = ['token', 'tier', 'rank'].map((k) => subscribe(k, load));
  page._cleanup = () => unsubs.forEach((u) => u());

  return page;
}