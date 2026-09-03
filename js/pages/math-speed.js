/* pages/math-speed.js — Math Speed (complete) */

// ===================== STATE =====================
const OP_NAMES = { addition: 'Penjumlahan', subtraction: 'Pengurangan', multiplication: 'Perkalian', division: 'Pembagian' };

function loadSettings() {
  try {
    const raw = localStorage.getItem('math_speed_settings');
    return raw ? JSON.parse(raw) : { operation: 'addition', questionsPerSession: 10, questionTime: 5, keyboardSize: 'medium' };
  } catch { return { operation: 'addition', questionsPerSession: 10, questionTime: 5, keyboardSize: 'medium' }; }
}
function saveSettings(s) { localStorage.setItem('math_speed_settings', JSON.stringify(s)); }

function loadRecords() {
  try {
    const raw = localStorage.getItem('math_speed_records');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveRecords(r) { localStorage.setItem('math_speed_records', JSON.stringify(r)); }

function updateRecord(op, newScore, newAvgTime) {
  const recs = loadRecords();
  const cur = recs[op];
  if (!cur || newScore > cur.topScore || (newScore === cur.topScore && newAvgTime < cur.bestAverageTime)) {
    recs[op] = { topScore: newScore, bestAverageTime: newAvgTime };
    saveRecords(recs);
    return true;
  }
  return false;
}

// ===================== ENGINE =====================
function genQuestion(op) {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  switch(op) {
    case 'addition': return { text: `${a} + ${b}`, ans: a + b };
    case 'subtraction': { const s = Math.floor(Math.random() * 10) + 1; const sum = s + Math.floor(Math.random() * 10); return { text: `${sum} - ${s}`, ans: sum - s }; }
    case 'multiplication': return { text: `${a} \u00d7 ${b}`, ans: a * b };
    case 'division': return { text: `${a * b} \u00f7 ${b}`, ans: a };
  }
  return { text: '1 + 1', ans: 2 };
}

function genSession(settings) {
  const qs = [], seen = new Set();
  while (qs.length < settings.questionsPerSession) {
    const q = genQuestion(settings.operation);
    if (!seen.has(q.text)) { seen.add(q.text); qs.push({ ...q, userAns: null, correct: false, time: 0, timeout: false }); }
  }
  return qs;
}

function genAllSessions(settings) {
  const total = Math.ceil(100 / settings.questionsPerSession);
  const sessions = [], seen = new Set();
  for (let i = 0; i < total; i++) {
    const sess = [];
    while (sess.length < settings.questionsPerSession) {
      const q = genQuestion(settings.operation);
      if (!seen.has(q.text)) { seen.add(q.text); sess.push({ ...q, userAns: null, correct: false, time: 0, timeout: false }); }
    }
    sessions.push(sess);
  }
  return sessions;
}

let tickAudio = null;
function playTick() {
  if (!tickAudio) tickAudio = new Audio('assets/sounds/tick.wav');
  tickAudio.play().catch(() => {});
}

// ===================== VIEWS =====================
export function render() {
  const container = document.createElement('div');
  let view = 'home', activeTab = 0;
  let settings = loadSettings();
  let sessions = [], sessIdx = 0, qIdx = 0, totalScore = 0;
  let timer = null, remaining = 0, answer = '', qStart = 0, newRecord = false;

  const content = document.createElement('div');
  content.id = 'math-content';
  container.appendChild(content);

  function switchView(v) { view = v; renderView(); }

  function renderView() {
    content.innerHTML = '';
    if (view === 'home') content.appendChild(renderHome());
    else if (view === 'quiz') content.appendChild(renderQuiz());
    else if (view === 'sessionResult') content.appendChild(renderSessionResult());
    else if (view === 'finalResult') content.appendChild(renderFinalResult());
  }

  // ---- HOME ----
  function renderHome() {
    const wrap = document.createElement('div');

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    ['Beranda', 'Rekor'].forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'tabs__item' + (i === activeTab ? ' tabs__item--active' : '');
      b.textContent = t;
      b.addEventListener('click', () => { activeTab = i; renderView(); });
      tabs.appendChild(b);
    });
    wrap.appendChild(tabs);

    if (activeTab === 0) {
      // Settings
      const card = document.createElement('div');
      card.className = 'card math-home';

      // Operation
      const opWrap = document.createElement('div');
      opWrap.className = 'field';
      opWrap.style.marginBottom = 'var(--s-4)';
      opWrap.innerHTML = '<label class="field__label">Operasi Matematika</label>';
      const opSel = document.createElement('select');
      opSel.className = 'field__select';
      Object.entries(OP_NAMES).forEach(([k, v]) => {
        const o = document.createElement('option');
        o.value = k; o.textContent = v;
        if (settings.operation === k) o.selected = true;
        opSel.appendChild(o);
      });
      opSel.addEventListener('change', e => { settings.operation = e.target.value; saveSettings(settings); });
      opWrap.appendChild(opSel);
      card.appendChild(opWrap);

      // Questions per session
      const qWrap = document.createElement('div');
      qWrap.className = 'field';
      qWrap.style.marginBottom = 'var(--s-4)';
      qWrap.innerHTML = `<label class="field__label">Jumlah Soal per Sesi: <strong>${settings.questionsPerSession}</strong></label>`;
      const qSlider = document.createElement('input');
      qSlider.type = 'range'; qSlider.min = '5'; qSlider.max = '20'; qSlider.value = settings.questionsPerSession;
      qSlider.className = 'field__input';
      qSlider.addEventListener('input', e => {
        settings.questionsPerSession = parseInt(e.target.value);
        qWrap.querySelector('strong').textContent = settings.questionsPerSession;
        saveSettings(settings);
      });
      qWrap.appendChild(qSlider);
      card.appendChild(qWrap);

      // Time per question
      const tWrap = document.createElement('div');
      tWrap.className = 'field';
      tWrap.style.marginBottom = 'var(--s-4)';
      tWrap.innerHTML = `<label class="field__label">Waktu per Soal (detik): <strong>${settings.questionTime}</strong></label>`;
      const tSlider = document.createElement('input');
      tSlider.type = 'range'; tSlider.min = '3'; tSlider.max = '15'; tSlider.value = settings.questionTime;
      tSlider.className = 'field__input';
      tSlider.addEventListener('input', e => {
        settings.questionTime = parseInt(e.target.value);
        tWrap.querySelector('strong').textContent = settings.questionTime;
        saveSettings(settings);
      });
      tWrap.appendChild(tSlider);
      card.appendChild(tWrap);

      // Keyboard size
      const kWrap = document.createElement('div');
      kWrap.className = 'field';
      kWrap.style.marginBottom = 'var(--s-5)';
      kWrap.innerHTML = '<label class="field__label">Ukuran Keypad</label>';
      const kSel = document.createElement('select');
      kSel.className = 'field__select';
      [['small', 'Kecil'], ['medium', 'Sedang'], ['large', 'Besar']].forEach(([k, v]) => {
        const o = document.createElement('option');
        o.value = k; o.textContent = v;
        if (settings.keyboardSize === k) o.selected = true;
        kSel.appendChild(o);
      });
      kSel.addEventListener('change', e => { settings.keyboardSize = e.target.value; saveSettings(settings); });
      kWrap.appendChild(kSel);
      card.appendChild(kWrap);

      // Start button
      const startBtn = document.createElement('button');
      startBtn.className = 'btn btn--primary btn--lg';
      startBtn.style.width = '100%';
      startBtn.textContent = 'Mulai Quiz';
      startBtn.addEventListener('click', () => {
        sessions = genAllSessions(settings);
        sessIdx = 0; qIdx = 0; totalScore = 0; newRecord = false;
        switchView('quiz');
        startQuestion();
      });
      card.appendChild(startBtn);
      wrap.appendChild(card);
    } else {
      // Records
      const recs = loadRecords();
      const card = document.createElement('div');
      card.className = 'card math-home';
      card.innerHTML = '<div class="card__head"><div class="card__title">Rekor</div></div>';

      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = 'var(--s-3)';

      Object.entries(OP_NAMES).forEach(([op, name]) => {
        const rec = recs[op];
        const row = document.createElement('div');
        row.className = 'math-record-row';
        const scoreText = rec ? rec.topScore : '0';
        const timeText = rec && rec.bestAverageTime !== Infinity ? rec.bestAverageTime.toFixed(2) + ' detik' : '-';
        row.innerHTML = `
          <div>
            <div style="font-weight:600;">${name}</div>
            <div style="font-size:var(--text-xs);color:var(--c-text-3);">Top: ${scoreText} | Avg: ${timeText}</div>
          </div>
          ${rec ? '<span class="badge badge--success">🏆</span>' : ''}
        `;
        list.appendChild(row);
      });
      card.appendChild(list);
      wrap.appendChild(card);
    }
    return wrap;
  }

  // ---- QUIZ ----
  function renderQuiz() {
    const session = sessions[sessIdx];
    const q = session[qIdx];
    const wrap = document.createElement('div');
    wrap.className = 'math-quiz';

    // Header
    const header = document.createElement('div');
    header.className = 'math-header';
    header.innerHTML = `<span>Sesi ${sessIdx + 1}/${sessions.length}</span><span>Soal ${qIdx + 1}/${session.length}</span>`;
    wrap.appendChild(header);

    // Timer
    const timerBar = document.createElement('div');
    timerBar.className = 'progress';
    timerBar.style.marginBottom = 'var(--s-4)';
    const timerFill = document.createElement('div');
    timerFill.className = 'progress__bar';
    timerFill.style.width = '100%';
    timerFill.style.transition = 'width 1s linear';
    timerBar.appendChild(timerFill);
    wrap.appendChild(timerBar);

    const timerText = document.createElement('div');
    timerText.className = 'math-timer-text';
    timerText.textContent = `Waktu: ${remaining} detik`;
    wrap.appendChild(timerText);

    // Question
    const qBox = document.createElement('div');
    qBox.className = 'math-question';
    qBox.textContent = q.text + ' = ?';
    wrap.appendChild(qBox);

    // Answer
    const ansBox = document.createElement('div');
    ansBox.className = 'math-answer';
    ansBox.textContent = answer || '_';
    wrap.appendChild(ansBox);

    // Keypad
    const btnSize = settings.keyboardSize === 'small' ? 50 : settings.keyboardSize === 'large' ? 70 : 60;
    const keypad = document.createElement('div');
    keypad.className = 'math-keypad';
    keypad.style.maxWidth = (btnSize * 3 + 20) + 'px';

    const keys = [
      { l: '1', a: () => add('1') },
      { l: '2', a: () => add('2') },
      { l: '3', a: () => add('3') },
      { l: '4', a: () => add('4') },
      { l: '5', a: () => add('5') },
      { l: '6', a: () => add('6') },
      { l: '7', a: () => add('7') },
      { l: '8', a: () => add('8') },
      { l: '9', a: () => add('9') },
      { l: '⌫', a: () => del(), cls: 'math-keypad-btn--warn' },
      { l: '0', a: () => add('0') },
      { l: '⏎', a: () => submit(), cls: 'math-keypad-btn--primary' },
    ];

    keys.forEach(k => {
      const b = document.createElement('button');
      b.className = 'math-keypad-btn' + (k.cls ? ' ' + k.cls : '');
      b.style.height = btnSize + 'px';
      b.style.fontSize = (btnSize / 2.5) + 'px';
      b.textContent = k.l;
      b.addEventListener('click', k.a);
      keypad.appendChild(b);
    });
    wrap.appendChild(keypad);

    // Score
    const scoreRow = document.createElement('div');
    scoreRow.className = 'math-score-row';
    scoreRow.innerHTML = `<span>Skor: <strong style="color:var(--c-text)">${totalScore}</strong></span>`;
    wrap.appendChild(scoreRow);

    // Keyboard support
    wrap._keyHandler = e => {
      if (e.key >= '0' && e.key <= '9') add(e.key);
      else if (e.key === 'Backspace') del();
      else if (e.key === 'Enter') submit();
    };
    document.addEventListener('keydown', wrap._keyHandler);

    return wrap;
  }

  function add(d) {
    if (answer.length < 6) { answer += d; updateAns(); }
  }
  function del() {
    answer = answer.slice(0, -1);
    updateAns();
  }
  function updateAns() {
    const box = content.querySelector('.math-answer');
    if (box) box.textContent = answer || '_';
  }

  function startQuestion() {
    remaining = settings.questionTime;
    answer = '';
    qStart = Date.now();
    updateTimer();
    updateAns();
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      remaining--;
      updateTimer();
      if (remaining <= 3 && remaining > 0) playTick();
      if (remaining <= 0) { clearInterval(timer); submit(true); }
    }, 1000);
  }

  function updateTimer() {
    const fill = content.querySelector('.progress__bar');
    const text = content.querySelector('.math-timer-text');
    if (fill) fill.style.width = ((remaining / settings.questionTime) * 100) + '%';
    if (text) {
      text.textContent = `Waktu: ${remaining} detik`;
      text.style.color = remaining <= 3 ? 'var(--c-danger)' : '';
    }
  }

  function submit(timeout = false) {
    if (timer) clearInterval(timer);
    const session = sessions[sessIdx];
    const q = session[qIdx];
    q.time = Math.max(0, (settings.questionTime - remaining) + (Date.now() - qStart) / 1000 - (settings.questionTime - remaining));

    if (!timeout && answer) {
      q.userAns = parseFloat(answer);
      q.correct = q.userAns === q.ans;
      if (q.correct) totalScore++;
    } else {
      q.userAns = answer ? parseFloat(answer) : 0;
      q.correct = false;
      if (timeout) q.timeout = true;
    }

    // Cleanup keyboard listener
    const oldWrap = content.querySelector('.math-quiz');
    if (oldWrap && oldWrap._keyHandler) document.removeEventListener('keydown', oldWrap._keyHandler);

    if (qIdx < session.length - 1) {
      qIdx++;
      answer = '';
      switchView('quiz');
      startQuestion();
    } else {
      if (sessIdx >= sessions.length - 1) {
        newRecord = updateRecord(settings.operation, totalScore, overallAvg());
        switchView('finalResult');
      } else {
        switchView('sessionResult');
      }
    }
  }

  function overallAvg() {
    const all = sessions.flat();
    if (!all.length) return 0;
    return all.reduce((s, q) => s + q.time, 0) / all.length;
  }

  function sessAvg() {
    const qs = sessions[sessIdx];
    if (!qs.length) return 0;
    return qs.reduce((s, q) => s + q.time, 0) / qs.length;
  }

  // ---- SESSION RESULT ----
  function renderSessionResult() {
    const session = sessions[sessIdx];
    const correct = session.filter(q => q.correct).length;
    const score = Math.round((correct * 100) / session.length);
    const avg = sessAvg();

    const wrap = document.createElement('div');
    wrap.className = 'card math-result';

    wrap.innerHTML = `
      <div style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--s-2);">Hasil Sesi ${sessIdx + 1}</div>
      <div style="font-size:var(--text-xl);font-weight:700;color:var(--c-primary);margin-bottom:var(--s-2);">${score}%</div>
      <div style="font-size:var(--text-sm);color:var(--c-text-2);margin-bottom:var(--s-5);">
        ${correct}/${session.length} benar \u2022 Rata-rata ${avg.toFixed(2)} detik/soal
      </div>
    `;

    const list = document.createElement('div');
    list.className = 'math-result-list';
    session.forEach(q => {
      const row = document.createElement('div');
      row.className = 'math-result-item';
      const ansText = q.timeout ? '\u23f1 Timeout' : (q.userAns !== null ? q.userAns : '-');
      row.innerHTML = `
        <span><strong>${q.text}</strong> = ${ansText}</span>
        <span class="${q.correct ? 'correct' : 'wrong'}">${q.correct ? '\u2713' : '\u2717'}</span>
      `;
      list.appendChild(row);
    });
    wrap.appendChild(list);

    const btnWrap = document.createElement('div');
    btnWrap.className = 'math-btn-wrap';

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn--secondary';
    retryBtn.textContent = 'Ulang Sesi';
    retryBtn.addEventListener('click', () => {
      sessions[sessIdx] = genSession(settings);
      qIdx = 0;
      answer = '';
      switchView('quiz');
      startQuestion();
    });
    btnWrap.appendChild(retryBtn);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn--primary';
    nextBtn.textContent = 'Lanjut';
    nextBtn.addEventListener('click', () => {
      if (sessIdx < sessions.length - 1) {
        sessIdx++; qIdx = 0;
        answer = '';
        switchView('quiz');
        startQuestion();
      } else {
        newRecord = updateRecord(settings.operation, totalScore, overallAvg());
        switchView('finalResult');
      }
    });
    btnWrap.appendChild(nextBtn);
    wrap.appendChild(btnWrap);

    return wrap;
  }

  // ---- FINAL RESULT ----
  function renderFinalResult() {
    const wrap = document.createElement('div');
    wrap.className = 'card math-final';

    if (newRecord) {
      wrap.innerHTML += `<div style="font-size:var(--text-md);color:var(--c-accent);font-weight:600;margin-bottom:var(--s-4);">\ud83c\udf89 Selamat, anda melampaui rekor sebelumnya!</div>`;
    }

    wrap.innerHTML += `
      <div style="font-size:var(--text-lg);font-weight:600;margin-bottom:var(--s-2);">Nilai Akhir</div>
      <div style="font-size:var(--text-xl);font-weight:700;color:var(--c-primary);margin-bottom:var(--s-4);">${totalScore}</div>
      <div style="font-size:var(--text-sm);color:var(--c-text-2);margin-bottom:var(--s-5);">
        Rata-rata waktu keseluruhan: ${overallAvg().toFixed(2)} detik
      </div>
    `;

    const againBtn = document.createElement('button');
    againBtn.className = 'btn btn--primary btn--lg';
    againBtn.style.width = '100%';
    againBtn.textContent = 'Main Lagi';
    againBtn.addEventListener('click', () => {
      sessions = []; sessIdx = 0; qIdx = 0; totalScore = 0; newRecord = false; activeTab = 0;
      switchView('home');
    });
    wrap.appendChild(againBtn);

    return wrap;
  }

  // Init
  renderView();

  // Cleanup on unmount
  container._cleanup = () => {
    if (timer) clearInterval(timer);
    const oldWrap = content.querySelector('.math-quiz');
    if (oldWrap && oldWrap._keyHandler) document.removeEventListener('keydown', oldWrap._keyHandler);
  };

  return container;
}
