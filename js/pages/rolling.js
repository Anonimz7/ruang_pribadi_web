/* pages/rolling.js — Rolling Yes/No (Meja Rollet) */
import { createEl } from '../utils/dom.js';

// ═══════════════════════════════════════════════════════
// KONFIGURASI — Mencerminkan rolling_screen.dart & roulette_ticker.dart
// ═══════════════════════════════════════════════════════
const YES_NO = {
  yes: { label: 'YES', color: '#00C87A', icon: '✓' },
  no:  { label: 'NO',  color: '#E74C3C', icon: '✕' }
};

const SECTOR_COUNT = 10; // YES, NO, YES, NO ... (5 each)
const SECTOR_ANGLE = 360 / SECTOR_COUNT;
const SPIN_TIME_MIN = 10;
const SPIN_TIME_MAX = 30;
const MAX_SPEED = 100;
const SPEED_SCALE = 8;
const V0_MIN_FACTOR = 0.95;
const V0_MAX_FACTOR = 1.00;

// Fisika jarum (damped spring oscillator) — sama seperti Dart source
const K_STIFFNESS = 120;  // rad/s² per rad
const K_DAMPING = 8;      // per detik
const K_MIN_KICK = 2.2;   // rad/s — dorongan dasar tiap hantaman
const K_SPEED_KICK = 0.35; // rad/s tambahan kecepatan putar
const K_MAX_AMPLITUDE = 0.6; // rad (~34°)

// Audio & haptic
const HAPTIC_AVAILABLE = 'vibrate' in navigator;
let audioPoolCtx = null;
let audioReady = false;
let lastPegIndex = -1;
let pegCount = SECTOR_COUNT;

// Fisika jarum
let needleAngle = 0;
let needleOmega = 0;
let lastElapsed = 0;

// State roda (bukan pakai baseRotation — kita reset ke 0 di setiap spin)
let spinning = false;
let result = null;
let spinDuration = 0;
let spinStartTime = 0;

// DOM references
let wheelEl, innerWheelEl, needleEl, goBtnEl, resultPlaceholderEl;
let animationFrameId = null;
let totalAngle = 0;
let v0Final = 0;

// ═══════════════════════════════════════════════════════
// ROULETTE TICKER — Efek suara & haptic
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
  } catch (e) {
    // Silent fail — best effort
  }
}

function triggerHaptic() {
  if (!HAPTIC_AVAILABLE) return;
  try {
    navigator.vibrate([5, 5, 5]);
  } catch (e) {
    // Silent fail — best effort
  }
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
// HASIL DARI SUDUT — sama seperti Dart source
// ═══════════════════════════════════════════════════════
function getResultFromAngle(angleDeg) {
  const normalized = ((angleDeg % 360) + 360) % 360;
  const sectorIndex = Math.floor((((270 - normalized) % 360 + 360) % 360) / SECTOR_ANGLE) % SECTOR_COUNT;
  const key = sectorIndex % 2 === 0 ? 'yes' : 'no';
  return YES_NO[key];
}

// ═══════════════════════════════════════════════════════
// BUILD SVG ELEMENTS
// ═══════════════════════════════════════════════════════
function buildWheelSVG() {
  const size = 260;
  const center = size / 2;
  const radius = 118;
  const labelRadius = radius * 0.65;
  const pegRadius = radius * 0.8;

  const slices = [];
  for (let i = 0; i < SECTOR_COUNT; i++) {
    const startAngle = (i * SECTOR_ANGLE) * Math.PI / 180;
    const endAngle = ((i + 1) * SECTOR_ANGLE) * Math.PI / 180;
    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x3 = center + radius * Math.cos(endAngle);
    const y3 = center + radius * Math.sin(endAngle);
    const largeArc = SECTOR_ANGLE > 180 ? 1 : 0;

    const key = i % 2 === 0 ? 'yes' : 'no';
    const color = YES_NO[key].color;

    slices.push(`
      <path d="M${center},${center} L${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x3},${y3} Z"
            fill="${color}" stroke="#000" stroke-width="1"/>
    `);

    const midAngle = (startAngle + endAngle) / 2;
    const lx = center + labelRadius * Math.cos(midAngle);
    const ly = center + (labelRadius * Math.sin(midAngle)) + 5;
    slices.push(`
      <text x="${lx}" y="${ly}" text-anchor="middle" fill="white" font-size="11" font-weight="bold">
        ${YES_NO[key].label}
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
      <circle cx="${px}" cy="${py}" r="4" fill="url(#pegGradientRolling)" />
      <circle cx="${px - 1.5}" cy="${py - 1.5}" r="1.5" fill="rgba(255,255,255,0.6)"/>
    `);
  }

  slices.push(`<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="white" stroke-width="5"/>`);

  return `
   <svg class="gacha-svg-wheel" width="100%" height="100%" viewBox="0 0 ${size} ${size}">
      <defs>
        <radialGradient id="pegGradientRolling" cx="50%" cy="50%" r="50%">
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

function buildNeedleSVG(resultColor = '#E74C3C') {
  const w = 26;
  const h = 54;
  return `
    <svg class="gacha-svg-needle" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <filter id="needle-shadow-rolling" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.5)"/>
        </filter>
      </defs>
      <path d="M${w/2},${h} L${w*0.06},0 L${w*0.94},0 Z" fill="${resultColor}" filter="url(#needle-shadow-rolling)"/>
      <circle cx="${w/2}" cy="0" r="${w*0.16}" fill="white"/>
      <circle cx="${w/2}" cy="0" r="${w*0.10}" fill="${resultColor}"/>
    </svg>
  `;
}

function buildResultCard(r) {
  const resultDiv = createEl('div', {
    class: 'gacha-result-card',
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      padding: '16px',
      borderRadius: '12px',
      background: `${r.color}15`,
      border: `1px solid ${r.color}40`,
    }
  });
  resultDiv.innerHTML = `
    <div style="width:40px;height:40px;border-radius:50%;background:${r.color};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;color:white;">
      ${r.icon}
    </div>
    <div style="font-size:24px;font-weight:700;color:${r.color};">${r.label}</div>
    <div style="font-size:14px;color:var(--c-text-2);text-align:center;">
      ${r === YES_NO.yes ? 'Keputusan ini mendukung kamu!' : 'Pertanyaan ini perlu pertimbangan ekstra.'}
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

  const target = roll();
  const index = target === YES_NO.yes ? 0 : 1;
  const tierCenter = SECTOR_ANGLE * index + SECTOR_ANGLE / 2;
  const jitter = (Math.random() * SECTOR_ANGLE * 0.6 - SECTOR_ANGLE * 0.3);

  let targetAngle = 270 - tierCenter + jitter;
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
  result = getResultFromAngle(totalAngle);
  needleAngle = 0;
  needleOmega = 0;

  // Roda tetap posisi akhiri — flush transform ke totalAngle untuk konsistensi
  if (wheelEl) {
    wheelEl.style.transition = 'none';
    wheelEl.style.transform = `rotate(${totalAngle}deg)`;
  }
  if (needleEl) {
    needleEl.style.transition = 'transform 0.5s ease-out';
    needleEl.style.transform = 'translateX(-50%) rotate(0rad)';
    needleEl.innerHTML = buildNeedleSVG(result.color);
  }
  if (goBtnEl) { goBtnEl.style.opacity = '1'; goBtnEl.style.pointerEvents = 'auto'; }

  const placeholder = resultPlaceholderEl;
  if (placeholder) {
    placeholder.innerHTML = '';
    placeholder.appendChild(buildResultCard(result));
  }

  updateStats();
}

