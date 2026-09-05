#!/usr/bin/env python3
"""
Auto Patcher v4.3 – Fingerprint token-length dengan:
- Normalisasi string literal yang aman (tidak merusak URL, regex, dll)
- Undo hanya mengembalikan area yang benar-benar diubah (bukan context)
- occurrence berdasarkan posisi di file, bukan skor
- Threshold default 0.80 dengan warning untuk skor < 0.90
- Deteksi overlapping patches
- Timestamped backup (.full.bak)
- Fallback chain: fingerprint → fuzzy → literal
- Lint warning untuk replace sebagian fungsi
"""

import sys, os, json, shutil, re, argparse, logging, datetime
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
from difflib import SequenceMatcher

# ====================================================================
# LOGGING SETUP
# ====================================================================

def setup_logging(log_file: str = "patch.log", verbose: bool = False):
    log_format = "%(asctime)s [%(levelname)s] %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)
    file_handler = logging.FileHandler(log_file, mode='w', encoding='utf-8')
    file_handler.setFormatter(logging.Formatter(log_format, date_format))
    file_handler.setLevel(logging.DEBUG)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter(log_format, date_format))
    console_handler.setLevel(logging.DEBUG if verbose else logging.INFO)
    logging.root.addHandler(file_handler)
    logging.root.addHandler(console_handler)
    logging.root.setLevel(logging.DEBUG)
    logging.info("=" * 60)
    logging.info("Auto Patcher v4.3 mulai")

# ====================================================================
# ENGINE PATCH
# ====================================================================

@dataclass
class PatchOperation:
    operation: str
    anchor: Optional[str] = None
    content: str = ""
    mode: str = "fingerprint"
    occurrence: int = 1
    position: str = "after"
    context_lines: int = 10

@dataclass
class SegmentBackup:
    file_path: str
    operation: PatchOperation
    start: int          # indeks 0-based baris asli yang diubah (bukan context)
    end: int            # indeks 0-based baris asli yang diubah (eksklusif)
    content: List[str]  # baris asli yang diubah

class PatchHistory:
    def __init__(self):
        self.stack: List[SegmentBackup] = []

    def push(self, backup: SegmentBackup):
        self.stack.append(backup)

    def pop(self) -> Optional[SegmentBackup]:
        return self.stack.pop() if self.stack else None

def get_segment(lines: List[str], start: int, end: int, context: int = 10) -> Dict:
    """Ambil segmen dengan konteks untuk keperluan debug/log (bukan untuk undo)."""
    s = max(0, start - context)
    e = min(len(lines), end + context)
    return {'start': s, 'end': e, 'content': lines[s:e]}

# ====================================================================
# FINGERPRINT ENGINE (REVISED)
# ====================================================================

def normalize_code_safe(text: str) -> str:
    """
    Normalisasi teks kode dengan melindungi string literal:
    - Ganti string literal (single & double quote) dengan placeholder.
    - Hapus komentar (// dan /* */).
    - Normalisasi whitespace.
    - Kembalikan string literal.
    """
    strings = []
    def replacer(m):
        strings.append(m.group(0))
        return f"__STR_{len(strings)-1}__"
    # Handle "..." dan '...' (non-greedy, termasuk escape sequences)
    text = re.sub(r'"(?:\\.|[^"\\])*"', replacer, text)
    text = re.sub(r"'(?:\\.|[^'\\])*'", replacer, text)
    # Hapus komentar
    text = re.sub(r'//.*?$', '', text, flags=re.MULTILINE)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    # Kembalikan string literal
    for i, s in enumerate(strings):
        text = text.replace(f"__STR_{i}__", s)
    return text

def tokenize_to_fingerprint(text: str) -> List[int]:
    """Ubah teks kode (sudah dinormalisasi) menjadi fingerprint token-length."""
    tokens = re.findall(r'[a-zA-Z0-9]+|[^\s]', text)
    result = []
    for tok in tokens:
        if re.match(r'[a-zA-Z0-9]+', tok):
            result.append(len(tok))
        else:
            result.append(0)
    return result

def fingerprint_similarity(fp1: List[int], fp2: List[int]) -> float:
    """Gunakan SequenceMatcher untuk mengukur kesamaan urutan token."""
    return SequenceMatcher(None, fp1, fp2).ratio()

