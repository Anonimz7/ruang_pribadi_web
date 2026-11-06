/* nq-core.js — modul bersama halaman kuis (NalarQuest, HLR, ...).
   Dimuat SETELAH skrip konfigurasi halaman dan SEBELUM skrip logika halaman.
   Fungsi halaman (nextSoal, drawPrincipleList, ...) dirujuk hanya saat jalan,
   jadi halaman boleh tidak mendefinisikannya. */

/* ============================================================
   0. Util
   ============================================================ */
const randInt = (a,b) => a + Math.floor(Math.random()*(b-a+1));
function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function hash(s){
  let h = 2166136261;
  for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h,16777619); }
  return (h>>>0).toString(16).padStart(8,"0");
}
function evalExpr(expr, scope){
  try{
    const keys = Object.keys(scope);
    return Function(...keys, "return (" + expr + ");")(...keys.map(k => scope[k]));
  }catch(e){ return NaN; }
}
/* ---------- Kode simbol ----------
   Data menyimpan KODE (mis. "triangle"); glif hanya tampil di layar.
   Untuk mengubah tampilan simbol, ubah satu registri ini saja —
   tanpa menyentuh data. Nilai yang tidak dikenal dilewatkan mentah,
   jadi data lama berglif mentah tetap bisa dimainkan. */
const SYMBOLS = {
  triangle: "△", square: "□", circle: "○",
  diamond: "◇", star: "☆", backspace: "⌫", enter: "⏎"
};
function renderSymbol(v){ return (v in SYMBOLS) ? SYMBOLS[v] : v; }
function renderRaw(tpl, scope){
  return String(tpl).replace(/\{(\w+)\}/g, (m,k) => (k in scope ? scope[k] : m));
}
function render(tpl, scope){
  return String(tpl).replace(/\{(\w+)\}/g, (m,k) => (k in scope ? renderSymbol(scope[k]) : m));
}
function normEq(a, b){
  const sa = String(a ?? "").trim();
  const sb = String(b ?? "").trim();
  if(sa === "" || sb === "") return sa === sb;
  const numRe = /^-?\d+(\.\d+)?$/;
  if(numRe.test(sa) && numRe.test(sb)) return Number(sa) === Number(sb);
  return sa.toLowerCase() === sb.toLowerCase();
}
function escapeHtml(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function fmtSec(ms){
  if(ms == null) return "—";
  return (ms/1000).toFixed(1) + "s";
}


let TEMPLATES = [];      /* diisi saat boot */
let STATIC_BANK = [];    /* diisi saat boot */

/* ---------- Mode API backend: AKTIF (fase 1) ----------
   Kontrak REST JSON dari backend:
     GET {baseUrl}/api/nalarquest/bank (publik, hanya published)
       -> { "version": "x.y.z",
            "templates": [ <entri template, format = nalarquest-dataset.json> ],
            "static":    [ <entri soal statis> ] }
     POST {baseUrl}/api/nalarquest/upload (admin, mode A -> draft)
     GET {baseUrl}/api/nalarquest/drafts (admin)
     POST {baseUrl}/api/nalarquest/{id}/publish|reject (admin)
     (cadangan, belum dipakai)
     GET {baseUrl}/api/question?principle=..&type=..&difficulty=..
       -> satu objek entri template/statis
   Backend fase 1 sudah live (2026-11-01): baca bank publik, unggah
   admin (mode A -> draft), review draft (publish/reject). Token admin
   disimpan di sessionStorage (hilang saat tab ditutup) + tombol logout.
*/
const API_CONFIG = {
  enabled: true,
  baseUrl: "https://www.onix.my.id",
  endpoints: {
    dataset: "/api/nalarquest/bank",
    question: "/api/question",
    login: "/api/auth/login",
    upload: "/api/nalarquest/upload",
    drafts: "/api/nalarquest/drafts",
    publish: "/api/nalarquest/{id}/publish",
    reject: "/api/nalarquest/{id}/reject"
  },
  timeoutMs: 8000
};

const datasetState = {
  source: "memuat\u2026",   /* file | bawaan | api | campuran */
  note: "",
  customIds: []        /* id entri hasil tambah-manual / muat-file */
};

async function fetchWithTimeout(url, ms){
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { signal: ctl.signal, cache: "no-store" }); }
  finally { clearTimeout(t); }
}

function applyDataset(data, sourceLabel){
  const tpl = Array.isArray(data.templates) ? data.templates : [];
  const stc = Array.isArray(data.static) ? data.static : [];
  /* entri kustom (manual/file) dipertahankan agar tidak hilang saat reload */
  const keep = new Set(datasetState.customIds);
  const customTpl = TEMPLATES.filter(t => keep.has(t.id));
  const customStc = STATIC_BANK.filter(s => keep.has(s.id));
  TEMPLATES = tpl.concat(customTpl);
  STATIC_BANK = stc.concat(customStc);
  datasetState.source = sourceLabel;
}

async function loadDataset(){
  try {
    const res = await fetchWithTimeout(DATASET_URL, 5000);
    if(!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if(!Array.isArray(data.templates) && !Array.isArray(data.static))
      throw new Error("format JSON tidak dikenali");
    applyDataset(data, "file");
    datasetState.note = DATASET_URL;
  } catch(e) {
    TEMPLATES = FALLBACK_TEMPLATES.slice();
    STATIC_BANK = FALLBACK_STATIC.slice();
    datasetState.source = "bawaan";
    datasetState.note = "tidak bisa memuat " + DATASET_URL + " \u2014 pakai data bawaan";
  }
  drawDatasetPanel();
}

/* ---------- API backend (lengkap, tapi NONAKTIF) ---------- */
async function fetchDatasetFromAPI(){
  if(!API_CONFIG.enabled) throw new Error("mode API nonaktif (API_CONFIG.enabled = false)");
  if(!API_CONFIG.baseUrl) throw new Error("API_CONFIG.baseUrl belum diisi");
  const url = API_CONFIG.baseUrl.replace(/\/+$/, "") + API_CONFIG.endpoints.dataset;
  const res = await fetchWithTimeout(url, API_CONFIG.timeoutMs);
  if(!res.ok) throw new Error("API HTTP " + res.status);
  return res.json();
}
async function useApiDataset(){
  const data = await fetchDatasetFromAPI();
  applyDataset(data, "api");
  datasetState.note = API_CONFIG.baseUrl + API_CONFIG.endpoints.dataset;
  refreshAfterDatasetChange();
}

/* Muat dari API dulu; gagal -> file lokal (fallback lama). API yang
   sukses tapi banknya kosong TETAP dipakai (bukan fallback): bank
   kosong berarti belum ada yang published, bukan API rusak. */
async function loadFromApiOrFile(){
  try {
    await useApiDataset();
  } catch(e) {
    await loadDataset();
    datasetState.note += " (API gagal: " + e.message + ")";
    refreshAfterDatasetChange();
  }
}

/* ---------- API admin: login, unggah, review draft ---------- */
function apiUrl(path){
  return API_CONFIG.baseUrl.replace(/\/+$/, "") + path;
}
/* Sesi login aplikasi (ruang_pribadi): token + user tersimpan di
   localStorage oleh SPA (auth.js) — satu origin dengan halaman ini,
   jadi panel tidak perlu login sendiri. */
function appSession(){
  try {
    const token = localStorage.getItem("jwt_token") || "";
    const raw = localStorage.getItem("user_data") || "";
    if(!token || !raw) return { token: "", username: "", rank: 3 };
    const user = JSON.parse(raw);
    let rank = Number.isFinite(user.rank) ? user.rank : 3;
    if(!Number.isFinite(user.rank)){
      rank = user.tier === "admin" ? 0 : user.tier === "premium" ? 1
        : user.tier === "member" ? 2 : 3;
    }
    return { token: token, username: user.username || "", rank: rank };
  } catch(e){ return { token: "", username: "", rank: 3 }; }
}
function nqToken(){
  /* Token aplikasi dulu; token panel lama (sessionStorage) hanya
     fallback — form login panel sudah dihapus. */
  try {
    const app = localStorage.getItem("jwt_token");
    if(app) return app;
  } catch(e){}
  try { return sessionStorage.getItem("nq-admin-token") || ""; }
  catch(e){ return ""; }
}
function authHeaders(){
  const t = nqToken();
  return t ? { "Authorization": "Bearer " + t } : {};
}
async function apiFetch(path, opts){
  opts = opts || {};
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), API_CONFIG.timeoutMs);
  try {
    const res = await fetch(apiUrl(path), {
      method: opts.method || "GET",
      headers: Object.assign(
        { "Content-Type": "application/json" },
        authHeaders(), opts.headers || {}),
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctl.signal
    });
    let data = null;
    try { data = await res.json(); } catch(e) { data = null; }
    if(!res.ok){
      const err = new Error("API HTTP " + res.status);
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  } finally { clearTimeout(t); }
}
/* Panel Dataset hanya untuk admin aplikasi (opsi B): bukan admin
   tidak perlu melihatnya. Form login panel dihapus — status admin
   dibaca dari sesi login aplikasi. */
