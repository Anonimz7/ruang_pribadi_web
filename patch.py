#!/usr/bin/env python3
"""
Auto Patcher v2.0 - CLI & GUI
Gunakan: python3 patch.py <file_json>   (mode CLI)
         python3 patch.py               (mode GUI)
"""

import sys
import os
import json
import shutil
import argparse
from dataclasses import dataclass
from typing import List, Dict, Optional

# ====================================================================
# ENGINE PATCH (sama seperti sebelumnya)
# ====================================================================

@dataclass
class PatchOperation:
    operation: str
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    line: Optional[int] = None
    content: str = ""

@dataclass
class SegmentBackup:
    file_path: str
    operation: PatchOperation
    start: Optional[int] = None
    end: Optional[int] = None
    content: Optional[List[str]] = None
    full_backup_path: Optional[str] = None

class PatchHistory:
    def __init__(self):
        self.stack: List[SegmentBackup] = []

    def push(self, backup: SegmentBackup):
        self.stack.append(backup)

    def pop(self) -> Optional[SegmentBackup]:
        return self.stack.pop() if self.stack else None

def get_segment(lines: List[str], center_start: int, center_end: int, context: int = 100) -> Dict:
    start = max(0, center_start - context)
    end = min(len(lines), center_end + context)
    return {'start': start, 'end': end, 'content': lines[start:end]}

def apply_patch_with_backup(file_path: str, patch_ops: List[Dict], history: PatchHistory, dry_run: bool = False) -> List[SegmentBackup]:
    created_backups = []
    file_ops = []
    line_ops = []
    for p in patch_ops:
        if p['operation'] in ('create_file', 'delete_file'):
            file_ops.append(p)
        else:
            line_ops.append(p)

    # Operasi file
    for op in file_ops:
        if op['operation'] == 'create_file':
            if dry_run:
                print(f"[DRY-RUN] Akan membuat file: {file_path}")
                continue
            dirname = os.path.dirname(file_path)
            if dirname and not os.path.exists(dirname):
                os.makedirs(dirname, exist_ok=True)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(op.get('content', ''))
            backup = SegmentBackup(
                file_path=file_path,
                operation=PatchOperation(operation='create_file', content=op.get('content', ''))
            )
            history.push(backup)
            created_backups.append(backup)
        elif op['operation'] == 'delete_file':
            if not os.path.isfile(file_path):
                raise FileNotFoundError(f"File {file_path} tidak ditemukan untuk dihapus.")
            if dry_run:
                print(f"[DRY-RUN] Akan menghapus file: {file_path}")
                continue
            backup_path = file_path + ".del.bak"
            shutil.copy2(file_path, backup_path)
            os.remove(file_path)
            backup = SegmentBackup(
                file_path=file_path,
                operation=PatchOperation(operation='delete_file'),
                full_backup_path=backup_path
            )
            history.push(backup)
            created_backups.append(backup)

    # Operasi baris (hanya jika file masih ada)
    if line_ops:
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"File {file_path} tidak ada, tidak bisa menerapkan line patches.")
        if not dry_run:
            shutil.copy2(file_path, file_path + ".full.bak")
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        ops = []
        for p in line_ops:
            ops.append(PatchOperation(
                operation=p['operation'],
                line_start=p.get('line_start'),
                line_end=p.get('line_end'),
                line=p.get('line'),
                content=p.get('content', '')
            ))

        def get_sort_key(op: PatchOperation) -> int:
            return op.line_start or op.line or 0

        ops_sorted = sorted(ops, key=get_sort_key, reverse=True)

        for op in ops_sorted:
            if op.operation == 'replace':
                start = op.line_start - 1
                end = op.line_end
            elif op.operation == 'delete':
                start = op.line_start - 1
                end = op.line_end
            elif op.operation == 'insert':
                pos = op.line - 1
                start = pos
                end = pos

            seg = get_segment(lines, start, end, context=100)
            backup = SegmentBackup(
                file_path=file_path,
                operation=op,
                start=seg['start'],
                end=seg['end'],
                content=seg['content']
            )
            created_backups.append(backup)

            if not dry_run:
                if op.operation == 'replace':
                    del lines[start:end]
                    new_lines = op.content.splitlines(keepends=True)
                    lines[start:start] = new_lines
                elif op.operation == 'delete':
                    del lines[start:end]
                elif op.operation == 'insert':
                    new_lines = op.content.splitlines(keepends=True)
                    lines[pos:pos] = new_lines

        if not dry_run:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)

    # Simpan history (hanya jika bukan dry-run)
    if not dry_run:
        for b in created_backups:
            history.push(b)

    return created_backups