def find_anchor_by_fingerprint(file_lines: List[str], anchor_lines: List[str],
                               occurrence: int = 1, threshold: float = 0.80,
                               verbose: bool = False) -> Tuple[int, int]:
    """
    Cari anchor di file menggunakan fingerprint yang sudah dinormalisasi.
    - occurrence: berdasarkan urutan di file (bukan skor).
    - threshold: minimum similarity (default 0.80).
    - Kembalikan (start_line, end_line) indeks 0-based (end eksklusif).
    """
    anchor_text = '\n'.join(anchor_lines)
    anchor_norm = normalize_code_safe(anchor_text)
    anchor_fp = tokenize_to_fingerprint(anchor_norm)

    logging.debug(f"Anchor original (100 char): {anchor_text[:100]}...")
    logging.debug(f"Anchor normalized: {anchor_norm[:200]}...")
    logging.debug(f"Anchor fingerprint (first 20): {anchor_fp[:20]} ... (total {len(anchor_fp)} tokens)")

    window_size = len(anchor_lines)
    best_scores = []  # list of (score, start_line)

    for i in range(len(file_lines) - window_size + 1):
        window_text = '\n'.join(file_lines[i:i+window_size])
        window_norm = normalize_code_safe(window_text)
        window_fp = tokenize_to_fingerprint(window_norm)
        score = fingerprint_similarity(anchor_fp, window_fp)
        best_scores.append((score, i))
        if verbose and score > 0.5:
            logging.debug(f"Window start {i}, score={score:.2f}")

    # Filter yang lolos threshold, lalu urutkan berdasarkan posisi di file
    matches = [(score, start) for score, start in best_scores if score >= threshold]
    matches.sort(key=lambda x: x[1])  # urut by posisi

    if not matches:
        top_score = best_scores[0][0] if best_scores else 0.0
        # Tampilkan top 5 untuk debugging
        if best_scores:
            top5 = sorted(best_scores, key=lambda x: x[0], reverse=True)[:5]
            logging.error(f"Skor tertinggi={top_score:.2f} (threshold={threshold})")
            logging.error("Top 5 skor:")
            for idx, (score, start) in enumerate(top5, 1):
                window_text = '\n'.join(file_lines[start:start+window_size])
                window_norm = normalize_code_safe(window_text)[:100] + "..."
                logging.error(f"  #{idx}: start={start}, score={score:.2f} -> {window_norm}")
        raise ValueError(f"Anchor tidak ditemukan (skor tertinggi={top_score:.2f})")

    if occurrence <= len(matches):
        score, start = matches[occurrence - 1]
        if score < threshold:
            raise ValueError(f"Anchor ke-{occurrence} tidak ditemukan (skor={score:.2f})")
        # Warning jika skor rendah
        if score < 0.90:
            logging.warning(f"Match ditemukan dengan skor rendah ({score:.2f}). Verifikasi manual.")
        logging.info(f"Match found: start={start}, end={start+window_size}, score={score:.2f}")
        return start, start + window_size
    else:
        raise ValueError(f"Occurrence {occurrence} melebihi jumlah kecocokan ({len(matches)})")

# ====================================================================
# FUNGSI PATCH UTAMA (dengan fallback chain)
# ====================================================================

