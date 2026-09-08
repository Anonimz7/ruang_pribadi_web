# Portal Redesign — Multi-Portal Architecture

> **Status**: **BERJALAN — fase 1 (Portal Saham) SELESAI. Design penuh 3-portal ditunda.**
> **Dibuat**: Sesi ini | **Update**: sesi berikutnya
> **Tujuan**: Memisahkan aplikasi menjadi portal tematik (Saham, Tools, Quiz) dengan autentikasi bertingkat

---

## 0. Keputusan Scope Terkini (update sesi)

User memutuskan **hanya Portal Saham dulu**, yang lain tetap apa adanya:

- ✅ **Landing `#/` SELESAI**: full-screen pilih menu (3 tombol bulat: Saham aktif, Tools & Quiz "Segera hadir"), tanpa drawer/appbar (`body.landing-mode`). Mockup glassmorphism user dibuat tokenized di 07-pages.css. `dashboard.js` lama dihapus, diganti `js/pages/landing.js`.
- ✅ **Portal Saham SELESAI**: route `/saham/*`, guard autentikasi (login utk seluruh portal, admin utk `/saham/admin/*`), drawer menyempit ke item saham saat di dalam portal (footer "Beranda"), entry via landing `#/`.
- ⏸️ **Tools & Quiz TIDAK di-portal-kan** — landing menampilkannya sebagai "Segera hadir" (disabled). Redesign penuh hanya kalau ada waktu luang.
- ⏸️ **Backend tidak diubah** — frontend-only. Menghapus akses menu di backend ditunda (tidak perlu utk sekarang: hanya soal mengambil/menampilkan data).
- ⏸️ 3 app kandidat baru (color-blind, type-writing, jepunese) belum di-porting → masuk Tools nanti.

**Dokumen di bawah ini memuat design penuh (3 portal) sebagai referensi masa depan.**
**Bagian yang SUDAH diimplementasikan: landing `#/`, route `/saham/*`, drawer portal-mode, guard, hero entry.**
**Bagian yang BELUM: portals.json, relokasi file, Tools/Quiz portal (status "Segera hadir" di landing), porting 3 app baru.**

---

## 1. Konsep

Saat ini semua 20+ aplikasi dicampur dalam satu sidebar flat. User harus scroll melewati kuis matematika untuk mencari berita saham.

**Setelah redesign**, user membuka `ruangpribadi.web.id` → disuguhi **3 portal card** (Saham, Tools, Quiz) → memilih satu → masuk ke dunia terpisah dengan sidebar & navigasi sendiri.

```
#/                    → Landing page (pilih portal)
#/saham/*             → Portal Saham (🔐 login wajib)
#/tools/*             → Portal Tools (🌐 public)
#/quiz/*              → Portal Quiz (🌐 public)
#/login               → Login page global (redirect balik ke portal)
```

---

## 2. Autentikasi Bertingkat

| Portal  | Akses         | Keterangan                                    |
|---------|---------------|-----------------------------------------------|
| Saham   | 🔐 Login      | Semua halaman saham + admin wajib autentikasi |
| Tools   | 🌐 Public     | Siapapun bisa akses tanpa login               |
| Quiz    | 🌐 Public     | Siapapun bisa akses tanpa login               |
| Login   | 🌐 Public     | Halaman login global                           |

**Guard behavior:**
- Klik portal Saham → cek `store.token` → kalau tidak ada → redirect ke `#/login` (dengan `pendingPortal = 'saham'`)
- Klik portal Tools/Quiz → langsung masuk, tanpa cek auth
- Login berhasil → redirect ke portal yang dimaksud (via `pendingPortal`), atau ke `#/saham` sebagai default
- Admin pages tetap di dalam portal Saham (bagian admin section)

---

## 3. Struktur File Baru

