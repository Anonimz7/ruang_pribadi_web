/* pages/gacha.js — Gacha Luck (Roulette Wheel) — konsisten dengan rolling.js */
import { createEl } from '../utils/dom.js';

// ═══════════════════════════════════════════════════════
// KONFIGURASI — Mencerminkan gacha_luck/gacha_screen.dart & roulette_ticker.dart
// ═══════════════════════════════════════════════════════
const LUCK_TIERS = [
  { key: 'veryUnlucky', name: 'Sangat Sial',        color: '#8B0000', icon: '😈', chance: 5 },
  { key: 'unlucky',     name: 'Sial',              color: '#E67E22', icon: '😞', chance: 25 },
  { key: 'normal',      name: 'Normal',            color: '#7F8C8D', icon: '😐', chance: 40 },
  { key: 'lucky',       name: 'Beruntung',         color: '#2ECC71', icon: '😊', chance: 25 },
  { key: 'veryLucky',   name: 'Sangat Beruntung',  color: '#F1C40F', icon: '🌟', chance: 5 },
];

const LUCK_MESSAGES = {
  veryUnlucky: ['Hati-hati! Hari ini bukan harimu. Jangan ambil keputusan besar.', 'Sial! Keberuntungan sedang menjauh.', 'Awas! Jalan licin menunggu.'],
  unlucky:     ['Hari ini agak kurang beruntung.', 'Sial ringan. Jangan beli lotre.', 'Ada yang tak berjalan mulus. Tetap tenang.'],
  normal:      ['Hari biasa, keberuntungan biasa.', 'Tidak istimewat, tidak buruk.', 'Normal saja. Cocok untuk rutinitas.'],
  lucky:       ['Hari ini hoki! Manfaatkan momentum.', 'Keberuntungan berpihak padamu.', 'Beruntung! Coba hal baru.'],
  veryLucky:   ['JACKPOT! Hari paling beruntungmu!', 'Sangat beruntung! Coba lotre!', 'Keberuntungan besar menghampirimu.'],
};

const STORAGE_KEY = 'gacha_history';

const SECTOR_COUNT = LUCK_TIERS.length;
const SECTOR_ANGLE = 360 / SECTOR_COUNT;
const SPIN_TIME_MIN = 10;
const SPIN_TIME_MAX = 30;
const MAX_SPEED = 100;
const SPEED_SCALE = 8;
const V0_MIN_FACTOR = 0.95;
const V0_MAX_FACTOR = 1.00;

const K_STIFFNESS = 120;
const K_DAMPING = 8;
const K_MIN_KICK = 2.2;
const K_SPEED_KICK = 0.35;
const K_MAX_AMPLITUDE = 0.6;

const HAPTIC_AVAILABLE = 'vibrate' in navigator;
let audioPoolCtx = null;
let audioReady = false;
let lastPegIndex = -1;
let pegCount = SECTOR_COUNT;

let needleAngle = 0;
let needleOmega = 0;
let lastElapsed = 0;

let spinning = false;
let result = null;
let spinDuration = 0;
let spinStartTime = 0;
let totalAngle = 0;
let v0Final = 0;

let wheelEl, innerWheelEl, needleEl, goBtnEl, resultPlaceholderEl;
let animationFrameId = null;

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveHistory(hist) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hist));
}

function loadStats() {
  const hist = loadHistory();
  const stats = {};
  LUCK_TIERS.forEach(t => { stats[t.key] = 0; });
  hist.forEach(r => { stats[r.result] = (stats[r.result] || 0) + 1; });
  return stats;
}

