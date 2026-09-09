/* pages/tools/jepunese-2/jepunese.js — Belajar Karakter Jepang
 * Konversi dari tools/jepunese/ (index.html + script.js + style.css + data/) ke module SPA.
 * Font Awesome lokal diganti CDN; tema mengikuti aplikasi; data dimuat relatif ke modul. */
import { createEl } from '../../../utils/dom.js';

// Base URL folder data (disalin ke folder ini)
const DATA_BASE = new URL('data/', import.meta.url).href;
const FONT_AWESOME_URL = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';

function ensureFontAwesome() {
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONT_AWESOME_URL;
    document.head.appendChild(l);
  }
}

const CSS = `/* Menggunakan SEMUA bobot dan gaya font lokal Poppins yang Anda punya */
  /* Asumsi file font Poppins berada di folder 'fonts/poppins/' */
  @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-Thin.ttf') format('truetype'); font-weight: 100; font-style: normal; }
  @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-ThinItalic.ttf') format('truetype'); font-weight: 100; font-style: italic; }
  @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-ExtraLight.ttf') format('truetype'); font-weight: 200; font-style: normal; }
  @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-ExtraLightItalic.ttf') format('truetype'); font-weight: 200; font-style: italic; }
  @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-Light.ttf') format('truetype'); font-weight: 300; font-style: normal; }
  @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-LightItalic.ttf') format('truetype'); font-weight: 300; font-style: italic; }
  @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-Regular.ttf') format('truetype'); font-weight: normal; /* 400 */ font-style: normal; }
   @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-Italic.ttf') format('truetype'); font-weight: normal; /* 400 */ font-style: italic; }
  @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-Medium.ttf') format('truetype'); font-weight: 500; font-style: normal; }
   @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-MediumItalic.ttf') format('truetype'); font-weight: 500; font-style: italic; }
  @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-SemiBold.ttf') format('truetype'); font-weight: 600; font-style: normal; }
   @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-SemiBoldItalic.ttf') format('truetype'); font-weight: 600; font-style: italic; }
  @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-Bold.ttf') format('truetype'); font-weight: bold; /* 700 */ font-style: normal; }
   @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-BoldItalic.ttf') format('truetype'); font-weight: bold; /* 700 */ font-style: italic; }
  @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-ExtraBold.ttf') format('truetype'); font-weight: 800; font-style: normal; }
   @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-ExtraBoldItalic.ttf') format('truetype'); font-weight: 800; font-style: italic; }
  @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-Black.ttf') format('truetype'); font-weight: 900; font-style: normal; }
   @font-face { font-family: 'Poppins'; src: url('fonts/poppins/Poppins-BlackItalic.ttf') format('truetype'); font-weight: 900; font-style: italic; }


  /* Menambahkan SEMUA bobot font lokal Noto Sans JP yang Anda punya */
  /* Asumsi file font Noto Sans JP berada di folder 'fonts/notosansjp/' */
  @font-face { font-family: 'Noto Sans JP'; src: url('fonts/notosansjp/NotoSansJP-Thin.ttf') format('truetype'); font-weight: 100; font-style: normal; }
  @font-face { font-family: 'Noto Sans JP'; src: url('fonts/notosansjp/NotoSansJP-ExtraLight.ttf') format('truetype'); font-weight: 200; font-style: normal; }
  @font-face { font-family: 'Noto Sans JP'; src: url('fonts/notosansjp/NotoSansJP-Light.ttf') format('truetype'); font-weight: 300; font-style: normal; }
  @font-face { font-family: 'Noto Sans JP'; src: url('fonts/notosansjp/NotoSansJP-Regular.ttf') format('truetype'); font-weight: normal; /* 400 */ font-style: normal; }
  @font-face { font-family: 'Noto Sans JP'; src: url('fonts/notosansjp/NotoSansJP-Medium.ttf') format('truetype'); font-weight: 500; font-style: normal; }
   @font-face { font-family: 'Noto Sans JP'; src: url('fonts/notosansjp/NotoSansJP-SemiBold.ttf') format('truetype'); font-weight: 600; font-style: normal; }
   @font-face { font-family: 'Noto Sans JP'; src: url('fonts/notosansjp/NotoSansJP-Bold.ttf') format('truetype'); font-weight: bold; /* 700 */ font-style: normal; }
   @font-face { font-family: 'Noto Sans JP'; src: url('fonts/notosansjp/NotoSansJP-ExtraBold.ttf') format('truetype'); font-weight: 800; font-style: normal; }
   @font-face { font-family: 'Noto Sans JP'; src: url('fonts/notosansjp/NotoSansJP-Black.ttf') format('truetype'); font-weight: 900; font-style: normal; }


  /* Root Variables */
  :root { --primary: #4f46e5; --secondary: #fbbf24; --bg: #f8fafc; --text: #1e293b; --card-bg: #ffffff; --border: #e2e8f0; }
  .jp-root[data-theme="dark"] { --primary: #818cf8; --secondary: #f59e0b; --bg: #1e293b; --text: #f8fafc; --card-bg: #334155; --border: #475569; }

  /* Global Styles */
  * { margin: 0; padding: 0; box-sizing: border-box; transition: background 0.3s, color 0.1s; }
  .jp-root {
   background: var(--bg);
   color: var(--text);
   padding: 20px; /* Padding di .jp-root untuk mencegah konten menempel di tepi layar */
   min-height: 100vh;
   /* Update font stack: Poppins (Latin) -> Noto Sans JP (Japanese) -> Fallbacks */
   font-family: 'Poppins', 'Noto Sans JP', 'Meiryo', 'Yu Gothic', 'Arial Unicode MS', sans-serif;
   position: relative; /* Tambahkan ini untuk konteks positioning absolute */
  }

  /* Header */
  header { text-align: center; margin-bottom: 30px; position: relative; }
  h1 { color: var(--primary); font-weight: 600; margin-bottom: 10px; }

  /* Controls */
  .controls {
   max-width: 1000px;
   margin: 0 auto 20px;
   display: flex;
   flex-wrap: wrap;
   gap: 15px;
   align-items: center;
   justify-content: center;
  }

  .level-selector {
    display: flex;
    flex-wrap: wrap; /* Tambahkan wrap agar tombol level bisa membungkus */
    gap: 5px;
    background: var(--card-bg);
    padding: 5px;
    border-radius: 8px;
    border: 1px solid var(--border);
    justify-content: center; /* Tengahkan tombol level jika membungkus */
  }
  .level-btn { padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: 500; background: transparent; color: var(--text); }
  .level-btn.active { background: var(--primary); color: white; }

  #searchInput {
    flex: 1 0 250px; /* Mengubah flex shorthand: grow=1, shrink=0, basis=250px */
    min-width: 200px; /* Tetap pertahankan min-width */
    padding: 12px;
    background: var(--card-bg); color: var(--text);
    border: 2px solid var(--border); border-radius: 8px; font-size: 1rem; outline: none;
    font-weight: normal;
  }

  /* Pagination Controls */
  .pagination-controls {
    display: flex;
    gap: 10px; /* Gap antara .perPage dan .pagination-buttons di desktop */
    align-items: center;
    justify-content: center; /* Tengahkan kontrol paginasi */
    margin-top: 30px; /* Tambahkan jarak di atas paginasi */
    margin-bottom: 20px; /* Tambahkan jarak di bawah paginasi jika diperlukan */
    flex-direction: row; /* Default layout: row di desktop */
  }

  /* Style untuk kontainer baru .pagination-buttons */
  .pagination-buttons {
      display: flex; /* Gunakan flexbox untuk children (tombol & span) */
      align-items: center; /* Tengahkan secara vertikal */
      gap: 10px; /* Jarak antara tombol dan info halaman */
  }


  select, button {
    padding: 10px 15px;
    background: var(--card-bg);
    color: var(--text);
    border: 2px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    font-weight: normal;
  }

  button:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Status & Message */
  .status { text-align: center; margin: 20px 0; color: var(--primary); font-weight: normal; }
  .message { text-align: center; grid-column: 1 / -1; padding: 20px; color: var(--text); font-weight: normal; }

  /* Theme Toggle (Menggunakan absolute, tidak lagi di dalam .controls) */
  .theme-toggle {
    position: absolute; /* Menggunakan absolute */
    top: 20px; /* Jarak dari atas dokumen */
    right: 20px; /* Jarak dari kanan dokumen */

    background: var(--card-bg);
    border: 2px solid var(--border);
    border-radius: 50%;
    width: 40px; /* Ukuran standar desktop */
    height: 40px; /* Ukuran standar desktop */
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 99; /* Sedikit di bawah FAB jika FAB z-index 100 */
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    transition: background 0.3s, color 0.1s, opacity 0.3s ease-out;
    /* Hapus properti positioning atau margin/float dari percobaan sebelumnya */
  }

.theme-toggle i {
    font-size: 1.2rem; /* Ukuran ikon standar desktop */
    color: var(--text);
}

/* Floating Display Toggle (Tetap fixed) */
.display-toggle-fab {
  position: fixed; /* Tetap menggunakan fixed */
  right: 20px; /* Posisi di kanan untuk desktop */

  /* Posisi vertikal di tengah untuk desktop */
  top: 50%;
  transform: translateY(-50%);

  background: var(--card-bg);
  border: 2px solid var(--border);
  border-radius: 50%;
  width: 40px; /* Ukuran standar desktop */
  height: 40px; /* Ukuran standar desktop */
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  transition: background 0.3s, color 0.1s, opacity 0.3s ease-out; /* Tambahkan transisi opacity */
}

.display-fab-btn {
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 50%;
}

.display-fab-btn i {
    font-size: 1.2rem; /* Samakan ukuran ikon dengan theme toggle desktop */
    color: var(--text);
}

.display-toggle-fab:hover {
    background-color: var(--border);
}

/* Class to hide the FABs (used by JavaScript) */
.hide-fab {
    opacity: 0;
    pointer-events: none; /* Prevent clicks when hidden */
}


  #categoryFilter {
    min-width: 180px;
    background: var(--card-bg); color: var(--text);
    border: 2px solid var(--border); border-radius: 8px; font-size: 1rem; outline: none;
    appearance: none; cursor: pointer; padding: 10px 15px; font-weight: normal;
    background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D'14'%20height%3D'10'%20viewBox%3D'0%200%2014%2010'%20xmlns%3D'http%3A//www.w3.org/2000/svg'%3E%3Cpath%20d%3D'M1%201l6%206%206-6'%20stroke%3D'%23666'%20stroke-width%3D'2'%20fill%3D'none'%20fill-rule%3D'evenodd'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center; background-size: 12px;
    padding-right: 35px;
  }
  #categoryFilter:disabled { opacity: 0.6; cursor: not-allowed; }

  .display-toggle {
    display: flex; align-items: center; gap: 10px;
    background: var(--card-bg); padding: 8px 12px;
    border-radius: 8px; border: 1px solid var(--border);
    flex-shrink: 0; font-weight: normal;
  }

  /* Media Query for Mobile */
  @media (max-width: 768px) {
    .controls { flex-direction: column; align-items: stretch; gap: 10px; }
    #searchInput { width: 100%; flex: 1 0 auto; }
    .display-toggle, #categoryFilter { width: 100%; justify-content: center; }

    /* Modifikasi pagination-controls di mobile */
    .pagination-controls {
      flex-direction: column; /* Stack children (#perPage dan .pagination-buttons) */
      gap: 15px; /* Jarak antara select dan grup tombol */
      align-items: center; /* Tengahkan item secara horizontal */
    }

    /* Atur tampilan select#perPage di mobile */
     .pagination-controls select#perPage {
         width: auto; /* Atau atur lebar spesifik jika perlu */
         min-width: 150px; /* Contoh min-width */
     }


    /* Style untuk kontainer grup tombol .pagination-buttons di mobile */
    .pagination-buttons {
        display: flex; /* Agar tombol & info halaman berdampingan */
        align-items: center; /* Tengahkan secara vertikal */
        justify-content: center; /* Tengahkan grup tombol secara horizontal */
        gap: 10px; /* Jarak antar item di dalam grup tombol */
        width: 100%; /* Agar grup tombol bisa ditengahkan di dalam flex column parent */
    }

    /* Media query for FAB position on smaller screens */
    /* Theme Toggle (menggunakan absolute di mobile juga) */
     .theme-toggle {
         top: 15px; /* Jarak dari atas dokumen di mobile */
         right: 15px; /* Jarak dari kanan dokumen di mobile */
         width: 35px; height: 35px; /* Ukuran di mobile */
     }
      .theme-toggle i { font-size: 1rem; } /* Ikon lebih kecil di mobile */


    .display-toggle-fab {
        /* Override desktop vertical centering for mobile */
        top: 80%; /* Pastikan tetap di tengah vertikal di mobile */
        transform: translateY(-50%); /* Pastikan penengahan vertikal di mobile */
        right: 15px; /* Posisi di kanan di mobile */
        width: 50px; height: 50px; /* Ukuran di mobile */
    }
     .display-fab-btn i {
         font-size: 1rem; /* Samakan ukuran ikon dengan theme toggle mobile */
     }
  }

  .display-toggle-btn { background: transparent; border: none; color: var(--text); cursor: pointer; font-weight: 500; padding: 6px 10px; border-radius: 4px; transition: all 0.2s; }
  .display-toggle-btn.active { background: var(--primary); color: white; font-weight: 600; }


  /* Grid Layout */
  .kanji-grid { /* Container Grid */
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); /* Default grid untuk card */
    gap: 15px;
    max-width: 1000px;
    margin: 0 auto;
  }

  /* Card Style - Mengganti kanji-card menjadi character-card */
  .character-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px 16px; /* Default padding */
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
    text-align: center;
    cursor: pointer;
    overflow: hidden;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    will-change: transform;
    display: flex; /* Default flex untuk konten card */
    flex-direction: column;
    justify-content: center; /* Tengahkan konten secara default */
    align-items: center;
  }

  .character-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
    border-color: rgba(79, 70, 229, 0.2);
  }

  .character-card::after {
    content: "";
    position: absolute; inset: 0;
    background: radial-gradient(circle at 20% 80%, rgba(79, 70, 229, 0.03), transparent 60%);
    opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
  }
  .character-card:hover::after { opacity: 1; }


  /* Konten dalam Card */
  .character-card .primary-char {
    font-size: 2.6rem; font-weight: 600; color: var(--primary); line-height: 1;
    margin-bottom: 10px; /* Default margin */
  }
  .character-card .secondary-text {
     font-size: 0.9rem; font-weight: 500; color: var(--text); /* Default style */
  }

  /* Styles Khusus untuk Card Kanji */
  .character-card.type-kanji {
    /* Sesuaikan padding jika perlu berbeda dari default character-card */
    padding: 24px 16px;
    display: block; /* Kanji Card defaultnya block layout, bukan flex item */
    /* Sesuaikan tinggi minimal jika perlu */
    min-height: auto;
  }
  .character-card.type-kanji .primary-char { /* Untuk Kanji */
     font-size: 2.6rem; font-weight: 600; margin-bottom: 16px; /* Kembalikan style kanji lama */
     /* Color dan line-height sudah di .primary-char */
  }
   .character-card.type-kanji .secondary-text { /* Untuk Furigana, Romaji, Meaning di Kanji Card */
     font-weight: normal; /* Default weight */
   }


  /* Styles Khusus untuk Card Hiragana */
  .character-card.type-hiragana {
     height: 160px; /* Tinggi tetap untuk hiragana card */
     display: flex; /* Gunakan flexbox untuk menengahkan */
     flex-direction: column;
     justify-content: center;
     align-items: center;
     padding: 15px; /* Padding disesuaikan */
     cursor: default;
     border-color: var(--secondary); /* Contoh: border warna kuning untuk Hiragana */
  }

  .character-card.type-hiragana .primary-char { /* Untuk Karakter Hiragana */
     font-size: 3.5rem; /* Ukuran karakter hiragana lebih besar */
     font-weight: 600; /* Bobot hiragana */
     margin-bottom: 5px; /* Jarak dengan romaji */
     color: var(--primary); /* Warna */
     line-height: 1;
  }

   .character-card.type-hiragana .secondary-text { /* Untuk Romaji Hiragana */
     font-size: 1rem; /* Ukuran romaji hiragana */
     font-weight: normal; /* Bobot romaji */
     color: #888; /* Warna romaji */
     font-style: italic; /* Romaji italic */
   }

   /* Styles Khusus untuk Card Katakana (Sama seperti Hiragana tapi beda warna border) */
  .character-card.type-katakana {
     height: 160px; /* Tinggi tetap */
     display: flex;
     flex-direction: column;
     justify-content: center;
     align-items: center;
     padding: 15px;
     cursor: default;
     border-color: #4d96ff; /* Contoh: border warna biru untuk Katakana */
  }

  .character-card.type-katakana .primary-char { /* Untuk Karakter Katakana */
     font-size: 3.5rem;
     font-weight: 600;
     margin-bottom: 5px;
     color: var(--primary);
     line-height: 1;
  }

   .character-card.type-katakana .secondary-text { /* Untuk Romaji Katakana */
     font-size: 1rem;
     font-weight: normal;
     color: #888;
     font-style: italic;
   }


  /* Struktur detail lama dari kanji card (di-inline rendering atau display none) */
  .kanji-card-details { /* Container untuk furigana, romaji, meaning di Kanji Card */
      display: block; /* Defaultnya tampil di Full mode */
  }
  .kanji-card-details .furigana {
    font-size: 0.85rem; font-weight: 500; letter-spacing: 0.5px; color: var(--primary); margin-bottom: 4px;
  }
  .kanji-card-details .romaji {
    font-size: 0.75rem; font-style: italic; color: #888; margin-bottom: 8px;
  }
  .kanji-card-details .meaning {
    font-size: 0.85rem; font-weight: normal; color: var(--text); line-height: 1.5;
  }
  .kanji-card-details .meaning .indo { color: #ff6b6b; margin-top: 2px; }
  .kanji-card-details .meaning .inggris { color: #4d96ff; margin-top: 2px; }


  /* --- Minimal Mode Styles - Terapkan ke kanji-grid container --- */
  /* Perubahan display mode akan mempengaruhi .kanji-grid */

  .kanji-grid.display-minimal .character-card.type-kanji {
     /* Kanji Minimal Mode: Sembunyikan detail, ubah layout */
     height: 160px;
     display: flex; /* Gunakan flexbox */
     flex-direction: column;
     justify-content: center;
     align-items: center;
     padding: 10px;
  }

  .kanji-grid.display-minimal .character-card.type-kanji .kanji-card-details {
      display: none; /* Sembunyikan detail di minimal mode */
  }

   /* Di mode minimal, karakter Hiragana & Katakana tetap tampil, romaji disembunyikan */
  .kanji-grid.display-minimal .character-card.type-hiragana .secondary-text,
  .kanji-grid.display-minimal .character-card.type-katakana .secondary-text {
      display: none; /* Sembunyikan romaji di mode minimal hiragana/katakana */
   }


  /* --- Full Mode Styles - Terapkan ke kanji-grid container --- */
   .kanji-grid.display-full .character-card.type-kanji {
    /* Kanji Full Mode: Tampilkan detail */
    display: block; /* Kembalikan ke block */
    padding: 24px 16px; /* Kembalikan padding */
    min-height: auto;
   }

   .kanji-grid.display-full .character-card.type-kanji .kanji-card-details {
      display: block; /* Pastikan detail terlihat di mode full kanji */
   }

  /* Di mode full, karakter Hiragana & Katakana tetap tampil, romaji juga tampil */
   .kanji-grid.display-full .character-card.type-hiragana .secondary-text,
    .kanji-grid.display-full .character-card.type-katakana .secondary-text {
      display: block; /* Pastikan romaji terlihat di mode full hiragana/katakana */
   }


  /* Responsive Card Styles */
  @media (max-width: 768px) {
    .kanji-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
    .character-card { padding: 15px; }
    .character-card .primary-char { font-size: 2rem; }
    .character-card.type-hiragana .primary-char,
    .character-card.type-katakana .primary-char { font-size: 3rem; } /* Hiragana/Katakana size di mobile */
    .character-card .secondary-text { font-size: 0.8rem; }
    .character-card.type-hiragana .secondary-text,
    .character-card.type-katakana .secondary-text { font-size: 0.9rem; } /* Romaji hiragana/katakana di mobile */
  }


  /* --- Styles untuk Modal Flashcard (Hanya untuk Kanji) --- */
  .kanji-modal {
    display: none; /* Sembunyikan secara default */
    position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto;
    background-color: rgba(0, 0, 0, 0.6); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
    justify-content: center; align-items: center; animation: fadeIn 0.3s ease-out;
  }
  .kanji-modal.visible { display: flex; }
  .modal-content {
    background: var(--card-bg); color: var(--text); margin: auto; padding: 30px; border-radius: 15px;
    border: 2px solid var(--border); max-width: 500px; width: 90%; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    position: relative; animation: scaleUp 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    display: flex; flex-direction: column; gap: 15px;
  }
  .close-button { color: #aaa; position: absolute; top: 15px; right: 25px; font-size: 28px; font-weight: bold; cursor: pointer; transition: color 0.3s ease; }
  .close-button:hover, .close-button:focus { color: var(--primary); text-decoration: none; }

  /* Konten Modal (Hanya untuk Detail Kanji) */
  .modal-kanji { font-size: 4rem; font-weight: bold; text-align: center; color: var(--primary); margin-bottom: 5px; }
  .modal-furigana { font-size: 1.2rem; text-align: center; color: var(--primary); margin-bottom: 10px; }
  .modal-romaji { font-size: 1rem; text-align: center; font-style: italic; color: #888; margin-bottom: 15px; }
  .modal-meaning { border-top: 1px solid var(--border); padding-top: 15px; text-align: center; }
  .modal-meaning div { margin-bottom: 5px; font-size: 1.1rem; }
  .modal-meaning .modal-indo { color: #ff6b6b; }
  .modal-meaning .modal-inggris { color: #4d96ff; }
  .modal-readings { border-top: 1px solid var(--border); padding-top: 15px; display: flex; justify-content: space-around; gap: 10px; }
  .modal-onyomi, .modal-kunyomi { flex: 1; }
  .modal-readings strong { display: block; margin-bottom: 5px; color: var(--primary); }
  .modal-readings ul { list-style: none; padding: 0; margin: 0; font-size: 0.95rem; }
  .modal-readings li { margin-bottom: 3px; }
  .modal-info { border-top: 1px solid var(--border); padding-top: 15px; display: flex; justify-content: space-between; font-size: 0.9rem; color: #666; }
  .modal-kategori::before { content: "Kategori: "; font-weight: 600; }
  .modal-jlpt::before { content: "Level: "; font-weight: 600; } /* Mengubah label JLPT */

/* Kontainer untuk tombol aksi di modal */
.modal-actions {
  border-top: 1px solid var(--border); /* Garis pemisah di atas tombol */
  padding-top: 15px; /* Jarak dari konten di atasnya */
  text-align: center; /* Tengahkan tombol */
}

/* Tombol aksi di modal (styled like a button) */
.modal-button {
  display: inline-block; /* Agar padding dan margin bekerja */
  padding: 10px 20px;
  background: var(--primary); /* Warna primary */
  color: white; /* Teks putih */
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  text-decoration: none; /* Hapus garis bawah default link */
  transition: background 0.3s ease;
}

.modal-button:hover {
  background: #6366f1; /* Efek hover: warna sedikit lebih terang */
}

.modal-button i {
  margin-right: 8px; /* Jarak antara ikon dan teks */
}

/* Opsional: Sesuaikan di layar kecil */
@media (max-width: 600px) {
.modal-button { padding: 8px 15px; font-size: 0.9rem; } /* Sesuaikan ukuran tombol di mobile */
.modal-button i { margin-right: 4px; }
}

  /* Animations */
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }

  /* Media Query untuk Modal Responsif */
  @media (max-width: 600px) {
    .modal-content { padding: 20px; width: 95%; }
    .modal-kanji { font-size: 3rem; }
    .modal-furigana { font-size: 1rem; }
    .modal-romaji { font-size: 0.9rem; }
    .modal-meaning div { font-size: 1rem; }
    .modal-readings { flex-direction: column; gap: 15px; }
  }

 /* Styles untuk Footer */
 footer {
  margin-top: 40px; /* Beri sedikit jarak dari konten di atasnya */
  padding: 20px;
  text-align: center;
  background: var(--card-bg); /* Gunakan warna background kartu */
  color: var(--text); /* Gunakan warna teks utama */
  border-top: 1px solid var(--border); /* Tambahkan garis di atas footer */
  font-size: 0.9rem;
 }

 footer p {
  margin: 0; /* Hapus margin default dari paragraf di dalam footer */
 }

/* --- New styles for select mode UI --- */

/* Style for the select controls container */
#selectControls {
    /* Basic styling, adjust as needed */
    margin: 20px auto 15px; /* Space above and below */
    max-width: 1000px; /* Match grid container width */
    text-align: center;
    font-size: 1rem;
    color: var(--text); /* Inherit text color */
    display: flex; /* Use flexbox for button alignment */
    justify-content: center; /* Center the flex items */
    align-items: center;
    flex-wrap: wrap; /* Allow items to wrap on smaller screens */
    gap: 10px; /* Space between items */
}

/* Style for the count span */
#selectControls #selectedCountInfo {
    font-weight: normal;
    color: var(--text);
}

#selectControls #selectedCount {
    font-weight: bold;
    color: var(--primary); /* Highlight the count */
}


/* Style for buttons within select controls */
#selectControls button {
    padding: 8px 12px; /* Adjust padding */
    background: var(--card-bg); /* Button background */
    color: var(--text); /* Button text color */
    border: 1px solid var(--border); /* Button border */
    border-radius: 5px; /* Button corner radius */
    cursor: pointer;
    font-size: 0.9rem;
    transition: background-color 0.2s ease, border-color 0.2s ease;
}

#selectControls button:hover {
    background-color: var(--border); /* Hover effect */
}

#selectControls button#cancelSelectBtn {
    color: #ff6b6b; /* Color for cancel button */
    border-color: #ff6b6b;
}
#selectControls button#cancelSelectBtn:hover {
    background-color: rgba(255, 107, 107, 0.1);
}

#selectControls button#shuffleBtn {
    color: #f59e0b; /* Color for shuffle button (secondary color) */
    border-color: #f59e0b;
}
#selectControls button#shuffleBtn:hover {
     background-color: rgba(245, 158, 11, 0.1);
}

/* New style for the Focus button */
#selectControls button#focusBtn {
    color: #4d96ff; /* Example color for focus button (blue) */
    border-color: #4d96ff;
}
#selectControls button#focusBtn:hover {
     background-color: rgba(77, 150, 255, 0.1);
}


/* Style for the select indicator on the card */
.character-card .select-indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 1.3rem;
    color: #ccc; /* Default color */
    z-index: 5; /* Above other card content */
     /* Ensure pointer events go through to the card */
    pointer-events: none;
}

/* Style for the select indicator when the card is selected */
.character-card.selected .select-indicator {
    color: var(--primary); /* Primary color when selected */
}

/* Optional: Add a border or background change for selected cards */
.character-card.selected {
    border-color: var(--primary); /* Highlight border when selected */
    /* background-color: rgba(79, 70, 229, 0.05); /* Optional: subtle background change */
}

/* Hide the original status text when select controls are shown */
.status[style*="display: none"] {
    display: none;
}

/* Style to hide non-selected cards in focus mode */
.kanji-grid.focus-mode .character-card:not(.selected) {
    display: none !important; /* Hide non-selected cards when focus-mode class is active */
}`;