```
ruang_pribadi_web/
├── index.html                    ← unchanged (entry point)
├── js/
│   ├── core/                     ← SHARED (tidak berubah)
│   │   ├── app.js                ← MODIFIKASI (portal-aware shell)
│   │   ├── auth.js               ← unchanged
│   │   ├── state.js              ← tambah `activePortal` key
│   │   ├── router.js             ← REWRITE (portal routing)
│   │   └── menu-config.js        ← REWRITE (per-portal config)
│   ├── ui/                       ← SHARED (tidak berubah)
│   │   ├── drawer.js             ← REWRITE (portal-aware)
│   │   ├── appbar.js             ← MODIFIKASI (breadcrumb portal)
│   │   ├── modal.js              ← unchanged
│   │   ├── icons.js              ← unchanged
│   │   ├── toast.js              ← unchanged
│   │   ├── table.js              ← unchanged
│   │   └── password-strength.js  ← unchanged
│   ├── utils/                    ← SHARED (tidak berubah)
│   │   └── dom.js
│   │
│   ├── landing/                  ← PORTAL LANDING (BARU)
│   │   └── landing.js            ← Halaman pemilih portal
│   │
│   ├── portal-saham/             ← PORTAL SAHAM 🔐
│   │   ├── config.js             ← Portal config (label, icon, routes, guard)
│   │   ├── init.js               ← Setup drawer Saham
│   │   ├── stocks.js             ← (pindah dari pages/stocks.js)
│   │   ├── stock-list.js         ← (pindah dari pages/stock-list.js)
│   │   ├── news.js               ← (pindah dari pages/news.js)
│   │   ├── reports.js            ← (pindah dari pages/reports.js)
│   │   ├── market.js             ← (pindah dari pages/market.js)
│   │   ├── video.js              ← (pindah dari pages/video.js)
│   │   ├── video-history.js      ← (pindah dari pages/video-history.js)
│   │   └── admin/                ← Admin section tetap di Saham
│   │       ├── dashboard.js
│   │       ├── users.js
│   │       ├── sitemaps.js
│   │       ├── proxies.js
│   │       ├── backup.js
│   │       ├── stock-status.js
│   │       └── idx-upload.js
│   │
│   ├── portal-tools/             ← PORTAL TOOLS 🌐
│   │   ├── config.js
│   │   ├── init.js
│   │   ├── password-gen.js       ← (pindah dari pages/password-gen.js)
│   │   ├── diagram.js            ← (pindah dari pages/diagram.js)
│   │   ├── bahasa.js             ← (pindah dari pages/bahasa.js)
│   │   ├── color-blind.js        ← REWRITE dari Ruang-Pribadi-Web/color-blind/ (BARU)
│   │   ├── type-writing.js       ← REWRITE dari Ruang-Pribadi-Web/type-writing/ (BARU)
│   │   └── jepunese.js           ← REWRITE dari Ruang-Pribadi-Web/jepunese/ (BARU)
│   │
│   └── portal-quiz/              ← PORTAL QUIZ 🌐
│       ├── config.js
│       ├── init.js
│       ├── math-speed.js         ← (pindah dari pages/math-speed.js)
│       ├── gacha.js              ← (pindah dari pages/gacha.js)
│       └── rolling.js            ← (pindah dari pages/rolling.js)
│
├── css/
│   └── 07-pages.css              ← TAMBAH portal landing styles
│
├── assets/
│   └── config/
│       ├── menu_config.json      ← REWRITE (tambah field `portal`)
│       └── portals.json          ← BARU (portal definitions)
```

---

## 4. Portal Definitions

### `assets/config/portals.json` (BARU)

```json
{
  "portals": [
    {
      "id": "saham",
      "label": "Saham",
      "description": "Market intel, berita, dan analisis IDX",
      "icon": "trending-up",
      "color": "primary",
      "auth": true,
      "route": "#/saham",
      "defaultPage": "stocks"
    },
    {
      "id": "tools",
      "label": "Tools",
      "description": "Kalkulator, konversi, dan produktivitas",
      "icon": "tool",
      "color": "accent",
      "auth": false,
      "route": "#/tools",
      "defaultPage": "password"
    },
    {
      "id": "quiz",
      "label": "Quiz",
      "description": "Kuis interaktif dan games seru",
      "icon": "zap",
      "color": "warn",
      "auth": false,
      "route": "#/quiz",
      "defaultPage": "math-speed"
    }
  ]
}
```