function refreshDatasetPanelVisibility(){
  const sec = document.getElementById("sec-dataset");
  if(sec) sec.style.display = appSession().rank === 0 ? "" : "none";
}
function refreshAuthUI(){
  const s = appSession();
  const st = document.getElementById("ds-auth-status");
  if(st) st.textContent = s.token
    ? ("Masuk sebagai " + (s.username || "?") + " (login aplikasi).") : "";
  const wrap = document.getElementById("ds-drafts-wrap");
  if(wrap) wrap.style.display = s.token ? "" : "none";
  if(!s.token){
    const list = document.getElementById("ds-drafts-list");
    if(list) list.innerHTML = "";
  }
  refreshDatasetPanelVisibility();
}
/* Sesi ditolak server (401/403): token milik aplikasi — panel TIDAK
   boleh menghapusnya (itu akan mengeluarkan user dari aplikasi). */
function onAdminSessionExpired(){
  const st = document.getElementById("ds-auth-status");
  if(st) st.textContent = "Sesi aplikasi habis — login ulang di aplikasi.";
  const wrap = document.getElementById("ds-drafts-wrap");
  if(wrap) wrap.style.display = "none";
  const list = document.getElementById("ds-drafts-list");
  if(list) list.innerHTML = "";
}
function normalizeUploadBody(data){
  /* Server membaca provenance dari kunci top-level "source"; entri
     statis tunggal membawa source:"static" (kontrak file) yang BUKAN
     provenance dan akan ditolak server (422). Normalisasi semua
     unggahan ke {templates, static, source:"import"} di sisi klien. */
  const templates = [], staticArr = [];
  if(data && typeof data === "object" && !Array.isArray(data)
     && (data.templates || data.static)){
    (data.templates || []).forEach(o => templates.push(o));
    (data.static || []).forEach(o => staticArr.push(o));
  } else if(Array.isArray(data)){
    data.forEach(o => (guessKind(o) === "static" ? staticArr : templates).push(o));
  } else if(data && typeof data === "object"){
    (guessKind(data) === "static" ? staticArr : templates).push(data);
  }
  return { templates: templates, static: staticArr, source: "import" };
}
async function uploadToServer(data){
  if(!nqToken()){ alert("Masuk dulu ke aplikasi sebagai admin."); return; }
  const body = normalizeUploadBody(data);
  if(!body.templates.length && !body.static.length){
    alert("Tidak ada entri untuk diunggah.");
    return;
  }
  try {
    const res = await apiFetch(API_CONFIG.endpoints.upload,
      { method: "POST", body: body });
    drawUploadReport([], res.added);
    await loadDrafts();
  } catch(e) {
    const det = e.data && e.data.detail;
    if(e.status === 422 && det && Array.isArray(det.failures)){
      drawUploadReport(det.failures, 0);
      alert("Unggah DITOLAK: " + det.failures.length +
        " entri tidak sesuai — tidak ada yang ditambahkan. Lihat laporan di panel Dataset.");
    } else if(e.status === 401 || e.status === 403){
      alert("Sesi aplikasi habis atau tidak berhak. Login ulang di aplikasi.");
      onAdminSessionExpired();
    } else if(e.status === 422 && typeof det === "string"){
      alert("Unggah ditolak: " + det);
    } else {
      alert("Unggah gagal: API HTTP " + (e.status || "?"));
    }
  }
}
async function loadDrafts(){
  const list = document.getElementById("ds-drafts-list");
  const st = document.getElementById("ds-auth-status");
  if(!nqToken()){ list.innerHTML = ""; return; }
  list.innerHTML = '<div style="font-size:11px">Memuat draft…</div>';
  try {
    const data = await apiFetch(API_CONFIG.endpoints.drafts);
    const drafts = data.drafts || [];
    if(!drafts.length){
      list.innerHTML = '<div style="font-size:11px">Tidak ada draft.</div>';
      return;
    }
    let html = '<button class="btn-sm" id="ds-publish-all">Terbitkan semua (' +
      drafts.length + ')</button>';
    drafts.forEach(d => {
      html += '<div style="margin-top:6px;font-size:11px"><b>' +
        escapeHtml(d.id) + '</b> (' + escapeHtml(d.type || "?") + ", " +
        escapeHtml(d.source_provenance || "?") + ")" +
        '<br><button class="btn-sm" data-pub="' + escapeHtml(d.id) +
        '">Terbitkan</button> ' +
        '<button class="btn-sm" data-rej="' + escapeHtml(d.id) +
        '">Tolak</button></div>';
    });
    list.innerHTML = html;
    list.querySelectorAll("[data-pub]").forEach(b =>
      b.addEventListener("click", () =>
        reviewDraft(b.getAttribute("data-pub"), "publish")));
    list.querySelectorAll("[data-rej]").forEach(b =>
      b.addEventListener("click", () =>
        reviewDraft(b.getAttribute("data-rej"), "reject")));
    document.getElementById("ds-publish-all").addEventListener("click",
      publishAllDrafts);
  } catch(e) {
    if(e.status === 401 || e.status === 403){
      onAdminSessionExpired();
      st.textContent = "Sesi aplikasi habis — login ulang di aplikasi.";
    } else {
      list.innerHTML = '<div style="font-size:11px">Gagal memuat draft: API HTTP ' +
        (e.status || "?") + '</div>';
    }
  }
}
async function reviewDraft(id, action){
  try {
    await apiFetch(API_CONFIG.endpoints[action].replace("{id}",
      encodeURIComponent(id)), { method: "POST" });
  } catch(e) {
    alert("Gagal " + (action === "publish" ? "menerbitkan" : "menolak") +
      ": API HTTP " + (e.status || "?"));
    return;
  }
  await loadDrafts();
  try { await useApiDataset(); } catch(e) { /* pool lama dipertahankan */ }
}
async function publishAllDrafts(){
  const btn = document.getElementById("ds-publish-all");
  if(btn) btn.disabled = true;
  try {
    const data = await apiFetch(API_CONFIG.endpoints.drafts);
    for(const d of (data.drafts || [])){
      await apiFetch(API_CONFIG.endpoints.publish.replace("{id}",
        encodeURIComponent(d.id)), { method: "POST" });
    }
  } catch(e) {
    alert("Terbitkan semua berhenti: API HTTP " + (e.status || "?") +
      ". Sebagian mungkin sudah terbit; muat ulang draft.");
  }
  if(btn) btn.disabled = false;
  await loadDrafts();
  try { await useApiDataset(); } catch(e) { /* pool lama dipertahankan */ }
}

/* ---------- Tambah / hapus manual ---------- */
function addDatasetEntry(kind, obj, deferRefresh){
  /* kind: "template" | "static". Return {ok, id?, errors?} */
  if(!obj || typeof obj !== "object" || Array.isArray(obj))
    return { ok:false, errors:["JSON harus berupa satu objek (bukan array)"] };
  const errs = validateTemplate(obj);
  if(errs.length) return { ok:false, errors:errs };
  const allIds = new Set(TEMPLATES.map(t => t.id).concat(STATIC_BANK.map(s => s.id)));
  if(!obj.id || allIds.has(obj.id))
    return { ok:false, errors:["id kosong atau sudah dipakai: " + obj.id] };
  if(kind === "static"){
    obj.source = "static";
    if(obj.template_id === undefined) obj.template_id = null;
    STATIC_BANK.push(obj);
  } else {
    TEMPLATES.push(obj);
  }
  datasetState.customIds.push(obj.id);
  if(datasetState.source === "file" || datasetState.source === "bawaan" || datasetState.source === "api")
    datasetState.source = "campuran";
  if(!deferRefresh) refreshAfterDatasetChange();
  return { ok:true, id: obj.id };
}