function randomMessage(tier) {
  const messages = LUCK_MESSAGES[tier.key];
  return messages[Math.floor(Math.random() * messages.length)];
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s lalu`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m lalu`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h lalu`;
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ═══════════════════════════════════════════════════════
// ROULETTE TICKER
// ═══════════════════════════════════════════════════════
function loadAudio() {
  if (audioReady) return;
  try {
    audioPoolCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioReady = true;
  } catch (e) {
    audioReady = false;
    console.warn('RollingTicker: Failed to init audio', e);
  }
}

function playTick(intensity) {
  if (!audioReady || !audioPoolCtx) return;
  try {
    const ctx = audioPoolCtx;
    const source = ctx.createBufferSource();
    const bufferSize = ctx.sampleRate * 0.02;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2) * (0.3 + intensity * 0.2);
    }
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.1 + intensity * 0.2;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    source.stop(ctx.currentTime + 0.05);
  } catch (e) {}
}

function triggerHaptic() {
  if (!HAPTIC_AVAILABLE) return;
  try { navigator.vibrate([5, 5, 5]); } catch (e) {}
}

function updateTicker(currentAngle, angularVelocity) {
  if (angularVelocity < 10) return;
  const normalizedAngle = ((currentAngle % 360) + 360) % 360;
  const needleAngleDeg = 270.0;
  const passed = (((needleAngleDeg - normalizedAngle) % 360) + 360) % 360;
  const currentPegIndex = Math.floor(passed / (360 / pegCount)) % pegCount;
  if (currentPegIndex !== lastPegIndex && lastPegIndex >= 0) {
    const intensity = angularVelocity / 100;
    playTick(intensity);
    triggerHaptic();
    needleOmega -= (K_MIN_KICK + intensity * K_SPEED_KICK);
  }
  lastPegIndex = currentPegIndex;
}

function resetTicker() {
  lastPegIndex = -1;
}

// ═══════════════════════════════════════════════════════
// HASIL DARI SUDUT
// ═══════════════════════════════════════════════════════
function getSectorFromAngle(angleDeg) {
  const normalized = ((angleDeg % 360) + 360) % 360;
  const sectorIndex = Math.floor((((270 - normalized) % 360 + 360) % 360) / SECTOR_ANGLE) % SECTOR_COUNT;
  return LUCK_TIERS[sectorIndex];
}

// ═══════════════════════════════════════════════════════
// BUILD SVG ELEMENTS — Konsisten dengan rolling.js
// ═══════════════════════════════════════════════════════
function buildWheelSVG() {
  const size = 260;
  const center = size / 2;
  const radius = 118;
  const labelRadius = radius * 0.55;
  const pegRadius = radius * 0.8;

  const slices = [];
  for (let i = 0; i < SECTOR_COUNT; i++) {
    const tier = LUCK_TIERS[i];
    const startAngle = i * SECTOR_ANGLE * Math.PI / 180;
    const endAngle = (i + 1) * SECTOR_ANGLE * Math.PI / 180;
    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x3 = center + radius * Math.cos(endAngle);
    const y3 = center + radius * Math.sin(endAngle);
    const largeArc = SECTOR_ANGLE > 180 ? 1 : 0;

    slices.push(`
      <path d="M${center},${center} L${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x3},${y3} Z"
            fill="${tier.color}" stroke="#000" stroke-width="1.5" opacity="0.9"/>
    `);

    const midAngle = (startAngle + endAngle) / 2;
    const lx = center + labelRadius * Math.cos(midAngle);
    const ly = center + (labelRadius * Math.sin(midAngle)) + 5;
    slices.push(`
      <text x="${lx}" y="${ly}" text-anchor="middle" fill="white" font-size="12" font-weight="bold">
        ${tier.icon}
      </text>
    `);
    slices.push(`
      <text x="${lx}" y="${ly + 18}" text-anchor="middle" fill="white" font-size="10" font-weight="bold">
        ${tier.name}
      </text>
    `);
  }

  // Garis antar sektor
  for (let i = 0; i < SECTOR_COUNT; i++) {
    const angle = i * SECTOR_ANGLE * Math.PI / 180;
    slices.push(`
      <line x1="${center}" y1="${center}" x2="${center + radius * Math.cos(angle)}" y2="${center + radius * Math.sin(angle)}" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
    `);
  }

  // Paku
  for (let i = 0; i <= SECTOR_COUNT; i++) {
    const angle = i * (360 / SECTOR_COUNT) * Math.PI / 180;
    const px = center + pegRadius * Math.cos(angle);
    const py = center + pegRadius * Math.sin(angle);
    slices.push(`
      <circle cx="${px}" cy="${py}" r="4" fill="url(#pegGradientGacha)" />
      <circle cx="${px - 1.5}" cy="${py - 1.5}" r="1.5" fill="rgba(255,255,255,0.6)"/>
    `);
  }

  // Border luar
  slices.push(`<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="white" stroke-width="5"/>`);
  slices.push(`<circle cx="${center}" cy="${center}" r="${radius * 0.92}" fill="rgba(0,0,0,0.2)"/>`);

  return `
    <svg class="gacha-svg-wheel" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <radialGradient id="pegGradientGacha" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#aaaaaa"/>
          <stop offset="70%" stop-color="#666666"/>
          <stop offset="100%" stop-color="#333333"/>
        </radialGradient>
      </defs>
      <circle cx="${center}" cy="${center}" r="${radius * 0.95}" fill="rgba(0,0,0,0.1)"/>
      ${slices.join('')}
    </svg>
  `;
}

function buildNeedleSVG(tier) {
  const color = tier ? tier.color : '#E74C3C';
  const w = 26;
  const h = 54;
  return `
    <svg class="gacha-svg-needle" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <filter id="needle-shadow-gacha" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.5)"/>
        </filter>
      </defs>
      <path d="M${w/2},${h} L${w*0.06},0 L${w*0.94},0 Z" fill="${color}" filter="url(#needle-shadow-gacha)"/>
      <circle cx="${w/2}" cy="0" r="${w*0.16}" fill="white"/>
      <circle cx="${w/2}" cy="0" r="${w*0.10}" fill="${color}"/>
    </svg>
  `;
}

function buildResultCard(tier) {
  const message = randomMessage(tier);
  const resultDiv = createEl('div', {
    class: 'gacha-result-card',
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      padding: '16px',
      borderRadius: '12px',
      background: `${tier.color}15`,
      border: `1px solid ${tier.color}40`,
    }
  });
  resultDiv.innerHTML = `
    <div style="width:40px;height:40px;border-radius:50%;background:${tier.color};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;color:white;">
      ${tier.icon}
    </div>
    <div style="font-size:24px;font-weight:700;color:${tier.color};">${tier.name}</div>
    <div style="font-size:14px;color:var(--c-text-2);text-align:center;">
      ${message.replace(/\n/g, '<br>')}
    </div>
    <div style="font-size:12px;color:var(--c-text-3);margin-top:4px;">
      Probabilitas: ${tier.chance}%
    </div>
  `;
  return resultDiv;
}

// ═══════════════════════════════════════════════════════
// ANIMASI & STATE
// ═══════════════════════════════════════════════════════
function startSpin() {
  if (spinning) return;
  if (!audioReady) loadAudio();

  const target = rollLuck();
  const index = LUCK_TIERS.indexOf(target);
  const tierCenter = SECTOR_ANGLE * index + SECTOR_ANGLE / 2;
  const jitter = Math.random() * SECTOR_ANGLE * 0.6 - SECTOR_ANGLE * 0.3;

  let targetAngle = 270 - tierCenter - jitter;
  targetAngle = ((targetAngle % 360) + 360) % 360;

  const T = SPIN_TIME_MIN + Math.random() * (SPIN_TIME_MAX - SPIN_TIME_MIN);
  const v0 = MAX_SPEED * (V0_MIN_FACTOR + Math.random() * (V0_MAX_FACTOR - V0_MIN_FACTOR)) * SPEED_SCALE;
  const rotations = Math.floor((v0 * T / 2) / 360);
  totalAngle = rotations * 360 + targetAngle;
  v0Final = 2 * totalAngle / T;

  spinning = true;
  result = null;
  spinDuration = T;
  spinStartTime = performance.now();
  needleAngle = 0;
  needleOmega = 0;
  lastElapsed = spinStartTime;
  resetTicker();

  if (resultPlaceholderEl) resultPlaceholderEl.style.display = 'none';
  if (goBtnEl) { goBtnEl.style.opacity = '0.4'; goBtnEl.style.pointerEvents = 'none'; }

  // Reset transform
  if (wheelEl) { wheelEl.style.transition = 'none'; wheelEl.style.transform = 'rotate(0deg)'; }
  if (innerWheelEl) { innerWheelEl.style.transform = 'rotate(0deg)'; }
  if (needleEl) { needleEl.style.transition = 'none'; needleEl.style.transform = 'translateX(-50%) rotate(0rad)'; }

  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(animateSpin);
}

function animateSpin(timestamp) {
  if (!spinning) { animationFrameId = null; return; }
  const elapsed = (timestamp - spinStartTime) / 1000;
  if (elapsed >= spinDuration) { finishSpin(); return; }

  const currentAngle = v0Final * elapsed * (1 - elapsed / (2 * spinDuration));
  const angularVelocity = Math.abs(v0Final * (1 - elapsed / spinDuration));

  if (wheelEl) wheelEl.style.transform = `rotate(${currentAngle}deg)`;
  updateTicker(currentAngle, angularVelocity);

  const now = timestamp;
  const dt = (now - lastElapsed) / 1000;
  lastElapsed = now;
  if (dt > 0 && dt <= 0.1) {
    const accel = -K_STIFFNESS * needleAngle - K_DAMPING * needleOmega;
    needleOmega += accel * dt;
    needleAngle = clamp(needleAngle + needleOmega * dt, -K_MAX_AMPLITUDE, K_MAX_AMPLITUDE);
    if (needleEl) needleEl.style.transform = `translateX(-50%) rotate(${needleAngle}rad)`;
  }

  animationFrameId = requestAnimationFrame(animateSpin);
}

function finishSpin() {
  spinning = false;
  // Gunakan totalAngle absolut — roda sudah di-reset ke 0 di startSpin
  result = getSectorFromAngle(totalAngle);
  needleAngle = 0;
  needleOmega = 0;

  // Roda tetap posisi akhiri — flush transform
  if (wheelEl) {
    wheelEl.style.transition = 'none';
    wheelEl.style.transform = `rotate(${totalAngle}deg)`;
  }
  if (needleEl) {
    needleEl.style.transition = 'transform 0.5s ease-out';
    needleEl.style.transform = 'translateX(-50%) rotate(0rad)';
    needleEl.innerHTML = buildNeedleSVG(result);
  }
  if (goBtnEl) { goBtnEl.style.opacity = '1'; goBtnEl.style.pointerEvents = 'auto'; }

  // Tampilkan hasil
  const placeholder = resultPlaceholderEl;
  if (placeholder) {
    placeholder.innerHTML = '';
    placeholder.appendChild(buildResultCard(result));
  }

  // Simpan riwayat
  const history = loadHistory();
  history.unshift({ result: result.key, time: Date.now(), message: randomMessage(result) });
  if (history.length > 30) history.splice(30);
  saveHistory(history);

  updateStats();
}

function rollLuck() {
  const r = Math.random() * 100;
  let acc = 0;
  for (const t of LUCK_TIERS) {
    acc += t.chance;
    if (r < acc) return t;
  }
  return LUCK_TIERS[LUCK_TIERS.length - 1];
}

function updateStats() {
  const stats = loadStats();
  LUCK_TIERS.forEach(t => {
    const el = document.querySelector(`[data-stat="${t.key}"] .stat-value`);
    if (el) el.textContent = (stats[t.key] || 0).toString();
  });
}

function resetHistory() {
  if (confirm('Reset riwayat gacha?')) {
    localStorage.removeItem(STORAGE_KEY);
    updateStats();
  }
}

// ═══════════════════════════════════════════════════════
// MAIN RENDER — konsisten dengan rolling.js
// ═══════════════════════════════════════════════════════
export function render() {
  const container = createEl('div', { class: 'gacha-page' });

  // Header
  container.appendChild(createEl('div', { class: 'gacha-header' }, [
    createEl('h1', { class: 'gacha-title' }, ['Gacha Luck']),
    createEl('p', { class: 'gacha-subtitle' }, [
      'Putar roda untuk melihat keberuntunganmu hari ini!'
    ]),
  ]));

  // Main roulette table
  const rouletteTable = createEl('div', { class: 'gacha-roulette-table' });

  // Build wheel with inner rotating element
  innerWheelEl = createEl('div', { class: 'gacha-wheel-inner' }, []);
  innerWheelEl.innerHTML = buildWheelSVG();

  wheelEl = createEl('div', { class: 'gacha-wheel-outer' }, [innerWheelEl]);

  // Container relatif untuk wheel + needle + GO button
  const wheelWrapper = createEl('div', {
    class: 'gacha-wheel-wrapper',
    style: { position: 'relative', margin: '0 auto' }
  }, [wheelEl]);

  // Needle statis (overlay di atas wheel)
  needleEl = createEl('div', { class: 'gacha-needle' });
  needleEl.innerHTML = buildNeedleSVG(null);
  needleEl.style.transform = 'translateX(-50%) rotate(0rad)'; // Inisialisasi posisi center
  wheelWrapper.appendChild(needleEl);

  // GO button — di tengah wheel (child of wheelWrapper)
  goBtnEl = createEl('button', { class: 'gacha-go-btn' }, []);
  goBtnEl.innerHTML = `
    <div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#00C87A,#00995E);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span style="font-size:12px;font-weight:bold;margin-top:2px;">GO!</span>
      </div>
    </div>
  `;
  goBtnEl.addEventListener('click', startSpin);
  wheelWrapper.appendChild(goBtnEl);

  // Assembly
  rouletteTable.appendChild(wheelWrapper);

  // Result placeholder
  resultPlaceholderEl = createEl('div', {
    class: 'gacha-result-placeholder',
    style: {
      marginTop: '16px',
      minHeight: '100px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--s-4)',
    }
  });
  resultPlaceholderEl.innerHTML = '<p style="color:var(--c-text-3);font-size:var(--text-sm);">Tekan GO untuk memutar roda</p>';
  rouletteTable.appendChild(resultPlaceholderEl);
  container.appendChild(rouletteTable);

  // Stats grid (5 columns sesuai Dart source)
  const stats = loadStats();
  const statsGrid = createEl('div', { class: 'gacha-stats-grid' });
  LUCK_TIERS.forEach(t => {
    const statEl = createEl('div', {
      class: 'rolling-stat',
      'data-stat': t.key,
      style: { textAlign: 'center' }
    });
    statEl.innerHTML = `
      <div class="stat-value" style="font-size:20px;font-weight:700;color:${t.color};">${stats[t.key] || 0}</div>
      <div style="font-size:11px;color:var(--c-text-3);">${t.icon}</div>
      <div style="font-size:10px;color:var(--c-text-3);">${t.chance}%</div>
    `;
    statsGrid.appendChild(statEl);
  });
  container.appendChild(statsGrid);

  // History
  const history = loadHistory();
  const historyTitle = createEl('h2', {
    class: 'card__title',
    style: { fontSize: 'var(--text-md)', fontWeight: '600', marginTop: 'var(--s-5)' }
  }, ['Riwayat Putaran']);
  container.appendChild(historyTitle);

  const historyCard = createEl('div', { class: 'card', style: { padding: 0, overflow: 'hidden' } });
  if (history.length === 0) {
    const empty = createEl('div', { class: 'empty', style: { padding: 'var(--s-5)', textAlign: 'center' } });
    empty.innerHTML = '<div class="empty__title">Belum ada riwayat</div><div class="empty__desc">Putar roda untuk memulai!</div>';
    historyCard.appendChild(empty);
  } else {
    const list = createEl('div', { style: { padding: 'var(--s-2)' } });
    history.slice(0, 30).forEach(h => {
      const tier = LUCK_TIERS.find(t => t.key === h.result) || LUCK_TIERS[2];
      const row = createEl('div', { class: 'gacha-history-item', style: {
        display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
        padding: 'var(--s-2) var(--s-3)',
      }});
      row.innerHTML = `
        <span style="font-size:18px;min-width:24px;text-align:center;">${tier.icon}</span>
        <span style="font-weight:600;color:${tier.color};">${tier.name}</span>
        <span style="font-size:11px;color:var(--c-text-3);margin-left:auto;text-align:right;">
          <div>${formatTime(h.time)}</div>
        </span>
      `;
      list.appendChild(row);
    });
    historyCard.appendChild(list);
  }

  const clearBtn = createEl('button', {
    class: 'btn btn--secondary gacha-reset-btn',
    style: { marginTop: 'var(--s-3)', fontSize: '12px' }
  }, ['Hapus Riwayati']);
  clearBtn.addEventListener('click', resetHistory);
  container.appendChild(historyCard);
  container.appendChild(clearBtn);

  // Update stat display
  setTimeout(updateStats, 0);

  return container;
}

// ═══════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════
export async function destroy() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  spinning = false;
  if (audioPoolCtx) {
    try {
      await audioPoolCtx.close();
    } catch (e) {}
  }
}

export { buildWheelSVG, buildNeedleSVG, buildResultCard, startSpin };