def undo_last_patch(history: PatchHistory) -> (bool, str):
    backup = history.pop()
    if backup is None:
        return False, "Tidak ada operasi yang dapat di-undo."

    op = backup.operation
    file_path = backup.file_path

    if op.operation == 'create_file':
        if os.path.isfile(file_path):
            os.remove(file_path)
            return True, f"Undo create_file: {file_path} dihapus."
        else:
            return False, f"File {file_path} sudah tidak ada."

    elif op.operation == 'delete_file':
        if backup.full_backup_path and os.path.isfile(backup.full_backup_path):
            shutil.copy2(backup.full_backup_path, file_path)
            os.remove(backup.full_backup_path)
            return True, f"Undo delete_file: {file_path} dipulihkan."
        else:
            return False, f"Backup untuk {file_path} tidak ditemukan."

    else:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except FileNotFoundError:
            return False, f"File {file_path} tidak ditemukan."

        start = backup.start
        end = backup.end
        end = min(end, len(lines))
        del lines[start:end]
        lines[start:start] = backup.content

        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)

        return True, f"Undo {op.operation} pada {file_path} berhasil."

# ====================================================================
# FUNGSI PEMROSES UTAMA (digunakan oleh CLI dan GUI)
# ====================================================================

def process_json(json_file: str, dry_run: bool = False, verbose: bool = False) -> (int, int):
    """
    Membaca JSON dan menerapkan semua patch.
    Mengembalikan (total_operations, error_count).
    """
    history = PatchHistory()
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error membaca JSON: {e}")
        return 0, 1

    if 'files' not in data:
        print("JSON tidak memiliki key 'files'.")
        return 0, 1

    base_dir = os.path.dirname(json_file)
    total_ops = 0
    error_count = 0

    for entry in data['files']:
        raw_path = entry.get('path')
        patches = entry.get('patches', [])
        if not raw_path or not patches:
            print(f"⚠️  Entry tidak lengkap: {entry}")
            continue

        # Resolve path
        if os.path.isabs(raw_path):
            full_path = os.path.normpath(raw_path)
        else:
            full_path = os.path.normpath(os.path.join(base_dir, raw_path))

        if verbose:
            print(f"▶️  Memproses {full_path} ...")

        try:
            backups = apply_patch_with_backup(full_path, patches, history, dry_run=dry_run)
            total_ops += len(backups)
            if verbose:
                print(f"✅ {len(backups)} operasi diproses.")
        except Exception as e:
            print(f"❌ ERROR pada {full_path}: {e}")
            error_count += 1

    if dry_run:
        print(f"[DRY-RUN] Selesai. Total {total_ops} operasi akan diterapkan.")
    else:
        print(f"✨ Selesai. Total {total_ops} operasi patch diterapkan. {error_count} error.")
    return total_ops, error_count

# ====================================================================
# CLI ENTRY POINT
# ====================================================================

def main_cli():
    parser = argparse.ArgumentParser(
        description="Auto Patcher - Terapkan patch kode dari file JSON",
        epilog="Tanpa argumen, jalankan GUI."
    )
    parser.add_argument("json_file", nargs='?', help="Path ke file JSON instruksi")
    parser.add_argument("--dry-run", action="store_true", help="Simulasi tanpa menulis perubahan")
    parser.add_argument("--verbose", "-v", action="store_true", help="Tampilkan log detail")
    args = parser.parse_args()

    if args.json_file is None:
        # Tidak ada argumen → jalankan GUI
        return False  # tandakan untuk lanjut ke GUI

    if not os.path.isfile(args.json_file):
        print(f"Error: File JSON '{args.json_file}' tidak ditemukan.")
        sys.exit(1)

    total_ops, errors = process_json(args.json_file, dry_run=args.dry_run, verbose=args.verbose)
    sys.exit(0 if errors == 0 else 1)

# ====================================================================
# GUI (TKINTER) – hanya dijalankan jika tidak ada argumen
# ====================================================================