function removeDatasetEntry(id){
  const ti = TEMPLATES.findIndex(t => t.id === id);
  if(ti >= 0) TEMPLATES.splice(ti, 1);
  const si = STATIC_BANK.findIndex(s => s.id === id);
  if(si >= 0) STATIC_BANK.splice(si, 1);
  datasetState.customIds = datasetState.customIds.filter(x => x !== id);
  refreshAfterDatasetChange();
}

function guessKind(o){
  if(o && (o.source === "static" || (o.explanation !== undefined && o.vars === undefined))) return "static";
  return "template";
}

function importDatasetObject(data){
  /* Terima {templates:[], static:[]}, array, atau satu objek.
     MODE A (tolak-semua): bila SATU entri gagal, tidak ada yang
     ditambahkan. Laporan kegagalan tampil di panel Dataset. */
  const items = [];
  if(data && typeof data === "object" && !Array.isArray(data) && (data.templates || data.static)){
    (data.templates || []).forEach(o => items.push(["template", o]));
    (data.static || []).forEach(o => items.push(["static", o]));
  } else if(Array.isArray(data)){
    data.forEach(o => items.push([guessKind(o), o]));
  } else if(data && typeof data === "object"){
    items.push([guessKind(data), data]);
  }
  /* Lintas 1: validasi semua, tanpa mengubah bank. */
  const existingIds = new Set(TEMPLATES.map(t => t.id).concat(STATIC_BANK.map(s => s.id)));
  const failures = [];
  items.forEach(([k, o]) => {
    if(!o || typeof o !== "object" || Array.isArray(o)){
      failures.push({ id: "(bukan objek)", kind: k, errors: ["JSON harus berupa satu objek (bukan array)"] });
      return;
    }
    const errs = validateTemplate(o);
    if(!o.id) errs.push("id kosong");
    else if(existingIds.has(o.id)) errs.push("id sudah dipakai: " + o.id);
    /* Uji render hanya bila cek field sudah lolos (hindari error turunan). */
    if(k === "template" && !errs.length) errs.push(...testRender(o));
    if(errs.length) failures.push({ id: o.id || "(tanpa id)", kind: k, errors: errs });
    else existingIds.add(o.id);
  });
  if(failures.length){
    drawImportReport(failures, 0);
    return { added: 0, failed: failures.length, rejected: true };
  }
  /* Lintas 2: semua lolos, baru ditambahkan. */
  items.forEach(([k, o]) => addDatasetEntry(k, o, true));
  refreshAfterDatasetChange();
  drawImportReport([], items.length);
  return { added: items.length, failed: 0 };
}

function reportFailuresHtml(failures){
  let html = "";
  failures.forEach(f => {
    html += '<div style="margin-top:6px"><b>' + escapeHtml(String(f.id)) + '</b> (' + escapeHtml(f.kind) + ')' +
      '<br>' + f.errors.map(e => '&bull; ' + escapeHtml(e)).join('<br>') + '</div>';
  });
  return html;
}
function drawImportReport(failures, added){
  const el = document.getElementById("ds-import-report");
  if(!el) return;
  if(!failures.length){
    el.innerHTML = added
      ? '<span style="color:#2e7d32">Impor berhasil: ' + added + ' entri ditambahkan.</span>'
      : "";
    return;
  }
  el.innerHTML = '<div style="border:1px solid #c0392b;padding:8px">' +
    '<b>Impor DITOLAK: ' + failures.length + ' entri tidak sesuai — tidak ada yang ditambahkan.</b>' +
    reportFailuresHtml(failures) + '</div>';
}
function drawUploadReport(failures, added){
  const el = document.getElementById("ds-import-report");
  if(!el) return;
  if(!failures.length){
    el.innerHTML = added
      ? '<span style="color:#2e7d32">Unggah berhasil: ' + added + ' entri masuk draft (menunggu review).</span>'
      : "";
    return;
  }
  el.innerHTML = '<div style="border:1px solid #c0392b;padding:8px">' +
    '<b>Unggah DITOLAK: ' + failures.length + ' entri tidak sesuai — tidak ada yang ditambahkan (server).</b>' +
    reportFailuresHtml(failures) + '</div>';
}

function refreshAfterDatasetChange(){
  runValidation();
  drawBankStatus();
  if(typeof drawPrincipleList === "function") drawPrincipleList();
  if(typeof drawSession === "function") drawSession();
  drawDatasetPanel();
  /* Halaman boleh menyediakan onDatasetChanged() (mis. HLR: bangun ulang
     antrean); bila tidak ada, perilaku lama: tarik soal baru. */
  if(typeof onDatasetChanged === "function") onDatasetChanged();
  else nextSoal();
}

/* ---------- Panel dataset ---------- */
function drawDatasetPanel(){
  const el = document.getElementById("dataset-status");
  if(!el) return;
  const v = state.validation || { validCount: 0 };
  el.innerHTML =
    "Sumber: <b>" + escapeHtml(String(datasetState.source)) + "</b><br>" +
    "Template: " + TEMPLATES.length + " &middot; Statis: " + STATIC_BANK.length +
    " &middot; Valid: " + v.validCount +
    (datasetState.note ? "<br>" + escapeHtml(datasetState.note) : "") +
    "<br>Mode API backend: <b>" + (API_CONFIG.enabled ? "aktif" : "nonaktif") + "</b>";
  const list = document.getElementById("ds-custom-list");
  if(!list) return;
  if(!datasetState.customIds.length){ list.innerHTML = ""; return; }
  list.innerHTML = "<div class=\"ds-tag\">Entri kustom (" + datasetState.customIds.length + ")</div>" +
    datasetState.customIds.map(id =>
      "<div class=\"ds-item\"><span>" + escapeHtml(id) + "</span>" +
      "<button class=\"ds-del\" data-id=\"" + escapeHtml(id) + "\">hapus</button></div>"
    ).join("");
  list.querySelectorAll(".ds-del").forEach(b =>
    b.addEventListener("click", () => removeDatasetEntry(b.getAttribute("data-id"))));
}

function initDatasetUI(){
  document.body.insertAdjacentHTML("beforeend",
    '<div class="modal-back" id="ds-modal" style="display:none">' +
    '<div class="modal" role="dialog" aria-label="Tambah dataset manual">' +
    '<h3>Tambah dataset manual</h3>' +
    '<div class="ds-formrow">' +
    '<select id="ds-kind"><option value="template">Template</option><option value="static">Soal statis</option></select>' +
    '<button class="btn-sm" id="ds-example">Isi contoh</button>' +
    '</div>' +
    '<textarea id="ds-json" spellcheck="false" placeholder=\'{"id": "...", ...}\'></textarea>' +
    '<div class="msg" id="ds-msg"></div>' +
    '<div class="row">' +
    '<button class="btn-sm primary" id="ds-validate">Validasi</button>' +
    '<button class="btn-sm primary" id="ds-save">Tambahkan</button>' +
    '<button class="btn-sm" id="ds-close">Tutup</button>' +
    '</div></div></div>');

  const modal = document.getElementById("ds-modal");
  const ta = document.getElementById("ds-json");
  const msg = document.getElementById("ds-msg");
  const kind = () => document.getElementById("ds-kind").value;
  const setMsg = (t, cls) => { msg.textContent = t; msg.className = "msg " + cls; };

  document.getElementById("ds-add").addEventListener("click", () => {
    setMsg("", ""); modal.style.display = "flex";
  });
  document.getElementById("ds-close").addEventListener("click", () => { modal.style.display = "none"; });
  modal.addEventListener("click", e => { if(e.target === modal) modal.style.display = "none"; });
  document.getElementById("ds-example").addEventListener("click", () => {
    ta.value = JSON.stringify(kind() === "static" ? DS_EXAMPLE_STATIC : DS_EXAMPLE_TEMPLATE, null, 2);
  });
  function parseTextarea(){
    try { return { obj: JSON.parse(ta.value) }; }
    catch(e){ return { error: "JSON tidak valid: " + e.message }; }
  }
  document.getElementById("ds-validate").addEventListener("click", () => {
    const pr = parseTextarea();
    if(pr.error){ setMsg(pr.error, "err"); return; }
    const errs = validateTemplate(pr.obj);
    if(errs.length) setMsg("Ditemukan " + errs.length + " masalah:\n\u2022 " + errs.join("\n\u2022 "), "err");
    else setMsg("Valid \u2014 siap ditambahkan.", "ok");
  });
  document.getElementById("ds-save").addEventListener("click", () => {
    const pr = parseTextarea();
    if(pr.error){ setMsg(pr.error, "err"); return; }
    const r = addDatasetEntry(kind(), pr.obj);
    if(!r.ok) setMsg("Gagal:\n\u2022 " + r.errors.join("\n\u2022 "), "err");
    else { setMsg("Ditambahkan: " + r.id, "ok"); ta.value = ""; }
  });

  const fileInput = document.getElementById("ds-file");
  document.getElementById("ds-load-file").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    if(!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      let data;
      try { data = JSON.parse(rd.result); }
      catch(e){ alert("File bukan JSON valid: " + e.message); fileInput.value = ""; return; }
      const res = importDatasetObject(data);
      if(res.rejected)
        alert("Impor DITOLAK: " + res.failed + " entri tidak sesuai — tidak ada yang ditambahkan. Lihat laporan di panel Dataset.");
      else
        alert("Impor berhasil: " + res.added + " entri ditambahkan.");
      fileInput.value = "";
    };
    rd.readAsText(f);
  });

  document.getElementById("ds-reload").addEventListener("click", async () => {
    datasetState.source = "memuat\u2026"; datasetState.note = ""; drawDatasetPanel();
    await loadFromApiOrFile();
    refreshAfterDatasetChange();
  });
  document.getElementById("ds-api").addEventListener("click", async () => {
    try { await useApiDataset(); }
    catch(e){ alert("Gagal memuat dari API: " + e.message); }
  });
  const fileServerInput = document.getElementById("ds-file-server");
  document.getElementById("ds-upload-server").addEventListener("click", () => fileServerInput.click());
  fileServerInput.addEventListener("change", () => {
    const f = fileServerInput.files[0];
    if(!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      let data;
      try { data = JSON.parse(rd.result); }
      catch(e){ alert("File bukan JSON valid: " + e.message); fileServerInput.value = ""; return; }
      await uploadToServer(data);
      fileServerInput.value = "";
    };
    rd.readAsText(f);
  });
  refreshAuthUI();
  if(nqToken()) loadDrafts();
  document.getElementById("ds-guide").addEventListener("click", downloadPanduanMD);
}