const BODY = `
 <div class="display-toggle-fab" id="displayToggleFab">
     <button id="displayModeFabToggle" class="display-fab-btn">
         <i class="fas fa-grip-horizontal"></i>
     </button>
 </div>

 <header>
  <h1>Belajar Karakter Jepang</h1> <div class="level-selector" id="levelSelector">
   <button class="level-btn active" data-level="n5">N5</button>
   <button class="level-btn" data-level="n4">N4</button>
   <button class="level-btn" data-level="n3">N3</button>
   <button class="level-btn" data-level="n2">N2</button>
   <button class="level-btn" data-level="n1">N1</button>
   <button class="level-btn" data-level="hiragana">Hiragana</button>
    <button class="level-btn" data-level="katakana">Katakana</button>
  </div>
 </header>

 <div class="controls">
  <input
   type="text"
   id="searchInput"
   placeholder="Cari (Karakter, Romaji, Makna...)" autocomplete="off"
  >

    <select id="categoryFilter" class="category-filter" disabled>
        <option value="">Pilih Kategori</option>
        </select>

  <div class="display-toggle">
    <span>Tampilan:</span>
    <button id="minimalBtn" class="display-toggle-btn active">Minimal</button>
    <button id="fullBtn" class="display-toggle-btn">Lengkap</button>
   </div>
 </div>
 <div class="status" id="statusInfo">Memuat data...</div>
 <div class="kanji-grid" id="kanjiContainer"> <div class="message">Memuat data...</div> </div>

 <div class="pagination-controls">
    <select id="perPage">
     <option value="3">3 per halaman</option>
     <option value="4">4 per halaman</option>
     <option value="5">5 per halaman</option>
     <option value="10">10 per halaman</option>
     <option value="14">14 per halaman</option>
     <option value="28">28 per halaman</option>
     <option value="56">56 per halaman</option>
     <option value="0">Tampilkan Semua</option>
    </select>

    <div class="pagination-buttons">
        <button id="prevBtn"><i class="fas fa-chevron-left"></i></button>
        <span id="pageInfo">Halaman 1</span>
        <button id="nextBtn"><i class="fas fa-chevron-right"></i></button>
    </div>

 </div>
 <div id="kanjiModal" class="kanji-modal">
  <div class="modal-content">
   <span class="close-button">&times;</span>
   <div class="modal-kanji"></div>
   <div class="modal-furigana"></div>
   <div class="modal-romaji"></div>
   <div class="modal-meaning">
    <div class="modal-indo"></div>
    <div class="modal-inggris"></div>
   </div>
   <div class="modal-readings">
    <div class="modal-onyomi">
     <strong>Onyomi:</strong> <ul class="onyomi-list"></ul>
    </div>
    <div class="modal-kunyomi">
     <strong>Kunyomi:</strong> <ul class="kunyomi-list"></ul>
    </div>
  </div>
  <div class="modal-actions">
    <a id="googleSearchButton" href="#" target="_blank" class="modal-button">
        <i class="fas fa-search"></i> Cari di Google
    </a>
   </div>
   <div class="modal-info">
    <div class="modal-kategori"></div>
    <div class="modal-jlpt"></div> </div>
  </div>
 </div>

  <footer>
    <p>&copy; <span id="currentYear"></span> Belajar Karakter Jepang. Dibuat dengan &#x2764;&#xfe0f;.</p>
  </footer>
  
`;