### `assets/config/menu_config.json` (REWRITE)

Tambah field `portal` di setiap app:

```json
{
  "apps": [
    { "key": "stocks", "portal": "saham", "section": "market", "icon": "Icons.candlestick_chart", "label": "IDX Stocks", "defaultPermission": true },
    { "key": "math_speed", "portal": "quiz", "section": "menu", "icon": "Icons.calculate", "label": "Math Speed", "defaultPermission": true },
    { "key": "password_generator", "portal": "tools", "section": "menu", "icon": "Icons.password", "label": "Password Generator", "defaultPermission": true }
  ]
}
```

---

## 5. Routing System Baru

### Route Registration Pattern

```js
// router.js — portal-aware route map
const PORTAL_ROUTES = {
  saham: {
    guard: 'auth',
    routes: {
      'stocks':          () => import('../portal-saham/stocks.js'),
      'news':            () => import('../portal-saham/news.js'),
      'stock-list':      () => import('../portal-saham/stock-list.js'),
      'reports':         () => import('../portal-saham/reports.js'),
      'market':          () => import('../portal-saham/market.js'),
      'video':           () => import('../portal-saham/video.js'),
      'video-history':   () => import('../portal-saham/video-history.js'),
      'admin/dashboard': () => import('../portal-saham/admin/dashboard.js'),
      'admin/users':     () => import('../portal-saham/admin/users.js'),
      'admin/sitemaps':  () => import('../portal-saham/admin/sitemaps.js'),
      'admin/proxies':   () => import('../portal-saham/admin/proxies.js'),
      'admin/backup':    () => import('../portal-saham/admin/backup.js'),
      'admin/stock-status': () => import('../portal-saham/admin/stock-status.js'),
      'admin/idx-upload':   () => import('../portal-saham/admin/idx-upload.js'),
    }
  },
  tools: {
    guard: 'none',
    routes: {
      'password':    () => import('../portal-tools/password-gen.js'),
      'bahasa':      () => import('../portal-tools/bahasa.js'),
      'diagram':     () => import('../portal-tools/diagram.js'),
      'color-blind': () => import('../portal-tools/color-blind.js'),
      'type-writing':() => import('../portal-tools/type-writing.js'),
      'jepunese':    () => import('../portal-tools/jepunese.js'),
    }
  },
  quiz: {
    guard: 'none',
    routes: {
      'math-speed': () => import('../portal-quiz/math-speed.js'),
      'gacha':      () => import('../portal-quiz/gacha.js'),
      'rolling':    () => import('../portal-quiz/rolling.js'),
    }
  }
};
```

### Access Check Flow

```
navigate('#/saham/stocks')
  → parse: portal='saham', page='stocks'
  → check guard: saham requires auth
  → store.token exists?
    → YES → load page
    → NO → store.pendingPortal = 'saham'; navigate('#/login')

navigate('#/tools/password')
  → parse: portal='tools', page='password'
  → check guard: tools = public
  → load page directly

navigate('#/saham/admin/dashboard')
  → parse: portal='saham', page='admin/dashboard'
  → check guard: saham requires auth ✓
  → check admin: store.tier === 'admin'?
    → YES → load page
    → NO → show "Akses Dibatasi"
```

---

## 6. Landing Page Design

### Visual

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                    🏠 Ruang Pribadi                          │
│              Personal productivity suite                     │
│                                                              │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│    │              │  │              │  │              │     │
│    │   📈         │  │   🔧         │  │   ⚡         │     │
│    │              │  │              │  │              │     │
│    │   Saham      │  │   Tools      │  │   Quiz       │     │
│    │              │  │              │  │              │     │
│    │ Market intel │  │ Kalkulator   │  │ Kuis interak │     │
│    │ berita IDX   │  │ konversi &   │  │ tif & games  │     │
│    │              │  │ produktivitas│  │ seru         │     │
│    │              │  │              │  │              │     │
│    │ 🔐 Login     │  │ 🌐 Public    │  │ 🌐 Public    │     │
│    │   diperlukan │  │              │  │              │     │
│    │              │  │              │  │              │     │
│    │  [ Masuk → ] │  │  [ Buka → ]  │  │  [ Buka → ]  │     │
│    └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│                    User card (jika login)                    │
│                    [ Ganti Portal ] [ Logout ]               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Behavior

