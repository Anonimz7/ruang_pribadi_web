PANDUAN PENULIS SOAL BAHASA (Bank Soal Monolingual) v0.1

Bank soal Bahasa adalah bank soal monolingual: setiap soal ditulis FULL
dalam SATU bahasa — Inggris penuh, Mandarin penuh, atau Jepang penuh.
Ini BUKAN pasangan bahasa (bukan Mandarin–Indonesia atau
Inggris–Indonesia). Model pasangan bahasa sudah ada di menu Language
(#/bahasa, kamus + reader) dan tidak diulang di sini.

JENIS SOAL — hanya dua:
1. Melanjutkan kalimat — soal memberi satu kalimat (atau awal kalimat),
   pemain memilih lanjutan yang tepat. Semua dalam bahasa itu.
2. Mengisi kata rumpang (cloze) — soal memberi kalimat dengan satu bagian
   kosong, pemain memilih kata/frasa yang tepat untuk mengisinya.
Jawaban TIDAK harus menerjemahkan. Terjemahan tetap ada sebagai opsi —
bukan keharusan: sebagian soal boleh memakai terjemahan sebagai salah
satu opsi jawaban, bila menu memintanya.

FORMAT TERJEMAHAN (bila menu memilih "Terjemahan sebagai opsi: ya")
- Soal: satu kalimat dalam bahasa sumber (mis. Inggris).
- Jawaban: pilihan ganda A/B/C/D dalam bahasa target (mis. Indonesia) —
  satu terjemahan benar, sisanya pengecoh yang mirip tapi salah
  (subjek ketukar, makna meleset, tenses salah).
- Berlaku juga sebaliknya (soal Indonesia, pilihan Inggris) bila menu
  memintanya.
- Contoh: soal "The cat is sleeping on the chair." — jawaban benar
  "Kucing itu sedang tidur di kursi."

MENU AI (cabang Bahasa) — jangan langsung membuat soal, tampilkan menu
ini dan tunggu jawaban:
  1. Bahasa: inggris / mandarin / jepang
  2. Jenis soal: lanjut_kalimat / kata_rumpang / campuran
  3. Terjemahan sebagai opsi: ya / tidak
  4. Bentuk jawaban: choice (pilihan ganda seperti yang sudah ada)
  5. Kesulitan: 1 / 2 / 3
  6. Jumlah soal: (angka)
Untuk setiap baris, pengguna boleh memilih sendiri atau menulis "acak".
Setelah pengguna menjawab menu, tulis konfigurasi yang dipakai di field
description (satu baris), lalu keluarkan HANYA JSON sesuai ATURAN KELUARAN.

ATURAN KELUARAN
- Keluarkan HANYA satu objek JSON, tanpa teks di luar JSON:
  {"version": "0.7.2", "description": "...", "templates": [...], "static": [...]}
- Mode template mengisi array templates; mode statis mengisi array static.

FIELD TEMPLATE BAHASA
- id: pola lang.<bahasa>.<tipe>.001, mis. "lang.en.lanjut.001"
  (bahasa: en / zh / ja; tipe: lanjut / rumpang)
- type: "lang" (nilai baru — perlu ditambahkan ke bank saat menu dibangun)
- principle: jenis soal yang dilatih, "lanjut_kalimat" atau "kata_rumpang"
- domain: "bahasa"
- surface_domain: bahasa soalnya, "english" | "mandarin" | "japanese"
- surface_distance: 0
- difficulty: 1, 2, atau 3
- vars: nama variabel beserta jenis dan rentangnya (untuk template yang
  memakai bagian yang diacak), mis.
  {"a": {"kind": "int", "min": 2, "max": 9}}
- constraints: syarat antar variabel bila ada
- prompt: soal dengan placeholder {a}, {b}, ... bila memakai vars;
  seluruh kalimat soal dalam bahasa yang dipilih
- input: kind "choice", shuffle true, TEPAT 1 opsi benar, setiap opsi memakai why
- explain: alur penalaran langkah demi langkah, dalam bahasa yang sama
  dengan soalnya, bukan sekadar "karena jawabannya X"

FIELD STATIS BAHASA
- Sama seperti template, tanpa vars dan tanpa constraints; nilai sudah tetap di prompt.
- surface_distance: null (tidak berlaku untuk statis)
- Tambah source: "static" dan template_id: null
- Field penjelasan bernama "explanation" (bukan "explain") untuk statis.

ATURAN BAHASA
- Seluruh soal, opsi, why, dan explanation ditulis dalam bahasa yang
  dipilih — jangan mencampur bahasa Indonesia ke dalam soal (kecuali
  bila opsi terjemahan diminta menu).
- Untuk Mandarin: hanzi disajikan apa adanya; pinyin hanya bila diminta
  menu. Untuk Jepang: kana/kanji disajikan apa adanya; romaji atau
  furigana hanya bila diminta menu.
- Kalimat harus natural — seperti yang dipakai penutur asli — bukan
  kalimat terjemahan kata-per-kata.

ANTI-SLOP BAHASA
- Lanjutan kalimat yang benar harus satu-satunya yang natural dan
  gramatikal; bila dua opsi sama-sama bisa benar, perbaiki soalnya.
- Pengecoh harus menangkap kesalahan yang umum (pilihan kata yang
  mirip tapi salah konteks, urutan kata yang salah, partikel yang
  salah), bukan sekadar jawaban ngawur.
- Kata rumpang harus punya tepat satu isian yang benar; bila ada
  ambiguitas, perbaiki soalnya, jangan biarkan pembaca menebak.
- Jangan menyalin struktur soal yang sudah ada di bank; ubah konteks
  DAN isi kalimatnya.
- Setiap entri harus lolos seluruh aturan validasi. Periksa sendiri
  sebelum menjawab.