function initJepunese(page) {
let currentLevel = 'n5';
let loadedData = [];
let filteredData = [];
let currentPage = 1;
let perPage = 3;
let displayMode = 'minimal';
let currentDataType = 'kanji';

const levelButtons = page.querySelectorAll('.level-btn');
const searchInput = page.querySelector('#searchInput');
const categoryFilter = page.querySelector('#categoryFilter');
const perPageSelect = page.querySelector('#perPage');
const prevBtn = page.querySelector('#prevBtn');
const nextBtn = page.querySelector('#nextBtn');
const pageInfo = page.querySelector('#pageInfo');
const statusInfo = page.querySelector('#statusInfo');
const kanjiContainer = page.querySelector('#kanjiContainer');

const kanjiModal = page.querySelector('#kanjiModal');
const closeModalBtn = kanjiModal.querySelector('.close-button');
const modalKanji = kanjiModal.querySelector('.modal-kanji');
const modalFurigana = kanjiModal.querySelector('.modal-furigana');
const modalRomaji = kanjiModal.querySelector('.modal-romaji');
const modalIndo = kanjiModal.querySelector('.modal-indo');
const modalInggris = kanjiModal.querySelector('.modal-inggris');
const modalOnyomiList = kanjiModal.querySelector('.onyomi-list');
const modalKunyomiList = kanjiModal.querySelector('.kunyomi-list');
const modalKategori = kanjiModal.querySelector('.modal-kategori');
const modalJlpt = kanjiModal.querySelector('.modal-jlpt');
const googleSearchButton = page.querySelector('#googleSearchButton');

const minimalBtn = page.querySelector('#minimalBtn');
const fullBtn = page.querySelector('#fullBtn');

// Variabel baru untuk FAB display toggle
const displayToggleFab = page.querySelector('#displayToggleFab');
const displayModeFabToggle = page.querySelector('#displayModeFabToggle');

// Variabel untuk Theme Toggle
const themeToggle = page.querySelector("#themeToggle"); // Pastikan ini ada

// --- Revised State Variables ---
let pressTimer = null; // Stores the setTimeout ID for long press
let pressTarget = null; // Stores the card element currently being pressed
let movedDuringPress = false; // True if significant movement occurred during the current press
const LONG_PRESS_TIME = 500; // Duration for long press in milliseconds

let isSelectMode = false; // Global state: is select mode active?
let selectedCards = new Set(); // Stores the identifiers of selected cards

let startX = 0; // Starting X coordinate of a press (for drag detection)
let startY = 0; // Starting Y coordinate of a press (for drag detection)
const MOVE_THRESHOLD = 15; // Pixels threshold to consider it a move/drag

// --- New State Variable for Focus Mode ---
let isFocusMode = false;

// --- Variables for Auto-hide FABs on Mobile ---
let hideFabTimer; // Variable to store the timer ID
const HIDE_DELAY = 10000; // 10 seconds delay

const selectControlsContainer = document.createElement('div');
selectControlsContainer.id = 'selectControls';
selectControlsContainer.style.textAlign = 'center';
selectControlsContainer.style.marginBottom = '15px';
selectControlsContainer.style.fontWeight = 'normal';
selectControlsContainer.style.color = 'var(--text)';
selectControlsContainer.style.display = 'none';


function bootstrap() {
    if (kanjiContainer && kanjiContainer.parentNode) {
         kanjiContainer.parentNode.insertBefore(selectControlsContainer, kanjiContainer);
    } else {
        console.error("Error: kanjiContainer or its parent not found.");
    }

    loadLevelData(currentLevel);
    setupEventListeners();
    applyAppTheme();
    const currentYearSpan = page.querySelector('#currentYear');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    // Add global mouse/touch move/end listeners for robust drag/cleanup detection
    document.addEventListener('mousemove', handleGlobalMouseMove, true);
    document.addEventListener('mouseup', handleGlobalMouseEnd);
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleGlobalTouchEnd);

    // Panggil setDisplayMode di sini untuk mengatur ikon FAB berdasarkan mode awal ('minimal')
    setDisplayMode(displayMode);

    // --- Auto-hide FABs on Mobile Logic ---

    // Add scroll listener to window
    window.addEventListener('scroll', () => {
        // Show FABs immediately when scrolling starts
        showFabs();
        // Reset the timer to hide them after scrolling stops
        resetHideFabTimer();
    });

    // Initial state on page load: show FABs and set the timer if on mobile
    if (isMobileView()) {
         showFabs(); // Ensure FABs are visible initially
         resetHideFabTimer(); // Start the timer to hide them after inactivity
    } else {
        // On desktop/non-mobile views, ensure FABs are always visible
         showFabs();
         // Clear any potential lingering timer if resized from mobile
         clearTimeout(hideFabTimer);
    }

    // Optional: Handle window resize event
    window.addEventListener('resize', () => {
        if (isMobileView()) {
            // If resized to mobile view, show FABs and start the hide timer
            showFabs();
            resetHideFabTimer();
        } else {
            // If resized to non-mobile view, ensure FABs are visible and clear the timer
            showFabs();
            clearTimeout(hideFabTimer);
        }
    });

    // --- End Auto-hide FABs Logic ---

}

