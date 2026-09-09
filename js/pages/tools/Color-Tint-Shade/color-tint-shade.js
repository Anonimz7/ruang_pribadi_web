/* pages/tools/color-tint-shade-2/color-tint-shade.js — Color Generator + Palette Mixer
 * Konversi dari tools/Color-Tint-Shade/index.html ke module SPA.
 * Partikel background dihilangkan; dark mode mengikuti tema app (CSS vars). */
import { createEl } from '../../../utils/dom.js';

const CSS = `
  .cts-page { max-width: 1200px; margin: 0 auto; padding: var(--s-2); text-align: center; }
  .cts-title { color: var(--c-primary); margin: 0 0 var(--s-1); font-size: var(--text-lg); }
  .cts-sub { color: var(--c-text-2); margin: 0 0 var(--s-4); }
  .cts-controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-4); margin-bottom: var(--s-5); padding: var(--s-4); border-radius: var(--radius); background: var(--c-surface-2); box-shadow: var(--shadow); }
  .cts-group { display: flex; flex-direction: column; align-items: center; padding: var(--s-3); border: 1px solid var(--c-border); border-radius: var(--radius); gap: var(--s-2); }
  .cts-row { display: flex; align-items: center; gap: 10px; width: 100%; justify-content: center; }
  .cts-group label { font-weight: 600; color: var(--c-text); }
  .cts-group small { color: var(--c-text-2); }
  input[type="color"].cts-picker { width: 50px; height: 50px; border: 2px solid var(--c-border); border-radius: 8px; cursor: pointer; padding: 0; background: none; }
  input[type="text"].cts-hex { padding: 10px; border: 1px solid var(--c-border); border-radius: 8px; font-size: 1em; width: 86px; text-align: center; outline: none; background: var(--c-surface); color: var(--c-text); }
  input[type="range"].cts-range { width: 100%; max-width: 160px; accent-color: var(--c-primary); }
  .cts-value { font-weight: bold; color: var(--c-primary); min-width: 40px; text-align: left; }
  .cts-wide { grid-column: 1 / -1; }
  .cts-range-wide { width: 80% !important; max-width: none !important; }
  .cts-palette { display: flex; flex-wrap: wrap; justify-content: flex-start; align-items: flex-start; margin-top: var(--s-5); border-radius: var(--radius); overflow: hidden; border: 1px solid var(--c-border); }
  .cts-box { width: calc(100% / 12); min-width: 70px; flex-grow: 1; flex-shrink: 0; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 8px; font-size: .85em; text-shadow: 0 1px 3px rgba(0,0,0,.4); cursor: pointer; transition: transform .1s; box-sizing: border-box; user-select: none; border-right: 1px solid rgba(255,255,255,.1); border-bottom: 1px solid rgba(255,255,255,.1); }
  .cts-box:hover { transform: scale(1.05); box-shadow: 0 5px 15px rgba(0,0,0,.2); z-index: 10; }
  .cts-box[draggable="true"] { cursor: grab; }
  .cts-box.dragging { opacity: .4; transform: scale(.95); cursor: grabbing; }
  .cts-notif { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--c-success, #2ecc71); color: #fff; padding: 10px 20px; border-radius: 5px; box-shadow: var(--shadow); opacity: 0; visibility: hidden; transition: opacity .3s, visibility .3s; z-index: 1000; }
  .cts-notif.show { opacity: 1; visibility: visible; }
  @media (max-width: 900px) {
    .cts-controls { grid-template-columns: 1fr 1fr; } .cts-wide { grid-column: 1 / -1; }
    .cts-box { width: calc(100% / 8); min-width: unset; height: 100px; }
  }
  @media (max-width: 600px) {
    .cts-controls { grid-template-columns: 1fr; } .cts-box { width: calc(100% / 4); min-width: unset; height: 80px; font-size: .65em; }
  }
`;

