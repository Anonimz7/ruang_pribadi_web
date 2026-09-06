# NEXT SESSION — Rencana Kerja (dibuat 2026-09-06, dipakai hari berikutnya)

> Klik-katanya: "catat, besok kita akan kerjakan ... dan mendesain dashboard".
> Pola kerja: rework halaman web ke paritas Flutter (`DART_TO_WEB_MAPPING.md`),
> anti-slop (`ANTI_SLOP_DESIGN_DOC.md`), tanya user saat ada keputusan fork besar.

## Daftar halaman yang AKAN dikerjakan (urut disiplin, dikerjakan 1 per 1)

1. `http://127.0.0.1:5500/#/admin/users` — `js/pages/admin/users.js`
2. `http://127.0.0.1:5500/#/admin/dashboard` — `js/pages/admin/dashboard.js`
3. `http://127.0.0.1:5500/#/admin/sitemaps` — `js/pages/admin/sitemaps.js`
4. `http://127.0.0.1:5500/#/admin/proxies` — `js/pages/admin/proxies.js`
5. `http://127.0.0.1:5500/#/admin/backup` — `js/pages/admin/backup.js`
6. `http://127.0.0.1:5500/#/profile` — `js/pages/profile.js`
7. **Mendesain ulang dashboard** `http://127.0.0.1:5500/#/` — `js/pages/dashboard.js` (halaman ini masih banyak inline style & `var(--card-bg, #fff)` fallback; kemungkinan besar butuh CSS classes baru)

## Status halaman saat ini (sebelum dikerjakan)

| Halaman | Status sekarang | Catatan |
|---|---|---|
| `/admin/users` | tabel + search + create modal, pakai `window.adminEditUser`/`window.adminDeleteUser` | Sudah diam-diam diperbaiki td `table__actions` → div (garis tabel) |
| `/admin/dashboard` | belum dicek isinya | — |
| `/admin/sitemaps` | tabel + `window.sitemapDelete`, td `table__actions` sudah fixed (div) | — |
| `/admin/proxies` | belum dicek isinya | — |
| `/admin/backup` | progress bar + WebSocket + GDrive card, td `table__actions`? cek nanti | — |
| `/profile` | belum dicek isinya | — |
| `/` dashboard | **banyak inline styles + var fallback** (`--card-bg,#fff`, `--border-color,#e0e0e0`, `--text-secondary,#666`) → pelanggaran token CSS, perlu CSS classes | kartu grid `dashboard-card` |

## Pola / keputusan yang sudah disepakati (WAJIB diikuti)

- **Search + clear**: `.search` + `.search.has-clear` + tombol `.search__clear` berisi `icons['x']`; state sync per ketikan, reload di-debounce 350–400ms; clear → reset filter & page.
- **Filter**: chips pakai pola `.reports-page__chip`/`.admin-stock-status__chip` (accent aktif) — bukan `<select>` kalau pilihan pendek.
- **Pagination**: Prev/Next + indikator `X / Y` + teks "Menampilkan a–b dari N (filter aktif)"; reset page=1 saat filter/search berubah; clamp ke halaman valid terakhir. 20/halaman.
- **Modal**: `createModal` dari `js/ui/modal.js`; form pakai `.field__label` + `.field__select` + `.field__textarea`; tombol aksi kanan; validation pakai `toast` error.
- **Badge saham**: reuse `DelistedBadge`/`StockSectorBadge` dari `js/ui/stock-widgets.js` (JANGAN duplikat inline).
- **Ticker/company → analisis**: `localStorage.setItem('stocks_initial_ticker', T)` + `location.hash = '#/stocks'` (delisted → non-clickable).
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