async function loadLevelData(level) {
    try {
        statusInfo.textContent = `Memuat data ${level.toUpperCase()}...`;
        if (kanjiContainer) {
             kanjiContainer.innerHTML = '<div class="message">Memuat data...</div>';
        }
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        if (pageInfo) pageInfo.textContent = '';
        if (searchInput) searchInput.disabled = true;
        if (categoryFilter) categoryFilter.disabled = true;
        if (perPageSelect) perPageSelect.disabled = true;


        let filePath;
        let data;

        if (level.startsWith('n')) {
            filePath = `${DATA_BASE}jlpt_${level}.json`;
            currentDataType = 'kanji';
            const response = await fetch(filePath);
            if (!response.ok) { throw new Error(`Gagal memuat data ${level.toUpperCase()} karena file tidak ditemukan atau ada masalah: ${response.status}`); }
            data = await response.json();
            loadedData = data;
        } else if (level === 'hiragana') {
            filePath = `${DATA_BASE}hirakana.json`;
            currentDataType = 'hiragana';
            const response = await fetch(filePath);
            if (!response.ok) { throw new Error(`Gagal memuat data Hiragana karena file tidak ditemukan atau ada masalah: ${response.status}`); }
            data = await response.json();
            loadedData = data.hiragana;
        } else if (level === 'katakana') {
            filePath = `${DATA_BASE}hirakana.json`; // Assuming hirakana.json also contains katakana
            currentDataType = 'katakana';
             const response = await fetch(filePath);
            if (!response.ok) { throw new Error(`Gagal memuat data Katakana karena file tidak ditemukan atau ada masalah: ${response.status}`); }
            data = await response.json();
            loadedData = data.katakana; // Assuming katakana data is under a 'katakana' key
        } else {
            loadedData = [];
            currentDataType = 'unknown';
        }

        filteredData = [...loadedData]; // Initially filteredData is the same as loadedData
        currentPage = 1;

        // Reset select mode and focus mode on level change
        toggleSelectMode(false);
        isFocusMode = false;


        populateCategoryFilter(loadedData, currentDataType);

        if (searchInput) searchInput.disabled = false;
        if (categoryFilter) categoryFilter.disabled = false;
        if (perPageSelect) perPageSelect.disabled = false;


        updateStatus();

        levelButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.level === level);
        });

    } catch (error) {
        if (kanjiContainer) {
            kanjiContainer.innerHTML = `
                <div class="message error" style="color: red;">
                    Gagal memuat data ${level.toUpperCase() || currentLevel}.
                    <br><strong>Error:</strong> ${error.message}
                    <br>Pastikan file data ada di folder yang benar.
                </div>
            `;
        }
        console.error("Error loading data:", error);
        if (statusInfo) statusInfo.textContent = `Gagal memuat data ${level.toUpperCase() || currentLevel}.`;

        if (searchInput) searchInput.disabled = true;
        if (categoryFilter) categoryFilter.disabled = true;
        if (perPageSelect) perPageSelect.disabled = true;
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        if (pageInfo) pageInfo.textContent = '';
        loadedData = [];
        filteredData = [];
        populateCategoryFilter([], currentDataType);
         toggleSelectMode(false);
         isFocusMode = false;
    }
}

function populateCategoryFilter(data, dataType) {
    const categories = new Set();
    // Assuming both kanji and hiragana/katakana items have a 'kategori' property
    data.forEach(item => {
        if (item.kategori) {
            categories.add(item.kategori);
        }
    });


    if (categoryFilter) {
        categoryFilter.innerHTML = '<option value="">Pilih Kategori</option>';
        const sortedCategories = Array.from(categories).sort();
        sortedCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });

        // Disable filter if no categories found for the current data type
        categoryFilter.disabled = sortedCategories.length === 0;
    }

    // Update search input placeholder based on data type
    if (searchInput) {
        if (dataType === 'kanji') {
            searchInput.placeholder = 'Cari kanji (contoh: 水, mizu, air...)';
        } else if (dataType === 'hiragana') {
             searchInput.placeholder = 'Cari Hiragana (contoh: あ, a)';
        } else if (dataType === 'katakana') {
             searchInput.placeholder = 'Cari Katakana (contoh: ア, a)';
        } else {
             searchInput.placeholder = 'Cari...';
        }
    }
}

function setupEventListeners() {
    levelButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentLevel = btn.dataset.level;
            currentPage = 1;
            if(searchInput) searchInput.value = ''; // Clear search input on level change
            if(categoryFilter) categoryFilter.value = ''; // Reset category filter on level change
            loadLevelData(currentLevel);
        });
    });

    setupDisplayToggleListeners(); // Listeners for top display buttons

    if(searchInput) searchInput.addEventListener('input', debounce(handleSearch, 300));

    if(categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            currentPage = 1;
            handleSearch();
        });
    }

    if(perPageSelect) {
        perPageSelect.addEventListener('change', () => {
            perPage = parseInt(perPageSelect.value);
            currentPage = 1;
            // Exit focus mode if changing pagination
            isFocusMode = false;
            // No need to clear selections or toggle select mode here
            renderCharacters(filteredData, currentDataType); // Render based on current filteredData
            updateStatus();
        });
    }

    if(prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                // Exit focus mode if changing page
                 isFocusMode = false;
                // No need to clear selections or toggle select mode here
                renderCharacters(filteredData, currentDataType); // Render based on current filteredData
                updateStatus();
            }
        });
    }

    if(nextBtn) {
        nextBtn.addEventListener('click', () => {
            // Pagination logic should be based on the data that would be displayed if not in focus mode
            const dataForPagination = isFocusMode ? filteredData : filteredData; // Always use filteredData for pagination count
            const totalPages = perPage === 0 ? 1 : Math.ceil(dataForPagination.length / perPage);

            if (perPage !== 0 && currentPage < totalPages) {
                currentPage++;
                // Exit focus mode if changing page
                 isFocusMode = false;
                 // No need to clear selections or toggle select mode here
                renderCharacters(filteredData, currentDataType); // Render based on current filteredData
                updateStatus();
            }
        });
    }

    if(themeToggle) themeToggle.addEventListener('click', toggleTheme); // Event listener for theme toggle

    if(closeModalBtn) closeModalBtn.addEventListener('click', hideKanjiModal);
    if(kanjiModal) {
        kanjiModal.addEventListener('click', (event) => {
            if (event.target === kanjiModal) {
                hideKanjiModal();
            }
        });
    }

    // Event listener untuk tombol FAB display toggle
    if (displayModeFabToggle) {
        displayModeFabToggle.addEventListener('click', handleFabDisplayToggle);
    }

    // Using delegation on selectControlsContainer for select mode buttons
     if (selectControlsContainer) {
         selectControlsContainer.addEventListener('click', (event) => {
             const target = event.target;
             // Check if the clicked element or its parent is a button with the target ID
             const clickedButton = target.closest('button');
             if (clickedButton) {
                 if (clickedButton.id === 'focusBtn') {
                     handleFocusToggle();
                 } else if (clickedButton.id === 'shuffleBtn') {
                     handleShuffleDisplay();
                 } else if (clickedButton.id === 'selectAllBtn') {
                     handleSelectAllToggle();
                 } else if (clickedButton.id === 'cancelSelectBtn') {
                     handleCancelSelect();
                 }
             }
         });
     }
}