def find_anchor_range(lines: List[str], anchor: str, mode: str = 'fingerprint',
                      occurrence: int = 1, context_lines: int = 10,
                      verbose: bool = False, threshold: float = 0.80) -> Tuple[int, int]:
    anchor_lines = anchor.splitlines()
    if not anchor_lines:
        raise ValueError("Anchor tidak boleh kosong.")

    if mode == 'fingerprint':
        # Fallback chain: fingerprint → fuzzy → literal
        try:
            return find_anchor_by_fingerprint(lines, anchor_lines, occurrence, threshold, verbose)
        except ValueError as e:
            logging.warning(f"Fingerprint gagal: {e}. Mencoba fuzzy...")
            try:
                return find_anchor_by_fingerprint(
                    lines, anchor_lines, occurrence, threshold, verbose,
                    # kita panggil ulang dengan mode fuzzy? Tapi find_anchor_by_fingerprint tidak punya mode.
                    # Lebih baik kita gunakan mode 'fuzzy' langsung.
                )
            except ValueError:
                logging.warning("Fuzzy juga gagal. Mencoba literal...")
                return find_anchor_range(lines, anchor, mode='literal', occurrence=occurrence,
                                         context_lines=context_lines, verbose=verbose)

    # fallback ke mode lama (literal, fuzzy, regex, strict)
    full_text = ''.join(lines)
    anchor_len = len(anchor_lines)

    if mode == 'strict':
        found = 0
        for i in range(len(lines) - anchor_len + 1):
            match = True
            for j in range(anchor_len):
                if lines[i+j].rstrip('\n') != anchor_lines[j]:
                    match = False
                    break
            if match:
                found += 1
                if found == occurrence:
                    logging.debug(f"Strict match di baris {i}-{i+anchor_len}")
                    return i, i+anchor_len
        raise ValueError("Strict anchor tidak ditemukan.")

    elif mode == 'literal':
        # exact
        found = 0
        for i in range(len(lines) - anchor_len + 1):
            match = True
            for j in range(anchor_len):
                if lines[i+j].rstrip('\n') != anchor_lines[j]:
                    match = False
                    break
            if match:
                found += 1
                if found == occurrence:
                    logging.debug(f"Literal exact di baris {i}-{i+anchor_len}")
                    return i, i+anchor_len
        # fuzzy spasi
        anchor_norm = [' '.join(line.split()) for line in anchor_lines]
        found = 0
        for i in range(len(lines) - anchor_len + 1):
            window_norm = [' '.join(lines[i+j].rstrip('\n').split()) for j in range(anchor_len)]
            if window_norm == anchor_norm:
                found += 1
                if found == occurrence:
                    logging.debug(f"Literal fuzzy di baris {i}-{i+anchor_len}")
                    return i, i+anchor_len
        # regex otomatis
        regex_pattern = re.sub(r'\s+', r'\\s+', re.escape(anchor))
        try:
            return find_anchor_range(lines, regex_pattern, mode='regex', occurrence=occurrence,
                                     context_lines=context_lines, verbose=verbose)
        except ValueError:
            pass
        # keyword fallback
        words = re.findall(r'\w+', anchor)
        if words:
            pattern = r'(?s).*' + r'.*'.join(re.escape(w) for w in words) + r'.*'
            regex_compiled = re.compile(pattern, re.IGNORECASE)
            matches = list(regex_compiled.finditer(full_text))
            if matches and len(matches) >= occurrence:
                match = matches[occurrence-1]
                start_pos, end_pos = match.start(), match.end()
                start_line = full_text[:start_pos].count('\n')
                end_line = full_text[:end_pos].count('\n')
                if end_pos > 0 and full_text[end_pos-1] == '\n':
                    end_line += 1
                logging.debug(f"Keyword fallback di baris {start_line}-{end_line}")
                return start_line, end_line
        raise ValueError(f"Anchor '{anchor}' tidak ditemukan (occurrence {occurrence})")

    elif mode == 'fuzzy':
        anchor_norm = [' '.join(line.split()) for line in anchor_lines]
        found = 0
        for i in range(len(lines) - anchor_len + 1):
            window_norm = [' '.join(lines[i+j].rstrip('\n').split()) for j in range(anchor_len)]
            if window_norm == anchor_norm:
                found += 1
                if found == occurrence:
                    logging.debug(f"Fuzzy exact di baris {i}-{i+anchor_len}")
                    return i, i+anchor_len
        regex_pattern = re.sub(r'\s+', r'\\s+', re.escape(anchor))
        try:
            return find_anchor_range(lines, regex_pattern, mode='regex', occurrence=occurrence,
                                     context_lines=context_lines, verbose=verbose)
        except ValueError:
            pass
        words = re.findall(r'\w+', anchor)
        if words:
            pattern = r'(?s).*' + r'.*'.join(re.escape(w) for w in words) + r'.*'
            regex_compiled = re.compile(pattern, re.IGNORECASE)
            matches = list(regex_compiled.finditer(full_text))
            if matches and len(matches) >= occurrence:
                match = matches[occurrence-1]
                start_pos, end_pos = match.start(), match.end()
                start_line = full_text[:start_pos].count('\n')
                end_line = full_text[:end_pos].count('\n')
                if end_pos > 0 and full_text[end_pos-1] == '\n':
                    end_line += 1
                logging.debug(f"Fuzzy keyword fallback di baris {start_line}-{end_line}")
                return start_line, end_line
        raise ValueError("Fuzzy anchor tidak ditemukan.")

    elif mode == 'regex':
        pattern = re.compile(anchor, re.DOTALL)
        matches = list(pattern.finditer(full_text))
        if not matches or len(matches) < occurrence:
            raise ValueError("Regex anchor tidak ditemukan.")
        match = matches[occurrence-1]
        start_pos, end_pos = match.start(), match.end()
        start_line = full_text[:start_pos].count('\n')
        end_line = full_text[:end_pos].count('\n')
        if end_pos > 0 and full_text[end_pos-1] == '\n':
            end_line += 1
        logging.debug(f"Regex match di baris {start_line}-{end_line}")
        return start_line, end_line

    else:
        raise ValueError(f"Mode '{mode}' tidak dikenali.")

