/* ui/password-strength.js — Password strength scoring (shared) */
export function calcStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { label: 'Lemah', pct: 25, cls: 'pw-strength__text--weak' };
  if (score <= 4) return { label: 'Cukup', pct: 50, cls: 'pw-strength__text--fair' };
  if (score <= 6) return { label: 'Bagus', pct: 75, cls: 'pw-strength__text--good' };
  return { label: 'Kuat', pct: 100, cls: 'pw-strength__text--strong' };
}