function setupDisplayToggleListeners() {
    // These listeners are for the original buttons in the .controls div
    if(minimalBtn) {
        minimalBtn.addEventListener('click', () => {
            setDisplayMode('minimal');
        });
    }
    if(fullBtn) {
        fullBtn.addEventListener('click', () => {
            setDisplayMode('full');
        });
    }
}

// Fungsi untuk menangani klik pada tombol FAB display toggle
function handleFabDisplayToggle() {
    console.log("Tombol FAB Display diklik!"); // Debug log
    // Tentukan mode baru berdasarkan mode saat ini
    const newMode = displayMode === 'minimal' ? 'full' : 'minimal';
    // Panggil setDisplayMode untuk mengganti tampilan dan memperbarui semua tombol
    setDisplayMode(newMode);
}


function setDisplayMode(mode) {
    console.log("Memanggil setDisplayMode dengan mode:", mode); // Debug log
    displayMode = mode;
    if (kanjiContainer) {
        // Remove both classes first
        kanjiContainer.classList.remove('display-minimal', 'display-full');

        // Update top buttons and FAB icon based on the new mode
        if (mode === 'minimal') {
            kanjiContainer.classList.add('display-minimal');
            // Update top buttons
            if(minimalBtn) minimalBtn.classList.add('active');
            if(fullBtn) fullBtn.classList.remove('active');
            // Update FAB icon
            if (displayModeFabToggle) {
                const icon = displayModeFabToggle.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-list'); // Hapus ikon mode full
                    icon.classList.add('fa-grip-horizontal'); // Tambahkan ikon mode minimal
                }
            }
        } else { // mode === 'full'
            kanjiContainer.classList.add('display-full');
            // Update top buttons
            if(fullBtn) fullBtn.classList.add('active');
            if(minimalBtn) minimalBtn.classList.remove('active');
            // Update FAB icon
            if (displayModeFabToggle) {
                const icon = displayModeFabToggle.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-grip-horizontal'); // Hapus ikon mode minimal
                    icon.classList.add('fa-list'); // Tambahkan ikon mode full
                }
            }
        }
    }
    // Re-render characters with the current selections and focus state
    renderCharacters(isFocusMode ? getFocusedData() : filteredData, currentDataType);
}

function handleSearch() {
    const keyword = searchInput.value.toLowerCase().trim();
    const selectedCategory = categoryFilter.value;

    filteredData = loadedData.filter(item => {
        let matchesKeyword = false;

        if (!keyword) {
            matchesKeyword = true;
        } else {
            if (currentDataType === 'kanji') {
                const kanji = item.kanji || '';
                const furigana = item.furigana ? item.furigana.toLowerCase() : '';
                const romaji = item.romaji ? item.romaji.toLowerCase() : '';
                const indo = item.indo ? item.indo.toLowerCase() : '';
                const inggris = item.inggris ? item.inggris.toLowerCase() : '';
                const onyomiMatch = (item.onyomi && item.onyomi.some(o => (o.kana || '').toLowerCase().includes(keyword) || (o.romaji || '').toLowerCase().includes(keyword)));
                const kunyomiMatch = (item.kunyomi && item.kunyomi.some(k => (k.kana || '').toLowerCase().includes(keyword) || (k.romaji || '').toLowerCase().includes(keyword)));

                matchesKeyword =
                    kanji.includes(keyword) ||
                    furigana.includes(keyword) ||
                    romaji.includes(keyword) ||
                    indo.includes(keyword) ||
                    inggris.includes(keyword) ||
                    onyomiMatch ||
                    kunyomiMatch;

            } else if (currentDataType === 'hiragana' || currentDataType === 'katakana') {
                const karakter = item.karakter || '';
                const romaji = item.romaji ? item.romaji.toLowerCase() : '';

                matchesKeyword =
                    karakter.includes(keyword) ||
                    romaji.includes(keyword);
            }
        }
        const matchesCategory = !selectedCategory || (item.kategori && item.kategori === selectedCategory);

        return matchesKeyword && matchesCategory;
    });

    currentPage = 1;
    // Keep select mode and focus mode state on search
    // toggleSelectMode(false); // REMOVED
    // isFocusMode = false; // REMOVED

    // After filtering, re-render the characters based on the updated filteredData and existing select/focus state
    // If focus mode is active, renderCharacters will call getFocusedData internally,
    // which now correctly filters from loadedData.
    renderCharacters(isFocusMode ? getFocusedData() : filteredData, currentDataType);


    // Update controls and status based on the *new* filtered data and existing select state.
    updateSelectControls();
    updateStatus();
}

function renderCharacters(dataToRender, dataType) {
    if (!kanjiContainer) {
         console.error("Error: kanjiContainer not found.");
         return;
    }
    kanjiContainer.innerHTML = '';

    // Add/remove focus-mode class based on state
    if (isFocusMode) {
        kanjiContainer.classList.add('focus-mode');
    } else {
        kanjiContainer.classList.remove('focus-mode');
    }


    if (dataToRender.length === 0) {
        kanjiContainer.innerHTML = `<div class="message">Tidak ada karakter yang cocok.</div>`;
        // Pagination and status updates are handled by updateStatus
        updateStatus(); // Ensure status, pagination buttons, pageInfo are updated
        updateSelectControls(); // Update select controls visibility and button states
        return;
    }

    let dataSubset;
    // Determine which data to paginate over and display
    const dataForRendering = isFocusMode ? dataToRender : filteredData; // In focus mode, dataToRender is already the subset to show. Otherwise, use filteredData.

    // Pagination logic
    if (isFocusMode || perPage === 0) { // If in focus mode OR perPage is 0, display all relevant items
         dataSubset = dataToRender; // In focus mode, dataToRender *is* the subset to display
         // Pagination controls are managed by updateStatus and updateSelectControls
    } else { // Not in focus mode and perPage is set, use standard pagination on filteredData
        const start = (currentPage - 1) * perPage;
        const end = start + perPage;
        dataSubset = dataForRendering.slice(start, end); // Slice the data based on pagination
        // Pagination controls are managed by updateStatus and updateSelectControls
    }


    let cardsHtml = dataSubset.map(item => {
        const characterId = dataType === 'kanji' ? item.kanji || '' : item.karakter || ''; // Handle potential undefined IDs
        // A card is selected if select mode is on AND its ID is in the selectedCards set
        const isSelected = isSelectMode && selectedCards.has(characterId);
        const selectedClass = isSelected ? ' selected' : '';
        // The select indicator is always rendered if isSelectMode is true
        const selectIndicatorHtml = isSelectMode ? '<div class="select-indicator"><i class="fas fa-check-circle"></i></div>' : '';

        if (dataType === 'kanji') {
             // Ensure data-item attribute is correctly formatted as a string
             const itemDataString = JSON.stringify({
                  kanji: item.kanji || '',
                  furigana: item.furigana || '',
                  romaji: item.romaji || '',
                  indo: item.indo || '',
                  inggris: item.inggris || '',
                  onyomi: item.onyomi || [],
                  kunyomi: item.kunyomi || [],
                  kategori: item.kategori || '',
                  jlpt: item.jlpt || ''
              });
            return `
                <div class="character-card type-kanji${selectedClass}" data-item='${itemDataString}'>
                    ${selectIndicatorHtml}
                    <div class="primary-char">${item.kanji || ''}</div>
                    <div class="kanji-card-details">
                        <div class="furigana">${item.furigana || ''}</div>
                        <div class="romaji">${item.romaji || ''}</div>
                        <div class="meaning">
                            <div class="indo">${item.indo || ''}</div>
                            <div class="inggris">${item.inggris || ''}</div>
                        </div>
                    </div>
                </div>
            `;
        } else if (dataType === 'hiragana' || dataType === 'katakana') {
             // Ensure data-item attribute is correctly formatted as a string
             const itemDataString = JSON.stringify({
                  karakter: item.karakter || '',
                  romaji: item.romaji || '',
                  kategori: item.kategori || ''
             });
            return `
                <div class="character-card type-${dataType}${selectedClass}" data-item='${itemDataString}'>
                    ${selectIndicatorHtml}
                    <div class="primary-char">${item.karakter || ''}</div>
                    <div class="secondary-text">${item.romaji || ''}</div>
                </div>
            `;
        }
        return '';
    }).join('');

    kanjiContainer.innerHTML = cardsHtml;

    // Pagination and status updates are handled by updateStatus
    updateStatus();
    // Update select controls visibility and button states based on current state and data
    updateSelectControls();


    // Add event listeners for card interaction
    const cards = kanjiContainer.querySelectorAll('.character-card');
    cards.forEach(card => {
        // Remove old listeners if any
        card.removeEventListener('click', handleCardClick); // Mostly handled by mouseup/touchend now
        card.removeEventListener('mousedown', handleMouseDown);
        card.removeEventListener('mouseup', handleMouseUp);
        card.removeEventListener('mouseleave', handleMouseLeave);
        card.removeEventListener('touchstart', handleTouchStart);
        card.removeEventListener('touchend', handleTouchEnd);

        // Add new listeners
        card.addEventListener('mousedown', handleMouseDown);
        card.addEventListener('mouseup', handleMouseUp);
        card.addEventListener('mouseleave', handleMouseLeave);
        card.addEventListener('touchstart', handleTouchStart);
        card.addEventListener('touchend', handleTouchEnd);

    });
}


// --- Event Handlers using Revised State ---

function handleMouseDown(event) {
    // Only handle left click
    if (event.button !== 0) return;
    // Only start a new press if one is not already active
    if (pressTarget !== null) {
         // If a press is already active, something unexpected happened (e.g., right click during left click press).
         // Clean up the old press state before starting a new one.
          if (pressTimer !== null) {
              clearTimeout(pressTimer);
          }
          pressTarget = null;
          movedDuringPress = false;
     }


    pressTarget = event.currentTarget;
    movedDuringPress = false;
    startX = event.clientX; // Use clientX for desktop
    startY = event.clientY;

    // Start the long press timer
    pressTimer = setTimeout(() => {
        // Long press detected
        if (pressTarget && !movedDuringPress) {
            // Ensure it's still the same target and no move occurred
            // Action: Activate select mode and select the long-pressed card
            if (!isSelectMode) {
                toggleSelectMode(true); // This activates the mode
            }
            // Select the card that was long-pressed (will only select if mode just became active or already active)
             // Ensure pressTarget is still a valid DOM element and part of the document
            if (pressTarget && pressTarget.isConnected && isSelectMode) { // Check if in select mode
                 const item = JSON.parse(pressTarget.dataset.item);
                 const characterId = getCharacterId(pressTarget);
                 if (!selectedCards.has(characterId)) { // Only toggle if not already selected
                     toggleCardSelection(pressTarget, item); // Select initial card
                 } else {
                     // If already selected, a long press might do something else, or nothing.
                     // For now, do nothing if already selected by long press.
                 }
             }
        }
        pressTimer = null; // Clear timer after execution
    }, LONG_PRESS_TIME);
}