/* ============================================================
   3. Validasi template (v0.7.1: perbaiki aturan)
   ============================================================ */
function validateTemplate(tpl){
  const errs = [];
  const req = ["id", "type", "principle", "surface_domain",
               "surface_distance", "difficulty", "prompt", "input"];
  req.forEach(f => { if(tpl[f] === undefined) errs.push("field '" + f + "' kosong"); });

  /* v0.7.1: bank statis memakai 'explanation', template memakai 'explain' */
  const hasExplain =
    (tpl.explain !== undefined) || (tpl.explanation !== undefined);
  if(!hasExplain) errs.push("field 'explain'/'explanation' kosong");

  if(!tpl.input){ return errs; }

  const inp = tpl.input;
  if(!inp.kind) errs.push("input.kind kosong");
  else if(!["choice", "keypad", "palette", "fill"].includes(inp.kind))
    errs.push("input.kind tidak dikenali: " + inp.kind);

  if(inp.kind === "choice"){
    if(!Array.isArray(inp.options) || inp.options.length < 2)
      errs.push("choice: opsi minimal 2");
    else {
      const correct = inp.options.filter(o => o.correct === true).length;
      if(correct !== 1) errs.push("choice: harus tepat 1 opsi benar (ada " + correct + ")");
      const texts = inp.options.map(o => String(o.text));
      if(new Set(texts).size !== texts.length) errs.push("choice: teks opsi duplikat");
    }
  }
  if(inp.kind === "keypad"){
    if(!inp.canonical) errs.push("keypad: 'canonical' wajib");
    if(inp.maxLength != null && (typeof inp.maxLength !== "number" || inp.maxLength < 1))
      errs.push("keypad: maxLength harus angka ≥1");
  }
  if(inp.kind === "palette"){
    if(!inp.canonical) errs.push("palette: 'canonical' wajib");
    if(!Array.isArray(inp.keys) || !inp.keys.length) errs.push("palette: 'keys' wajib");
  }
  if(inp.kind === "fill"){
    if(!Array.isArray(inp.slots) || !inp.slots.length) errs.push("fill: 'slots' wajib");
    if(!Array.isArray(inp.parts)) errs.push("fill: 'parts' wajib");
    /* v0.7.1: parts boleh lebih pendek dari slots+1 asalkan renderer toleran */
    else if(inp.slots){
      if(inp.parts.length < inp.slots.length)
        errs.push("fill: 'parts' kurang dari 'slots' (butuh minimal " + inp.slots.length + ")");
      if(inp.parts.length > inp.slots.length + 1)
        errs.push("fill: 'parts' lebih dari slots.length + 1");
    }
    if(inp.slots && inp.slots.some(s => !s.answer))
      errs.push("fill: setiap slot harus punya 'answer'");
  }
  return errs;
}
function runValidation(){
  const validIds = new Set();
  const invalid = [];
  TEMPLATES.forEach(t => {
    const errs = validateTemplate(t);
    if(errs.length) invalid.push({ id: t.id || "(tanpa id)", errors: errs });
    else validIds.add(t.id);
  });
  STATIC_BANK.forEach(s => {
    const errs = validateTemplate(s);
    if(errs.length) invalid.push({ id: s.id || "(tanpa id)", errors: errs });
    else validIds.add(s.id);
  });
  state.validation = {
    validCount: validIds.size,
    invalid,
    validIds
  };
}

/* ============================================================
   4. Instantiate
   ============================================================ */
function resolveVars(spec){
  const scope = {};
  for(const [k,s] of Object.entries(spec || {})){
    if(s.kind === "int"){
      scope[k] = randInt(s.min, s.max);
    } else if(s.kind === "pick"){
      const it = s.from[randInt(0, s.from.length - 1)];
      if(it && typeof it === "object") Object.assign(scope, it);
      else scope[k] = it;
    } else if(s.kind === "expr"){
      scope[k] = evalExpr(s.expr, scope);
    }
  }
  return scope;
}
function checkConstraints(cs, scope){
  if(!cs || !cs.length) return true;
  try { return cs.every(c => evalExpr(c, scope)); }
  catch(e){ return false; }
}
function buildInput(spec, scope){
  if(!spec || !spec.kind) return null;

  if(spec.kind === "choice"){
    const opts = spec.options.map(o => ({
      text:    render(o.text, scope),
      correct: !!o.correct,
      why:     o.why ? render(o.why, scope) : null
    }));
    if(spec.shuffle !== false) shuffle(opts);
    const texts = opts.map(o => o.text);
    if(new Set(texts).size !== texts.length) return null;
    if(opts.filter(o => o.correct).length !== 1) return null;
    return { kind:"choice", options: opts };
  }

  if(spec.kind === "keypad"){
    if(!spec.canonical) return null;
    return {
      kind: "keypad",
      maxLength: spec.maxLength || 6,
      canonical: render(spec.canonical, scope),
      keys:   spec.keys   || ["1","2","3","4","5","6","7","8","9","⌫","0","⏎"],
      layout: spec.layout || [3,3,3]
    };
  }

  if(spec.kind === "palette"){
    if(!spec.canonical || !spec.keys) return null;
    return {
      kind: "palette",
      maxLength: spec.maxLength || 4,
      /* canonical + keys tetap KODE; glif hanya tampil di tombol & display */
      canonical: renderRaw(spec.canonical, scope),
      keys: spec.keys.map(k => render(k, scope)),
      layout: spec.layout || [spec.keys.length]
    };
  }

  if(spec.kind === "fill"){
    if(!spec.slots || !spec.slots.length) return null;
    const slots = spec.slots.map(sl => ({
      answer: render(sl.answer, scope),
      width:  sl.width || 12
    }));
    const parts = (spec.parts || []).map(p => render(p, scope));
    if(parts.length < slots.length) return null;
    const out = { kind:"fill", parts, slots };
    if(spec.keys && spec.keys.length){
      out.keys = spec.keys.map(k => render(k, scope));
      out.layout = spec.layout || [spec.keys.length];
    }
    return out;
  }

  return null;
}
function instantiate(tpl){
  for(let attempt = 0; attempt < 400; attempt++){
    const scope = resolveVars(tpl.vars || {});
    if(!checkConstraints(tpl.constraints, scope)) continue;
    const input = buildInput(tpl.input, scope);
    if(!input) continue;

    return {
      id: hash(tpl.id + render(tpl.prompt, scope)).slice(0, 6),
      source: "template",
      template_id: tpl.id,
      type: tpl.type,
      domain: tpl.domain,
      principle: tpl.principle,
      surface_domain: tpl.surface_domain,
      surface_distance: tpl.surface_distance,
      contrast_with: tpl.contrast_with || [],
      is_contrast: !!tpl.is_contrast,
      difficulty: tpl.difficulty,
      prompt: render(tpl.prompt, scope),
      explanation: render(tpl.explain || tpl.explanation || "", scope),
      input
    };
  }
  return null;
}