- **Guest**: 3 card tampil. Saham card bertuliskan "🔐 Login diperlukan" + tombol "Masuk" → `#/login`. Tools & Quiz langsung "Buka" → portal
- **Logged-in**: 3 card tampil. Semua "Buka". Di atas card ada user info bar: avatar + "Halo, {username}" + "Logout" button
- **Hover**: card lift shadow + border-color portal theme
- **Mobile**: 1 kolom, card full-width

---

## 7. Drawer Portal-Aware

### Behavior

- Saat di landing page (`#/`) → **drawer tidak tampil** (full-width centered)
- Saat di login page (`#/login`) → **drawer tidak tampil**
- Saat di profile (`#/profile`) → **drawer tidak tampil**
- Saat di portal (`#/saham/*`, `#/tools/*`, `#/quiz/*`) → drawer muncul dengan item portal itu saja

### Drawer Structure per Portal

**Portal Saham:**
```
┌─────────────────┐
│ 👤 Nama User    │
│    admin/guest  │
├─────────────────┤
│ 📊 MARKET       │
│   IDX Stocks    │
│   Stock List    │
│   News          │
│   Reports       │
│   Market        │
│                 │
│ 🎥 MEDIA        │
│   Video Down.   │
│   Video History │
│                 │
│ 🛡️ ADMIN        │  ← hanya tier admin
│   Dashboard     │
│   Users         │
│   Sitemaps      │
│   Proxies       │
│   Backup        │
│   Stock Status  │
│   IDX Upload    │
├─────────────────┤
│ 🏠 Ganti Portal │
│ 🚪 Logout       │
└─────────────────┘
```

**Portal Tools:**
```
┌─────────────────┐
│ 👤 Nama User    │
│    guest        │
├─────────────────┤
│ 🔧 TOOLS        │
│   Password Gen  │
│   Render Diagram│
│   Language      │
│   Color Blind   │  ← BARU (dari Ruang-Pribadi-Web)
│   Type Writing  │  ← BARU (dari Ruang-Pribadi-Web)
│   Jepunese      │  ← BARU (dari Ruang-Pribadi-Web)
├─────────────────┤
│ 🏠 Ganti Portal │
│ 🚪 Login/Logout │
└─────────────────┘
```

**Portal Quiz:**
```
┌─────────────────┐
│ 👤 Nama User    │
│    guest        │
├─────────────────┤
│ ⚡ QUIZ          │
│   Math Speed    │
│   Gacha Luck    │
│   Rolling       │
├─────────────────┤
│ 🏠 Ganti Portal │
│ 🚪 Login/Logout │
└─────────────────┘
```

---

## 8. App Shell — Layout Switching

### Saat ini (`app.js`)

```
#app
└── .app-shell (flex row)
    ├── .drawer (sidebar)
    └── .main
        ├── .appbar (top bar)
        └── #page-root (content)
```

### Setelah redesign — 3 layout modes

**Mode 1: Full-width** (landing, login, profile)
```
#app
└── #page-root (full-width, centered, NO drawer)
```