// Global mousemove listener to detect movement during press
function handleGlobalMouseMove(event) {
    // Check if we have an active press and the timer is still running
    if (pressTarget && pressTimer !== null) {
        const currentX = event.clientX;
        const currentY = event.clientY;
        const deltaX = Math.abs(currentX - startX);
        const deltaY = Math.abs(currentY - startY);

        // Check if movement exceeds the threshold
        if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
            movedDuringPress = true; // Mark that movement occurred
            // Cancel the long press timer immediately on significant move
            if (pressTimer !== null) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
             // No preventDefault here to allow native scrolling
        }
    }
}

function handleMouseUp(event) {
    // Check if this release is on the active press target
    if (pressTarget === event.currentTarget) {
        // It's the end of a press on the same target
        if (pressTimer !== null) {
            // Timer was still running - it was a click
            clearTimeout(pressTimer); // Clear the long press timer
            pressTimer = null;

            if (!movedDuringPress) { // Only trigger click action if no move occurred during the press
                // It was a clean click/tap
                const card = event.currentTarget;
                const item = JSON.parse(card.dataset.item);

                if (isSelectMode) {
                    // If in select mode, a clean click toggles selection
                    toggleCardSelection(card, item);
                } else {
                    // If not in select mode, show modal (if Kanji)
                     if (card.classList.contains('type-kanji')) {
                         showKanjiModal(item);
                     } else if (card.classList.contains('type-hiragana') || card.classList.contains('katakana')) {
                          console.log(`Klik pendek pada kartu ${card.classList.contains('type-hiragana') ? 'Hiragana' : 'Katakana'}:`, item);
                     }
                }
            }
            // If movedDuringPress is true, it was a drag (but ended on the same target), no specific action here.
        }
        // If pressTimer was null, it means long press timer already fired (action handled in setTimeout callback).
        // No further action needed on mouseup if timer fired.

        // Reset press state
        pressTarget = null;
        movedDuringPress = false;

        // Prevent default click after handling mouseup to avoid double events
        event.preventDefault();
    }
    // If release is on a different target, global mouseup listener handles cleanup
}

function handleMouseLeave() {
    // If mouse leaves card while pressing and timer is running, treat as move intent
    if (pressTarget && pressTarget === event.currentTarget && pressTimer !== null) {
        movedDuringPress = true; // Mark as moved
        // Cancel the long press timer when mouse leaves the element during press
        clearTimeout(pressTimer);
        pressTimer = null;
        // Note: pressTarget is NOT set to null here, it will be cleared on mouseup/globalmouseup.
    }
}

// Global mouseup listener for cleanup (if press ends outside any card)
function handleGlobalMouseEnd() {
    // If there was an active press target when mouseup happened anywhere
    if (pressTarget !== null) {
        // If the timer was still running, clear it
        if (pressTimer !== null) {
            clearTimeout(pressTimer);
        }
        // Reset press state regardless of where the mouseup occurred
        pressTarget = null;
        movedDuringPress = false;
    }
}


function handleTouchStart(event) {
    // Only handle single touch
    if (event.touches.length !== 1) return;
    // Only start a new press if one is not already active
    if (pressTarget !== null) {
         // If a press is already active (e.g., multi-touch scenario or unexpected event order)
         // Clean up the old press state.
         if (pressTimer !== null) {
             clearTimeout(pressTimer);
         }
         pressTarget = null;
         movedDuringPress = false;
     }

    pressTarget = event.currentTarget;
    movedDuringPress = false;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;

    // No prevent default here on touchstart to allow natural scrolling initially
    // event.preventDefault(); // Keep REMOVED

    // Start the long press timer
    pressTimer = setTimeout(() => {
        if (pressTarget && !movedDuringPress) {
            // Long press detected
             // Ensure pressTarget is still a valid DOM element and part of the document
            if (pressTarget && pressTarget.isConnected) {
                 if (!isSelectMode) {
                     toggleSelectMode(true); // Activate mode
                 }
                 // Select the card that was long-pressed (will only select if mode just became active or already active)
                 if (isSelectMode) { // Check if in select mode
                     const item = JSON.parse(pressTarget.dataset.item);
                     const characterId = getCharacterId(pressTarget);
                     if (!selectedCards.has(characterId)) { // Only toggle if not already selected
                          toggleCardSelection(pressTarget, item); // Select initial card
                     }
                 }
            }
        }
        pressTimer = null; // Clear timer after execution
    }, LONG_PRESS_TIME);
}

// Global touchmove listener for movedDuringPress and cancelling long press early
function handleGlobalTouchMove(event) {
    // Check if we have an active press and the timer is still running, and it's a single touch
    if (pressTarget && pressTimer !== null && event.touches.length === 1) {
        const currentX = event.touches[0].clientX;
        const currentY = event.touches[0].clientY;
        const deltaX = Math.abs(currentX - startX);
        const deltaY = Math.abs(currentY - startY);

        // Use a slightly larger threshold for touch to account for finger wobble
        const touchMoveThreshold = 20;

        if (deltaX > touchMoveThreshold || deltaY > touchMoveThreshold) {
            movedDuringPress = true; // Mark that movement occurred
            // Cancel the long press timer immediately on significant move
            if (pressTimer !== null) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
            // Allowing default here lets the browser handle scrolling naturally
             // event.preventDefault(); // Keep REMOVED
        }
    }
     // If not an active single touch press with timer, allow default behavior (e.g. multi-touch zoom, natural scroll)
}

function handleTouchEnd(event) {
    // Check if this release is on the active press target AND the touch that started the press is ending
    // event.changedTouches contains the touches that ended
     let touchEndedOnTarget = false;
     for (let i = 0; i < event.changedTouches.length; i++) {
         const endedTouch = event.changedTouches[i];
         // We can't directly match the original touch ID easily here,
         // so we rely on the touch ending *on the same element* and the global state (pressTarget).
         // This is a simplification. A more robust way needs tracking touch IDs.
         // For now, let's assume if the release is on the pressTarget element, it's the correct touch.
         if (endedTouch.target === pressTarget) {
              touchEndedOnTarget = true;
              break;
         }
     }

    // Only process if the touch ended on the currently active press target element
    if (touchEndedOnTarget && pressTarget !== null) {
         if (pressTimer !== null) {
             // Timer was still running - it was a tap
             clearTimeout(pressTimer); // Clear the long press timer
             pressTimer = null;

             if (!movedDuringPress) { // Only trigger tap action if no move occurred during the press
                 // It was a clean tap
                 const card = pressTarget; // Use pressTarget which is the card element
                 const item = JSON.parse(card.dataset.item);

                 if (isSelectMode) {
                     // If in select mode, a clean tap toggles selection
                     toggleCardSelection(card, item);
                 } else {
                     // If not in select mode, show modal (if Kanji)
                     if (card.classList.contains('type-kanji')) {
                         showKanjiModal(item);
                     } else if (card.classList.contains('type-hiragana') || card.classList.contains('katakana')) {
                          console.log(`Klik pendek pada kartu ${card.classList.contains('type-hiragana') ? 'Hiragana' : 'Katakana'}:`, item);
                     }
                }
             }
             // If movedDuringPress is true, it was a drag (but ended on the same target), no specific action here.
         }
         // If pressTimer was null, it means long press timer already fired (action handled in setTimeout callback).
         // No further action needed on touchend if timer fired.

         // Reset press state
         pressTarget = null;
         movedDuringPress = false;

         // Prevent default behaviors like tap highlight, click generation on this element
         event.preventDefault();
     }
     // If touch ended on a different target or not on any element, global touchend/touchcancel handles cleanup.
}

// Global touchend/touchcancel listener for cleanup
function handleGlobalTouchEnd(event) {
    // If there was an active press target when touchend happened anywhere
     if (pressTarget !== null) {
         // Check if *any* of the touches that ended were the one that started the press.
         // This requires tracking touch IDs, which is complex with the current state.
         // A simpler cleanup: if any touch ends while pressTarget is set, clear the state.
         // This might occasionally cancel a press if another finger is lifted, but it's safer than a lingering state.

         if (event.changedTouches && event.changedTouches.length > 0) {
             let relevantTouchEnded = false;
              // Simple check: If any touch that ended has the same clientX/clientY as the press start point within threshold
              // This is not a perfect ID match but can help prevent clearing on unrelated touches ending.
              for(let i = 0; i < event.changedTouches.length; i++) {
                  const endedTouch = event.changedTouches[i];
                   const deltaX = Math.abs(endedTouch.clientX - startX);
                   const deltaY = Math.abs(endedTouch.clientY - startY);
                   if (deltaX < MOVE_THRESHOLD && deltaY < MOVE_THRESHOLD) {
                       relevantTouchEnded = true;
                       break;
                   }
              }

              // If a touch that ended was near the start point, or if we can't check precisely, clear the state
              // A more robust solution would map touchstart event's touch.identifier and check against touchend's changedTouches[i].identifier
             if (relevantTouchEnded || event.changedTouches.length === 1) { // Simpler fallback check
                 if (pressTimer !== null) {
                     clearTimeout(pressTimer);
                 }
                 pressTarget = null;
                 movedDuringPress = false;
             }
         } else {
             // If no changed touches (e.g., mouseup) and pressTarget is set, clear state
             if (pressTimer !== null) {
                 clearTimeout(pressTimer);
             }
             pressTarget = null;
             movedDuringPress = false;
         }
     }
}


// Helper to get character ID regardless of type from card element
function getCharacterId(cardElement) {
     // Ensure item data exists
     if (!cardElement || !cardElement.dataset || !cardElement.dataset.item) {
         console.error("Invalid card element or data for getCharacterId");
         return null; // Return null or handle error appropriately
     }
     try {
         const item = JSON.parse(cardElement.dataset.item);
         return item.kanji || item.karakter;
     } catch (e) {
         console.error("Error parsing item data for getCharacterId:", e);
         return null;
     }
}


// --- Other functions ---

function showKanjiModal(item) {
    if(!kanjiModal) return;

    if(modalKanji) modalKanji.textContent = item.kanji;
    if(modalFurigana) modalFurigana.textContent = item.furigana;
    if(modalRomaji) modalRomaji.textContent = item.romaji;
    if(modalIndo) modalIndo.textContent = item.indo;
    if(modalInggris) modalInggris.textContent = item.inggris;

    if(modalOnyomiList) {
        modalOnyomiList.innerHTML = '';
        if (item.onyomi && item.onyomi.length > 0) {
            item.onyomi.forEach(reading => { const li = document.createElement('li'); li.textContent = `${reading.kana} ${reading.romaji}`; modalOnyomiList.appendChild(li); });
        } else { modalOnyomiList.innerHTML = '<li>-</li>'; }
    }

    if(modalKunyomiList) {
        modalKunyomiList.innerHTML = '';
        if (item.kunyomi && item.kunyomi.length > 0) {
            item.kunyomi.forEach(reading => { const li = document.createElement('li'); li.textContent = `${reading.kana} ${reading.romaji}`; modalKunyomiList.appendChild(li); });
        } else { modalKunyomiList.innerHTML = '<li>-</li>'; }
    }

    if(modalKategori) modalKategori.textContent = item.kategori || '-';
    if(modalJlpt) modalJlpt.textContent = item.jlpt || '-';

    if (googleSearchButton && item.kanji) {
        const searchTerm = encodeURIComponent("Jelaskan kanji: " + item.kanji);
        googleSearchButton.href = `https://www.google.com/search?q=${searchTerm}`;
        googleSearchButton.innerHTML = `<i class="fas fa-search"></i> Cari ${item.kanji} di Google`;
        googleSearchButton.style.display = '';
    } else if (googleSearchButton) {
        googleSearchButton.style.display = 'none';
    }

    kanjiModal.classList.add('visible');
}

