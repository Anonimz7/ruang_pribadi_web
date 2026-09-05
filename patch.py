import tkinter as tk
from tkinter import filedialog, scrolledtext, messagebox
import json
import shutil
import os
import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

# ====================================================================
# ENGINE PATCH
# ====================================================================

@dataclass
class PatchOperation:
    """Representasi satu operasi patch dari JSON."""
    operation: str   # 'replace', 'insert', 'delete'
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    line: Optional[int] = None       # untuk insert
    content: str = ""

@dataclass
class SegmentBackup:
    """Menyimpan segmen baris yang di-backup (100 baris sekitar area patch)."""
    file_path: str
    start: int          # indeks 0-based baris awal segmen
    end: int            # indeks 0-based baris akhir segmen (eksklusif)
    content: List[str]  # daftar baris yang disimpan
    operation: PatchOperation

class PatchHistory:
    """Stack untuk menyimpan riwayat patch yang sudah diterapkan."""
    def __init__(self):
        self.stack: List[SegmentBackup] = []

    def push(self, backup: SegmentBackup):
        self.stack.append(backup)

    def pop(self) -> Optional[SegmentBackup]:
        if self.stack:
            return self.stack.pop()
        return None

    def clear(self):
        self.stack.clear()

    def is_empty(self) -> bool:
        return len(self.stack) == 0

def get_segment(lines: List[str], center_start: int, center_end: int, context: int = 100) -> Dict:
    """
    Ambil segmen baris dengan konteks di sekitar area yang akan diubah.
    center_start, center_end adalah indeks 0-based (end eksklusif).
    """
    start = max(0, center_start - context)
    end = min(len(lines), center_end + context)
    return {
        'start': start,
        'end': end,
        'content': lines[start:end]
    }

def apply_patch_with_backup(file_path: str, patch_ops: List[Dict], history: PatchHistory) -> List[SegmentBackup]:
    """
    Menerapkan daftar patch ke file, membuat backup segment untuk setiap operasi,
    dan menyimpan ke history. Mengembalikan daftar backup yang dibuat.
    """
    # Backup full (keamanan ekstra)
    backup_full = file_path + ".full.bak"
    shutil.copy2(file_path, backup_full)

    # Baca file
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Ubah dict ke PatchOperation
    ops = []
    for p in patch_ops:
        op = PatchOperation(
            operation=p['operation'],
            line_start=p.get('line_start'),
            line_end=p.get('line_end'),
            line=p.get('line'),
            content=p.get('content', '')
        )
        ops.append(op)

    # Urutkan dari bawah ke atas agar indeks baris tidak bergeser saat modifikasi
    def get_sort_key(op: PatchOperation) -> int:
        if op.operation == 'insert':
            return op.line or 0
        else:
            return op.line_start or 0

    ops_sorted = sorted(ops, key=get_sort_key, reverse=True)

    created_backups = []

    for op in ops_sorted:
        # Tentukan rentang baris yang akan diubah (0-based, end eksklusif)
        if op.operation == 'replace':
            start = op.line_start - 1
            end = op.line_end  # karena line_end adalah 1-based inclusive, kita jadikan eksklusif
        elif op.operation == 'delete':
            start = op.line_start - 1
            end = op.line_end
        elif op.operation == 'insert':
            pos = op.line - 1
            start = pos
            end = pos   # tidak menghapus baris, hanya menyisipkan

        # Ambil segmen sebelum perubahan
        seg = get_segment(lines, start, end, context=100)
        backup = SegmentBackup(
            file_path=file_path,
            start=seg['start'],
            end=seg['end'],
            content=seg['content'],
            operation=op
        )
        created_backups.append(backup)

        # Lakukan modifikasi pada list lines
        if op.operation == 'replace':
            del lines[start:end]
            new_lines = op.content.splitlines(keepends=True)
            lines[start:start] = new_lines
        elif op.operation == 'delete':
            del lines[start:end]
        elif op.operation == 'insert':
            new_lines = op.content.splitlines(keepends=True)
            lines[pos:pos] = new_lines

    # Tulis ulang file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)

    # Simpan semua backup ke history (dalam urutan diterapkan)
    for b in created_backups:
        history.push(b)

    return created_backups