// --- Color Conversion Helpers (dari source asli) ---
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function hexToRgb(hex) {
  if (hex.charAt(0) !== '#') hex = '#' + hex;
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  const bigint = parseInt(hex.slice(1), 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function getContrastTextColor(hexColor) {
  const [r, g, b] = hexToRgb(hexColor);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? 'black' : 'white';
}

export function render() {
  const page = createEl('div', { class: 'cts-page' });

  const style = document.createElement('style');
  style.textContent = CSS;
  page.appendChild(style);

  const notification = createEl('div', { class: 'cts-notif' });
  page.appendChild(notification);

  let draggedElement = null;

  // --- BUILD CONTROLS ---
  page.appendChild(createEl('h1', { class: 'cts-title' }, ['Color Pallete Mixer']));
  page.appendChild(createEl('p', { class: 'cts-sub' }, ['Geser Hue Shifter untuk langsung mengubah warna dasar dan palet. Default 12 kotak.']));

  const controls = createEl('div', { class: 'cts-controls' });

  // Group 1: Warna Dasar
  const g1 = createEl('div', { class: 'cts-group' });
  g1.appendChild(createEl('label', {}, ['Warna Dasar']));
  const row1 = createEl('div', { class: 'cts-row' });
  const baseColorPicker = document.createElement('input');
  baseColorPicker.type = 'color';
  baseColorPicker.className = 'cts-picker';
  baseColorPicker.value = '#3498DB';
  const baseColorHex = document.createElement('input');
  baseColorHex.type = 'text';
  baseColorHex.className = 'cts-hex';
  baseColorHex.value = '#3498DB';
  baseColorHex.placeholder = '#RRGGBB';
  row1.append(baseColorPicker, baseColorHex);
  g1.appendChild(row1);
  controls.appendChild(g1);

  // Group 2: Weight
  const g2 = createEl('div', { class: 'cts-group' });
  g2.appendChild(createEl('label', {}, ['Kekuatan Langkah (Weight)']));
  const row2 = createEl('div', { class: 'cts-row' });
  row2.appendChild(createEl('span', {}, ['Halus']));
  const weightSlider = document.createElement('input');
  weightSlider.type = 'range';
  weightSlider.className = 'cts-range';
  weightSlider.min = '1'; weightSlider.max = '10'; weightSlider.value = '5';
  const weightValue = createEl('span', { class: 'cts-value' }, ['5']);
  row2.append(weightSlider, weightValue, createEl('span', {}, ['Ekstrim']));
  g2.appendChild(row2);
  controls.appendChild(g2);

  // Group 3: Total Kotak
  const g3 = createEl('div', { class: 'cts-group' });
  g3.appendChild(createEl('label', {}, ['Total Kotak Palet (Genap)']));
  const row3 = createEl('div', { class: 'cts-row' });
  row3.appendChild(createEl('span', {}, ['2']));
  const stepsSlider = document.createElement('input');
  stepsSlider.type = 'range';
  stepsSlider.className = 'cts-range';
  stepsSlider.min = '2'; stepsSlider.max = '36'; stepsSlider.step = '2'; stepsSlider.value = '12';
  const totalBoxes = createEl('span', { class: 'cts-value' }, ['12']);
  row3.append(stepsSlider, totalBoxes, createEl('span', {}, ['36']));
  g3.appendChild(row3);
  g3.appendChild(createEl('small', {}, ['(Contoh: 12 kotak = 6 Shade + 6 Tint)']));
  controls.appendChild(g3);

  // Group 4 (wide): Hue Shifter
  const g4 = createEl('div', { class: 'cts-group cts-wide' });
  g4.appendChild(createEl('label', {}, ['Geser Nada Warna (Hue Shifter)']));
  const row4 = createEl('div', { class: 'cts-row' });
  const hueSlider = document.createElement('input');
  hueSlider.type = 'range';
  hueSlider.className = 'cts-range cts-range-wide';
  hueSlider.min = '0'; hueSlider.max = '360'; hueSlider.value = '204';
  const hueValue = createEl('span', { class: 'cts-value' }, ['204°']);
  row4.append(hueSlider, hueValue);
  g4.appendChild(row4);
  controls.appendChild(g4);

  page.appendChild(controls);

  // Palette container
  const paletteContainer = createEl('div', { class: 'cts-palette' });
  page.appendChild(paletteContainer);

  // --- FUNCTIONS ---
  function showNotification(message) {
    notification.textContent = message;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 2000);
  }

  function addDragAndDropListeners(element) {
    element.setAttribute('draggable', 'true');
    element.addEventListener('dragstart', (e) => {
      draggedElement = element;
      e.dataTransfer.setData('text/plain', 'dragging');
      setTimeout(() => element.classList.add('dragging'), 0);
    });
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedElement && draggedElement !== element && element.parentNode === draggedElement.parentNode) {
        const rect = element.getBoundingClientRect();
        const isLeft = e.clientX < rect.left + rect.width / 2;
        paletteContainer.querySelectorAll('.cts-box').forEach((box) => box.classList.remove('drop-left', 'drop-right'));
        element.classList.add(isLeft ? 'drop-left' : 'drop-right');
      }
    });
    element.addEventListener('drop', (e) => {
      e.preventDefault();
      element.classList.remove('drop-left', 'drop-right');
      if (draggedElement && draggedElement !== element) {
        const rect = element.getBoundingClientRect();
        const isLeft = e.clientX < rect.left + rect.width / 2;
        if (isLeft) paletteContainer.insertBefore(draggedElement, element);
        else paletteContainer.insertBefore(draggedElement, element.nextSibling);
      }
    });
    element.addEventListener('dragend', () => {
      paletteContainer.querySelectorAll('.cts-box').forEach((box) => box.classList.remove('dragging', 'drop-left', 'drop-right'));
      draggedElement = null;
    });
  }

  function createColorBox(hexColor) {
    const box = document.createElement('div');
    box.className = 'cts-box';
    box.style.backgroundColor = hexColor;
    box.textContent = hexColor;
    box.dataset.color = hexColor;
    box.style.color = getContrastTextColor(hexColor);
    addDragAndDropListeners(box);
    box.addEventListener('click', () => {
      navigator.clipboard.writeText(hexColor)
        .then(() => showNotification(`Copied: ${hexColor}`))
        .catch(() => {});
    });
    return box;
  }

  function generatePalette(baseColorHexValue, currentHue, weight, steps) {
    if (!/^#([0-9A-F]{3}([0-9A-F]{3})?)$/i.test(baseColorHexValue)) {
      paletteContainer.innerHTML = '<p style="color:var(--c-text-2);">Input Hex tidak valid.</p>';
      return;
    }
    const [r, g, b] = hexToRgb(baseColorHexValue);
    let [h, s, l] = rgbToHsl(r, g, b);
    if (currentHue !== null) h = parseInt(currentHue, 10);
    else hueSlider.value = h;

    const calculationHue = h % 360;
    hueValue.textContent = `${h}°`;
    paletteContainer.innerHTML = '';

    const numSteps = steps / 2;
    const weightFactor = weight / 5;
    const shadeStep = (l / (numSteps + 1)) * weightFactor;
    const tintStep = ((100 - l) / (numSteps + 1)) * weightFactor;
    const boxes = [];

    for (let i = numSteps; i >= 1; i--) {
      const shadeL = Math.max(0, l - (shadeStep * i));
      const [sr, sg, sb] = hslToRgb(calculationHue, s, shadeL);
      boxes.push(createColorBox(rgbToHex(sr, sg, sb)));
    }
    for (let i = 1; i <= numSteps; i++) {
      const tintL = Math.min(100, l + (tintStep * i));
      const [tr, tg, tb] = hslToRgb(calculationHue, s, tintL);
      boxes.push(createColorBox(rgbToHex(tr, tg, tb)));
    }
    boxes.forEach((box) => paletteContainer.appendChild(box));
  }

  // --- SYNC LOGIC (dua arah) ---
  const updateHexFromPicker = () => {
    const hex = baseColorPicker.value.toUpperCase();
    baseColorHex.value = hex;
    synchronizeControlsFromHex();
  };

  const synchronizeControlsFromHex = () => {
    let hex = baseColorHex.value.toUpperCase();
    if (hex.charAt(0) !== '#') hex = '#' + hex;
    if (!/^#([0-9A-F]{3}|[0-9A-F]{6})$/.test(hex)) return;
    baseColorPicker.value = hex;
    baseColorHex.value = hex;
    const [r, g, b] = hexToRgb(hex);
    const [h] = rgbToHsl(r, g, b);
    hueSlider.value = h;
    regenerate();
  };

  const updateBaseColorFromHue = () => {
    const newH = parseInt(hueSlider.value, 10);
    const hex = baseColorPicker.value;
    if (!/^#([0-9A-F]{3}([0-9A-F]{3})?)$/i.test(hex)) return;
    const [r, g, b] = hexToRgb(hex);
    const [, s, l] = rgbToHsl(r, g, b);
    const [nr, ng, nb] = hslToRgb(newH % 360, s, l);
    const newHex = rgbToHex(nr, ng, nb);
    baseColorPicker.value = newHex;
    baseColorHex.value = newHex;
    regenerate();
  };

  const regenerate = () => {
    const hex = baseColorPicker.value;
    const hue = hueSlider.value;
    const weight = parseInt(weightSlider.value, 10);
    const steps = parseInt(stepsSlider.value, 10);
    totalBoxes.textContent = steps;
    generatePalette(hex, hue, weight, steps);
  };

  // --- WIRE EVENTS ---
  baseColorPicker.addEventListener('input', updateHexFromPicker);
  baseColorHex.addEventListener('keyup', synchronizeControlsFromHex);
  baseColorHex.addEventListener('change', synchronizeControlsFromHex);
  hueSlider.addEventListener('input', updateBaseColorFromHue);
  weightSlider.addEventListener('input', () => { weightValue.textContent = weightSlider.value; regenerate(); });
  stepsSlider.addEventListener('input', () => { totalBoxes.textContent = stepsSlider.value; regenerate(); });

  // Init
  synchronizeControlsFromHex();

  return page;
}