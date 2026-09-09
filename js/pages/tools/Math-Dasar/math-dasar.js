/* pages/tools/math-dasar-2/math-dasar.js — Tabel Matematika Interaktif
 * Konversi dari tools/Math-Dasar/index.html ke module SPA.
 * Partikel background dihilangkan (bukan esensial); dark mode mengikuti tema app. */
import { createEl } from '../../../utils/dom.js';

const CSS = `
  .md-page { max-width: 1200px; margin: 0 auto; padding: var(--s-2); }
  .md-hero { background: var(--c-primary); color: #fff; padding: var(--s-5); border-radius: var(--radius); margin-bottom: var(--s-5); position: relative; }
  .md-hero h1 { font-size: var(--text-lg); margin: 0 0 var(--s-2); }
  .md-hero p { margin: 0; opacity: .9; }
  .md-controls { background: var(--c-surface); padding: var(--s-4); border-radius: var(--radius); margin-bottom: var(--s-5); display: grid; grid-template-columns: repeat(auto-fill, minmax(180px,1fr)); gap: var(--s-4); border: 1px solid var(--c-border); }
  .md-field { display: flex; flex-direction: column; }
  .md-field label { margin-bottom: var(--s-1); font-weight: 600; color: var(--c-primary); font-size: var(--text-sm); }
  .md-field select, .md-field input { padding: 8px 10px; border: 2px solid var(--c-border); border-radius: var(--radius); background: var(--c-surface-2); color: var(--c-text); font-size: var(--text-sm); }
  .md-field select:focus, .md-field input:focus { border-color: var(--c-primary); outline: none; }
  .md-gen-btn { background: var(--c-primary); color: #fff; border: none; border-radius: var(--radius); padding: 10px 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; align-self: end; }
  .md-gen-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
  .md-tables { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px,1fr)); gap: var(--s-5); }
  .md-table { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius); padding: var(--s-4); display: flex; flex-direction: column; gap: var(--s-3); }
  .md-table-title { text-align: center; margin: 0; padding-bottom: var(--s-2); border-bottom: 2px solid var(--c-primary); color: var(--c-primary); font-size: var(--text-base); }
  .md-table table { width: 100%; border-collapse: collapse; }
  .md-table th, .md-table td { padding: 8px; text-align: center; border: 1px solid var(--c-border); }
  .md-table th { background: var(--c-primary); color: #fff; font-weight: 600; }
  .md-table tr:nth-child(even) { background: var(--c-surface-2); }
  .md-answer-cell { background: var(--c-accent-soft, transparent); }
  .md-user-answer { width: 60px; padding: 6px; border: 1px solid var(--c-border); border-radius: 4px; text-align: center; background: var(--c-surface-2); color: var(--c-text); font-size: .95rem; }
  .md-validate-wrap { display: flex; justify-content: center; }
  .md-validate-btn { padding: 10px 20px; background: var(--c-accent, #ff6b6b); border: none; color: #fff; border-radius: var(--radius); cursor: pointer; font-weight: 600; }
  .md-validate-btn:hover { filter: brightness(1.05); }
  .md-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: none; align-items: center; justify-content: center; z-index: 1000; }
  .md-overlay.open { display: flex; }
  .md-modal { background: var(--c-surface); padding: var(--s-5); border-radius: var(--radius); width: 90%; max-width: 500px; max-height: 80vh; overflow-y: auto; box-shadow: var(--shadow); }
  .md-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--s-4); border-bottom: 2px solid var(--c-primary); padding-bottom: var(--s-2); }
  .md-modal-title { margin: 0; color: var(--c-primary); }
  .md-close-x { background: none; border: none; font-size: 1.4rem; cursor: pointer; color: var(--c-text); }
  .md-correct { color: var(--c-success, #48bb78); font-weight: 600; }
  .md-incorrect { color: var(--c-danger, #f56565); font-weight: 600; }
  .md-mistake { padding: var(--s-2) 0; border-bottom: 1px solid var(--c-border); }
  .md-total { margin-top: var(--s-4); padding-top: var(--s-3); border-top: 2px solid var(--c-primary); font-weight: 600; text-align: center; }
  .md-actions { display: flex; justify-content: flex-end; margin-top: var(--s-4); }
  .md-close-btn { background: var(--c-primary); color: #fff; border: none; border-radius: var(--radius); padding: 10px 20px; cursor: pointer; font-weight: 600; }
  @media (max-width: 768px) { .md-tables { grid-template-columns: 1fr; } .md-controls { grid-template-columns: 1fr; } }
`;

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function render() {
  const page = createEl('div', { class: 'md-page' });

  const style = document.createElement('style');
  style.textContent = CSS;
  page.appendChild(style);

  // Hero
  const hero = createEl('div', { class: 'md-hero' });
  hero.appendChild(createEl('h1', {}, ['Tabel Matematika Interaktif']));
  hero.appendChild(createEl('p', {}, ['Buat tabel perhitungan seperti di dinding sekolah']));
  page.appendChild(hero);

  // Controls
  const controls = createEl('div', { class: 'md-controls' });
  const field = (label, content) => {
    const f = createEl('div', { class: 'md-field' });
    f.appendChild(createEl('label', {}, [label]));
    f.appendChild(content);
    return f;
  };

  const operation = document.createElement('select');
  operation.id = 'md-operation';
  [['addition', 'Penjumlahan (+)'], ['subtraction', 'Pengurangan (-)'], ['multiplication', 'Perkalian (×)'], ['division', 'Pembagian (÷)'], ['random', 'Acak Semua Operasi']]
    .forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; operation.appendChild(o); });
  controls.appendChild(field('Jenis Operasi', operation));

  const minVal = document.createElement('input');
  minVal.type = 'number'; minVal.id = 'md-min'; minVal.value = '1'; minVal.min = '0';
  controls.appendChild(field('Nilai Minimum', minVal));

  const maxVal = document.createElement('input');
  maxVal.type = 'number'; maxVal.id = 'md-max'; maxVal.value = '10'; maxVal.min = '1';
  controls.appendChild(field('Nilai Maksimum', maxVal));

  const perTable = document.createElement('select');
  perTable.id = 'md-per';
  [['5', '5 Soal (20 tabel)'], ['10', '10 Soal (10 tabel)'], ['20', '20 Soal (5 tabel)']]
    .forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === '10') o.selected = true; perTable.appendChild(o); });
  controls.appendChild(field('Jumlah Soal per Tabel', perTable));

  const randomize = document.createElement('select');
  randomize.id = 'md-rand';
  [['yes', 'Ya'], ['no', 'Tidak']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; randomize.appendChild(o); });
  controls.appendChild(field('Acak Soal', randomize));

  const showAns = document.createElement('select');
  showAns.id = 'md-show';
  [['yes', 'Ya'], ['no', 'Tidak (isi manual)']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; showAns.appendChild(o); });
  controls.appendChild(field('Tampilkan Jawaban', showAns));

  const genBtn = createEl('button', { class: 'md-gen-btn', type: 'button' }, ['Buat Tabel']);
  const genWrap = createEl('div', { class: 'md-field' });
  genBtn.style.marginTop = 'auto';
  genWrap.appendChild(genBtn);
  controls.appendChild(genWrap);
  page.appendChild(controls);

  // Tables container
  const tablesContainer = createEl('div', { class: 'md-tables' });
  page.appendChild(tablesContainer);

  // Result modal
  const overlay = createEl('div', { class: 'md-overlay' });
  const modal = createEl('div', { class: 'md-modal' });
  const modalHead = createEl('div', { class: 'md-modal-head' });
  modalHead.appendChild(createEl('h3', { class: 'md-modal-title' }, ['Hasil Validasi']));
  const closeX = createEl('button', { class: 'md-close-x', type: 'button' }, ['×']);
  modalHead.appendChild(closeX);
  modal.appendChild(modalHead);
  const resultSummary = createEl('div', { class: 'md-result-summary' });
  const mistakesList = createEl('div', { class: 'md-mistakes' });
  const totalScore = createEl('div', { class: 'md-total' });
  const actions = createEl('div', { class: 'md-actions' });
  const closeBtn = createEl('button', { class: 'md-close-btn', type: 'button' }, ['Tutup']);
  actions.appendChild(closeBtn);
  modal.append(resultSummary, mistakesList, totalScore, actions);
  overlay.appendChild(modal);
  page.appendChild(overlay);

  const closeModal = () => overlay.classList.remove('open');
  closeX.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  function generateTables() {
    const op = operation.value;
    const minValue = parseInt(minVal.value, 10);
    const maxValue = parseInt(maxVal.value, 10);
    const qPer = parseInt(perTable.value, 10);
    const rand = randomize.value === 'yes';
    const showA = showAns.value === 'yes';

    const totalQuestions = 100;
    const tableCount = totalQuestions / qPer;
    tablesContainer.innerHTML = '';

    const numbers = [];
    for (let i = minValue; i <= maxValue; i++) numbers.push(i);
    const seq = rand ? shuffleArray(numbers) : numbers;

    for (let ti = 0; ti < tableCount; ti++) {
      const tableDiv = createEl('div', { class: 'md-table' });
      tableDiv.appendChild(createEl('h3', { class: 'md-table-title' }, [`Tabel ${ti + 1}`]));

      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['No', 'Soal', 'Jawaban'].forEach((h) => { const th = document.createElement('th'); th.textContent = h; headRow.appendChild(th); });
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      const questions = [];

      for (let i = 0; i < qPer; i++) {
        const qIndex = ti * qPer + i;
        if (qIndex >= numbers.length * numbers.length) continue;

        const row = document.createElement('tr');
        const noCell = document.createElement('td');
        noCell.textContent = qIndex + 1;
        row.appendChild(noCell);

        const qCell = document.createElement('td');
        let a, b;
        if (rand) {
          a = numbers[Math.floor(Math.random() * numbers.length)];
          b = numbers[Math.floor(Math.random() * numbers.length)];
        } else {
          a = seq[Math.floor(qIndex / numbers.length)];
          b = seq[qIndex % numbers.length];
        }

        let questionText = '';
        let correctAnswer;
        let currentOperation = op;
        if (op === 'random') {
          const ops = ['addition', 'subtraction', 'multiplication', 'division'];
          currentOperation = ops[Math.floor(Math.random() * ops.length)];
        }

        switch (currentOperation) {
          case 'addition':
            questionText = `${a} + ${b} =`;
            correctAnswer = a + b;
            break;
          case 'subtraction':
            const mx = Math.max(a, b), mn = Math.min(a, b);
            questionText = `${mx} - ${mn} =`;
            correctAnswer = mx - mn;
            break;
          case 'multiplication':
            questionText = `${a} × ${b} =`;
            correctAnswer = a * b;
            break;
          case 'division':
            questionText = `${a * b} ÷ ${a} =`;
            correctAnswer = b;
            break;
        }

        qCell.textContent = questionText;
        row.appendChild(qCell);

        const ansCell = document.createElement('td');
        ansCell.className = 'md-answer-cell';
        let userInput = null;
        if (showA) {
          ansCell.textContent = correctAnswer;
        } else {
          userInput = document.createElement('input');
          userInput.type = 'number';
          userInput.className = 'md-user-answer';
          ansCell.appendChild(userInput);
        }
        row.appendChild(ansCell);
        tbody.appendChild(row);

        questions.push({ questionNumber: qIndex + 1, questionText, correctAnswer, operation: currentOperation, userInput });
      }

      table.appendChild(tbody);
      tableDiv.appendChild(table);

      if (!showA) {
        const wrap = createEl('div', { class: 'md-validate-wrap' });
        const vBtn = createEl('button', { class: 'md-validate-btn', type: 'button' }, ['Validasi Jawaban']);
        vBtn.addEventListener('click', () => validateAnswers(questions, ti + 1));
        wrap.appendChild(vBtn);
        tableDiv.appendChild(wrap);
      }

      tablesContainer.appendChild(tableDiv);
    }
  }

  function validateAnswers(questions, tableNumber) {
    let correctCount = 0;
    const mistakes = [];
    questions.forEach((q) => {
      if (q.userInput) {
        const userAnswer = parseInt(q.userInput.value, 10);
        const isCorrect = userAnswer === q.correctAnswer;
        if (isCorrect) {
          correctCount++;
          q.userInput.style.backgroundColor = 'var(--c-success, #48bb78)';
          q.userInput.style.color = 'white';
        } else {
          q.userInput.style.backgroundColor = 'var(--c-danger, #f56565)';
          q.userInput.style.color = 'white';
          mistakes.push({ number: q.questionNumber, question: q.questionText, userAnswer: isNaN(userAnswer) ? '(kosong)' : userAnswer, correctAnswer: q.correctAnswer, operation: q.operation });
        }
      }
    });
    showResultModal(correctCount, questions.length, mistakes, tableNumber);
  }

  function showResultModal(correctCount, totalQ, mistakes, tableNumber) {
    const percentage = Math.round((correctCount / totalQ) * 100);
    const sym = { addition: '+', subtraction: '-', multiplication: '×', division: '÷' };

    resultSummary.innerHTML = `
      <p>Hasil validasi untuk <strong>Tabel ${tableNumber}</strong>:</p>
      <p>Anda menjawab <span class="md-correct">${correctCount} benar</span> dan <span class="md-incorrect">${totalQ - correctCount} salah</span> dari ${totalQ} soal.</p>
      <p>Nilai: <strong>${percentage}%</strong></p>
    `;

    mistakesList.innerHTML = '';
    if (mistakes.length > 0) {
      mistakesList.appendChild(createEl('p', {}, [createEl('strong', {}, ['Detail Kesalahan:'])]));
      mistakes.forEach((m) => {
        const item = createEl('div', { class: 'md-mistake' });
        const opSym = sym[m.operation] || '';
        item.innerHTML = `
          <p><strong>No. ${m.number}:</strong> ${m.question.replace(/[+\-×÷]/, opSym)}</p>
          <p>Jawaban Anda: <span class="md-incorrect">${m.userAnswer}</span></p>
          <p>Jawaban benar: <span class="md-correct">${m.correctAnswer}</span></p>
        `;
        mistakesList.appendChild(item);
      });
    } else {
      mistakesList.appendChild(createEl('p', {}, [createEl('span', { class: 'md-correct' }, ['Semua jawaban benar! 👍'])]));
    }

    totalScore.innerHTML = `
      <p>Total Skor: <span style="color: var(--c-primary); font-size: 1.3rem;">${correctCount}/${totalQ}</span></p>
      <p>Persentase: <span style="color: ${percentage >= 80 ? 'var(--c-success, #48bb78)' : 'var(--c-danger, #f56565)'}">${percentage}%</span></p>
    `;
    overlay.classList.add('open');
  }

  genBtn.addEventListener('click', generateTables);
  generateTables();

  return page;
}