def undo_last_patch(history: PatchHistory) -> (bool, str):
    """
    Membatalkan patch terakhir yang tersimpan di history.
    Mengembalikan (status, pesan).
    """
    backup = history.pop()
    if backup is None:
        return False, "Tidak ada operasi yang dapat di-undo."

    file_path = backup.file_path
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except FileNotFoundError:
        return False, f"File {file_path} tidak ditemukan."

    # Kembalikan segmen ke posisi semula
    start = backup.start
    end = backup.end
    end = min(end, len(lines))
    del lines[start:end]
    lines[start:start] = backup.content

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)

    return True, f"Undo berhasil untuk {file_path} (operasi: {backup.operation.operation})"

# ====================================================================
# GUI TKINTER
# ====================================================================

class PatchApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Auto Patcher dengan Undo")
        self.root.geometry("800x600")

        self.json_path = tk.StringVar()
        self.history = PatchHistory()

        # Frame atas
        top_frame = tk.Frame(root)
        top_frame.pack(pady=10)

        tk.Label(top_frame, text="File JSON Instruksi:").pack(side=tk.LEFT, padx=5)
        tk.Entry(top_frame, textvariable=self.json_path, width=50).pack(side=tk.LEFT, padx=5)
        tk.Button(top_frame, text="Pilih JSON", command=self.browse_json).pack(side=tk.LEFT, padx=5)

        # Tombol aksi
        btn_frame = tk.Frame(root)
        btn_frame.pack(pady=5)
        tk.Button(btn_frame, text="Jalankan Patch", command=self.run_patches, bg="lightgreen").pack(side=tk.LEFT, padx=10)
        tk.Button(btn_frame, text="Undo", command=self.undo_action, bg="lightcoral").pack(side=tk.LEFT, padx=10)
        tk.Button(btn_frame, text="Clear Log", command=self.clear_log).pack(side=tk.LEFT, padx=10)

        # Log area
        self.log = scrolledtext.ScrolledText(root, width=80, height=25, state='normal')
        self.log.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)

        # Status bar
        self.status = tk.Label(root, text="Siap", bd=1, relief=tk.SUNKEN, anchor=tk.W)
        self.status.pack(side=tk.BOTTOM, fill=tk.X)

        self.log.insert(tk.END, "=== Auto Patcher v1.0 ===\n")
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

    def resolve_path(self, base_dir: str, raw_path: str) -> str:
        """Mengubah path relatif menjadi absolut berdasarkan folder JSON."""
        if os.path.isabs(raw_path):
            return os.path.normpath(raw_path)
        else:
            return os.path.normpath(os.path.join(base_dir, raw_path))

    def run_patches(self):
        json_file = self.json_path.get()
        if not json_file:
            messagebox.showerror("Error", "Pilih file JSON terlebih dahulu!")
            return

        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            messagebox.showerror("Error", f"Gagal membaca JSON: {e}")
            return

        if 'files' not in data:
            messagebox.showerror("Error", "JSON tidak memiliki key 'files'.")
            return

        base_dir = os.path.dirname(json_file)
        total_patches = 0

        for file_entry in data['files']:
            raw_path = file_entry.get('path')
            patches = file_entry.get('patches', [])
            if not raw_path or not patches:
                self.log_insert(f"⚠️  Entry tidak lengkap: {file_entry}\n")
                continue

            full_path = self.resolve_path(base_dir, raw_path)

            if not os.path.isfile(full_path):
                self.log_insert(f"❌ File tidak ditemukan: {full_path}\n")
                continue

            self.log_insert(f"▶️  Memproses {full_path} ...\n")
            try:
                backups = apply_patch_with_backup(full_path, patches, self.history)
                total_patches += len(backups)
                self.log_insert(f"✅ Berhasil dipatch ({len(backups)} operasi).\n")
            except Exception as e:
                self.log_insert(f"❌ ERROR pada {full_path}: {e}\n")
                import traceback
                traceback.print_exc()

        self.log_insert(f"\n✨ Selesai. Total {total_patches} operasi patch diterapkan.\n")
        self.status.config(text=f"Patch selesai. {total_patches} operasi. History stack: {len(self.history.stack)}")

    def undo_action(self):
        success, msg = undo_last_patch(self.history)
        if success:
            self.log_insert(f"↩️  UNDO: {msg}\n")
            self.status.config(text=f"Undo berhasil. History stack: {len(self.history.stack)}")
        else:
            messagebox.showinfo("Informasi", msg)
            self.log_insert(f"ℹ️  {msg}\n")

# ====================================================================
# MAIN
# ====================================================================

if __name__ == "__main__":
    root = tk.Tk()
    app = PatchApp(root)
    root.mainloop()