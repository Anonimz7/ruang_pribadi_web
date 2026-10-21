/* utils/format.js — Pemformat angka, tanggal, dan ukuran berkas bersama.
   Satu-satunya rumah bagi fungsi-fungsi ini; halaman tidak lagi
   menggulung salinannya sendiri. */
import { normalizeDate } from '../ui/chart.js';

export function fmtPrice(v) {
  if (v == null) return '-';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(v);
}

export function formatNilaiSingkat(v) {
  if (v == null) return '-';
  const n = Number(v), s = n < 0 ? '-' : '', a = Math.abs(n);
  if (a >= 1e12) return s + (a / 1e12).toFixed(1) + 'T';
  if (a >= 1e9) return s + (a / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return s + (a / 1e6).toFixed(1) + 'M';
  return s + a.toFixed(0);
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function dateLabel(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function dateLabelYear(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function toTs(dateStr) {
  const d = new Date(normalizeDate(dateStr));
  return isNaN(d) ? 0 : d.getTime();
}