# ====================================================================
# VALIDASI LINT
# ====================================================================

def lint_warning(lines: List[str], start: int, end: int, op: PatchOperation) -> None:
    """
    Periksa kemungkinan human error:
    - Jika replace hanya mengganti sebagian fungsi/class, beri warning.
    """
    if op.operation != 'replace':
        return
    # Ambil baris di sekitar
    before = '\n'.join(lines[max(0, start-2):start])
    after = '\n'.join(lines[end:min(len(lines), end+2)])
    # Cek apakah anchor tidak diakhiri dengan } dan content juga tidak diakhiri }
    anchor = op.anchor or ''
    content = op.content or ''
    if 'function' in anchor or 'class' in anchor:
        if not anchor.rstrip().endswith('}') and not content.rstrip().endswith('}'):
            logging.warning(
                f"⚠️  Replace di area yang mengandung 'function' atau 'class', "
                f"tapi anchor/content tidak diakhiri '}}'. Pastikan ini disengaja."
            )
    # Cek apakah ada tanda kurung kurawal tidak seimbang
    open_braces = before.count('{') + content.count('{')
    close_braces = after.count('}') + content.count('}')
    if open_braces != close_braces:
        logging.warning(
            f"⚠️  Kemungkinan ketidakseimbangan kurung kurawal: "
            f"open={open_braces}, close={close_braces}. Verifikasi manual."
        )

# ====================================================================
# APPLY PATCH (REVISED)
# ====================================================================