/* ---------- Uji render impor (mode A: tolak-semua) ----------
   Template yang lolos cek field belum tentu bisa dirender: expr yang
   tidak valid menghasilkan NaN (kasus 'a+2d' 2026-10-27) dan lolos
   validateTemplate. Fungsi ini me-render uji sebelum entri diterima:
   - template pick-only: SEMUA set variasi diuji satu per satu
   - template lain: 20 render acak
   Render gagal bila: tidak bisa di-render, atau ada field hasil render
   yang mengandung "NaN"/"undefined". */
function checkRenderedField(name, value, errs){
  if(value != null && /NaN|undefined/.test(String(value)))
    errs.push("render: '" + name + "' mengandung NaN/undefined");
}
function checkRenderedInput(inp, errs){
  if(!inp) return;
  if(inp.kind === "choice"){
    inp.options.forEach((o, i) => {
      checkRenderedField("options[" + i + "].text", o.text, errs);
      checkRenderedField("options[" + i + "].why", o.why, errs);
    });
  }
  if(inp.kind === "keypad" || inp.kind === "palette")
    checkRenderedField("canonical", inp.canonical, errs);
  if(inp.kind === "fill"){
    (inp.slots || []).forEach((s, i) => checkRenderedField("slots[" + i + "].answer", s.answer, errs));
    (inp.parts || []).forEach((p, i) => checkRenderedField("parts[" + i + "]", p, errs));
  }
}
function testRender(tpl){
  const errs = [];
  const vars = tpl.vars || {};
  const keys = Object.keys(vars);
  if(keys.length === 1 && vars[keys[0]] && vars[keys[0]].kind === "pick" && Array.isArray(vars[keys[0]].from)){
    const k = keys[0];
    let tested = 0;
    vars[k].from.forEach(it => {
      const scope = (it && typeof it === "object") ? { ...it } : { [k]: it };
      if(!checkConstraints(tpl.constraints, scope)) return;
      tested++;
      const input = buildInput(tpl.input, scope);
      if(!input){ errs.push("render: variasi " + JSON.stringify(scope) + " tidak bisa di-render"); return; }
      checkRenderedField("prompt", render(tpl.prompt, scope), errs);
      checkRenderedField("explain", render(tpl.explain || tpl.explanation || "", scope), errs);
      checkRenderedInput(input, errs);
    });
    if(!tested) errs.push("render: tidak ada variasi yang lolos constraints");
  } else {
    for(let i = 0; i < 20; i++){
      const s = instantiate(tpl);
      if(!s){ errs.push("render: tidak bisa di-render"); break; }
      checkRenderedField("prompt", s.prompt, errs);
      checkRenderedField("explain", s.explanation, errs);
      checkRenderedInput(s.input, errs);
    }
  }
  /* Pesan yang sama dari banyak render cukup tampil sekali. */
  return [...new Set(errs)];
}

/* ============================================================
   5. Pool & pick
   ============================================================ */
function matchesItem(item, filters, sourceKind){
  /* v0.7.1: entri yang ditolak validasi tidak pernah masuk pool */
  if(!state.validation.validIds.has(item.id)) return false;
  if(sourceKind === "static"  && filters.srcFilter === "template") return false;
  if(sourceKind === "template"&& filters.srcFilter === "static")   return false;
  if(filters.mode !== "all" && item.type !== filters.mode) return false;
  if(filters.diff !== 0 && item.difficulty !== filters.diff) return false;
  if(filters.principle !== "all" && item.principle !== filters.principle) return false;
  return true;
}
function availablePrinciples(filters){
  const set = new Set();
  TEMPLATES.forEach(t => {
    if(matchesItem(t, filters, "template")) set.add(t.principle);
  });
  STATIC_BANK.forEach(s => {
    if(matchesItem(s, filters, "static")) set.add(s.principle);
  });
  return [...set].sort();
}
function pickSoal(filters){
  const staticCandidates = STATIC_BANK.filter(s => matchesItem(s, filters, "static"));
  const tplCandidates = TEMPLATES.filter(t => matchesItem(t, filters, "template"));

  const hasStatic   = staticCandidates.length > 0;
  const hasTemplate = tplCandidates.length > 0;
  if(!hasStatic && !hasTemplate) return null;

  let useStatic;
  if(!hasStatic) useStatic = false;
  else if(!hasTemplate) useStatic = true;
  else useStatic = Math.random() < 0.30;

  if(useStatic){
    const s = staticCandidates[randInt(0, staticCandidates.length - 1)];
    /* v0.7.1: soal statis lewat buildInput supaya default keys/layout terpasang */
    return instantiateStatic(s);
  }

  for(let i = 0; i < 40; i++){
    const t = tplCandidates[randInt(0, tplCandidates.length - 1)];
    const soal = instantiate(t);
    if(soal) return soal;
  }
  return null;
}
function instantiateStatic(s){
  /* lewat buildInput supaya default keys/layout terisi */
  const input = buildInput(s.input, {});
  if(!input) return null;
  return {
    id: s.id,
    source: "static",
    template_id: null,
    type: s.type,
    domain: s.domain,
    principle: s.principle,
    surface_domain: s.surface_domain,
    surface_distance: s.surface_distance,
    contrast_with: s.contrast_with || [],
    is_contrast: !!s.is_contrast,
    difficulty: s.difficulty,
    prompt: s.prompt,
    explanation: s.explanation || s.explain || "",
    input
  };
}

/* ============================================================
   7. Grade
   ============================================================ */
function grade(soal, ua){
  const inp = soal.input;
  if(inp.kind === "choice"){
    if(typeof ua !== "number") return false;
    return inp.options[ua] && inp.options[ua].correct === true;
  }
  if(inp.kind === "keypad" || inp.kind === "palette"){
    return normEq(ua, inp.canonical);
  }
  if(inp.kind === "fill"){
    if(!Array.isArray(ua) || ua.length !== inp.slots.length) return false;
    return inp.slots.every((s,i) => normEq(ua[i], s.answer));
  }
  return false;
}

/* ============================================================
   8. State
   ============================================================ */
const state = {
  soal: null, soalStartedAt: 0,
  answered: false, awaitingConfidence: false,
  userAnswer: null, buffer: "",
  pending: null,
  lastKey: null,
  stats: { ok:0, no:0, streak:0, best:0, byPrinciple: {} },
  validation: { validCount: 0, invalid: [], validIds: new Set() },
  srcTab: "soal"
};

const $ = id => document.getElementById(id);
const els = {
  prompt: $("prompt"), inputs: $("inputs"), explain: $("explain"),
  confSlot: $("conf-slot"),
  mId: $("m-id"), mTpl: $("m-tpl"), mDom: $("m-dom"), mDif: $("m-dif"),
  mKind: $("m-kind"), mPrinciple: $("m-principle"), mDist: $("m-dist"),
  mSrc: $("m-src"), mSession: $("m-session"),
  code: $("code"), redactNote: $("redact-note"),
  sOk: $("s-ok"), sNo: $("s-no"), sAcc: $("s-acc"), sSt: $("s-st"), sBest: $("s-best"),
  calibTotal: $("calib-total"),
  principleList: $("principle-list"),
  sessionPanel: $("session-panel"),
  bankStatus: $("bank-status"),
  tabs: $("tabs"), next: $("next"), nextInline: $("next-inline")
};

function draw(){
  const s = state.soal;
  if(!s) return;
  els.mId.textContent = "#" + s.id;
  els.mTpl.textContent = s.template_id || "(statis)";
  els.mDom.textContent = s.domain;
  els.mDif.textContent = "tingkat " + s.difficulty;
  els.mKind.textContent = "input:" + s.input.kind;
  els.mPrinciple.textContent = s.principle || "—";
  els.mDist.textContent = "jarak " + (s.surface_distance ?? "—");
  els.mSrc.textContent = s.source;
  els.mSrc.className = "src-tag " + s.source;

  if(state.session && state.session.active){
    els.mSession.innerHTML = '<span class="session-tag">sesi</span>';
  } else {
    els.mSession.textContent = "";
  }

  els.prompt.textContent = s.prompt;
  els.inputs.innerHTML = "";
  els.confSlot.innerHTML = "";
  els.explain.hidden = true;
  els.explain.innerHTML = "";
  els.nextInline.style.display = "none";

  mountInput(s.input);
  drawCode();
}
function mountInput(inp){
  if(inp.kind === "choice")  mountChoice(inp);
  if(inp.kind === "keypad")  mountKeypad(inp, false);
  if(inp.kind === "palette") mountKeypad(inp, true);
  if(inp.kind === "fill")    mountFill(inp);
}