function hideKanjiModal() {
    if(kanjiModal) kanjiModal.classList.remove('visible');
}

function updateStatus() {
    // Status should reflect the total number of items in the current *view*,
    // and indicate if in focus mode.
    const totalFilteredItems = filteredData.length;
    let statusText = '';

    if (totalFilteredItems === 0 && !isFocusMode) { // Only show no items message if not in focus mode and filtered data is empty
        statusText = `Tidak ada karakter ditemukan untuk ${currentLevel.toUpperCase() || currentDataType.charAt(0).toUpperCase() + currentDataType.slice(1)} dengan filter saat ini.`;
         // Keep pagination disabled if no items found
        if(prevBtn) prevBtn.disabled = true;
        if(nextBtn) nextBtn.disabled = true;
        if(pageInfo) pageInfo.textContent = '';
    } else if (isFocusMode) {
         const displayedCount = selectedCards.size; // In focus mode, displayed count is selected count
         const typeLabel = currentDataType === 'kanji' ? 'kanji' : (currentDataType === 'hiragana' ? 'hiragana' : 'katakana');
         statusText = `Menampilkan ${displayedCount} karakter terpilih (Fokus Mode)`;
         // Disable pagination in focus mode
         if(prevBtn) prevBtn.disabled = true;
         if(nextBtn) nextBtn.disabled = true;
         if(pageInfo) pageInfo.textContent = '';
    }
    else { // Not in focus mode, show status based on filteredData and pagination
        const typeLabel = currentDataType === 'kanji' ? 'kanji' : (currentDataType === 'hiragana' ? 'hiragana' : 'katakana');
        if (perPage === 0) {
            statusText = `Menampilkan semua ${totalFilteredItems} ${typeLabel} ${currentDataType === 'kanji' ? currentLevel.toUpperCase() : ''}`.trim();
            if(prevBtn) prevBtn.disabled = true; // Disable pagination if all are shown
            if(nextBtn) nextBtn.disabled = true;
            if(pageInfo) pageInfo.textContent = '';
        } else {
            const start = (currentPage - 1) * perPage + 1;
            const end = Math.min(currentPage * perPage, totalFilteredItems);
            const totalPages = Math.ceil(totalFilteredItems / perPage); // Calculate total pages based on filtered data
            statusText = `Menampilkan ${start}-${end} dari ${totalFilteredItems} ${typeLabel} ${currentDataType === 'kanji' ? currentLevel.toUpperCase() : ''}`.trim();
            // Enable/disable pagination based on current page and total pages
            if(prevBtn) prevBtn.disabled = currentPage === 1;
            if(nextBtn) nextBtn.disabled = currentPage === totalPages;
             if(pageInfo) pageInfo.textContent = `Halaman ${currentPage}/${totalPages}`;
        }
    }

    if(statusInfo) statusInfo.textContent = statusText;
    // Status info is hidden when select mode is active
    if(statusInfo) statusInfo.style.display = isSelectMode ? 'none' : 'block';
}

function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

function loadTheme() {
    const savedTheme = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(savedTheme);
}

function toggleTheme() {
    const currentTheme = page.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function setTheme(theme) {
    page.setAttribute('data-theme', theme);
}

function applyAppTheme() {
    const appTheme = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(appTheme);
}

// Helper function to check if currently on a mobile viewport
function isMobileView() {
    // Use a media query check that matches your CSS breakpoint
    return window.matchMedia('(max-width: 768px)').matches;
}

// Function to show the FABs
function showFabs() {
    if (themeToggle) themeToggle.classList.remove('hide-fab');
    if (displayToggleFab) displayToggleFab.classList.remove('hide-fab');
}

// Function to hide the FABs
function hideFabs() {
    if (themeToggle) themeToggle.classList.add('hide-fab');
    if (displayToggleFab) displayToggleFab.classList.add('hide-fab');
}

// Function to reset the hide timer
function resetHideFabTimer() {
    // Clear any existing timer
    clearTimeout(hideFabTimer);

    // If on mobile view, set a new timer to hide FABs
    if (isMobileView()) {
        hideFabTimer = setTimeout(hideFabs, HIDE_DELAY);
    }
}


function toggleSelectMode(enable) {
    isSelectMode = enable;
    // Do NOT clear selectedCards here unless explicitly cancelled or level changes.
    // selectedCards should persist across searches and display mode changes.

    const cards = kanjiContainer ? kanjiContainer.querySelectorAll('.character-card') : [];
    cards.forEach(card => {
        // Update the 'selected' class based on the current selectedCards set
        const characterId = getCharacterId(card);
        if (selectedCards.has(characterId)) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }

        const existingIndicator = card.querySelector('.select-indicator');
        if (isSelectMode && !existingIndicator) {
            const indicator = document.createElement('div');
            indicator.classList.add('select-indicator');
            indicator.innerHTML = '<i class="fas fa-check-circle"></i>';
            card.insertBefore(indicator, card.firstChild);
        } else if (!isSelectMode && existingIndicator) {
            existingIndicator.remove();
        }
    });

    // If exiting select mode (e.g., via Cancel button), also exit focus mode
    if (!isSelectMode) {
         isFocusMode = false; // Exit focus mode
         // When exiting select mode, reset pagination to page 1 and render filtered data
         currentPage = 1;
         // When exiting select mode (via Cancel), we should return to the state
         // where only the category filter is applied, and search is empty.
         // Recalculate filteredData based *only* on loadedData and current category filter.
         const currentCategory = categoryFilter ? categoryFilter.value : '';
         filteredData = loadedData.filter(item => {
             const matchesCategory = !currentCategory || (item.kategori && item.kategori === currentCategory);
             return matchesCategory;
         });
         if(searchInput) searchInput.value = ''; // Clear search input
         populateCategoryFilter(loadedData, currentDataType); // Reset search placeholder


         renderCharacters(filteredData, currentDataType); // Render the newly filtered data
    }


    if(selectControlsContainer) selectControlsContainer.style.display = isSelectMode ? 'flex' : 'none';
    updateSelectControls();
    updateStatus(); // Update status visibility
}

function toggleCardSelection(cardElement, item) {
    const characterId = item.kanji || item.karakter;

    if (selectedCards.has(characterId)) {
        selectedCards.delete(characterId);
        cardElement.classList.remove('selected');
    } else {
        selectedCards.add(characterId);
        cardElement.classList.add('selected');
    }
    updateSelectControls();
    // No need to re-render the grid just for selection state
    // renderCharacters(isFocusMode ? getFocusedData() : filteredData, currentDataType);
}

function updateSelectControls() {
    // Only show and update controls if select mode is active
    if (!isSelectMode) {
        if(selectControlsContainer) {
             selectControlsContainer.innerHTML = '';
             selectControlsContainer.style.display = 'none';
        }
        // Ensure kanjiContainer doesn't have focus-mode class when select controls are hidden
        if (kanjiContainer) kanjiContainer.classList.remove('focus-mode');
        return;
    }

    if (!selectControlsContainer) {
         console.error("Error: selectControlsContainer not found.");
         return;
    }

    // Get the currently displayed cards to update 'Pilih Semua' text accurately
    const cards = kanjiContainer ? kanjiContainer.querySelectorAll('.character-card') : [];
     // Only count currently *visible* cards for the "Pilih Semua" check
    const currentlyDisplayedCards = Array.from(cards).filter(card => card.style.display !== 'none');
    const totalDisplayed = currentlyDisplayedCards.length;

    const selectedCount = selectedCards.size;

    // Check if controls are already rendered to avoid duplicating event listeners on each call
    // We can check for one of the buttons, e.g., shuffleBtn
    let shuffleBtn = selectControlsContainer.querySelector('#shuffleBtn');

    if (!shuffleBtn) { // If controls are not rendered, build them
        selectControlsContainer.innerHTML = `
            <span id="selectedCountInfo">
                <span id="selectedCount">${selectedCount}</span> dipilih
            </span>
            <button id="selectAllBtn"></button>
            <button id="cancelSelectBtn">Batal</button>
            <button id="shuffleBtn">Acak Tampilan Ini</button>
            <button id="focusBtn"></button>
        `;
        // Get references after creating them
        shuffleBtn = selectControlsContainer.querySelector('#shuffleBtn');
        const selectAllBtn = selectControlsContainer.querySelector('#selectAllBtn');
        const cancelSelectBtn = selectControlsContainer.querySelector('#cancelSelectBtn');
        const focusBtn = selectControlsContainer.querySelector('#focusBtn');

        // Add event listeners (delegation is already set up in setupEventListeners)

         // Update 'Pilih Semua' button text immediately after creation
         if (selectAllBtn) {
              if (selectedCount > 0 && totalDisplayed > 0 && selectedCount === totalDisplayed) {
                 selectAllBtn.textContent = 'Batal Pilih Semua';
             } else {
                  // Calculate selected count among currently displayed cards
                  const selectedInView = currentlyDisplayedCards.filter(card => selectedCards.has(getCharacterId(card))).length;
                  if (selectedInView > 0 && selectedInView === totalDisplayed && totalDisplayed > 0) {
                       selectAllBtn.textContent = 'Batal Pilih Semua';
                  } else {
                       selectAllBtn.textContent = 'Pilih Semua';
                  }
             }
         }

         // Update Focus/Kembalikan button text immediately after creation
          if (focusBtn) {
              focusBtn.textContent = isFocusMode ? 'Kembalikan Tampilan' : 'Fokus ke yang Dipilih';
          }


    } else { // If controls exist, just update the dynamic parts
         const selectedCountSpan = selectControlsContainer.querySelector('#selectedCount');
         const selectAllBtn = selectControlsContainer.querySelector('#selectAllBtn');
         const focusBtn = selectControlsContainer.querySelector('#focusBtn');

         if(selectedCountSpan) {
             selectedCountSpan.textContent = selectedCount;
         }
         if (selectAllBtn) {
              // Calculate selected count among currently displayed cards for 'Pilih Semua' text
              const selectedInView = currentlyDisplayedCards.filter(card => selectedCards.has(getCharacterId(card))).length;
              if (selectedCount > 0 && totalDisplayed > 0 && selectedInView === totalDisplayed) {
                 selectAllBtn.textContent = 'Batal Pilih Semua';
             } else {
                 selectAllBtn.textContent = 'Pilih Semua';
             }
         }
         if (focusBtn) {
              focusBtn.textContent = isFocusMode ? 'Kembalikan Tampilan' : 'Fokus ke yang Dipilih';
         }
    }

    // Update disabled states
    const focusBtn = selectControlsContainer.querySelector('#focusBtn'); // Ensure focusBtn is referenced here too

    if (shuffleBtn) {
        // Shuffle button should only be disabled if at least one item is selected *in the currently displayed view*
         const currentlyDisplayedItems = isFocusMode ? getFocusedData() : (perPage === 0 ? filteredData : filteredData.slice((currentPage - 1) * perPage, (currentPage - 1) * perPage + perPage));
         const selectedInCurrentView = currentlyDisplayedItems.filter(item => selectedCards.has(getCharacterIdFromItem(item))).length;
         shuffleBtn.disabled = selectedInCurrentView === 0;

    }
     if (focusBtn) {
         // Disable focus if nothing selected AND not already in focus mode
         focusBtn.disabled = selectedCards.size === 0 && !isFocusMode;
     }


    if(statusInfo) statusInfo.style.display = isSelectMode ? 'none' : 'block';
}