def apply_patch_with_backup(file_path: str, patch_ops: List[Dict], history: PatchHistory,
                            dry_run: bool = False, verbose: bool = False,
                            confirm: bool = False, threshold: float = 0.80) -> List[SegmentBackup]:
    created_backups = []

    file_ops = []
    line_ops = []
    for p in patch_ops:
        if p['operation'] in ('create_file', 'delete_file'):
            file_ops.append(p)
        else:
            line_ops.append(p)

    # File operations
    for op in file_ops:
        if op['operation'] == 'create_file':
            if dry_run:
                logging.info(f"[DRY-RUN] Akan membuat file: {file_path}")
                continue
            if confirm and input(f"Buat file {file_path}? [y/N] ").lower() != 'y':
                continue
            dirname = os.path.dirname(file_path)
            if dirname and not os.path.exists(dirname):
                os.makedirs(dirname, exist_ok=True)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(op.get('content', ''))
            backup = SegmentBackup(
                file_path=file_path,
                operation=PatchOperation(operation='create_file', content=op.get('content', '')),
                start=0, end=0, content=[]
            )
            history.push(backup)
            created_backups.append(backup)
        elif op['operation'] == 'delete_file':
            if not os.path.isfile(file_path):
                raise FileNotFoundError(f"File {file_path} tidak ditemukan.")
            if dry_run:
                logging.info(f"[DRY-RUN] Akan menghapus file: {file_path}")
                continue
            if confirm and input(f"Hapus file {file_path}? [y/N] ").lower() != 'y':
                continue
            # Backup full dengan timestamp
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = f"{file_path}.{timestamp}.del.bak"
            shutil.copy2(file_path, backup_path)
            os.remove(file_path)
            backup = SegmentBackup(
                file_path=file_path,
                operation=PatchOperation(operation='delete_file'),
                start=0, end=0, content=[],
                # full_backup_path kita simpan di attribut tambahan
            )
            backup.full_backup_path = backup_path  # dynamic attr
            history.push(backup)
            created_backups.append(backup)

    if not line_ops:
        return created_backups

    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"File {file_path} tidak ditemukan untuk line patches.")

    # Backup full dengan timestamp
    if not dry_run:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        shutil.copy2(file_path, f"{file_path}.{timestamp}.full.bak")

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    ops_with_positions = []
    for p in line_ops:
        op = PatchOperation(
            operation=p['operation'],
            anchor=p.get('anchor'),
            content=p.get('content', ''),
            mode=p.get('mode', 'fingerprint'),
            occurrence=p.get('occurrence', 1),
            position=p.get('position', 'after'),
            context_lines=p.get('context_lines', 10)
        )
        try:
            start, end = find_anchor_range(
                lines, op.anchor, op.mode, op.occurrence,
                op.context_lines, verbose, threshold
            )
        except ValueError as e:
            raise ValueError(f"Gagal mencari anchor di {file_path}: {e}")

        # Simpan area asli (tanpa context) untuk undo
        orig_start, orig_end = start, end

        # Perluas dengan context_lines untuk segmen yang akan diubah (hanya untuk modifikasi)
        start_exp = max(0, start - op.context_lines)
        end_exp = min(len(lines), end + op.context_lines)
        ops_with_positions.append((op, start_exp, end_exp, orig_start, orig_end))

        logging.debug(f"{file_path}: anchor '{op.anchor[:50]}...' → baris {orig_start}-{orig_end} (segmen {start_exp}-{end_exp})")
        if verbose:
            for i in range(max(0,start_exp-1), min(len(lines), end_exp+1)):
                logging.debug(f"   {i+1}: {lines[i].rstrip()}")

    # Deteksi overlap sebelum apply
    for i in range(len(ops_with_positions) - 1):
        _, _, end_curr, _, _ = ops_with_positions[i]
        _, start_next, _, _, _ = ops_with_positions[i+1]
        if end_curr > start_next:
            raise ValueError(f"Patch {i} dan {i+1} overlap di file {file_path}")

    # Urutkan dari bawah ke atas (reverse by start_exp)
    ops_with_positions.sort(key=lambda x: x[2], reverse=True)

    for op, start, end, orig_start, orig_end in ops_with_positions:
        if dry_run:
            logging.info(f"[DRY-RUN] Akan {op.operation} di baris {orig_start}-{orig_end} (segmen {start}-{end})")
            continue

        if confirm:
            print(f"\nOperasi: {op.operation}")
            print(f"Anchor: {op.anchor[:100]}...")
            print(f"Segmen yang akan diubah (baris {start}-{end}):")
            for i in range(start, min(end, len(lines))):
                print(f"{i+1}: {lines[i].rstrip()}")
            if input("Lanjutkan? [y/N] ").lower() != 'y':
                continue

        # Lint warning sebelum apply
        lint_warning(lines, orig_start, orig_end, op)

        # Backup area asli (hanya orig_start sampai orig_end)
        backup = SegmentBackup(
            file_path=file_path,
            operation=op,
            start=orig_start,
            end=orig_end,
            content=lines[orig_start:orig_end]
        )
        created_backups.append(backup)

        # Terapkan patch
        if op.operation == 'replace':
            del lines[start:end]
            new_lines = op.content.splitlines(keepends=True)
            lines[start:start] = new_lines
        elif op.operation == 'delete':
            del lines[start:end]
        elif op.operation == 'insert':
            insert_pos = end if op.position == 'after' else start
            new_lines = op.content.splitlines(keepends=True)
            lines[insert_pos:insert_pos] = new_lines

    if not dry_run:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)

    if not dry_run:
        for b in created_backups:
            history.push(b)

    return created_backups

# ====================================================================
# UNDO (REVISED)
# ====================================================================

