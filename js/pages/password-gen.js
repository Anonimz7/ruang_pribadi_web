/* pages/password-gen.js — Password Generator (complete) */

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SPECIAL = '!@#$%^&*()_-+=';

function generatePassword(length, incUpper, incLower, incNum, incSpecial) {
  let chars = '';
  if (incUpper) chars += UPPER;
  if (incLower) chars += LOWER;
  if (incNum) chars += NUMBERS;
  if (incSpecial) chars += SPECIAL;
  if (!chars) return 'Pilih setidaknya satu opsi karakter!';

  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, n => chars[n % chars.length]).join('');
}

function calcStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { label: 'Lemah', pct: 25, cls: 'pw-strength__text--weak' };
  if (score <= 4) return { label: 'Cukup', pct: 50, cls: 'pw-strength__text--fair' };
  if (score <= 6) return { label: 'Bagus', pct: 75, cls: 'pw-strength__text--good' };
  return { label: 'Kuat', pct: 100, cls: 'pw-strength__text--strong' };
}

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

export function render() {
  const container = document.createElement('div');

  let length = 12;
  let incUpper = true;
  let incLower = true;
  let incNum = true;
  let incSpecial = true;
  let password = '';
  let copied = false;

  function update() {
    container.innerHTML = '';
    container.appendChild(renderView());
  }

  function renderView() {
    const wrap = document.createElement('div');

    // Title
    const title = document.createElement('h1');
    title.textContent = 'Password Generator';
    wrap.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.style.cssText = 'color:var(--c-text-2);margin-bottom:var(--s-5);';
    subtitle.textContent = 'Generate strong, secure passwords instantly.';
    wrap.appendChild(subtitle);

    const card = document.createElement('div');
    card.className = 'card pw-card';

    // Output
    const outWrap = document.createElement('div');
    outWrap.className = 'pw-output';

    const outField = document.createElement('div');
    outField.className = 'pw-output__field';
    outField.textContent = password || 'Klik Generate...';
    outField.style.color = password ? 'var(--c-text)' : 'var(--c-text-3)';
    outWrap.appendChild(outField);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'pw-output__copy' + (copied ? ' pw-output__copy--copied' : '');
    copyBtn.innerHTML = copied
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    copyBtn.setAttribute('aria-label', 'Copy password');
    copyBtn.addEventListener('click', () => {
      if (!password) return;
      navigator.clipboard.writeText(password).then(() => {
        copied = true;
        update();
        setTimeout(() => { copied = false; update(); }, 1500);
      }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = password;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        copied = true;
        update();
        setTimeout(() => { copied = false; update(); }, 1500);
      });
    });
    outWrap.appendChild(copyBtn);
    card.appendChild(outWrap);

    // Strength bar
    if (password) {
      const strength = calcStrength(password);
      const stWrap = document.createElement('div');
      stWrap.className = 'pw-strength';
      stWrap.innerHTML = `
        <div class="pw-strength__label">
          <span>Strength</span>
          <span class="pw-strength__text ${strength.cls}">${strength.label}</span>
        </div>
        <div class="progress">
          <div class="progress__bar" style="width:${strength.pct}%;background:${strength.cls.includes('weak') ? 'var(--c-danger)' : strength.cls.includes('fair') ? 'var(--c-warn)' : strength.cls.includes('good') ? 'var(--c-info)' : 'var(--c-accent)'}"></div>
        </div>
      `;
      card.appendChild(stWrap);
    }

    // Length slider
    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'pw-slider';
    sliderWrap.innerHTML = `
      <div class="pw-slider__row">
        <span class="pw-slider__label">Panjang Password</span>
        <span class="pw-slider__value">${length}</span>
      </div>
    `;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '4';
    slider.max = '32';
    slider.value = length;
    slider.className = 'pw-slider__input';
    slider.addEventListener('input', e => {
      length = parseInt(e.target.value);
      update();
    });
    sliderWrap.appendChild(slider);
    card.appendChild(sliderWrap);

    // Options
    const optsWrap = document.createElement('div');
    optsWrap.className = 'pw-options';

    [
      { key: 'upper', label: 'Uppercase (A-Z)', val: incUpper },
      { key: 'lower', label: 'Lowercase (a-z)', val: incLower },
      { key: 'num', label: 'Numbers (0-9)', val: incNum },
      { key: 'special', label: 'Special Characters (!@#$)', val: incSpecial },
    ].forEach(opt => {
      const row = document.createElement('div');
      row.className = 'pw-option';
      row.innerHTML = `
        <span class="pw-option__label">${opt.label}</span>
        <span class="pw-option__check ${opt.val ? 'pw-option__check--checked' : ''}">${opt.val ? CHECK_SVG : ''}</span>
      `;
      row.addEventListener('click', () => {
        if (opt.key === 'upper') incUpper = !incUpper;
        else if (opt.key === 'lower') incLower = !incLower;
        else if (opt.key === 'num') incNum = !incNum;
        else if (opt.key === 'special') incSpecial = !incSpecial;
        update();
      });
      optsWrap.appendChild(row);
    });
    card.appendChild(optsWrap);

    // Generate button
    const genBtn = document.createElement('button');
    genBtn.className = 'btn btn--primary btn--lg';
    genBtn.style.width = '100%';
    genBtn.textContent = 'Generate Password';
    genBtn.addEventListener('click', () => {
      password = generatePassword(length, incUpper, incLower, incNum, incSpecial);
      copied = false;
      update();
    });
    card.appendChild(genBtn);

    wrap.appendChild(card);
    return wrap;
  }

  update();
  return container;
}
