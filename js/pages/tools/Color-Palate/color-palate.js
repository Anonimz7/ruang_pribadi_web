/* pages/tools/color-palate-2/color-palate.js — 72 Warna Faber-Castell Oil Pastel
 * Konversi dari tools/Color-Palate/index.html (halaman statis 72 warna) ke module SPA. */
import { createEl } from '../../../utils/dom.js';

// [nama, hexa] — diekstrak langsung dari index.html asli (3 section x 24 warna)
const SECTIONS = [
  {
    title: 'Warna Inti (Kemungkinan Set 12/18/24 Warna & ke bawah)',
    colors: [
      ['White', '#FFFFFF'], ['Lemon Yellow', '#FFF700'], ['Light Yellow', '#FFF978'], ['Orange Yellow', '#FFDC00'],
      ['Cream', '#FFF2CC'], ['Yellow Ochre', '#C8A02F'], ['Orange', '#FF8A00'], ['Light Orange', '#FFBB6B'],
      ['Vermilion', '#FF5A00'], ['Red', '#FF0000'], ['Dark Red', '#C80000'], ['Rose Pink', '#FF6B8B'],
      ['Pink', '#FFC0CB'], ['Light Pink', '#FFDFE8'], ['Magenta', '#FF00FF'], ['Lavender', '#CC66FF'],
      ['Violet', '#8A2BE2'], ['Purple', '#800080'], ['Dark Violet', '#580080'], ['Light Blue', '#8BEBFF'],
      ['Sky Blue', '#00BFFF'], ['Cerulean Blue', '#007FFF'], ['Cobalt Blue', '#004FFF'], ['Ultramarine', '#0000FF'],
    ],
  },
  {
    title: 'Tambahan untuk Set 36/48 Warna',
    colors: [
      ['Prussian Blue', '#000080'], ['Turquoise', '#00D0D0'], ['Emerald Green', '#00B000'], ['Light Green', '#80FF80'],
      ['Grass Green', '#008000'], ['Dark Green', '#004000'], ['Olive Green', '#6B8E23'], ['Yellow Green', '#9ACD32'],
      ['Lime Green', '#BFD600'], ['Green', '#008000'], ['Teal', '#008080'], ['Light Brown', '#AA6600'],
      ['Brown', '#8B4513'], ['Dark Brown', '#5A2C00'], ['Burnt Sienna', '#E97451'], ['Raw Umber', '#734A12'],
      ['Sepia', '#704214'], ['Grey', '#808080'], ['Dark Grey', '#404040'], ['Light Grey', '#C0C0C0'],
      ['Silver', '#C0C0C0'], ['Gold', '#D4AF37'], ['Black', '#000000'], ['Fluorescent Pink', '#FF69B4'],
    ],
  },
  {
    title: 'Tambahan untuk Set 60/72 Warna',
    colors: [
      ['Pale Yellow', '#FFFEC6'], ['Deep Yellow', '#FFCC00'], ['Naples Yellow', '#FFDA80'], ['Apricot', '#FBCEB1'],
      ['Light Peach', '#FFDAB9'], ['Salmon Pink', '#FA8072'], ['Scarlet', '#FF2400'], ['Crimson', '#DC143C'],
      ['Wine Red', '#722F37'], ['Rose Madder', '#E3256B'], ['Plum', '#8E4585'], ['Indigo', '#4B0082'],
      ['Cerulean Blue Hue', '#007BA7'], ['Peacock Blue', '#33A1C9'], ['Viridian Hue', '#40826D'], ['Sap Green', '#507D2A'],
      ['Forest Green', '#228B22'], ['Light Olive Green', '#B4BF96'], ['Khaki', '#C3B091'], ['Raw Sienna', '#D27D46'],
      ['Vandyke Brown', '#664228'], ['Warm Grey', '#8C7B76'], ['Cool Grey', '#808A87'], ["Payne's Grey", '#536878'],
    ],
  },
];

export function render() {
  const page = createEl('div', { class: 'cp-page' });

  const style = document.createElement('style');
  style.textContent = `
    .cp-page { padding: var(--s-2) 0; max-width: 1080px; margin: 0 auto; }
    .cp-page__title { font-size: var(--text-md); color: var(--c-primary); text-align: center; margin: 0 0 var(--s-3); }
    .cp-note {
      background: var(--c-surface-2); border-left: 4px solid var(--c-primary);
      padding: var(--s-3); border-radius: var(--radius); margin-bottom: var(--s-5);
      font-size: var(--text-sm); color: var(--c-text-2);
    }
    .cp-section { margin-bottom: var(--s-6); }
    .cp-section h2 { font-size: var(--text-base); color: var(--c-primary); border-bottom: 1px solid var(--c-border); padding-bottom: var(--s-2); margin: 0 0 var(--s-3); }
    .cp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: var(--s-3); }
    .cp-item { border: 1px solid var(--c-border); border-radius: var(--radius); overflow: hidden; text-align: center; transition: transform 0.15s; }
    .cp-item:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
    .cp-swatch { height: 56px; border-bottom: 1px solid var(--c-border); }
    .cp-info { padding: var(--s-2); font-size: var(--text-xs); color: var(--c-text-2); word-break: break-word; }
    .cp-info strong { display: block; color: var(--c-text); font-size: var(--text-xs); margin-bottom: 2px; }
  `;
  page.appendChild(style);

  page.appendChild(createEl('h1', { class: 'cp-page__title' }, ['Daftar 72 Warna Faber-Castell Oil Pastel']));
  page.appendChild(createEl('div', { class: 'cp-note' }, [
    'Catatan: Representasi warna dalam kode heksadesimal ini adalah perkiraan digital yang mendekati warna asli krayon. Warna mungkin sedikit bervariasi tergantung pada layar monitor. Pembagian ke dalam set adalah asumsi umum penambahan warna oleh produsen.',
  ]));

  for (const sec of SECTIONS) {
    const group = createEl('section', { class: 'cp-section' });
    group.appendChild(createEl('h2', {}, [sec.title]));

    const grid = createEl('div', { class: 'cp-grid' });
    for (const [name, hex] of sec.colors) {
      const item = createEl('div', { class: 'cp-item' });
      const swatch = createEl('div', { class: 'cp-swatch', style: { backgroundColor: hex } });
      const info = createEl('div', { class: 'cp-info' });
      info.appendChild(createEl('strong', {}, [name]));
      info.appendChild(document.createTextNode(hex));
      item.append(swatch, info);
      grid.appendChild(item);
    }
    group.appendChild(grid);
    page.appendChild(group);
  }

  return page;
}