function mountChoice(inp){
  const box = document.createElement("div");
  box.className = "opts";
  inp.options.forEach((o, i) => {
    const b = document.createElement("button");
    b.className = "opt";
    b.innerHTML = '<span class="key">' + "ABCDEFGH"[i] + '</span>' +
                  '<span class="txt"></span><span class="mk"></span>';
    b.querySelector(".txt").textContent = o.text;
    b.addEventListener("click", () => {
      if(state.answered) return;
      state.userAnswer = i;
      [...box.children].forEach((el, j) => el.classList.toggle("chosen", j === i));
      submit();
    });
    box.appendChild(b);
  });
  els.inputs.appendChild(box);
}

function mountKeypad(inp, isPalette){
  /* v0.7.1: default keys/layout kalau tidak ada (untuk soal statis lama) */
  const keys = inp.keys || ["1","2","3","4","5","6","7","8","9","⌫","0","⏎"];
  const layout = (inp.layout && inp.layout.length) ? inp.layout : [3,3,3];

  const wrap = document.createElement("div");
  wrap.className = "kp-wrap" + (isPalette ? " pal" : "");

  const disp = document.createElement("div");
  disp.className = "kp-display";
  disp.innerHTML = '<span class="ph">' +
    (isPalette ? "Pilih simbol" : "Ketik angka") +
    '</span><span class="kp-buf"></span><span class="cursor"></span>';
  wrap.appendChild(disp);

  const grid = document.createElement("div");
  grid.className = "kp-keys";
  const cols = Math.max(...layout);
  grid.style.gridTemplateColumns = "repeat(" + cols + ", minmax(0,1fr))";

  keys.forEach(k => {
    const b = document.createElement("button");
    b.className = "kp-key" + (isPalette ? " pal-key" : "");
    /* palette: label = glif dari kode; nilai tetap kode */
    b.textContent = isPalette ? renderSymbol(k) : k;
    const isDel = (k === "⌫" || k === "backspace");
    const isEnter = (k === "⏎" || k === "enter");
    if(isDel || isEnter) b.classList.add("action");
    b.addEventListener("click", () => {
      if(state.answered) return;
      /* palette: buffer memegang satu kode utuh, hapus = kosongkan */
      if(isDel){ state.buffer = isPalette ? "" : state.buffer.slice(0, -1); }
      else if(isEnter){ state.userAnswer = state.buffer; submit(); return; }
      else if(state.buffer.length < (inp.maxLength || 6)){ state.buffer += k; }
      refreshBuffer();
    });
    grid.appendChild(b);
  });
  wrap.appendChild(grid);
  els.inputs.appendChild(wrap);
  refreshBuffer();
}

function mountFill(inp){
  /* v0.7.1: iterasi berdasarkan slots, bukan parts.
     parts boleh lebih pendek dari slots+1; yang kosong tidak dirender. */
  const wrap = document.createElement("div");
  wrap.className = "fill-wrap";

  const line = document.createElement("div");
  line.className = "fill-line";
  const fields = [];
  let activeSlot = 0;
  const hasKeys = !!(inp.keys && inp.keys.length);

  for(let i = 0; i < inp.slots.length; i++){
    const prefix = inp.parts[i];
    if(prefix){
      const span = document.createElement("span");
      span.textContent = prefix;
      line.appendChild(span);
    }
    const f = document.createElement("input");
    f.className = "fill-slot";
    f.style.width = (inp.slots[i].width || 12) * 10 + "px";
    f.autocomplete = "off";
    f.spellcheck = false;
    f.dataset.idx = i;
    if(hasKeys) f.readOnly = true;
    f.addEventListener("focus", () => { activeSlot = i; updateActive(); });
    f.addEventListener("click", () => { activeSlot = i; updateActive(); });
    f.addEventListener("keydown", e => {
      if(e.key === "Enter"){ e.preventDefault(); trySubmit(); }
    });
    line.appendChild(f);
    fields.push(f);
  }
  /* teks penutup, kalau ada */
  const suffix = inp.parts[inp.slots.length];
  if(suffix){
    const span = document.createElement("span");
    span.textContent = suffix;
    line.appendChild(span);
  }
  wrap.appendChild(line);

  if(hasKeys){
    const kp = document.createElement("div");
    kp.className = "fill-keys";
    const cols = Math.max(...(inp.layout || [inp.keys.length]));
    kp.style.gridTemplateColumns = "repeat(" + cols + ", minmax(0,1fr))";

    inp.keys.forEach(k => {
      const b = document.createElement("button");
      b.className = "fill-key";
      b.textContent = k;
      b.addEventListener("click", () => {
        if(state.answered) return;
        fields[activeSlot].value = k;
        const nextEmpty = fields.findIndex((f, idx) => idx > activeSlot && !f.value);
        if(nextEmpty >= 0) activeSlot = nextEmpty;
        else if(activeSlot < fields.length - 1) activeSlot++;
        updateActive();
      });
      kp.appendChild(b);
    });
    wrap.appendChild(kp);

    const actions = document.createElement("div");
    actions.className = "fill-actions";

    const clearBtn = document.createElement("button");
    clearBtn.className = "fill-action";
    clearBtn.textContent = "Hapus";
    clearBtn.addEventListener("click", () => {
      if(state.answered) return;
      fields[activeSlot].value = "";
      updateActive();
    });
    actions.appendChild(clearBtn);

    const submitBtn = document.createElement("button");
    submitBtn.className = "fill-action primary";
    submitBtn.textContent = "Periksa";
    submitBtn.addEventListener("click", trySubmit);
    actions.appendChild(submitBtn);

    wrap.appendChild(actions);
    wrap._btn = submitBtn;
  } else {
    const submitBox = document.createElement("div");
    submitBox.className = "fill-submit";
    const btn = document.createElement("button");
    btn.textContent = "Periksa";
    btn.addEventListener("click", trySubmit);
    submitBox.appendChild(btn);
    wrap.appendChild(submitBox);
    wrap._btn = btn;
    setTimeout(() => fields[0] && fields[0].focus(), 40);
  }

  function updateActive(){
    fields.forEach((f, i) => f.classList.toggle("active", i === activeSlot));
  }
  updateActive();

  function trySubmit(){
    if(state.answered) return;
    if(fields.some(f => !f.value.trim())) return;
    state.userAnswer = fields.map(f => f.value);
    submit();
  }

  wrap._fields = fields;
  els.inputs.appendChild(wrap);
}

/* ============================================================
   10. Submit → confidence → commit
   ============================================================ */
function submit(){
  if(state.answered || !state.soal) return;
  state.answered = true;
  state.awaitingConfidence = true;

  const s = state.soal;
  const correct = grade(s, state.userAnswer);
  const ms = Date.now() - state.soalStartedAt;
  state.pending = { correct, ms };

  disableInput();
  mountConfidenceBar();
  updateLockState();
  drawCode();          /* redaksi dilepas setelah soal dijawab */
}

function disableInput(){
  const inp = state.soal.input;
  if(inp.kind === "choice"){
    const box = els.inputs.querySelector(".opts");
    if(box) [...box.children].forEach(el => el.disabled = true);
  } else if(inp.kind === "keypad" || inp.kind === "palette"){
    const wrap = els.inputs.querySelector(".kp-wrap");
    if(wrap){
      wrap.querySelectorAll("button").forEach(b => b.disabled = true);
      const cur = wrap.querySelector(".cursor");
      if(cur) cur.classList.add("hide");
    }
  } else if(inp.kind === "fill"){
    const wrap = els.inputs.querySelector(".fill-wrap");
    if(wrap){
      wrap._fields.forEach(f => { f.disabled = true; f.classList.remove("active"); });
      wrap.querySelectorAll("button").forEach(b => b.disabled = true);
    }
  }
}

