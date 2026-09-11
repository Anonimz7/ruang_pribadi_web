/* core/menu-config.js — Loads static menu_config.json (mirrors Flutter AppConfig.load) */
import { icons } from '../ui/icons.js';

// Maps Flutter IconData names to our icon registry keys
const iconMap = {
  'Icons.person': 'user',
  'Icons.calculate': 'calculate',
  'Icons.password': 'key',
  'Icons.casino': 'dice',
  'Icons.change_circle': 'target',
  'Icons.account_tree': 'git-branch',
  'Icons.translate': 'globe',
  'Icons.download': 'download',
  'Icons.article': 'newspaper',
  'Icons.candlestick_chart': 'trending-up',
  'Icons.list_alt': 'list',
  'Icons.radar': 'radar',
  'Icons.receipt_long': 'file-text',
  'Icons.admin_panel_settings': 'users',
  'Icons.dashboard': 'monitor',
  'Icons.language': 'map',
  'Icons.hub': 'link',
  'Icons.backup': 'database',
  'Icons.shield': 'shield',
  'Icons.upload_file': 'upload',
  'Icons.history': 'history',
  'Icons.help': 'help-circle',
  'Icons.grid': 'grid',
  'Icons.book_open': 'book-open',
  'Icons.layers': 'layers',
};

/** Portal registry — single source of truth for portal ids */
export const PORTALS = {
  saham: {
    id: 'saham',
    label: 'Saham',
    icon: 'trending-up',
    route: '/saham',
    defaultPage: '/saham/news',
    sections: ['market', 'admin'],
  },
};

export function getPortal(portalId) {
  return PORTALS[portalId] || null;
}

let cached = null;

export async function fetchMenuConfig() {
  if (cached) return cached;
  const res = await fetch('/assets/config/menu_config.json');
  const data = await res.json();
  cached = data.apps.map((app) => ({
    key: app.key,
    icon: iconMap[app.icon] || 'help-circle',
    label: app.label,
    section: app.section,
    portal: app.portal || null,
    defaultPermission: app.defaultPermission,
  }));
  return cached;
}

// Section -> human-readable label + route mapping
export const MENU_SECTIONS = [
  { value: 'system', label: 'System', path: '/' },
  { value: 'menu', label: 'Menu', path: '/math-speed' },
  { value: 'market', label: 'Market', path: '/saham/news' },
  { value: 'admin', label: 'Admin', path: '/saham/admin/dashboard' },
];

// Menu key -> route path (mirrors Flutter drawer paths)
export const ROUTE_MAP = {
  profile: '/profile',
  math_speed: '/math-speed',
  password_generator: '/password',
  gacha_luck: '/gacha',
  rolling: '/rolling',
  code_diagram: '/diagram',
  language: '/bahasa',
  news: '/saham/news',
  stocks: '/saham/stocks',
  stock_list: '/saham/stock-list',
  ihsg_radar: '/saham/market',
  reports: '/saham/reports',
  index_saham: '/saham/index',
  video_downloader: '/video',
  user_permissions: '/saham/admin/users',
  server_dashboard: '/saham/admin/dashboard',
  sitemaps: '/saham/admin/sitemaps',
  proxies: '/saham/admin/proxies',
  backup: '/saham/admin/backup',
  stock_status: '/saham/admin/stock-status',
  idx_upload: '/saham/admin/idx-upload',
  // Tools baru (dikonversi dari HTML standalone)
  color_palate: '/color-palate',
  math_dasar: '/math-dasar',
  csv_shuffler: '/bacak',
  tint_shade: '/tint-shade',
  color_vision: '/color-blind',
  jepunese: '/jepunese',
  bahasa_interaktif: '/bahasa-interaktif',
  type_writing: '/type-writing',
  math_speed_legacy: '/math-speed-legacy',
};

// Menu key -> URL yang dibuka di tab baru (tool HTML standalone, tanpa konversi SPA)
export const EXTERNAL_URLS = {
  deck_of_cards: '/js/pages/tools/deck-of-cards-old/index.html',
};