// Helper to get character ID from an item object (used in shuffle and updateControls)
function getCharacterIdFromItem(item) {
     if (!item) return null;
     return item.kanji || item.karakter;
}


function handleSelectAllToggle() {
    const cards = kanjiContainer ? kanjiContainer.querySelectorAll('.character-card') : [];
    // Select/deselect based on currently *visible* cards
     const currentlyDisplayedCards = Array.from(cards).filter(card => card.style.display !== 'none');
    const totalDisplayed = currentlyDisplayedCards.length;
    const selectedCountInView = currentlyDisplayedCards.filter(card => selectedCards.has(getCharacterId(card))).length;


    if (selectedCountInView > 0 && selectedCountInView === totalDisplayed && totalDisplayed > 0) {
        // If all currently displayed are selected, deselect all currently displayed
         currentlyDisplayedCards.forEach(card => {
             const item = JSON.parse(card.dataset.item);
             const characterId = item.kanji || item.karakter;
             selectedCards.delete(characterId);
             card.classList.remove('selected'); // Visual update
         });
    } else {
        // Select all currently displayed
        currentlyDisplayedCards.forEach(card => {
            const item = JSON.parse(card.dataset.item);
            const characterId = item.kanji || item.karakter;
            selectedCards.add(characterId);
            card.classList.add('selected'); // Visual update
        });
    }

    updateSelectControls();
    // No need to re-render the whole grid, just update the card classes
}

function handleCancelSelect() {
    // Clear selections and exit select mode
    selectedCards.clear();
    toggleSelectMode(false); // This will reset focus mode and re-render
}

function handleShuffleDisplay() {
    // Shuffle should apply to the data currently *being displayed* (either paginated filtered data or focused data)
    if (!isSelectMode || selectedCards.size === 0) {
         // If select mode is off or nothing is selected at all, shuffle button should be disabled.
         // If it was somehow clicked, just return.
         return;
     }

    // Get the data that is currently visible on the screen based on pagination and focus mode
    const dataToShuffle = isFocusMode ? getFocusedData() : (perPage === 0 ? filteredData : filteredData.slice((currentPage - 1) * perPage, (currentPage - 1) * perPage + perPage));

     // Filter for selected items WITHIN THIS SPECIFIC VIEW (dataToShuffle)
    const selectedCurrentViewItems = dataToShuffle.filter(item => {
         const characterId = item.kanji || item.karakter;
         return selectedCards.has(characterId); // Check if selected in the global set
    });

     // Only shuffle if there are selected items in the current view
     if (selectedCurrentViewItems.length === 0) {
         console.warn("No selected items in the current view to shuffle.");
          alert("Pilih karakter di tampilan saat ini untuk diacak."); // Give user feedback
         return;
     }

    const nonSelectedCurrentViewItems = dataToShuffle.filter(item => {
         const characterId = item.kanji || item.karakter;
         return !selectedCards.has(characterId); // Check if NOT selected in the global set
    });

    // Shuffle only the selected items
    const shuffledSelectedCurrentViewItems = shuffleArray([...selectedCurrentViewItems]);

    // Reconstruct the current view's data order with shuffled selected items
    const newOrderedCurrentViewItems = [];
    let shuffledIndex = 0;

    // Iterate through the original dataToShuffle order to maintain relative positions of non-selected
    dataToShuffle.forEach(item => {
         const characterId = item.kanji || item.karakter;
         if (selectedCards.has(characterId)) {
              // Place shuffled selected items in the positions where original selected items were in this view
              if (shuffledIndex < shuffledSelectedCurrentViewItems.length) {
                 newOrderedCurrentViewItems.push(shuffledSelectedCurrentViewItems[shuffledIndex]);
                 shuffledIndex++;
             } else {
                  // Fallback (shouldn't be needed if logic is correct)
                  newOrderedCurrentViewItems.push(item);
             }
         } else {
             // Keep non-selected items in their original positions within this view
             newOrderedCurrentViewItems.push(item);
         }
    });


    // Now, update the *source* array that `renderCharacters` will use for the current view.
    // If in focus mode, the source is the array returned by `getFocusedData()`.
    // If not in focus mode, the source is a slice of `filteredData`.

    if (isFocusMode) {
        // If in focus mode, update the order of the currently displayed (focused) items.
        // The `renderCharacters` function will need to receive this newly ordered array.
        // Let's pass the `newOrderedCurrentViewItems` directly to renderCharacters.
        renderCharacters(newOrderedCurrentViewItems, currentDataType); // Render the shuffled focused data

        // Note: Shuffling in focus mode *does not* change the order of items in the main `filteredData` array.
        // If the user exits focus mode, they will see the non-shuffled `filteredData` order (for items not selected).
        // Shuffling in focus mode only affects the display order *while in focus mode*.

    } else {
         // If NOT in focus mode (standard pagination view), update the order in the main `filteredData` array.
         const startIndex = (currentPage - 1) * perPage;
         const endIndex = perPage === 0 ? filteredData.length : Math.min(startIndex + perPage, filteredData.length);

        const updatedFilteredData = [
            ...filteredData.slice(0, startIndex),
            ...newOrderedCurrentViewItems, // Insert the newly ordered items for the current page/view
            ...filteredData.slice(endIndex) // Keep the rest of the filteredData as is
        ];
         // Update the global filteredData state
        filteredData = updatedFilteredData;

        // Re-render the current page from the now shuffled filteredData
        renderCharacters(filteredData, currentDataType); // Render based on the updated filteredData
    }


    // Selections should persist after shuffle
    // selectedCards.clear(); // KEEP REMOVED

    updateSelectControls(); // Update controls (e.g., disabled states)
    updateStatus(); // Update status
}


function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    // While there remain elements to shuffle.
    while (currentIndex !== 0) {
        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}

// --- New Focus Feature Logic ---

function handleFocusToggle() {
    if (!isSelectMode) return; // Fokus hanya berfungsi dalam mode pilih

    if (isFocusMode) {
        // Saat ini dalam mode fokus, beralih kembali ke tampilan filter penuh
        isFocusMode = false;
        // Saat keluar dari mode fokus, atur ulang paginasi ke halaman 1
        currentPage = 1;

        // --- Recalculate filteredData based ONLY on category filter when exiting focus mode ---
        const currentCategory = categoryFilter ? categoryFilter.value : '';
        filteredData = loadedData.filter(item => {
            // Keep only items matching the current category, ignore any previous search keyword
            const matchesCategory = !currentCategory || (item.kategori && item.kategori === currentCategory);
            return matchesCategory;
        });
         // --- End recalculate filteredData ---

         // Clear search input and reset placeholder when exiting focus mode
        if(searchInput) {
             searchInput.value = ''; // Clear input value
             // Reset placeholder based on current data type
             if (currentDataType === 'kanji') {
                 searchInput.placeholder = 'Cari kanji (contoh: 水, mizu, air...)';
             } else if (currentDataType === 'hiragana') {
                 searchInput.placeholder = 'Cari Hiragana (contoh: あ, a)';
             } else if (currentDataType === 'katakana') {
                 searchInput.placeholder = 'Cari Katakana (contoh: ア, a)';
             } else {
                 searchInput.placeholder = 'Cari...';
             }
             // Aktifkan kembali input pencarian
             searchInput.disabled = false;
         }


         // When entering focus mode, display all selected items at once (no pagination)
         // The renderCharacters function handles disabling pagination in focus mode.
         // Call renderCharacters with the data from getFocusedData(), which now filters from loadedData.
        renderCharacters(filteredData, currentDataType); // Render data yang baru difilter
    } else {
        // Tidak dalam mode fokus, beralih ke tampilan fokus (hanya tampilkan yang dipilih)
        if (selectedCards.size === 0) {
            alert("Pilih minimal satu karakter untuk menggunakan fitur Fokus.");
            return;
        }
        isFocusMode = true;

        // --- Clear search input and reset placeholder when entering focus mode ---
        if(searchInput) {
             searchInput.value = ''; // Clear input value
             // Reset placeholder based on current data type
             if (currentDataType === 'kanji') {
                 searchInput.placeholder = 'Cari kanji (contoh: 水, mizu, air...)';
             } else if (currentDataType === 'hiragana') {
                 searchInput.placeholder = 'Cari Hiragana (contoh: あ, a)';
             } else if (currentDataType === 'katakana') {
                 searchInput.placeholder = 'Cari Katakana (contoh: ア, a)';
             } else {
                 searchInput.placeholder = 'Cari...';
             }
            // Nonaktifkan input pencarian
            searchInput.disabled = true;
         }


         // When entering focus mode, display all selected items at once (no pagination)
         // The renderCharacters function handles disabling pagination in focus mode.
         // Call renderCharacters with the data from getFocusedData(), which now filters from loadedData.
        renderCharacters(getFocusedData(), currentDataType); // Render hanya data yang dipilih
    }
    updateSelectControls(); // Perbarui teks tombol ("Fokus" / "Kembalikan") dan status tombol disabled
    updateStatus(); // Perbarui teks status
}

// Helper function to get the data subset for focus mode
function getFocusedData() {
     // Filter the *entire* loadedData based on current selections
     const focusedData = loadedData.filter(item => {
         const characterId = item.kanji || item.karakter;
         return selectedCards.has(characterId);
     });
     return focusedData;
}


// This click handler is mostly disabled in the new logic,
// as mouseup/touchend handle the actions.
function handleCardClick(event) {
    console.log("Click event fired. Handled by mouseup/touchend.");
    // event.preventDefault();
}
  bootstrap();
}

export function render() {
  ensureFontAwesome();
  const page = createEl('div', { class: 'jp-root' });
  const style = document.createElement('style');
  style.textContent = CSS;
  page.appendChild(style);
  page.insertAdjacentHTML('beforeend', BODY);
  initJepunese(page);
  return page;
}
