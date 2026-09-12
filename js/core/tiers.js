/* core/tiers.js — Tier registry mirror (backend: config/tiers.json).
 * Rank 0 = tertinggi (admin), makin besar makin rendah.
 * Akses: rank(user) <= app.minTier -> app diizinkan.
 * Sumber otoritas tetap di backend; file ini hanya mirror untuk UI & fallback.
 */
export const TIERS = [
  { key: 'admin',   rank: 0, label: 'Admin' },
  { key: 'premium', rank: 1, label: 'Premium' },
  { key: 'member',  rank: 2, label: 'Member' },
  { key: 'guest',   rank: 3, label: 'Guest' },
];

const TIER_RANK = Object.fromEntries(TIERS.map((t) => [t.key, t.rank]));

/** Rank dari tier key. Tier tak dikenal -> tier dasar (nilai terbesar). */
export function tierRank(tierKey) {
  const rank = TIER_RANK[tierKey];
  return rank === undefined ? Math.max(...Object.values(TIER_RANK)) : rank;
}

/** Rank tertinggi (admin) — nilai terkecil. */
export const ADMIN_RANK = Math.min(...Object.values(TIER_RANK));

/** Label dari tier key (fallback: key itu sendiri). */
export function tierLabel(tierKey) {
  return TIERS.find((t) => t.key === tierKey)?.label || tierKey;
}

/** Apakah rank mencapai tier admin (rank terkecil). */
export function isAdminRank(rank) {
  return rank <= ADMIN_RANK;
}