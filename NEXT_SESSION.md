# NEXT SESSION — Rencana Kerja (dibuat 2026-09-06, dipakai hari berikutnya)

> Klik-katanya: "catat, besok kita akan kerjakan ... dan mendesain dashboard".
> Pola kerja: rework halaman web ke paritas Flutter (`DART_TO_WEB_MAPPING.md`),
> anti-slop (`ANTI_SLOP_DESIGN_DOC.md`), tanya user saat ada keputusan fork besar.

## ✅ Selesai sesi sebelumnya (7 halaman rework + Portal Saham fase 1 + landing)

1. `/admin/users` — tabel + modal + chips (pilihan user: "Tetap tabel + modal + chips")
2. `/admin/dashboard` — tabs Dashboard|Logs, tiles SISTEM/SERVER/DATABASE/SCRAPER, WS status
3. `/admin/sitemaps` — tabel + modal add + modal edit language
4. `/admin/proxies` — tabs Webshare|Proxy|Log, key masking, test/sync
5. `/admin/backup` — GDrive auth flow lengkap (auth_url + code), progress card, history
6. `/profile` — hero avatar + permission chips + password change + strength meter (redesign bebas, tanpa paritas Flutter)
7. ✅ **Landing `#/` (BARU, sesi ini)** — `js/pages/landing.js`: 3 tombol bulat pilih menu (Saham aktif, Tools & Quiz "Segera hadir"), full-screen tanpa drawer/appbar (`body.landing-mode`), login/logout mini di pojok kanan atas. **`dashboard.js` lama DIHAPUS** (diganti landing) + CSS dashboard lama dibersihkan.
8. ✅ **Portal Saham fase 1**:
   - Route `/saham/*` (market + media + admin), guard: login utk seluruh portal, admin utk `/saham/admin/*`
   - `store.activePortal` — saat di dalam portal, drawer menyempit hanya item `portal: "saham"` + tombol "Beranda"
   - `menu_config.json`: field `portal`, section `media` (video), app `video_history`
   - `ROUTE_MAP`/`MENU_SECTIONS`/appbar title di-update ke `/saham/*`
   - Link internal (`#/stocks`, `#/video`, dll) diarahkan ke `/saham/...`
   - URL lama `/stocks`, `/news`, `/admin/*` pecah total (tidak redirect)

## Potensi agenda sesi berikut (urut disiplin)

- [ ] **Aktifkan portal Tools & Quiz** di landing `#/` (saat ini disabled "Segera hadir") — buat hub page per portal dulu, lalu switch status di `js/pages/landing.js`
- [ ] **Porting 3 app baru** (color-blind, type-writing, jepunese) → portal Tools — detail di `PORTAL_REDESIGN.md` §15
- [ ] (Opsional) Penghapusan akses menu di backend — ditunda, frontend-only cukup
- [ ] (Opsional, opsional) favicon fix: `<link rel="icon" href="data:,">` (404 di console)

## Pola / keputusan yang sudah disepakati (WAJIB diikuti)

- **Portal**: `store.activePortal` mengendalikan mode drawer (saham = item portal saja). Guard portal di `router.js` (`/saham` → login, `/saham/admin` → admin).
- **Search + clear**: `.search` + `.search.has-clear` + tombol `.search__clear` berisi `icons['x']`; state sync per ketikan, reload di-debounce 350–400ms; clear → reset filter & page.
- **Filter**: chips pakai pola `.reports-page__chip`/`.admin-stock-status__chip` (accent aktif) — bukan `<select>` kalau pilihan pendek.
- **Pagination**: Prev/Next + indikator `X / Y` + teks "Menampilkan a–b dari N (filter aktif)"; reset page=1 saat filter/search berubah; clamp ke halaman valid terakhir. 20/halaman.
- **Modal**: `createModal` dari `js/ui/modal.js`; form pakai `.field__label` + `.field__select` + `.field__textarea`; tombol aksi kanan; validation pakai `toast` error.
- **Badge saham**: reuse `DelistedBadge`/`StockSectorBadge` dari `js/ui/stock-widgets.js` (JANGAN duplikat inline).
- **Ticker/company → analisis**: `localStorage.setItem('stocks_initial_ticker', T)` + `location.hash = '#/saham/stocks'` (delisted → non-clickable). **Jangan kembali ke `#/stocks` — sudah pecah total.**
- **`<td class="table__actions">` TIDAK BOLEH** — `display:flex` di `<td>` mematahkan garis tabel; harus `<td><div class="table__actions">…</div></td>`.
- **Ikon SVG** hanya lewat `innerHTML` (createEl children string jadi text node ter-escape).
- **CSS**: pakai token (`var(--c-*)`, `var(--s-*)`, `var(--text-*)`) — no inline styles dengan hex/fallback kustom; class baru di `07-pages.css`.
- **Anti-slop**: hapus dead UI/import/dead code; user suka lihat before/after code.

## Verifikasi rutin

- `node --check` tiap JS yang diedit
- Live Server `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5500/` → 200
- Implementasi hidup di Live Server (tanpa build/rebuild)
- Backend live: `https://www.onix.my.id/api` (hanya untuk verifikasi read-only via token user)

## Tunggakan opsional (belum diputuskan user)

- Konsolidasi duplikat `DelistedBadge` / `formatReasonLines` / `StockInfoCard` antara `js/pages/stocks.js` dan `js/ui/stock-widgets.js` (user belum approve).
- `db_size_mb` di backend `/idx/status` selalu 0 (tidak pernah dihitung) — web menampilkan "—". Kalau mau angka asli, perlu ubah backend.
- `router.js.bak` file backup lama di `js/core/` — bisa dihapus kalau sudah yakin.