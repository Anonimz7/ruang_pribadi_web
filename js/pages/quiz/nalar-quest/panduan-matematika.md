PANDUAN PENULIS SOAL MATEMATIKA (Drilling Acak) v0.1

Matematika drilling adalah latihan berhitung acak: soal dibangkitkan dari
template dengan nilai yang diacak setiap kali program dimulai, sehingga
soal yang sama tidak pernah muncul dua kali dengan angka yang sama.
Satu soal menuntut satu rantai berhitung yang jelas — dari soal ke jawaban
lewat langkah-langkah yang bisa diperiksa ulang.

NOTASI MATEMATIKA — LaTeX WAJIB
- Semua notasi matematika ditulis dalam LaTeX, bukan teks biasa:
  pecahan, pangkat, akar, variabel, persamaan, dan simbol matematika.
- Inline: $...$ — contoh: $\frac{3}{4}$, $x^2$, $\sqrt{16}$, $2 \times 5$.
- Display (baris sendiri): $$...$$ — untuk persamaan yang panjang.
- Jangan tulis "3/4", "x^2", atau "akar 16" sebagai teks biasa.
- Di dalam string JSON, backslash LaTeX ditulis ganda: "\\frac{3}{4}"
  (JSON memakai backslash sebagai escape, jadi satu backslash akan rusak).
- Di dalam TEMPLATE, pecahan dengan nilai variabel ditulis dengan kurung
  kurawal ganda: $\frac{{a}}{{b}}$ — kurung tunggal {a} akan dimakan
  mesin template, sehingga $\frac{a}{b}$ rusak menjadi $\frac35$.
  Di soal STATIS (nilai sudah tetap), tulis biasa: $\frac{3}{4}$.
- LaTeX boleh dipakai di prompt, opsi jawaban, why, dan explanation.

MENU AI (cabang Matematika) — jangan langsung membuat soal, tampilkan menu
ini dan tunggu jawaban:
  1. Mode: template (utama — nilai diacak) / statis (soal jadi, nilai tetap)
  2. Topik: aritmetika / aljabar / geometri / pecahan & desimal / persen /
     (pilih per batch sesuai permintaan)
  3. Bentuk jawaban: choice (pilihan ganda seperti yang sudah ada)
  4. LaTeX: wajib (lihat aturan di atas)
  5. Kesulitan: 1 / 2 / 3
  6. Jumlah soal: (angka)
Untuk setiap baris, pengguna boleh memilih sendiri atau menulis "acak".
Setelah pengguna menjawab menu, tulis konfigurasi yang dipakai di field
description (satu baris), lalu keluarkan HANYA JSON sesuai ATURAN KELUARAN.

ATURAN KELUARAN
- Keluarkan HANYA satu objek JSON, tanpa teks di luar JSON:
  {"version": "0.7.2", "description": "...", "templates": [...], "static": [...]}
- Mode template mengisi array templates; mode statis mengisi array static.

FIELD TEMPLATE MATEMATIKA
- id: pola math.<topik>.001, mis. "math.pecahan.001"
- type: "math" (nilai baru — perlu ditambahkan ke bank saat menu dibangun)
- principle: topik yang dilatih, mis. "penjumlahan_pecahan"
- domain: "angka"
- surface_domain: "matematis"
- surface_distance: 0
- difficulty: 1, 2, atau 3
- vars: nama variabel beserta jenis dan rentangnya, mis.
  {"a": {"kind": "int", "min": 2, "max": 9}, "b": {"kind": "int", "min": 2, "max": 9}}
- constraints: syarat antar variabel bila ada, mis. ["a > b"]
- prompt: soal dengan placeholder {a}, {b}, ... dan LaTeX untuk notasinya
- input: kind "choice", shuffle true, TEPAT 1 opsi benar, setiap opsi memakai why
- explain: alur berhitung langkah demi langkah, bukan sekadar "karena jawabannya X"

FIELD STATIS MATEMATIKA
- Sama seperti template, tanpa vars dan tanpa constraints; nilai sudah tetap di prompt.
- surface_distance: null (tidak berlaku untuk statis)
- Tambah source: "static" dan template_id: null
- Field penjelasan bernama "explanation" (bukan "explain") untuk statis.

ANTI-SLOP MATEMATIKA
- Hitung ulang jawaban dengan angka yang dipakai sebelum menulis opsi;
  bila opsi benar dan explanation tidak cocok, perbaiki soalnya.
- Pengecoh harus menangkap kesalahan berhitung yang umum (lupa urutan
  operasi, salah membalik pecahan, keliru menempatkan koma desimal),
  bukan sekadar jawaban ngawur.
- Soal harus punya tepat satu jawaban yang pasti; bila ada ambiguitas,
  perbaiki soalnya, jangan biarkan pembaca menebak.
- Satuan dan konteks harus jelas (rupiah, meter, kg, dst.).
- Jangan menyalin struktur soal yang sudah ada di bank; ubah konteks DAN
  langkah berhitungnya.
- Setiap entri harus lolos seluruh aturan validasi. Periksa sendiri
  sebelum menjawab.