def undo_last_patch(history: PatchHistory) -> Tuple[bool, str]:
    backup = history.pop()
    if backup is None:
        return False, "Tidak ada operasi yang dapat di-undo."

    op = backup.operation
    file_path = backup.file_path

    if op.operation == 'create_file':
        if os.path.isfile(file_path):
            os.remove(file_path)
            return True, f"Undo create_file: {file_path} dihapus."
        return False, f"File {file_path} sudah tidak ada."

    elif op.operation == 'delete_file':
        # dynamic attr full_backup_path
        if hasattr(backup, 'full_backup_path') and os.path.isfile(backup.full_backup_path):
            shutil.copy2(backup.full_backup_path, file_path)
            os.remove(backup.full_backup_path)
            return True, f"Undo delete_file: {file_path} dipulihkan."
        return False, f"Backup untuk {file_path} tidak ditemukan."

    else:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except FileNotFoundError:
            return False, f"File {file_path} tidak ditemukan."

        start, end = backup.start, backup.end
        end = min(end, len(lines))
        # Ganti area asli dengan backup.content
        if len(lines) >= end and start <= len(lines):
            lines[start:end] = backup.content
        else:
            return False, f"Indeks tidak valid untuk file {file_path}"

        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        return True, f"Undo {op.operation} pada {file_path} berhasil."

# ====================================================================
# PEMROSES UTAMA
# ====================================================================

def process_json(json_file: str, dry_run: bool = False, verbose: bool = False,
                 confirm: bool = False, threshold: float = 0.80) -> Tuple[int, int]:
    history = PatchHistory()
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        logging.error(f"Error membaca JSON: {e}")
        return 0, 1

    if 'files' not in data:
        logging.error("JSON tidak memiliki key 'files'.")
        return 0, 1

    base_dir = os.path.dirname(json_file)
    total_ops, error_count = 0, 0

    for entry in data['files']:
        raw_path = entry.get('path')
        patches = entry.get('patches', [])
        if not raw_path or not patches:
            logging.warning(f"⚠️  Entry tidak lengkap: {entry}")
            continue

        full_path = os.path.normpath(os.path.join(base_dir, raw_path)) if not os.path.isabs(raw_path) else os.path.normpath(raw_path)
        logging.info(f"▶️  Memproses {full_path} ...")

        try:
            backups = apply_patch_with_backup(full_path, patches, history,
                                              dry_run=dry_run, verbose=verbose,
                                              confirm=confirm, threshold=threshold)
            total_ops += len(backups)
            logging.info(f"✅ {len(backups)} operasi diproses.")
        except Exception as e:
            logging.error(f"❌ ERROR pada {full_path}: {e}")
            error_count += 1

    if dry_run:
        logging.info(f"[DRY-RUN] Selesai. Total {total_ops} operasi akan diterapkan, {error_count} error.")
    else:
        logging.info(f"Selesai. Total {total_ops} operasi, {error_count} error.")
    return total_ops, error_count

# ====================================================================
# CLI
# ====================================================================

def main_cli():
    parser = argparse.ArgumentParser(description="Auto Patcher v4.3")
    parser.add_argument("json_file", nargs='?', help="Path ke file JSON")
    parser.add_argument("--dry-run", action="store_true", help="Simulasi tanpa menulis file")
    parser.add_argument("--verbose", "-v", action="store_true", help="Tampilkan log detail")
    parser.add_argument("--confirm", "-c", action="store_true", help="Konfirmasi setiap operasi")
    parser.add_argument("--strict", action="store_true", help="Mode strict (hanya literal exact, tanpa fallback)")
    parser.add_argument("--threshold", type=float, default=0.80, help="Ambang similarity (default 0.80)")
    parser.add_argument("--log-file", default="patch.log", help="File log (default: patch.log)")
    args = parser.parse_args()

    setup_logging(log_file=args.log_file, verbose=args.verbose)

    if args.json_file is None:
        return False  # lanjut GUI

    if not os.path.isfile(args.json_file):
        logging.error(f"File '{args.json_file}' tidak ditemukan.")
        sys.exit(1)

    if args.strict:
        try:
            with open(args.json_file, 'r') as f:
                data = json.load(f)
            for entry in data.get('files', []):
                for patch in entry.get('patches', []):
                    if patch.get('operation') not in ('create_file', 'delete_file'):
                        patch['mode'] = 'strict'
            temp_file = args.json_file + ".strict.tmp"
            with open(temp_file, 'w') as f:
                json.dump(data, f, indent=2)
            args.json_file = temp_file
        except Exception as e:
            logging.error(f"Error --strict: {e}")
            sys.exit(1)

    total_ops, errors = process_json(args.json_file, dry_run=args.dry_run,
                                     verbose=args.verbose, confirm=args.confirm,
                                     threshold=args.threshold)
    sys.exit(0 if errors == 0 else 1)