function mountConfidenceBar(){
  const el = els.confSlot;
  el.innerHTML = "";
  const bar = document.createElement("div");
  bar.className = "conf-bar";
  const q = document.createElement("span");
  q.className = "q";
  q.textContent = "Seberapa yakin dengan jawabanmu?";
  const btns = document.createElement("div");
  btns.className = "conf-btns";

  const bY = document.createElement("button");
  bY.className = "conf-btn yakin";
  bY.textContent = "Yakin (Y)";
  bY.addEventListener("click", () => commit(true));

  const bN = document.createElement("button");
  bN.className = "conf-btn tidak";
  bN.textContent = "Tidak yakin (T)";
  bN.addEventListener("click", () => commit(false));

  btns.appendChild(bY); btns.appendChild(bN);
  bar.appendChild(q); bar.appendChild(btns);
  el.appendChild(bar);

  const hint = document.createElement("div");
  hint.className = "conf-hint";
  hint.textContent = "Jawaban akan dinilai setelah keyakinan dipilih.";
  el.appendChild(hint);
}

function commit(confident){
  if(!state.pending) return;
  state.awaitingConfidence = false;
  const { correct, ms } = state.pending;
  const s = state.soal;

  if(correct){
    state.stats.ok++;
    state.stats.streak++;
    if(state.stats.streak > state.stats.best) state.stats.best = state.stats.streak;
  } else {
    state.stats.no++;
    state.stats.streak = 0;
  }

  const p  = s.principle || "unknown";
  const sd = s.surface_domain || "unknown";
  if(!state.stats.byPrinciple[p]){
    state.stats.byPrinciple[p] = {
      ok:0, no:0, bySurface:{},
      confident:{ ok:0, no:0 }, unsure:{ ok:0, no:0 }
    };
  }
  const ps = state.stats.byPrinciple[p];
  if(!ps.bySurface[sd]) ps.bySurface[sd] = { ok:0, no:0 };
  if(correct){ ps.ok++; ps.bySurface[sd].ok++; }
  else       { ps.no++; ps.bySurface[sd].no++; }
  const bucket = confident ? ps.confident : ps.unsure;
  if(correct) bucket.ok++; else bucket.no++;

  if(state.session && state.session.active && typeof recordSessionResult === "function"){
    recordSessionResult(correct, confident, ms);
  }

  drawStats();
  if(typeof drawPrincipleList === "function") drawPrincipleList();
  if(typeof drawSession === "function") drawSession();
  drawCode();   /* v0.7.2-fix: segarkan panel kanan agar redaksi dilepas setelah commit */

  els.confSlot.innerHTML = "";
  reveal(s, correct);
  renderExplain(s, correct, confident, ms);

  state.pending = null;
  if(typeof updateLockState === "function") updateLockState();
}

function reveal(s, correct){
  const inp = s.input;

  if(inp.kind === "choice"){
    const box = els.inputs.querySelector(".opts");
    [...box.children].forEach((el, i) => {
      el.disabled = true;
      el.classList.remove("chosen");
      const mk = el.querySelector(".mk");
      const o = inp.options[i];
      if(o.correct){
        el.classList.add("correct");
        mk.textContent = correct ? "benar" : "jawaban";
      } else if(i === state.userAnswer){
        el.classList.add("wrong");
        mk.textContent = "salah";
      } else {
        el.classList.add("faded");
      }
    });
    return;
  }

  if(inp.kind === "keypad" || inp.kind === "palette"){
    const wrap = els.inputs.querySelector(".kp-wrap");
    if(!wrap) return;
    const disp = wrap.querySelector(".kp-display");
    const cur = disp.querySelector(".cursor");
    if(cur) cur.classList.add("hide");
    if(correct){
      disp.style.borderColor = "var(--ok)";
      disp.style.background = "var(--ok-bg)";
    } else {
      disp.style.borderColor = "var(--no)";
      disp.style.background = "var(--no-bg)";
    }
    disp.querySelector(".kp-buf").textContent = state.userAnswer || "—";
    wrap.querySelectorAll("button").forEach(b => b.disabled = true);
    return;
  }

  if(inp.kind === "fill"){
    const wrap = els.inputs.querySelector(".fill-wrap");
    if(!wrap) return;
    wrap._fields.forEach((f, i) => {
      f.disabled = true;
      f.classList.remove("active");
      f.classList.add(normEq(f.value, inp.slots[i].answer) ? "ok" : "no");
    });
    wrap.querySelectorAll("button").forEach(b => b.disabled = true);
  }
}

function renderExplain(s, correct, confident, ms){
  const inp = s.input;
  let html = '<span class="lbl">Pembahasan</span>' +
    '<p class="verdict ' + (correct ? "ok" : "no") + '">' +
    (correct ? "Tepat." : "Belum tepat.") + '</p>';

  if(inp.kind === "choice"){
    const idx = inp.options.findIndex(o => o.correct);
    html += '<p class="row"><span class="tag">Jawaban</span>' +
      escapeHtml(inp.options[idx].text) + '</p>';
  } else if(inp.kind === "keypad" || inp.kind === "palette"){
    html += '<p class="row"><span class="tag">Jawaban</span>' +
      escapeHtml(inp.canonical) + '</p>';
    if(!correct){
      html += '<p class="row"><span class="tag">Jawabanmu</span>' +
        escapeHtml(state.userAnswer || "—") + '</p>';
    }
  } else if(inp.kind === "fill"){
    let sentence = "";
    for(let i = 0; i < inp.slots.length; i++){
      const prefix = inp.parts[i] || "";
      sentence += escapeHtml(prefix) +
        '<span style="border-bottom:1px solid var(--ink);padding:0 4px">' +
        escapeHtml(inp.slots[i].answer) + '</span>';
    }
    const suffix = inp.parts[inp.slots.length] || "";
    sentence += escapeHtml(suffix);
    html += '<p class="row"><span class="tag">Jawaban</span>' + sentence + '</p>';
  }

  html += '<p class="row" style="margin-top:12px">' + escapeHtml(s.explanation) + '</p>';

  /* v0.7.1: precedence bug diperbaiki — setiap baris disusun terpisah */
  const confLabel = confident ? "yakin" : "tidak yakin";
  const confClass = confident ? "ok" : "no";
  html += '<div class="meta-line">';
  html +=   '<span class="' + confClass + '">Keyakinan: ' + confLabel + '</span>';
  html +=   '<span>Waktu: ' + fmtSec(ms) + '</span>';
  html +=   '<span>Jarak: ' + (s.surface_distance ?? "—") + '</span>';
  html += '</div>';

  if(inp.kind === "choice" && inp.options.some(o => o.why)){
    html += '<div class="whys">';
    inp.options.forEach((o, i) => {
      if(!o.why) return;
      const cls = o.correct ? "correct" : (i === state.userAnswer ? "wrong" : "");
      html += '<div class="why ' + cls + '">' +
        '<span class="k">' + "ABCDEFGH"[i] + '</span>' +
        '<div><div>' + escapeHtml(o.text) + '</div>' +
        '<div style="color:var(--muted);font-size:12px;margin-top:2px">' +
        escapeHtml(o.why) + '</div></div>' +
        '</div>';
    });
    html += '</div>';
  }

  els.explain.innerHTML = html;
  els.explain.hidden = false;
  /* v0.7.3: alur mobile tidak putus — tombol lanjut tepat di bawah pembahasan */
  els.nextInline.style.display = "";
}

function drawStats(){
  const { ok, no, streak, best } = state.stats;
  const total = ok + no;
  els.sOk.textContent = ok;
  els.sNo.textContent = no;
  els.sAcc.textContent = total ? Math.round((ok / total) * 100) + "%" : "—";
  els.sSt.textContent = String(streak).padStart(2, "0");
  els.sBest.textContent = String(best).padStart(2, "0");

  let cOk = 0, cTotal = 0, uOk = 0, uTotal = 0;
  Object.values(state.stats.byPrinciple).forEach(ps => {
    if(ps.confident){ cOk += ps.confident.ok; cTotal += ps.confident.ok + ps.confident.no; }
    if(ps.unsure)   { uOk += ps.unsure.ok;   uTotal += ps.unsure.ok + ps.unsure.no; }
  });

  const el = els.calibTotal;
  el.innerHTML = "";
  const row = (label, ok, total) => {
    const r = document.createElement("div");
    r.className = "calib-row";
    const acc = total ? Math.round((ok/total)*100) + "%" : "—";
    r.innerHTML = '<span>' + label + '</span><span class="acc">' +
      (total ? ok + "/" + total + " · " + acc : "—") + '</span>';
    el.appendChild(r);
  };
  row("Yakin", cOk, cTotal);
  row("Tidak yakin", uOk, uTotal);

  if(cTotal >= 3 && uTotal >= 3){
    const gap = Math.round(((cOk/cTotal) - (uOk/uTotal)) * 100);
    const g = document.createElement("div");
    g.className = "calib-gap" + (gap >= 20 ? " good" : (gap < 5 ? " bad" : ""));
    g.textContent = "Beda: " + (gap >= 0 ? "+" : "") + gap + "%";
    el.appendChild(g);
  }
}