def main_gui():
    try:
        import tkinter as tk
        from tkinter import filedialog, scrolledtext, messagebox
    except ImportError:
        print("Error: Tkinter tidak tersedia. Jalankan dengan argumen JSON untuk mode CLI.")
        sys.exit(1)

    class PatchApp:
        def __init__(self, root):
            self.root = root
            self.root.title("Auto Patcher v2.0 (CLI/GUI)")
            self.root.geometry("800x600")

            self.json_path = tk.StringVar()
            self.history = PatchHistory()

            top_frame = tk.Frame(root)
            top_frame.pack(pady=10)

            tk.Label(top_frame, text="File JSON Instruksi:").pack(side=tk.LEFT, padx=5)
            tk.Entry(top_frame, textvariable=self.json_path, width=50).pack(side=tk.LEFT, padx=5)
            tk.Button(top_frame, text="Pilih JSON", command=self.browse_json).pack(side=tk.LEFT, padx=5)

            btn_frame = tk.Frame(root)
            btn_frame.pack(pady=5)
            tk.Button(btn_frame, text="Jalankan Patch", command=self.run_patches, bg="lightgreen").pack(side=tk.LEFT, padx=10)
            tk.Button(btn_frame, text="Undo", command=self.undo_action, bg="lightcoral").pack(side=tk.LEFT, padx=10)
            tk.Button(btn_frame, text="Clear Log", command=self.clear_log).pack(side=tk.LEFT, padx=10)

            self.log = scrolledtext.ScrolledText(root, width=80, height=25, state='normal')
            self.log.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)

            self.status = tk.Label(root, text="Siap", bd=1, relief=tk.SUNKEN, anchor=tk.W)
            self.status.pack(side=tk.BOTTOM, fill=tk.X)

            self.log.insert(tk.END, "=== Auto Patcher v2.0 (CLI/GUI) ===\n")
            self.log.insert(tk.END, "Gunakan 'Pilih JSON' untuk memilih file instruksi patch.\n")
            self.log.insert(tk.END, "Kemudian tekan 'Jalankan Patch'.\n")
            self.log.insert(tk.END, "Tekan 'Undo' untuk membatalkan patch terakhir.\n\n")

        def browse_json(self):
            f = filedialog.askopenfilename(
                title="Pilih file JSON instruksi",
                filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
            )
            if f:
                self.json_path.set(f)
                self.log_insert(f"File JSON dipilih: {f}\n")

        def log_insert(self, text):
            self.log.insert(tk.END, text)
            self.log.see(tk.END)
            self.root.update_idletasks()

        def clear_log(self):
            self.log.delete(1.0, tk.END)

        def run_patches(self):
            json_file = self.json_path.get()
            if not json_file:
                messagebox.showerror("Error", "Pilih file JSON terlebih dahulu!")
                return
            if not os.path.isfile(json_file):
                messagebox.showerror("Error", f"File {json_file} tidak ditemukan.")
                return

            self.log_insert("▶️  Memulai proses patch...\n")
            # Panggil process_json dengan dry_run=False, verbose=True (tapi output di log)
            # Kita perlu menangkap output dan menampilkannya di log.
            # Untuk sederhana, kita tidak menggunakan process_json langsung karena outputnya ke stdout.
            # Tapi kita bisa mengarahkan output sementara.
            # Atau kita gunakan kembali engine kita secara manual.
            # Lebih praktis: panggil process_json dengan redirect stdout?
            # Karena kita sudah punya fungsi terpisah, kita akan gunakan kembali.
            # Tapi process_json mencetak ke stdout, tidak ke log.
            # Untuk GUI, kita akan menggunakan kembali implementasi yang ada di class.
            # Untuk menghindari duplikasi, kita akan panggil process_json dengan mengarahkan stdout ke log? Agak ribet.
            # Cara termudah: kita ekstrak logika dari process_json dan gunakan di GUI.
            # Karena ini contoh, kita akan gunakan process_json dan arahkan output ke log dengan meng-override stdout.
            # Tapi untuk kesederhanaan, kita tulis ulang sedikit:
            # Kita buat fungsi yang menerima callback log.
            # Namun untuk menjaga kode tetap ringkas, saya akan menggunakan process_json dengan mengalihkan stdout.
            # Atau kita bisa membuat fungsi yang mengembalikan string log.
            # Saya pilih menggunakan process_json dan menangkap outputnya.

            import io
            from contextlib import redirect_stdout
            f = io.StringIO()
            with redirect_stdout(f):
                total_ops, errors = process_json(json_file, dry_run=False, verbose=True)
            output = f.getvalue()
            self.log_insert(output)
            if errors == 0:
                self.status.config(text=f"Patch selesai. {total_ops} operasi. History stack: {len(self.history.stack)}")
            else:
                self.status.config(text=f"Selesai dengan {errors} error.")

        def undo_action(self):
            success, msg = undo_last_patch(self.history)
            if success:
                self.log_insert(f"↩️  UNDO: {msg}\n")
                self.status.config(text=f"Undo berhasil. History stack: {len(self.history.stack)}")
            else:
                messagebox.showinfo("Informasi", msg)
                self.log_insert(f"ℹ️  {msg}\n")

    root = tk.Tk()
    app = PatchApp(root)
    root.mainloop()

# ====================================================================
# ENTRY POINT UTAMA
# ====================================================================

if __name__ == "__main__":
    # Jika ada argumen → CLI
    if len(sys.argv) > 1:
        main_cli()
    else:
        main_gui()