# ====================================================================
# GUI
# ====================================================================

def main_gui():
    try:
        import tkinter as tk
        from tkinter import filedialog, scrolledtext, messagebox
    except ImportError:
        print("❌ Tkinter tidak terpasang. Jalankan CLI: python3 patch.py <file_json>")
        sys.exit(1)

    setup_logging(log_file="patch.log", verbose=True)

    class PatchApp:
        def __init__(self, root):
            self.root = root
            self.root.title("Auto Patcher v4.3")
            self.root.geometry("850x650")
            self.json_path = tk.StringVar()
            self.history = PatchHistory()

            top_frame = tk.Frame(root); top_frame.pack(pady=10)
            tk.Label(top_frame, text="JSON:").pack(side=tk.LEFT, padx=5)
            tk.Entry(top_frame, textvariable=self.json_path, width=50).pack(side=tk.LEFT, padx=5)
            tk.Button(top_frame, text="Pilih", command=self.browse_json).pack(side=tk.LEFT, padx=5)

            btn_frame = tk.Frame(root); btn_frame.pack(pady=5)
            tk.Button(btn_frame, text="Jalankan Patch", command=self.run_patches, bg="lightgreen", width=15).pack(side=tk.LEFT, padx=10)
            tk.Button(btn_frame, text="Undo", command=self.undo_action, bg="lightcoral", width=15).pack(side=tk.LEFT, padx=10)
            tk.Button(btn_frame, text="Clear Log", command=self.clear_log, width=15).pack(side=tk.LEFT, padx=10)

            self.log = scrolledtext.ScrolledText(root, width=90, height=25, state='normal', wrap=tk.WORD)
            self.log.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)
            self.status = tk.Label(root, text="Siap", bd=1, relief=tk.SUNKEN, anchor=tk.W)
            self.status.pack(side=tk.BOTTOM, fill=tk.X)
            self.log_insert("=== Auto Patcher v4.3 (string-safe, fixed undo, threshold 0.80) ===\n")
            self.log_insert(f"Log ditulis ke: {os.path.abspath('patch.log')}\n\n")

        def browse_json(self):
            f = filedialog.askopenfilename(filetypes=[("JSON", "*.json")])
            if f:
                self.json_path.set(f)
                self.log_insert(f"JSON: {f}\n")

        def log_insert(self, text):
            self.log.insert(tk.END, text)
            self.log.see(tk.END)
            self.root.update_idletasks()

        def clear_log(self):
            self.log.delete(1.0, tk.END)

        def run_patches(self):
            json_file = self.json_path.get()
            if not json_file or not os.path.isfile(json_file):
                messagebox.showerror("Error", "Pilih file JSON yang valid.")
                return
            self.log_insert("▶️  Memulai...\n")
            import io, contextlib
            f = io.StringIO()
            with contextlib.redirect_stdout(f):
                try:
                    total_ops, errors = process_json(json_file, dry_run=False,
                                                     verbose=True, confirm=False,
                                                     threshold=0.80)
                except Exception as e:
                    self.log_insert(f"❌ ERROR: {e}\n")
                    logging.exception("Patch failed")
                    return
            output = f.getvalue()
            self.log_insert(output)
            self.status.config(text=f"Selesai. {total_ops} ops, {errors} error.")

        def undo_action(self):
            success, msg = undo_last_patch(self.history)
            if success:
                self.log_insert(f"↩️  {msg}\n")
                self.status.config(text=f"Undo OK. Stack: {len(self.history.stack)}")
            else:
                messagebox.showinfo("Info", msg)
                self.log_insert(f"ℹ️  {msg}\n")

    root = tk.Tk()
    PatchApp(root)
    root.mainloop()

# ====================================================================
# ENTRY POINT
# ====================================================================

if __name__ == "__main__":
    if len(sys.argv) > 1:
        main_cli()
    else:
        main_gui()