function roll() {
  const rng = Date.now() * Math.random();
  return (rng % 1) < 0.5 ? YES_NO.yes : YES_NO.no;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateStats() {
  const yesCount = parseInt(localStorage.getItem('rolling_stats_yes') || '0', 10);
  const noCount = parseInt(localStorage.getItem('rolling_stats_no') || '0', 10);
  if (result === YES_NO.yes) {
    const newVal = yesCount + 1;
    localStorage.setItem('rolling_stats_yes', newVal.toString());
    updateStatDisplay('yes', newVal);
  } else {
    const newVal = noCount + 1;
    localStorage.setItem('rolling_stats_no', newVal.toString());
    updateStatDisplay('no', newVal);
  }
}

function updateStatDisplay(key, value) {
  const statEls = document.querySelectorAll('.rolling-stat');
  statEls.forEach(el => {
    if (el.dataset.stat === key) {
      const valEl = el.querySelector('.stat-value');
      if (valEl) valEl.textContent = value.toString();
    }
  });
}

function resetStats() {
  if (confirm('Reset statistik rolling?')) {
    localStorage.removeItem('rolling_stats_yes');
    localStorage.removeItem('rolling_stats_no');
    updateStatDisplay('yes', 0);
    updateStatDisplay('no', 0);
  }
}

// ═══════════════════════════════════════════════════════
// MAIN RENDER — sync, konsisten dengan gacha.js
// ═══════════════════════════════════════════════════════
export function render() {
  const container = createEl('div', { class: 'rolling-container' });

  // Header
  container.appendChild(createEl('div', { class: 'gacha-header' }, [
    createEl('h1', { class: 'gacha-title' }, ['Rolling Yes/No']),
    createEl('p', { class: 'gacha-subtitle' }, [
      'Putar roda untuk mengundi YES atau NO!'
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
  needleEl.innerHTML = buildNeedleSVG('#E74C3C');
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
    }
  });

  const instruction = createEl('div', {
    style: {
      textAlign: 'center',
      color: 'var(--c-text-3)',
      fontSize: '13px',
    }
  }, ['Tekan GO untuk mengundi']);
  resultPlaceholderEl.appendChild(instruction);

  rouletteTable.appendChild(resultPlaceholderEl);
  container.appendChild(rouletteTable);

  // Stats grid (2 kolom untuk rolling)
  const yesCount = parseInt(localStorage.getItem('rolling_stats_yes') || '0', 10);
  const noCount = parseInt(localStorage.getItem('rolling_stats_no') || '0', 10);
  const statsGrid = createEl('div', { class: 'gacha-stats-grid' });
  statsGrid.innerHTML = `
    <div class="rolling-stat" data-stat="yes" style="text-align:center;">
      <div class="stat-value" style="font-size:28px;font-weight:700;color:${YES_NO.yes.color};">${yesCount}</div>
      <div style="color:var(--c-text-3);font-size:13px;">${YES_NO.yes.label}</div>
    </div>
    <div class="rolling-stat" data-stat="no" style="text-align:center;">
      <div class="stat-value" style="font-size:28px;font-weight:700;color:${YES_NO.no.color};">${noCount}</div>
      <div style="color:var(--c-text-3);font-size:13px;">${YES_NO.no.label}</div>
    </div>
  `;
  container.appendChild(statsGrid);

  // Reset button
  const resetBtn = createEl('button', {
    class: 'btn btn--secondary gacha-reset-btn',
    style: { marginTop: 'var(--s-5)' }
  }, ['Reset']);
  resetBtn.addEventListener('click', resetStats);
  container.appendChild(resetBtn);

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
    } catch (e) {
      // Silent fail
    }
  }
}

export { buildWheelSVG, buildNeedleSVG, buildResultCard, startSpin };