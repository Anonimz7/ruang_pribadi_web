/* pages/tools/bacak-2/bacak.js — CSV Shuffler & Memorizer (Flashcard)
 * Konversi dari tools/bacak/index.html + data.json ke module SPA.
 * Partikel background dihilangkan (bukan esensial). */
import { createEl } from '../../../utils/dom.js';

// Daftar set data tersimpan (dari data.json asli)
const DATA_LIST = [
  { nama: 'Hiragana [あ]', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSwzfL_VBpt6CxuDNvVWfS67YrolNeCwLWcqtWOjrs876pZuvKyhreBMpKuMlp7bhlhMjGz9eDGS4rc/pub?gid=0&single=true&output=csv' },
  { nama: 'Katakana [ア]', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSnkDuW4phRIfnCDqrYRaSzee4l_CWStwIDI4L4Ld3-Hof-zNL1lqdaHS1Q_xZuJcVevjDCOLZ62Izm/pub?gid=0&single=true&output=csv' },
  { nama: 'Perkalian [X]', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTRi1MGPWz6RjyCaFa_86_YvriUjL-chF4H5U13CfkPhqCDlzgdT5MQAcjFYs5Cy3CCeqPNeEsKENQ7/pub?output=csv' },
  { nama: 'Pembagian [:]', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSg10JptFcg9N7YP3o9ziEA1yLwadpIDrPM8UWNTQWepWrBiLXh0VK5LgQqKZVa2Nv0B4NKYsZ0wA0e/pub?output=csv' },
  { nama: 'Penjumlahan [+]', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTMjdh6IVt8pI1EuZTVATIuPB3AP2YYXqp2zAZTal5Q5-zb6A1uAz5tvIVgDE5cVYAnx99fuWRpxD4-/pub?output=csv' },
  { nama: 'Pengurangan [-]', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTMjdh6IVt8pI1EuZTVATIuPB3AP2YYXqp2zAZTal5Q5-zb6A1uAz5tvIVgDE5cVYAnx99fuWRpxD4-/pub?output=csv' },
];

const CSS = `
  .bk-page { max-width: 650px; margin: 0 auto; padding: var(--s-2); }
  .bk-title { color: var(--c-primary); font-size: 1.9em; margin: 0 0 var(--s-1); font-weight: 800; text-align: center; }
  .bk-sub { color: var(--c-text-2); margin: 0 0 var(--s-4); text-align: center; }
  .bk-load { background: var(--c-surface-2); padding: var(--s-4); border-radius: var(--radius); margin-bottom: var(--s-4); border: 1px solid var(--c-border); }
  .bk-input { display: block; width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; border: 1px solid var(--c-primary); background: var(--c-surface); color: var(--c-text); margin-bottom: var(--s-3); font-size: 1em; }
  .bk-load select.bk-input option { background: var(--c-surface); color: var(--c-text); }
  .bk-input:focus { outline: none; border-color: var(--c-primary); }
  .bk-mode { display: flex; align-items: center; gap: var(--s-2); margin-bottom: var(--s-3); font-size: .95em; }
  .bk-mode input { width: 20px; height: 20px; accent-color: var(--c-primary); }
  .bk-upload { border: 2px dashed var(--c-primary); padding: 12px 20px; border-radius: 8px; cursor: pointer; display: inline-block; margin-bottom: var(--s-3); font-weight: 600; color: var(--c-primary); }
  .bk-filename { display: block; margin-bottom: var(--s-3); font-style: italic; color: var(--c-text-2); font-size: .9em; }
  .bk-btn { padding: 14px 24px; margin: 8px 8px 8px 0; border-radius: 10px; border: none; color: #fff; font-weight: 700; cursor: pointer; font-size: 1em; transition: all .3s; box-shadow: 0 4px 10px rgba(0,0,0,.3); }
  .bk-btn:hover { transform: translateY(-2px); }
  .bk-btn-green { background: var(--c-success, #4caf50); }
  .bk-btn-blue { background: var(--c-primary); }
  .bk-btn-orange { background: var(--c-accent, #ff5722); }
  .bk-btn-purple { background: #9c27b0; }
  .bk-btn-red { background: #cc0000; }
  .bk-table-wrap { margin-top: var(--s-4); text-align: left; padding: var(--s-4); background: var(--c-surface); border-radius: var(--radius); border: 1px solid var(--c-border); }
  .bk-table-wrap h3 { color: var(--c-primary); margin-top: 0; }
  .bk-table { width: 100%; border-collapse: collapse; font-size: .9em; }
  .bk-table th, .bk-table td { padding: 10px; border: 1px solid var(--c-border); text-align: left; }
  .bk-table th { background: var(--c-surface-2); color: var(--c-primary); position: sticky; top: 0; }
  .bk-table-scroll { max-height: 400px; overflow-y: auto; }
  .bk-message { color: var(--c-accent, #ff5722); margin-top: var(--s-4); font-weight: bold; min-height: 1.2em; }
  .bk-progress-wrap { width: 100%; height: 10px; background: var(--c-border); border-radius: 5px; margin-bottom: var(--s-4); overflow: hidden; }
  .bk-progress { height: 100%; width: 0%; background: linear-gradient(90deg, #f44336, var(--c-success, #48bb78), var(--c-primary)); transition: width .3s ease; }
  .bk-card { padding: var(--s-5); border-radius: var(--radius); background: var(--c-surface); box-shadow: var(--shadow); min-height: 180px; border-bottom: 5px solid var(--c-secondary, #ff5722); transition: transform .5s ease-out, opacity .5s ease-out; }
  .bk-question { font-size: 1.9em; font-weight: 700; color: var(--c-text); margin: 0 0 var(--s-4); line-height: 1.2; text-align: center; word-break: break-word; }
  .bk-answer { font-size: 1.5em; color: var(--c-primary); margin-top: var(--s-3); font-weight: 500; text-align: center; word-break: break-word; }
  .bk-hidden { opacity: 0 !important; height: 0 !important; visibility: hidden !important; margin: 0 !important; }
  .bk-hidden.visible { opacity: 1 !important; height: auto !important; visibility: visible !important; margin-top: var(--s-3) !important; }
  .bk-controls { display: flex; justify-content: center; flex-wrap: wrap; margin-top: var(--s-4); }
  .bk-reset { opacity: 0 !important; transform: scale(.8) !important; }
  .bk-slide-left { opacity: 0; transform: translateX(-100%) scale(.9); }
  .bk-zoom { opacity: 0; transform: scale(.6) rotateZ(-5deg); }
  .bk-flip { opacity: 0; transform: rotateY(90deg); }
  .bk-counter { margin-top: var(--s-4); color: var(--c-text-2); text-align: center; font-style: italic; }
  @media (max-width: 650px) {
    .bk-question { font-size: 1.5em; } .bk-answer { font-size: 1.2em; }
    .bk-btn { width: 100%; margin: 6px 0; } .bk-controls { flex-direction: column; }
  }
`;

const EFFECTS = ['bk-slide-left', 'bk-zoom', 'bk-flip'];

export function render() {
  const page = createEl('div', { class: 'bk-page' });

  const style = document.createElement('style');
  style.textContent = CSS;
  page.appendChild(style);

  // State
  let rawData = [];
  let shuffledData = [];
  let currentCardIndex = 0;
  let isReversed = false;
  let globalDataList = DATA_LIST;

  let messageDiv, flashcard, cardQuestion, cardAnswer;
  let toggleBtn, reverseBtn, nextBtn;
  let progressBar, cardCounter, totalCards;
  let dataTableContainer, dataTableTbody;

  // === BUILD DOM ===
  page.appendChild(createEl('h1', { class: 'bk-title' }, ['✨ Flashcard Belajar CSV']));
  page.appendChild(createEl('p', { class: 'bk-sub' }, ['Pilih data dari daftar, atau masukkan URL/unggah file.']));

  // Load section
  const loadSection = createEl('div', { class: 'bk-load' });

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'bk-input';
  searchInput.placeholder = 'Cari atau pilih set data dari daftar...';
  loadSection.appendChild(searchInput);

  const dataSelect = document.createElement('select');
  dataSelect.className = 'bk-input';
  loadSection.appendChild(dataSelect);

  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.className = 'bk-input';
  urlInput.placeholder = 'URL CSV publik Sheets (diisi otomatis dari daftar atau manual)';
  loadSection.appendChild(urlInput);

  const filterInput = document.createElement('input');
  filterInput.type = 'text';
  filterInput.className = 'bk-input';
  filterInput.placeholder = 'Filter teks: Pisahkan dengan koma jika lebih dari satu (opsional)';
  loadSection.appendChild(filterInput);

  const rangeInput = document.createElement('input');
  rangeInput.type = 'text';
  rangeInput.className = 'bk-input';
  rangeInput.placeholder = 'Rentang Baris Data: Contoh 1-20 (Baris A2/B2 hingga A21/B21)';
  loadSection.appendChild(rangeInput);

  const modeGroup = createEl('label', { class: 'bk-mode' });
  const shuffleMode = document.createElement('input');
  shuffleMode.type = 'checkbox';
  shuffleMode.checked = true;
  modeGroup.appendChild(shuffleMode);
  modeGroup.appendChild(document.createTextNode('Mode Acak (Hilangkan centang untuk urutan sequential)'));
  loadSection.appendChild(modeGroup);

  const uploadLabel = createEl('label', { class: 'bk-upload' }, ['📂 Pilih File CSV']);
  const csvFile = document.createElement('input');
  csvFile.type = 'file';
  csvFile.accept = '.csv';
  csvFile.style.display = 'none';
  uploadLabel.appendChild(csvFile);
  loadSection.appendChild(uploadLabel);

  const fileNameDisplay = createEl('span', { class: 'bk-filename' }, ['Belum ada file dipilih atau URL dimasukkan.']);
  loadSection.appendChild(fileNameDisplay);

  const loadBtn = createEl('button', { class: 'bk-btn bk-btn-green', type: 'button' }, ['▶️ Muat Data']);
  const viewDataBtn = createEl('button', { class: 'bk-btn bk-btn-blue', type: 'button' }, ['📋 Lihat Data Tabel']);
  loadSection.appendChild(loadBtn);
  loadSection.appendChild(viewDataBtn);
  page.appendChild(loadSection);

  // Data table container
  dataTableContainer = createEl('div', { class: 'bk-table-wrap', style: { display: 'none' } });
  dataTableContainer.appendChild(createEl('h3', {}, ['Preview Data CSV (Baris Data)']));
  dataTableContainer.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', fontSize: '.9em' } }, ["Gunakan nomor baris ini untuk kolom 'Rentang Baris Data' (misalnya 1-10)."]));
  const tableScroll = createEl('div', { class: 'bk-table-scroll' });
  const dataTable = document.createElement('table');
  dataTable.className = 'bk-table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>#</th><th>Kolom 1 (Q)</th><th>Kolom 2 (A)</th></tr>';
  const tbody = document.createElement('tbody');
  dataTable.append(thead, tbody);
  tableScroll.appendChild(dataTable);
  dataTableContainer.appendChild(tableScroll);
  const closeTableBtn = createEl('button', { class: 'bk-btn bk-btn-red', type: 'button', style: { marginTop: '15px', width: '100%' } }, ['Tutup Tabel']);
  dataTableContainer.appendChild(closeTableBtn);
  page.appendChild(dataTableContainer);

  messageDiv = createEl('div', { class: 'bk-message' });
  page.appendChild(messageDiv);

  // Progress bar
  const progressWrap = createEl('div', { class: 'bk-progress-wrap' });
  progressBar = createEl('div', { class: 'bk-progress' });
  progressWrap.appendChild(progressBar);
  page.appendChild(progressWrap);

  // Flashcard
  flashcard = createEl('div', { class: 'bk-card' });
  cardQuestion = createEl('p', { class: 'bk-question' }, ['Unggah data untuk memulai sesi belajar.']);
  cardAnswer = createEl('p', { class: 'bk-answer bk-hidden' });
  flashcard.appendChild(cardQuestion);
  flashcard.appendChild(cardAnswer);

  const controls = createEl('div', { class: 'bk-controls' });
  toggleBtn = createEl('button', { class: 'bk-btn bk-btn-blue', type: 'button' }, ['Tampilkan Jawaban']);
  reverseBtn = createEl('button', { class: 'bk-btn bk-btn-purple', type: 'button' }, ['Balik Mode (Q/A)']);
  nextBtn = createEl('button', { class: 'bk-btn bk-btn-orange', type: 'button' }, ['Kartu Berikutnya »']);
  controls.append(toggleBtn, reverseBtn, nextBtn);
  flashcard.appendChild(controls);

  const counterP = createEl('p', { class: 'bk-counter' }, ['Kartu ke: ']);
  cardCounter = createEl('span', {}, ['0']);
  counterP.appendChild(cardCounter);
  counterP.appendChild(document.createTextNode(' dari '));
  totalCards = createEl('span', {}, ['0']);
  counterP.appendChild(totalCards);
  flashcard.appendChild(counterP);
  page.appendChild(flashcard);

  // === FUNCTIONS ===
  function filterDataList() {
    const search = searchInput.value.toLowerCase();
    dataSelect.innerHTML = '<option value="">-- Pilih Set Data Tersimpan --</option>';
    const filtered = globalDataList.filter((item) => item.nama.toLowerCase().includes(search));
    filtered.forEach((item) => {
      const o = document.createElement('option');
      o.value = item.url;
      o.textContent = item.nama;
      dataSelect.appendChild(o);
    });
    if (filtered.length === 0 && search.length > 0) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'Tidak ada hasil.';
      dataSelect.appendChild(o);
    }
  }

  function updateUrlFromSelect() {
    urlInput.value = dataSelect.value;
    searchInput.value = '';
    if (dataSelect.value) processCSV();
  }

  function displayFileName() {
    const file = csvFile.files[0];
    const url = urlInput.value.trim();
    if (file) {
      fileNameDisplay.textContent = `File terpilih: ${file.name}`;
      urlInput.value = '';
    } else if (url) {
      const sel = globalDataList.find((item) => item.url === url);
      fileNameDisplay.textContent = sel ? `Menggunakan data: ${sel.nama} (dari URL)` : `Menggunakan data dari URL: ${url.substring(0, 30)}...`;
    } else {
      fileNameDisplay.textContent = 'Belum ada file dipilih atau URL dimasukkan.';
    }
  }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function updateProgress() {
    const total = shuffledData.length;
    const percentage = total ? (currentCardIndex / total) * 100 : 0;
    progressBar.style.width = percentage.toFixed(2) + '%';
    if (currentCardIndex === 0 && total > 0) {
      messageDiv.textContent = shuffleMode.checked
        ? '🎉 Sesi belajar selesai! File diacak ulang dan diulang dari awal.'
        : '🎉 Sesi belajar selesai! File diulang dari awal (sequential).';
    } else if (currentCardIndex !== 0) {
      messageDiv.textContent = '';
    }
  }

  function displayDataTableContent() {
    tbody.innerHTML = '';
    rawData.forEach((item, index) => {
      const row = tbody.insertRow();
      const rc = row.insertCell();
      rc.textContent = index + 1;
      const cq = row.insertCell();
      cq.textContent = item[0] || '—';
      const ca = row.insertCell();
      ca.textContent = item[1] || '—';
      if (index % 2 === 1) row.style.backgroundColor = 'var(--c-surface-2)';
    });
    dataTableContainer.style.display = 'block';
    messageDiv.textContent = `Tabel menampilkan ${rawData.length} baris data yang valid.`;
  }

  function toggleDataTable() {
    if (dataTableContainer.style.display === 'block') {
      dataTableContainer.style.display = 'none';
      messageDiv.textContent = '';
      return;
    }
    if (rawData.length === 0) {
      messageDiv.textContent = '❗ Muat data CSV terlebih dahulu sebelum melihat tabel.';
      dataTableContainer.style.display = 'none';
      return;
    }
    displayDataTableContent();
  }

  function handleCSVText(text) {
    let lines = text.trim().split('\n').filter((line) => line.trim() !== '');
    if (lines.length === 0) {
      messageDiv.textContent = '❗ Data CSV kosong.';
      flashcard.style.display = 'none';
      return;
    }
    const firstLine = lines[0];
    let delimiter = firstLine.includes(';') ? ';' : ',';
    lines.shift();

    let tempRawData = lines.map((line) => {
      const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length > 1) return [cols[0], cols[1]];
      return ['', ''];
    });

    const rangeInputVal = rangeInput.value.trim();
    let rowStart = 1, rowEnd = Infinity;
    if (rangeInputVal) {
      const parts = rangeInputVal.split('-');
      if (parts.length === 2 && !isNaN(parseInt(parts[0])) && !isNaN(parseInt(parts[1]))) {
        rowStart = Math.max(1, parseInt(parts[0]));
        rowEnd = parseInt(parts[1]);
        if (rowStart > rowEnd) [rowStart, rowEnd] = [rowEnd, rowStart];
        tempRawData = tempRawData.slice(rowStart - 1, rowEnd);
      } else if (parts.length === 1 && !isNaN(parseInt(parts[0]))) {
        rowStart = Math.max(1, parseInt(parts[0]));
        tempRawData = tempRawData.slice(rowStart - 1, Infinity);
      }
    }

    rawData = tempRawData.filter((item) => item[0] !== '' && item[1] !== '');

    const filterTextRaw = filterInput.value.trim().toLowerCase();
    const filters = filterTextRaw ? filterTextRaw.split(',').map((f) => f.trim()).filter((f) => f.length > 0) : [];

    let filteredData = rawData;
    if (filters.length > 0) {
      filteredData = rawData.filter((item) => {
        const itemText = (item[0] + ' ' + item[1]).toLowerCase();
        return filters.some((filter) => itemText.includes(filter));
      });
    }

    if (shuffleMode.checked) shuffleArray(filteredData);
    shuffledData = filteredData;
    currentCardIndex = 0;

    if (shuffledData.length === 0) {
      messageDiv.textContent = filters.length > 0
        ? '❗ Data kosong atau tidak ada yang cocok dengan filter.'
        : '❗ Data CSV kosong atau rentang baris tidak valid.';
      flashcard.style.display = 'none';
      return;
    }

    totalCards.textContent = shuffledData.length;
    flashcard.style.display = 'block';
    const modeStatus = shuffleMode.checked ? 'acak' : 'sequential';
    messageDiv.textContent = `✅ Berhasil memuat ${shuffledData.length} pasangan data dalam mode ${modeStatus}.`;
    displayCard(false);
    updateProgress();
  }

  function processCSV() {
    const url = urlInput.value.trim();
    messageDiv.textContent = '';
    dataTableContainer.style.display = 'none';
    displayFileName();

    if (url) {
      messageDiv.textContent = '⏳ Memuat data dari URL...';
      fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`Gagal memuat: ${response.statusText} (${response.status})`);
          return response.text();
        })
        .then((text) => handleCSVText(text))
        .catch((error) => {
          messageDiv.textContent = `❌ Error memuat URL: ${error.message}. Pastikan URL publik dan CORS diizinkan.`;
          flashcard.style.display = 'none';
        });
      return;
    }

    const file = csvFile.files[0];
    if (!file) {
      messageDiv.textContent = '❗ Pilih file CSV atau masukkan URL/pilih dari daftar!';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => handleCSVText(e.target.result);
    reader.onerror = () => { messageDiv.textContent = '❌ Error saat membaca file.'; };
    reader.readAsText(file);
  }

  function displayCard(showAnswer) {
    if (shuffledData.length === 0) return;
    const data = shuffledData[currentCardIndex];
    let q = data[0], a = data[1];
    if (isReversed) [q, a] = [a, q];
    cardQuestion.textContent = q || 'Kosong';
    cardAnswer.textContent = a || 'Kosong';
    if (showAnswer) {
      cardAnswer.classList.remove('bk-hidden');
      cardAnswer.classList.add('visible');
      toggleBtn.textContent = 'Sembunyikan Jawaban';
    } else {
      cardAnswer.classList.remove('visible');
      cardAnswer.classList.add('bk-hidden');
      toggleBtn.textContent = 'Tampilkan Jawaban';
    }
    cardCounter.textContent = currentCardIndex + 1;
  }

  function toggleCard() {
    const isVisible = cardAnswer.classList.contains('visible');
    displayCard(!isVisible);
  }

  function toggleReverseMode() {
    isReversed = !isReversed;
    reverseBtn.textContent = isReversed ? 'Mode: Jawaban (A/Q)' : 'Mode: Pertanyaan (Q/A)';
    displayCard(false);
  }

  function nextCard() {
    if (shuffledData.length === 0) return;
    const effect = EFFECTS[Math.floor(Math.random() * EFFECTS.length)];
    flashcard.classList.add(effect);
    setTimeout(() => {
      flashcard.classList.remove(effect);
      currentCardIndex = (currentCardIndex + 1) % shuffledData.length;
      displayCard(false);
      flashcard.classList.add('bk-reset');
      void flashcard.offsetHeight;
      flashcard.classList.remove('bk-reset');
      updateProgress();
    }, 500);
  }

  // === WIRE EVENTS ===
  searchInput.addEventListener('input', filterDataList);
  dataSelect.addEventListener('change', updateUrlFromSelect);
  loadBtn.addEventListener('click', processCSV);
  viewDataBtn.addEventListener('click', toggleDataTable);
  closeTableBtn.addEventListener('click', toggleDataTable);
  toggleBtn.addEventListener('click', toggleCard);
  reverseBtn.addEventListener('click', toggleReverseMode);
  nextBtn.addEventListener('click', nextCard);

  // Init
  filterDataList();

  return page;
}