function fmt(n, d){
  if(d === 0) return "—";
  const pct = Math.round((n / d) * 100);
  return n + "/" + d + " · " + pct + "%";
}

function drawBankStatus(){
  const el = els.bankStatus;
  el.innerHTML = "";
  const { validCount, invalid } = state.validation;

  if(invalid.length === 0){
    const ok = document.createElement("div");
    ok.className = "val-ok";
    ok.textContent = "Semua " + validCount + " entri valid.";
    el.appendChild(ok);
    return;
  }

  const warn = document.createElement("div");
  warn.className = "val-warn";
  warn.innerHTML = '<span class="head">' + invalid.length + " entri ditolak</span>";
  invalid.forEach(item => {
    const line = document.createElement("span");
    line.className = "item";
    line.textContent = item.id + " — " + item.errors.join("; ");
    warn.appendChild(line);
  });
  el.appendChild(warn);

  const ok = document.createElement("div");
  ok.className = "val-ok";
  ok.textContent = validCount + " entri valid.";
  el.appendChild(ok);
}

function refreshBuffer(){
  const disp = els.inputs.querySelector(".kp-display");
  if(!disp || !state.soal) return;
  const isPal = state.soal.input.kind === "palette";
  disp.querySelector(".kp-buf").textContent = isPal ? renderSymbol(state.buffer) : state.buffer;
  const cur = disp.querySelector(".cursor");
  const max = state.soal.input.maxLength || 6;
  cur.classList.toggle("hide", state.buffer.length >= max);
}

/* ============================================================
   11. Source panel (v0.7.1: redaksi)
   ============================================================ */
const REDACTED = '"…"';

function redactSoal(soal){
  /* Buat salinan soal dengan field sensitif diganti placeholder. */
  const copy = JSON.parse(JSON.stringify(soal));

  /* v0.7.2: field 'explanation' di level atas menyebut jawaban secara eksplisit
     ("...maka 70 > 42." / "...semua merpati juga hewan."). Ikut diredaksi. */
  if(copy.explanation !== undefined) copy.explanation = "…";

  if(copy.input){
    if(copy.input.kind === "choice" && Array.isArray(copy.input.options)){
      copy.input.options = copy.input.options.map(o => ({
        text: o.text,
        correct: o.correct ? "…" : "…",
        why: o.why ? "…" : null
      }));
    }
    if(copy.input.kind === "keypad" || copy.input.kind === "palette"){
      if(copy.input.canonical !== undefined) copy.input.canonical = "…";
    }
    if(copy.input.kind === "fill" && Array.isArray(copy.input.slots)){
      copy.input.slots = copy.input.slots.map(s => ({
        answer: "…",
        width: s.width
      }));
    }
  }
  copy.__redacted = true;
  return copy;
}
function redactTemplate(tpl){
  const copy = JSON.parse(JSON.stringify(tpl));

  /* v0.7.2: template memakai 'explain' (bukan 'explanation').
     Keduanya menyebut jawaban dan harus diredaksi. */
  if(copy.explain !== undefined)       copy.explain = "…";
  if(copy.explanation !== undefined)   copy.explanation = "…";

  if(copy.input){
    if(copy.input.kind === "choice" && Array.isArray(copy.input.options)){
      copy.input.options = copy.input.options.map(o => ({
        text: o.text,
        correct: o.correct ? "…" : "…",
        why: o.why ? "…" : null
      }));
    }
    if(copy.input.kind === "keypad" || copy.input.kind === "palette"){
      if(copy.input.canonical !== undefined) copy.input.canonical = "…";
    }
    if(copy.input.kind === "fill" && Array.isArray(copy.input.slots)){
      copy.input.slots = copy.input.slots.map(s => ({
        answer: "…",
        width: s.width
      }));
    }
  }
  return copy;
}

function highlight(obj){
  const raw = escapeHtml(JSON.stringify(obj, null, 2));
  return raw
    .replace(/"([^"\n]+)":/g, '<span class="k">"$1"</span>:')
    .replace(/: "([^"\n]*)"/g, ': <span class="s">"$1"</span>')
    .replace(/: (\d+)/g, ': <span class="n">$1</span>')
    .replace(/: (true|false)/g, ': <span class="b">$1</span>');
}
function drawCode(){
  const s = state.soal;
  if(!s){ els.code.textContent = ""; return; }

  /* v0.7.2: redaksi HANYA dilepas setelah commit (keyakinan dipilih).
     Sebelumnya memakai state.answered, yang sudah true di submit() —
     sehingga panel kanan menampilkan correct/canonical tepat saat bar
     keyakinan terbuka, dan kalibrasi bisa dipalsukan dengan melihat
     panel sebelum memilih yakin/tidak yakin. */
  const reveal = state.answered && !state.awaitingConfidence;

  if(state.srcTab === "soal"){
    const shown = reveal ? s : redactSoal(s);
    els.code.innerHTML = highlight(shown);
  } else {
    if(s.source === "static"){
      els.code.innerHTML = '<span class="k">// soal statis — tidak punya template</span>';
      return;
    }
    const tpl = TEMPLATES.find(t => t.id === s.template_id);
    if(!tpl){ els.code.textContent = ""; return; }
    const shown = reveal ? tpl : redactTemplate(tpl);
    els.code.innerHTML = highlight(shown);
  }

  els.redactNote.classList.toggle("hidden", reveal);
}

function initCoreEvents(){
  /* Dipanggil dari boot halaman, setelah semua skrip dimuat. */
$("srctabs").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b));
  state.srcTab = b.dataset.t;
  drawCode();
});
els.next.addEventListener("click", () => {
  if(state.awaitingConfidence) return;
  nextSoal();
});

/* v0.7.3: toggle panel mobile — pakai ulang guard tombol #next */
els.nextInline.addEventListener("click", () => els.next.click());
$("rail-toggle").addEventListener("click", () => {
  document.querySelector(".app").classList.toggle("rail-open");
});
$("src-toggle").addEventListener("click", (e) => {
  const open = document.querySelector(".src").classList.toggle("src-open");
  e.currentTarget.textContent = open ? "Sembunyikan JSON" : "Tampilkan JSON";
});
document.addEventListener("keydown", e => {
  if(!state.soal) return;
  const inField = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";

  /* menunggu pilihan keyakinan — v0.7.1: hanya Y/T, tidak lagi 1/2 */
  if(state.awaitingConfidence){
    if(e.key === "y" || e.key === "Y"){ e.preventDefault(); commit(true); return; }
    if(e.key === "t" || e.key === "T"){ e.preventDefault(); commit(false); return; }
    return;
  }

  if(e.key === "Enter"){
    if(state.answered){ e.preventDefault(); nextSoal(); return; }
    if(!inField && (state.soal.input.kind === "keypad" || state.soal.input.kind === "palette")){
      e.preventDefault();
      state.userAnswer = state.buffer;
      submit();
      return;
    }
    return;
  }
  if(state.answered || inField) return;

  const kind = state.soal.input.kind;

  if(kind === "choice" && /^[1-9]$/.test(e.key)){
    const i = Number(e.key) - 1;
    if(state.soal.input.options[i]){
      state.userAnswer = i;
      const box = els.inputs.querySelector(".opts");
      if(box) [...box.children].forEach((el, j) => el.classList.toggle("chosen", j === i));
      submit();
    }
    return;
  }

  if(kind === "keypad" || kind === "palette"){
    if(e.key === "Backspace"){
      e.preventDefault();
      state.buffer = state.buffer.slice(0, -1);
      refreshBuffer();
      return;
    }
    if(e.key === "Escape"){
      state.buffer = "";
      refreshBuffer();
      return;
    }
    if(e.key.length === 1 && state.buffer.length < (state.soal.input.maxLength || 6)){
      if(kind === "keypad"){
        if(!/^\d$/.test(e.key)) return;
        state.buffer += e.key;
      } else {
        const hit = state.soal.input.keys.find(k =>
          k.length === 1 && k.toLowerCase() === e.key.toLowerCase()
        );
        if(!hit) return;
        state.buffer += hit;
      }
      refreshBuffer();
    }
  }
});
}

