#!/usr/bin/env python3
"""
PATCH ENGINE v6.2 — Zero External Dependency
=============================================
Perbaikan:
- Auto-fix newline literal di JSON sebelum parsing
- Dukungan context_before/after di AST strategy
"""

import ast
import argparse
import difflib
import json
import os
import re
import shutil
import sys
import textwrap
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# =============================================================================
# KONSTANTA & UTILITAS
# =============================================================================

VERSION = "6.2.0"
BACKUP_DIR_NAME = ".patch_backups"
LOG_FILE_NAME = "patch.log"
LAST_RUN_FILE = ".last_run_result.json"


class Colors:
    """Warna ANSI untuk terminal."""
    GREEN = "\033[92m"
    RED = "\033[91m"
    CYAN = "\033[36m"
    YELLOW = "\033[93m"
    MAGENTA = "\033[95m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RESET = "\033[0m"

    _enabled = True

    @classmethod
    def disable(cls):
        cls._enabled = False
        cls.GREEN = cls.RED = cls.CYAN = cls.YELLOW = cls.MAGENTA = cls.BOLD = cls.DIM = cls.RESET = ""

    @classmethod
    def colorize(cls, text: str, color: str = "") -> str:
        if cls._enabled and color:
            return f"{color}{text}{cls.RESET}"
        return text


def log_message(log_file: Path, message: str, verbose: bool = False):
    """Catat pesan ke file log dan terminal (jika verbose)."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {message}\n")
    if verbose:
        print(f"  {Colors.DIM}[{timestamp}]{Colors.RESET} {message}")


def print_colored(text: str, color: str = "", end: str = "\n"):
    """Cetak teks berwarna jika terminal mendukung."""
    print(Colors.colorize(text, color), end=end)


# =============================================================================
# AUTO-FIX JSON (Perbaikan #1)
# =============================================================================

def fix_json_newlines(text: str) -> str:
    """
    Perbaiki newline literal di dalam string JSON.
    Ubah karakter newline (0x0A) yang tidak di-escape menjadi \n yang valid.
    """
    # State machine sederhana untuk melacak posisi di dalam string
    result = []
    i = 0
    in_string = False
    escape = False
    while i < len(text):
        ch = text[i]
        if escape:
            # Karakter setelah backslash, kita lewati
            result.append(ch)
            escape = False
            i += 1
            continue
        if ch == '\\':
            escape = True
            result.append(ch)
            i += 1
            continue
        if ch == '"':
            in_string = not in_string
            result.append(ch)
            i += 1
            continue
        if in_string and ch == '\n':
            # Newline literal di dalam string → ganti dengan \n escape
            result.append('\\n')
            i += 1
            continue
        result.append(ch)
        i += 1
    return ''.join(result)


def extract_json_from_text(text: str) -> Optional[Dict]:
    """
    Ekstrak JSON dari teks mentah.
    Support markdown, teks campuran, dan auto-fix newline literal.
    """
    # 1. Coba parsing langsung
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 2. Coba dengan auto-fix
    fixed = fix_json_newlines(text)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # 3. Cari di blok markdown ```json ... ```
    markdown_pattern = re.compile(r'```(?:json)?\s*\n(.*?)\n```', re.DOTALL)
    matches = markdown_pattern.findall(text)
    for match in matches:
        candidate = match.strip()
        # Coba langsung
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass
        # Coba setelah auto-fix
        try:
            return json.loads(fix_json_newlines(candidate))
        except json.JSONDecodeError:
            continue

    # 4. Cari pola {"operations": [...]} dengan regex
    json_pattern = re.compile(r'(\{[\s\S]*"operations"[\s\S]*\})')
    match = json_pattern.search(text)
    if match:
        candidate = match.group(1)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass
        try:
            return json.loads(fix_json_newlines(candidate))
        except json.JSONDecodeError:
            pass

    return None


# =============================================================================
# STRUKTUR DATA
# =============================================================================

class PatchResult:
    """Hasil dari satu operasi patch."""
    def __init__(self, success: bool, op_type: str, path: str,
                 message: str, strategy: str = "", diff: str = "",
                 backup_path: str = ""):
        self.success = success
        self.op_type = op_type
        self.path = path
        self.message = message
        self.strategy = strategy
        self.diff = diff
        self.backup_path = backup_path


# =============================================================================
# STRATEGI PENCARIAN
# =============================================================================

class SearchResult:
    """Hasil pencarian: posisi byte di file."""
    def __init__(self, start_byte: int, end_byte: int, strategy: str):
        self.start_byte = start_byte
        self.end_byte = end_byte
        self.strategy = strategy


class ASTPythonStrategy:
    """
    Strategi #1: AST Python (Khusus file .py)
    Gunakan ast bawaan untuk batasi scope, lalu literal find di area tersebut.
    **Perbaikan #2: Dukungan context_before/after untuk verifikasi.**
    """
    name = "AST Python"

    @classmethod
    def find(cls, content: str, old_str: str, scope: str = "",
             context_before: str = "", context_after: str = "",
             occurrence: int = 0, verbose: bool = False) -> Optional[SearchResult]:
        try:
            tree = ast.parse(content)
        except SyntaxError:
            if verbose:
                print_colored("   AST: Parse error, skip", Colors.DIM)
            return None

        line_to_byte = cls._build_line_map(content)

        search_areas = []
        if scope:
            parts = scope.split(":", 1)
            if len(parts) == 2:
                scope_type, scope_name = parts[0], parts[1]
                for node in ast.walk(tree):
                    if scope_type == "function" and isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        if node.name == scope_name:
                            search_areas.append(cls._node_range(node, line_to_byte, content))
                    elif scope_type == "class" and isinstance(node, ast.ClassDef):
                        if node.name == scope_name:
                            search_areas.append(cls._node_range(node, line_to_byte, content))

        if not search_areas:
            search_areas.append((0, len(content)))

        for start_byte, end_byte in search_areas:
            area = content[start_byte:end_byte]
            idx = area.find(old_str)
            if idx != -1:
                actual_start = start_byte + idx
                actual_end = actual_start + len(old_str)
                # Verifikasi konteks sebelum/sesudah
                if not cls._verify_context(content, actual_start, actual_end,
                                           context_before, context_after):
                    if verbose:
                        print_colored("   AST: Context tidak cocok, lanjut cari area lain", Colors.DIM)
                    continue
                if verbose:
                    print_colored(f"   AST: Found at byte {actual_start}-{actual_end}", Colors.DIM)
                return SearchResult(actual_start, actual_end, cls.name)

        if verbose:
            print_colored("   AST: Not found", Colors.DIM)
        return None

    @classmethod
    def _verify_context(cls, content: str, start: int, end: int,
                        context_before: str, context_after: str) -> bool:
        """Verifikasi context_before dan context_after di sekitar posisi."""
        if context_before:
            before_start = max(0, start - len(context_before) - 10)
            before_area = content[before_start:start]
            if context_before not in before_area:
                return False
        if context_after:
            after_end = min(len(content), end + len(context_after) + 10)
            after_area = content[end:after_end]
            if context_after not in after_area:
                return False
        return True

    @classmethod
    def _node_range(cls, node, line_to_byte, content):
        if not hasattr(node, 'lineno') or node.lineno is None:
            return (0, len(content))
        start_line = node.lineno
        end_line = getattr(node, 'end_lineno', start_line)
        start_byte = line_to_byte.get(start_line, 0)
        end_byte = line_to_byte.get(end_line + 1, len(content))
        if end_byte > len(content):
            end_byte = len(content)
        return (start_byte, end_byte)

    @staticmethod
    def _build_line_map(content: str) -> Dict[int, int]:
        line_map = {1: 0}
        pos = 0
        line_no = 1
        while True:
            newline_pos = content.find('\n', pos)
            if newline_pos == -1:
                break
            pos = newline_pos + 1
            line_no += 1
            line_map[line_no] = pos
        return line_map


class TokenContextStrategy:
    """
    Strategi #2: Token + Konteks (Primadona)
    Tokenisasi dengan regex + sliding window + verifikasi konteks.
    """
    name = "Token + Konteks"
    TOKEN_PATTERN = re.compile(r"[a-zA-Z_]\w*|[\"'][^\"']*[\"']|[0-9]+|[^\s\w\"']")

    @classmethod
    def tokenize(cls, text: str) -> List[Tuple[str, int]]:
        tokens = []
        for match in cls.TOKEN_PATTERN.finditer(text):
            tokens.append((match.group(), match.start()))
        return tokens

    @classmethod
    def find(cls, content: str, old_str: str, scope: str = "",
             context_before: str = "", context_after: str = "",
             occurrence: int = 0, verbose: bool = False) -> Optional[SearchResult]:
        file_tokens = cls.tokenize(content)
        search_tokens = [t[0] for t in cls.tokenize(old_str)]

        if not search_tokens:
            return None

        # Tentukan scope area
        scope_start, scope_end = 0, len(content)
        if scope:
            scope_result = cls._find_scope(content, scope)
            if scope_result:
                scope_start, scope_end = scope_result
                if verbose:
                    print_colored(f"   Token: Scope area {scope_start}-{scope_end}", Colors.DIM)
            else:
                if verbose:
                    print_colored(f"   Token: Scope '{scope}' tidak ditemukan", Colors.DIM)

        # Filter token ke area scope
        scoped_file_tokens = [(t, pos) for t, pos in file_tokens if scope_start <= pos < scope_end]

        # Sliding window
        matches = []
        search_len = len(search_tokens)
        for i in range(len(scoped_file_tokens) - search_len + 1):
            window = [t for t, _ in scoped_file_tokens[i:i + search_len]]
            if window == search_tokens:
                start_byte = scoped_file_tokens[i][1]
                end_byte = scoped_file_tokens[i + search_len - 1][1] + len(
                    scoped_file_tokens[i + search_len - 1][0])
                matches.append((start_byte, end_byte))

        if not matches:
            if verbose:
                print_colored("   Token: No match found", Colors.DIM)
            return None

        # Verifikasi konteks (urutan token)
        if len(matches) > 1 and (context_before or context_after):
            verified = []
            for start, end in matches:
                before_ok = cls._check_context_sequence(content, old_str, start, end,
                                                        context_before, "before")
                after_ok = cls._check_context_sequence(content, old_str, start, end,
                                                       context_after, "after")
                if before_ok and after_ok:
                    verified.append((start, end))
            if verified:
                matches = verified
                if verbose:
                    print_colored(f"   Token: Context verification passed ({len(matches)} matches)", Colors.DIM)

        # Penanganan ambiguitas: perpanjang konteks
        if len(matches) > 1:
            matches = cls._resolve_ambiguity(content, old_str, matches)

        if not matches:
            return None

        if len(matches) == 1:
            if verbose:
                print_colored(f"   Token: Found at byte {matches[0][0]}-{matches[0][1]}", Colors.DIM)
            return SearchResult(matches[0][0], matches[0][1], cls.name)

        return None

    @classmethod
    def _find_scope(cls, content: str, scope: str) -> Optional[Tuple[int, int]]:
        parts = scope.split(":", 1)
        if len(parts) != 2:
            return None
        scope_type, scope_name = parts

        if scope_type == "function":
            pattern = re.compile(rf'^(\s*)def\s+{re.escape(scope_name)}\s*\(', re.MULTILINE)
        elif scope_type == "class":
            pattern = re.compile(rf'^(\s*)class\s+{re.escape(scope_name)}\b', re.MULTILINE)
        else:
            return None

        match = pattern.search(content)
        if not match:
            return None

        start = match.start()
        base_indent = len(match.group(1))
        lines = content[start:].splitlines()
        end = start + len(lines[0])
        for line in lines[1:]:
            if line.strip():
                current_indent = len(line) - len(line.lstrip())
                if current_indent <= base_indent:
                    break
            end += len(line) + 1
        return (start, min(end, len(content)))

    @classmethod
    def _check_context_sequence(cls, content: str, old_str: str, start: int, end: int,
                                 context: str, direction: str) -> bool:
        if not context:
            return True
        if direction == "before":
            area = content[max(0, start - 200):start]
        else:
            area = content[end:end + 200]

        area_tokens = [t for t, _ in cls.tokenize(area)]
        context_tokens = [t for t, _ in cls.tokenize(context)]

        if not context_tokens:
            return True

        for i in range(len(area_tokens) - len(context_tokens) + 1):
            if area_tokens[i:i + len(context_tokens)] == context_tokens:
                return True
        return False

    @classmethod
    def _resolve_ambiguity(cls, content: str, old_str: str,
                           matches: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
        old_tokens = cls.tokenize(old_str)

        for extra in [10, 20, 30]:
            verified = []
            for start, end in matches:
                file_tokens = cls.tokenize(content)
                idx = None
                for i, (_, pos) in enumerate(file_tokens):
                    if pos == start:
                        idx = i
                        break
                if idx is None:
                    continue
                window_start = max(0, idx - extra)
                window_end = min(len(file_tokens), idx + len(old_tokens) + extra)
                window = [t for t, _ in file_tokens[window_start:window_end]]
                ref_start = max(0, -extra)
                ref_end = len(old_tokens) + extra
                file_text = content[start:end]
                score = difflib.SequenceMatcher(None, file_text, old_str).ratio()
                if score > 0.95:
                    verified.append((start, end))
            if len(verified) == 1:
                return verified

        return matches


class FlatcodeStrategy:
    """
    Strategi #3: Flatcode (Normalisasi)
    Hilangkan komentar dan whitespace, cari exact match di flat space.
    """
    name = "Flatcode"

    @classmethod
    def find(cls, content: str, old_str: str, scope: str = "",
             context_before: str = "", context_after: str = "",
             occurrence: int = 0, verbose: bool = False) -> Optional[SearchResult]:
        flat_content, content_map = cls._flatten(content)
        flat_search, _ = cls._flatten(old_str)

        idx = flat_content.find(flat_search)
        if idx == -1:
            if verbose:
                print_colored("   Flatcode: Not found", Colors.DIM)
            return None

        start_byte = content_map[idx]
        end_byte = content_map[idx + len(flat_search) - 1] + 1
        if verbose:
            print_colored(f"   Flatcode: Found at byte {start_byte}-{end_byte}", Colors.DIM)
        return SearchResult(start_byte, end_byte, cls.name)

    @staticmethod
    def _flatten(text: str) -> Tuple[str, List[int]]:
        strings = []
        def replacer(m):
            strings.append(m.group(0))
            return f"__STR_{len(strings)-1}__"

        text = re.sub(r'"(?:\\.|[^"\\])*"', replacer, text)
        text = re.sub(r"'(?:\\.|[^'\\])*'", replacer, text)

        text = re.sub(r'//.*?$', '', text, flags=re.MULTILINE)
        text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
        text = re.sub(r'#.*?$', '', text, flags=re.MULTILINE)

        for i, s in enumerate(strings):
            text = text.replace(f"__STR_{i}__", s)

        flat_chars = []
        byte_map = []
        for i, char in enumerate(text):
            if not char.isspace():
                flat_chars.append(char)
                byte_map.append(i)

        return ''.join(flat_chars), byte_map


class FuzzyMatcherStrategy:
    """
    Strategi #4: Fuzzy Matcher (difflib)
    4 tingkat toleransi: Exact → Trailing WS → Normalize WS → Relative Indent.
    """
    name = "Fuzzy Matcher"

    @classmethod
    def find(cls, content: str, old_str: str, scope: str = "",
             context_before: str = "", context_after: str = "",
             occurrence: int = 0, verbose: bool = False) -> Optional[SearchResult]:
        for level in range(4):
            result = cls._try_level(content, old_str, level)
            if result:
                if verbose:
                    print_colored(f"   Fuzzy: Found at level {level} -> byte {result[0]}-{result[1]}", Colors.DIM)
                return SearchResult(result[0], result[1], f"{cls.name} (L{level})")
        if verbose:
            print_colored("   Fuzzy: Not found", Colors.DIM)
        return None

    @classmethod
    def _try_level(cls, content: str, old_str: str, level: int) -> Optional[Tuple[int, int]]:
        if level == 0:
            idx = content.find(old_str)
            if idx != -1:
                return (idx, idx + len(old_str))
            return None

        elif level == 1:
            content_lines = content.splitlines()
            search_lines = old_str.splitlines()
            for i in range(len(content_lines) - len(search_lines) + 1):
                match = True
                for j, sline in enumerate(search_lines):
                    if content_lines[i + j].rstrip() != sline.rstrip():
                        match = False
                        break
                if match:
                    start = sum(len(l) + 1 for l in content_lines[:i])
                    end = start + len('\n'.join(content_lines[i:i + len(search_lines)]))
                    return (start, end)
            return None

        elif level == 2:
            norm_content = cls._normalize_ws(content)
            norm_search = cls._normalize_ws(old_str)
            idx = norm_content.find(norm_search)
            if idx != -1:
                return cls._approximate_position(content, old_str, idx, len(norm_search))
            return None

        elif level == 3:
            rel_content = cls._relative_indent(content)
            rel_search = cls._relative_indent(old_str)
            idx = rel_content.find(rel_search)
            if idx != -1:
                return cls._approximate_position(content, old_str, idx, len(rel_search))
            return None

        return None

    @staticmethod
    def _normalize_ws(text: str) -> str:
        lines = text.splitlines()
        normalized = []
        for line in lines:
            stripped = line.lstrip()
            indent = line[:len(line) - len(stripped)]
            norm_indent = indent.replace('\t', '    ')
            norm_line = norm_indent + ' '.join(stripped.split())
            normalized.append(norm_line)
        return '\n'.join(normalized)

    @staticmethod
    def _relative_indent(text: str) -> str:
        lines = text.splitlines()
        if not lines:
            return text
        min_indent = float('inf')
        for line in lines:
            if line.strip():
                indent = len(line) - len(line.lstrip())
                min_indent = min(min_indent, indent)
        if min_indent == float('inf'):
            min_indent = 0
        relative = []
        for line in lines:
            if line.strip():
                current = len(line) - len(line.lstrip())
                relative.append(' ' * (current - min_indent) + line.lstrip())
            else:
                relative.append('')
        return '\n'.join(relative)

    @staticmethod
    def _approximate_position(original: str, search: str, norm_idx: int, norm_len: int) -> Optional[Tuple[int, int]]:
        matcher = difflib.SequenceMatcher(None, original, search)
        match = matcher.find_longest_match(0, len(original), 0, len(search))
        if match.size > len(search) * 0.8:
            return (match.a, match.a + len(search))

        orig_lines = original.splitlines()
        search_lines = search.splitlines()
        for i in range(len(orig_lines) - len(search_lines) + 1):
            window = '\n'.join(orig_lines[i:i + len(search_lines)])
            similarity = difflib.SequenceMatcher(None, window, search).ratio()
            if similarity > 0.85:
                start = sum(len(l) + 1 for l in orig_lines[:i])
                return (start, start + len(window))
        return None


class LiteralExactStrategy:
    """
    Strategi #5: Literal Exact (Terakhir)
    Cari exact match dengan str.find(), support occurrence.
    """
    name = "Literal Exact"

    @classmethod
    def find(cls, content: str, old_str: str, scope: str = "",
             context_before: str = "", context_after: str = "",
             occurrence: int = 0, verbose: bool = False) -> Optional[SearchResult]:
        idx = -1
        count = 0
        while True:
            idx = content.find(old_str, idx + 1)
            if idx == -1:
                break
            if count == occurrence:
                if verbose:
                    print_colored(f"   Literal: Found at byte {idx}-{idx+len(old_str)} (occurrence {occurrence})", Colors.DIM)
                return SearchResult(idx, idx + len(old_str), cls.name)
            count += 1
        if verbose:
            print_colored("   Literal: Not found", Colors.DIM)
        return None


# =============================================================================
# STRATEGY SELECTOR
# =============================================================================

class StrategySelector:
    STRATEGIES = [
        ASTPythonStrategy,
        TokenContextStrategy,
        FlatcodeStrategy,
        FuzzyMatcherStrategy,
        LiteralExactStrategy,
    ]

    @classmethod
    def find_location(cls, content: str, old_str: str, file_path: str,
                      scope: str = "", context_before: str = "",
                      context_after: str = "", occurrence: int = 0,
                      verbose: bool = False) -> Optional[SearchResult]:
        is_python = file_path.endswith('.py')

        for strategy in cls.STRATEGIES:
            if strategy is ASTPythonStrategy and not is_python:
                continue
            result = strategy.find(
                content, old_str, scope=scope,
                context_before=context_before,
                context_after=context_after,
                occurrence=occurrence,
                verbose=verbose
            )
            if result:
                return result

        return None


# =============================================================================
# PATCH ENGINE
# =============================================================================

class PatchEngine:
    def __init__(self, workspace: Path, dry_run: bool = False, verbose: bool = False):
        self.workspace = workspace.resolve()
        self.dry_run = dry_run
        self.verbose = verbose
        self.backup_dir = self.workspace / BACKUP_DIR_NAME
        self.log_file = self.workspace / LOG_FILE_NAME
        self.results: List[PatchResult] = []

        if not self.dry_run:
            self.backup_dir.mkdir(parents=True, exist_ok=True)

        if self.log_file.exists():
            self.log_file.unlink()

        log_message(self.log_file, f"PATCH ENGINE v{VERSION} started")
        log_message(self.log_file, f"Workspace: {self.workspace}")
        log_message(self.log_file, f"Dry-run: {self.dry_run}")

    def _resolve_path(self, path: str) -> Path:
        p = Path(path)
        if p.is_absolute():
            return p
        return self.workspace / path

    def _backup_file(self, file_path: Path) -> str:
        if self.dry_run or not file_path.exists():
            return ""

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        relative = file_path.relative_to(self.workspace)
        backup_name = '_'.join(relative.parts) + f".{timestamp}.bak"
        backup_path = self.backup_dir / backup_name

        shutil.copy2(file_path, backup_path)
        log_message(self.log_file, f"Backup created: {backup_path}")
        return str(backup_path)

    def _generate_diff(self, original: str, modified: str, path: str) -> str:
        orig_lines = original.splitlines(keepends=True)
        mod_lines = modified.splitlines(keepends=True)

        if orig_lines and not orig_lines[-1].endswith('\n'):
            orig_lines[-1] += '\n'
        if mod_lines and not mod_lines[-1].endswith('\n'):
            mod_lines[-1] += '\n'

        diff = list(difflib.unified_diff(
            orig_lines, mod_lines,
            fromfile=f"a/{path}",
            tofile=f"b/{path}"
        ))
        return ''.join(diff)

    def _print_diff(self, diff: str):
        for line in diff.splitlines():
            if line.startswith('+'):
                print_colored(line, Colors.GREEN)
            elif line.startswith('-'):
                print_colored(line, Colors.RED)
            elif line.startswith('@@'):
                print_colored(line, Colors.CYAN)
            else:
                print(f"    {line}")

    def execute_create(self, op: Dict) -> PatchResult:
        path = op.get("path", "")
        content = op.get("content", "")
        full_path = self._resolve_path(path)

        if full_path.exists():
            return PatchResult(False, "create", path, f"File sudah ada: {path}")

        if not self.dry_run:
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content, encoding="utf-8")

        diff = self._generate_diff("", content, path)
        log_message(self.log_file, f"CREATE {path} — success", self.verbose)

        return PatchResult(True, "create", path, f"File dibuat: {path}", diff=diff)

    def execute_delete(self, op: Dict) -> PatchResult:
        path = op.get("path", "")
        full_path = self._resolve_path(path)

        if not full_path.exists():
            return PatchResult(False, "delete", path, f"File tidak ditemukan: {path}")

        backup = self._backup_file(full_path)

        if not self.dry_run:
            full_path.unlink()

        log_message(self.log_file, f"DELETE {path} — success", self.verbose)
        return PatchResult(True, "delete", path, f"File dihapus: {path}", backup_path=backup)

    def execute_write(self, op: Dict) -> PatchResult:
        path = op.get("path", "")
        content = op.get("content", "")
        full_path = self._resolve_path(path)

        original = ""
        if full_path.exists():
            original = full_path.read_text(encoding="utf-8")

        backup = self._backup_file(full_path)

        if not self.dry_run:
            full_path.write_text(content, encoding="utf-8")

        diff = self._generate_diff(original, content, path)
        log_message(self.log_file, f"WRITE {path} — success", self.verbose)

        return PatchResult(True, "write", path, f"File ditimpa: {path}",
                          diff=diff, backup_path=backup)

    def execute_str_replace(self, op: Dict) -> PatchResult:
        path = op.get("path", "")
        old_str = op.get("old_str", "")
        new_str = op.get("new_str", "")
        scope = op.get("scope", "")
        context_before = op.get("context_before", "")
        context_after = op.get("context_after", "")
        occurrence = op.get("occurrence", 0)

        full_path = self._resolve_path(path)

        if not full_path.exists():
            return PatchResult(False, "str_replace", path, f"File tidak ditemukan: {path}")

        content = full_path.read_text(encoding="utf-8")

        if not old_str:
            return PatchResult(False, "str_replace", path, "old_str tidak boleh kosong")

        location = StrategySelector.find_location(
            content, old_str, path,
            scope=scope,
            context_before=context_before,
            context_after=context_after,
            occurrence=occurrence,
            verbose=self.verbose
        )

        if not location:
            suggestions = self._suggest_locations(content, old_str)
            msg = f"Tidak dapat menemukan old_str di {path}"
            if suggestions:
                msg += f"\n   Saran: coba gunakan occurrence={suggestions[0]} atau tambahkan context_before/after"
            return PatchResult(False, "str_replace", path, msg)

        lint_warning = self._lint_check(old_str, new_str)
        modified = content[:location.start_byte] + new_str + content[location.end_byte:]

        backup = self._backup_file(full_path)

        if not self.dry_run:
            full_path.write_text(modified, encoding="utf-8")

        diff = self._generate_diff(content, modified, path)
        log_message(self.log_file, f"STR_REPLACE {path} — success via {location.strategy}", self.verbose)

        msg = f"Replace berhasil di {path} (strategy: {location.strategy})"
        if lint_warning:
            msg += f"\n   ⚠️  Peringatan: {lint_warning}"

        return PatchResult(True, "str_replace", path, msg,
                          strategy=location.strategy, diff=diff, backup_path=backup)

    def _suggest_locations(self, content: str, old_str: str) -> List[int]:
        idx = -1
        occurrences = []
        count = 0
        while True:
            idx = content.find(old_str, idx + 1)
            if idx == -1:
                break
            occurrences.append(count)
            count += 1
        return occurrences

    def _lint_check(self, old_str: str, new_str: str) -> str:
        old_braces = old_str.count('{') - old_str.count('}')
        new_braces = new_str.count('{') - new_str.count('}')
        old_parens = old_str.count('(') - old_str.count(')')
        new_parens = new_str.count('(') - new_str.count(')')

        warnings = []
        if old_braces != new_braces:
            warnings.append(f"kurung kurawal tidak seimbang ({old_braces} → {new_braces})")
        if old_parens != new_parens:
            warnings.append(f"kurung bulat tidak seimbang ({old_parens} → {new_parens})")
        return "; ".join(warnings)

    def execute_operation(self, op: Dict) -> PatchResult:
        op_type = op.get("type", "").lower()
        handlers = {
            "create": self.execute_create,
            "delete": self.execute_delete,
            "write": self.execute_write,
            "str_replace": self.execute_str_replace,
        }

        handler = handlers.get(op_type)
        if not handler:
            return PatchResult(False, op_type, op.get("path", ""),
                             f"Tipe operasi tidak dikenal: {op_type}")

        return handler(op)

    def run(self, patch_data: Dict) -> List[PatchResult]:
        operations = patch_data.get("operations", [])
        description = patch_data.get("description", "Patch tanpa deskripsi")

        print_colored("=" * 70, Colors.BOLD)
        print_colored(f"🤖 PATCH ENGINE v{VERSION}", Colors.BOLD + Colors.CYAN)
        print_colored(f"   {description}", Colors.BOLD)
        print_colored(f"   Workspace: {self.workspace}", Colors.BOLD)
        print_colored(f"   Mode: {'DRY-RUN (simulasi)' if self.dry_run else 'LIVE'}",
                     Colors.YELLOW if self.dry_run else Colors.GREEN)
        print_colored("=" * 70, Colors.BOLD)
        print()

        log_message(self.log_file, f"Description: {description}", self.verbose)
        log_message(self.log_file, f"Total operations: {len(operations)}", self.verbose)

        for i, op in enumerate(operations, 1):
            op_type = op.get("type", "?")
            path = op.get("path", "?")
            print_colored(f"[{i}/{len(operations)}] {op_type.upper()} → {path}", Colors.BOLD)

            result = self.execute_operation(op)
            self.results.append(result)

            if result.success:
                icon = "✅"
                color = Colors.GREEN
            else:
                icon = "❌"
                color = Colors.RED

            print_colored(f"   {icon} {result.message}", color)
            if result.strategy:
                print_colored(f"   🔍 Strategy: {result.strategy}", Colors.MAGENTA)
            if result.backup_path:
                print_colored(f"   💾 Backup: {result.backup_path}", Colors.CYAN)
            if result.diff:
                print("   📋 Diff preview:")
                self._print_diff(result.diff)
            print()

            log_message(self.log_file,
                       f"[{i}] {op_type} {path} — {'OK' if result.success else 'FAIL'} — {result.message}",
                       self.verbose)

        return self.results

    def print_summary(self):
        total = len(self.results)
        success = sum(1 for r in self.results if r.success)
        failed = total - success

        print_colored("=" * 70, Colors.BOLD)
        print_colored(f"📊 RINGKASAN", Colors.BOLD)
        print_colored(f"   Total operasi : {total}", Colors.BOLD)
        print_colored(f"   ✅ Berhasil   : {success}", Colors.GREEN)
        if failed > 0:
            print_colored(f"   ❌ Gagal      : {failed}", Colors.RED)
        print_colored("=" * 70, Colors.BOLD)

        last_run = {
            "version": VERSION,
            "timestamp": datetime.now().isoformat(),
            "workspace": str(self.workspace),
            "dry_run": self.dry_run,
            "summary": {"total": total, "success": success, "failed": failed},
            "results": [
                {
                    "success": r.success,
                    "type": r.op_type,
                    "path": r.path,
                    "message": r.message,
                    "strategy": r.strategy,
                    "backup_path": r.backup_path,
                }
                for r in self.results
            ]
        }

        if not self.dry_run:
            last_run_path = self.workspace / LAST_RUN_FILE
            with open(last_run_path, "w", encoding="utf-8") as f:
                json.dump(last_run, f, indent=2, ensure_ascii=False)
            print(f"\n💾 Hasil tersimpan di: {last_run_path}")

        if failed > 0:
            print("\n💡 Saran perbaikan:")
            print("   1. Periksa apakah old_str exact sama dengan kode di file")
            print("   2. Tambahkan context_before / context_after untuk mempersempit pencarian")
            print("   3. Gunakan scope (contoh: \"function:nama_fungsi\") untuk file .py")
            print("   4. Coba mode dry-run dulu untuk melihat preview")
            print("   5. Jika ada multiple kemunculan, gunakan occurrence (0, 1, 2, ...)")

        log_message(self.log_file, f"Summary: {success}/{total} success, {failed} failed", self.verbose)
        log_message(self.log_file, "PATCH ENGINE finished", self.verbose)


# =============================================================================
# VALIDASI
# =============================================================================

def validate_operation(op: Dict, index: int) -> Tuple[bool, str]:
    op_type = op.get("type", "").lower()
    path = op.get("path", "")

    if not op_type:
        return False, f"Operasi #{index}: field 'type' wajib diisi"
    if not path:
        return False, f"Operasi #{index}: field 'path' wajib diisi"

    valid_types = {"create", "delete", "write", "str_replace"}
    if op_type not in valid_types:
        return False, f"Operasi #{index}: tipe '{op_type}' tidak valid. Gunakan: {valid_types}"

    if op_type == "create":
        if "content" not in op:
            return False, f"Operasi #{index} (create): field 'content' wajib diisi"

    elif op_type == "str_replace":
        if "old_str" not in op:
            return False, f"Operasi #{index} (str_replace): field 'old_str' wajib diisi"
        if "new_str" not in op:
            return False, f"Operasi #{index} (str_replace): field 'new_str' wajib diisi"

    return True, ""


def validate_patch_data(patch_data: Dict) -> Tuple[bool, str]:
    if not isinstance(patch_data, dict):
        return False, "Input harus berupa objek JSON"

    if "operations" not in patch_data:
        return False, "Field 'operations' tidak ditemukan di JSON"

    operations = patch_data.get("operations", [])
    if not isinstance(operations, list):
        return False, "Field 'operations' harus berupa array"

    for i, op in enumerate(operations, 1):
        valid, msg = validate_operation(op, i)
        if not valid:
            return False, msg

    return True, ""


# =============================================================================
# MAIN
# =============================================================================

def create_example_patch() -> Dict:
    return {
        "description": "Contoh: Tambah fitur logging dan refactor main",
        "operations": [
            {
                "type": "create",
                "path": "src/utils/logger.py",
                "content": "import logging\nimport sys\n\n\ndef setup_logger(name: str, level: int = logging.INFO) -> logging.Logger:\n    \"\"\"Setup logger dengan format konsisten.\"\"\"\n    logger = logging.getLogger(name)\n    logger.setLevel(level)\n    handler = logging.StreamHandler(sys.stdout)\n    formatter = logging.Formatter(\n        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'\n    )\n    handler.setFormatter(formatter)\n    logger.addHandler(handler)\n    return logger\n"
            },
            {
                "type": "str_replace",
                "path": "src/main.py",
                "old_str": "import os\nimport sys",
                "new_str": "import os\nimport sys\n\nfrom utils.logger import setup_logger",
                "scope": ""
            },
            {
                "type": "str_replace",
                "path": "src/main.py",
                "old_str": "def main():\n    print(\"Starting application...\")\n    # TODO: implement main logic\n    pass",
                "new_str": "def main():\n    logger = setup_logger(\"app\")\n    logger.info(\"Starting application...\")\n    try:\n        run_application()\n    except Exception as e:\n        logger.error(f\"Application failed: {e}\")\n        sys.exit(1)",
                "scope": "function:main"
            },
            {
                "type": "delete",
                "path": "src/temp_old.py"
            }
        ]
    }


def main():
    parser = argparse.ArgumentParser(
        description=f"PATCH ENGINE v{VERSION} — Apply AI-generated JSON patches",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Examples:
              python patch.py patch.json --workspace ./my-project
              python patch.py patch.json --workspace ./my-project --dry-run
              cat patch.json | python patch.py --stdin --workspace ./my-project
              python patch.py --example > example.json
        """)
    )

    parser.add_argument("patch_file", nargs="?", help="File JSON patch")
    parser.add_argument("--workspace", default=".", help="Direktori root proyek (default: .)")
    parser.add_argument("--dry-run", action="store_true", help="Simulasi tanpa mengubah file")
    parser.add_argument("--verbose", "-v", action="store_true", help="Tampilkan log detail di terminal")
    parser.add_argument("--stdin", action="store_true", help="Baca patch dari stdin")
    parser.add_argument("--example", action="store_true", help="Generate contoh patch JSON")
    parser.add_argument("--no-color", action="store_true", help="Nonaktifkan warna terminal")

    args = parser.parse_args()

    if args.no_color:
        Colors.disable()

    if args.example:
        print(json.dumps(create_example_patch(), indent=2, ensure_ascii=False))
        return

    if args.stdin:
        raw_text = sys.stdin.read()
    elif args.patch_file:
        patch_path = Path(args.patch_file)
        if not patch_path.exists():
            print_colored(f"❌ File tidak ditemukan: {args.patch_file}", Colors.RED)
            sys.exit(1)
        raw_text = patch_path.read_text(encoding="utf-8")
    else:
        parser.print_help()
        sys.exit(1)

    patch_data = extract_json_from_text(raw_text)
    if patch_data is None:
        print_colored("❌ Gagal mengekstrak JSON dari input.", Colors.RED)
        print("   Pastikan input berisi JSON valid atau blok markdown ```json ... ```")
        sys.exit(1)

    valid, error_msg = validate_patch_data(patch_data)
    if not valid:
        print_colored(f"❌ Validasi gagal: {error_msg}", Colors.RED)
        sys.exit(1)

    workspace = Path(args.workspace).resolve()
    if not workspace.is_dir():
        print_colored(f"❌ Workspace bukan direktori: {workspace}", Colors.RED)
        sys.exit(1)

    engine = PatchEngine(workspace=workspace, dry_run=args.dry_run, verbose=args.verbose)
    engine.run(patch_data)
    engine.print_summary()

    failed = sum(1 for r in engine.results if not r.success)
    sys.exit(failed)


if __name__ == "__main__":
    main()