**Mode 2: Portal** (saham/*, tools/*, quiz/*)
```
#app
└── .app-shell (flex row)
    ├── .drawer (portal-specific items)
    └── .main
        ├── .appbar (portal badge + page title)
        └── #page-root (content)
```

### app.js Logic Baru

```js
function isPortalRoute(path) {
  return path.startsWith('/saham') || path.startsWith('/tools') || path.startsWith('/quiz');
}

export async function initApp() {
  // ...
  const path = location.hash.slice(1) || '/';

  if (isPortalRoute(path)) {
    // Portal mode: show shell with drawer
    await buildPortalShell();
  } else {
    // Full-width mode: no drawer
    buildFullWidthShell();
  }

  await initRouter();
}
```

---

## 9. State Additions

### `state.js` — tambah keys

```js
export const store = new Proxy({
  // ... existing keys ...
  activePortal: null,     // 'saham' | 'tools' | 'quiz' | null
  pendingPortal: null,    // portal tujuan setelah login
}, { ... });
```

### Flow

1. User klik "Saham" di landing → `store.activePortal = 'saham'`
2. Router check auth → redirect ke login
3. `store.pendingPortal = 'saham'`
4. Login berhasil → navigate ke `#/saham` (default page)
5. User klik "Ganti Portal" → navigate ke `#/` → `store.activePortal = null`

---

## 10. Menu Config Migration

### Field baru di `menu_config.json`

```json
{
  "apps": [
    {
      "key": "stocks",
      "portal": "saham",
      "icon": "Icons.candlestick_chart",
      "label": "IDX Stocks",
      "section": "market",
      "defaultPermission": true
    }
  ]
}
```

### Pemetaan portal → apps

| Portal | Section | Apps |
|--------|---------|------|
| **saham** | market | stocks, stock_list, news, reports, market |
| **saham** | media | video, video_history |
| **saham** | admin | user_permissions, server_dashboard, sitemaps, proxies, backup, stock_status, idx_upload |
| **tools** | menu | password_generator, code_diagram, language |
| **tools** | color | color_blind *(BARU)* |
| **tools** | typing | type_writing *(BARU)* |
| **tools** | language | jepunese *(BARU)* |
| **quiz** | menu | math_speed, gacha_luck, rolling |

> **Catatan**: App baru (color_blind, type_writing, jepunese) perlu ditambahkan ke `menu_config.json` dengan key baru + icon mapping baru di `menu-config.js` jika belum ada di `icons.js`.

---

## 11. URL Migration

**Decision: Pecah total, URL baru. Tidak ada redirect backward-compat.**

| URL Lama | URL Baru |
|----------|----------|
| `#/` | `#/` (landing, ganti dari dashboard) |
| `#/stocks` | `#/saham/stocks` |
| `#/news` | `#/saham/news` |
| `#/stock-list` | `#/saham/stock-list` |
| `#/market` | `#/saham/market` |
| `#/reports` | `#/saham/reports` |
| `#/video` | `#/saham/video` |
| `#/video-history` | `#/saham/video-history` |
| `#/admin/*` | `#/saham/admin/*` |
| `#/math-speed` | `#/quiz/math-speed` |
| `#/gacha` | `#/quiz/gacha` |
| `#/rolling` | `#/quiz/rolling` |
| `#/password` | `#/tools/password` |
| `#/diagram` | `#/tools/diagram` |
| `#/bahasa` | `#/tools/bahasa` |
| `#/profile` | `#/profile` (global) |
| `#/login` | `#/login` (global) |
| *(baru)* | `#/tools/color-blind` |
| *(baru)* | `#/tools/type-writing` |
| *(baru)* | `#/tools/jepunese` |

---

## 12. Execution Plan (Phased)

### Phase 1: Infrastructure
- [ ] Buat `portals.json` config
- [ ] Update `menu_config.json` (tambah field `portal`)
- [ ] Tambah `activePortal`, `pendingPortal` ke `state.js`
- [ ] Update `menu-config.js` → portal-aware helpers + updated ROUTE_MAP

### Phase 2: Router Rewrite
- [ ] Rewrite `router.js` → parse portal from hash, portal guard, route resolution
- [ ] Update `checkAccess()` → portal-aware (saham = auth, tools/quiz = public, admin = admin tier)
- [ ] Login redirect: `pendingPortal` flow

### Phase 3: App Shell
- [ ] Update `app.js` → layout switching (full-width vs portal)
- [ ] Drawer show/hide based on route type
- [ ] AppBar update → portal badge (opsional)

### Phase 4: Landing Page
- [ ] Buat `js/landing/landing.js` (card grid, user info, portal selection)
- [ ] Buat CSS landing di `07-pages.css`
- [ ] Fetch portals.json → render 3 cards

### Phase 5: Drawer Portal-Aware
- [ ] Rewrite `drawer.js` → render items filtered by `store.activePortal`
- [ ] Tambah "Ganti Portal" button di drawer footer
- [ ] Subscribe `activePortal` → re-render drawer

### Phase 6: File Relocation
- [ ] Buat folder `portal-saham/`, `portal-tools/`, `portal-quiz/`, `landing/`
- [ ] Pindah page files satu per satu ke portal masing-masing
- [ ] `node --check` setiap file setelah pindah
- [ ] Fix cross-imports jika ada
- [ ] Buat `config.js` per portal

### Phase 6b: Porting 3 App Baru (Tools)
- [ ] Rewrite `color-blind.js` (hapus particles.js, tokenize CSS, gunakan `icons.js`)
- [ ] Rewrite `type-writing.js` (gabung bahasa + coder mode, 2 tabs)
- [ ] Rewrite `jepunese.js` (hapus fontawesome 25MB, pindah JSON ke `assets/data/jepunese/`)
- [ ] Tambah key baru (`color_blind`, `type_writing`, `jepunese`) ke `menu_config.json` + icon map di `menu-config.js`
- [ ] Tambah 3 route baru di `router.js`
- [ ] `node --check` + test manual di Live Server

### Phase 7: Cleanup
- [ ] Hapus folder `js/pages/` lama (setelah semua pindah)
- [ ] Update `NEXT_SESSION.md`
- [ ] Test semua portal end-to-end
- [ ] Audit dead code, unused imports, unused CSS

---

## 13. Risks & Mitigations

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Import path berubah di banyak file | Banyak error | Pindah file satu per satu, `node --check` setiap file |
| Drawer flash kosong saat switch portal | UX buruk | Skeleton / smooth transition |
| state `currentPage` format berubah | Active state drawer salah | `currentPage` simpan full path |
| Shared code break | Semua portal affected | Shared code (`core/`, `ui/`) tidak dipindah |
| Favicon 404 (existing) | Console error | `<link rel="icon" href="data:,">` quick fix |
| Porting 3 app — JS inline ribuan baris | Bug planar | Port per-app secara bertahap, test masing-masing setelah selesai |
| Jepunese JSON 5 file besar (JLPT N1-N5) | Load lambat | Lazy-load per level (fetch hanya saat level dipilih) |
| Data JSON path berubah | 404 | Letakkan di `assets/data/jepunese/`, fetch relatif dari module |

---

## 14. Estimasi

| Fase | Estimasi | Keterangan |
|------|----------|------------|
| Phase 1-2 | 1-2 jam | Config + Router (fondasi) |
| Phase 3-4 | 1-2 jam | Shell + Landing |
| Phase 5 | 1 jam | Drawer portal-aware |
| Phase 6 | 2-3 jam | Relokasi files + fix imports |
| Phase 6b | 3-4 jam | Porting 3 app baru (color-blind, type-writing, jepunese) |
| Phase 7 | 0.5 jam | Cleanup + testing |
| **Total** | **9-13 jam** | **4-5 sesi kerja** |

---

## 15. Kandidat Apps Baru (dari `Ruang-Pribadi-Web/`)

Audit langsung dari folder sumber (di luar repo utama). Semua masuk **Portal Tools** (public).

### 15.1 🎨 Color Blind — `color-blind/index.html`

| Aspek | Detail |
|-------|--------|
| **Fungsi** | Edukasi buta warna parsial + pencampuran warna interaktif |
| **Fitur** | Penjelasan jenis buta warna (protan/deutan/tritan), daftar warna rentan per kategori, WCAG contrast guidelines + contoh, color mixer (RGB/CMYK/Hex, 2-4 warna, nama warna HTML) |
| **Dependencies** | `particles.js` (CDN, background animasi), Font Awesome 6 (CDN) |
| **CSS** | ~580 baris inline (dark mode sendiri, responsive) → pindah & tokenize |
| **JS** | ~200+ baris inline (color name map, CMYK↔RGB, mixing alg) |
| **Status** | Self-contained single HTML, perlu rewrite jadi ES module |
| **Section** | `color` — icon: 🎨 / `palette` |

### 15.2 ⌨️ Type Writing — `type-writing/`

| Aspek | Detail |
|-------|--------|
| **Fungsi** | Typing practice "natural typewriter" |
| **Fitur** | 2 mode: **Bahasa** (natural language typing, cursor blink, speed control, pause/resume, progress bar) & **Coder** (sama untuk kode + syntax highlighting) |
| **Dependencies** | `particles.js` (CDN), Font Awesome 6 (CDN), `highlight.js` (CDN, hanya mode coder) |
| **CSS** | ~300 baris per file inline |
| **JS** | ~500+ baris per file (typing algorithm char-by-char) |
| **Status** | 3 HTML files (index=chooser, bahasa, coder) → gabung jadi 2 mode dalam 1 module |
| **Section** | `typing` — icon: ⌨️ / `keyboard` |
| **Catatan** | `index.html` tidak perlu — mode selector dibuat inline di page |

### 15.3 🇯🇵 Jepunese — `jepunese/`

| Aspek | Detail |
|-------|--------|
| **Fungsi** | Belajar karakter Jepang (Kanji + Hiragana + Katakana) |
| **Fitur** | Level selector (N5→N1 + Hiragana + Katakana), search, category filter, display mode (minimal/lengkap), pagination, detail modal (kunyomi/onyomi/meaning/Google search), dark/light theme |
| **Dependencies** | Font Awesome **local** (`fonts/fontawesome/`, ~25MB!) → **HAPUS**, pakai `icons.js` |
| **CSS** | `style.css` terpisah (~baris) |
| **JS** | `script.js` terpisah (grid, pagination, modal, search/filter) |
| **Data** | `data/hirakana.json`, `data/jlpt_n1.json` s/d `jlpt_n5.json` → pindah ke `assets/data/jepunese/` |
| **Status** | Terstruktur paling rapi dari 3; tetap perlu rewrite jadi ES module |
| **Section** | `language` — icon: 🇯🇵 / `globe` |
| **Catatan** | Potensi jadi portal Quiz di masa depan (mode kuis kosakata) |

### Migrasi Umum 3 App

| Masalah | Solusi |
|---------|--------|
| `particles.js` 23KB per app (3x CDN load) | Ganti CSS animation ringan ATAU buang (anti-slop) |
| Font Awesome CDN per app | Ganti `icons.js` (SVG inline) |
| Dark mode duplikat | Ikut `data-theme="dark"` global (hapus toggle sendiri) |
| CSS inline + Hex hardcoded | Tokenize ke `07-pages.css` (`--c-*`, `--radius`, `--s-*`) |
| JS inline + `onclick=` attribute | Rewrite gunakan `createEl`/`on`/`html` dari `dom.js` |
| `confirm()`/`alert()` | Ganti `createModal` |

---

## 16. Open Questions

1. **Video downloader** → Tools atau Saham? (Proposal: Tools — utility)
2. **Profile page** → global (`#/profile`) atau per-portal? (Proposal: global)
3. **Theme** → per-portal atau global? (Proposal: global — lebih simpel)
4. **Landing page default** → kalau user langsung bookmark `#/saham/stocks` tanpa login → redirect login → setelah login → ke saham. Ini sudah di-cover oleh `pendingPortal`.
5. **Jepunese** → Tools atau Quiz? Saat ini hanya "belajar" (referensi), tapi kalau nanti ada mode kuis kosakata → pindah ke Quiz. (Proposal: Tools dulu, migrasi nanti kalau mode kuis dibuat)
6. **`particles.js`** → buang total (anti-slop) atau ganti CSS animation ringan? (Proposal: buang — background statis token-based cukup)
7. **Type Writing** → apakah `highlight.js` (CDN ~300KB) layak dipertahankan untuk mode coder? (Proposal: ya, library sudah standar industri; atau sederhanakan tanpa syntax highlighting untuk versi awal)
