/* core/menu-config.js — Loads static menu_config.json (mirrors Flutter AppConfig.load) */
import { icons } from '../ui/icons.js';

// Maps Flutter IconData names to our icon registry keys
const iconMap = {
  'Icons.settings': 'settings',
  'Icons.person': 'user',
  'Icons.book': 'book',
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
  'Icons.help': 'help-circle',
};

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
    defaultPermission: app.defaultPermission,
  }));
  return cached;
}

// Section -> human-readable label + route mapping
export const MENU_SECTIONS = [
  { value: 'system', label: 'System', path: '/' },
  { value: 'menu', label: 'Menu', path: '/math-speed' },
  { value: 'market', label: 'Market', path: '/news' },
  { value: 'admin', label: 'Admin', path: '/admin/dashboard' },
];

// Menu key -> route path (mirrors Flutter drawer paths)
export const ROUTE_MAP = {
  settings: '/',
  profile: '/profile',
  japanese_alphabet: '/japanese',
  math_speed: '/math-speed',
  password_generator: '/password',
  gacha_luck: '/gacha',
  rolling: '/rolling',
  code_diagram: '/diagram',
  language: '/bahasa',
  video_downloader: '/video',
  news: '/news',
  stocks: '/stocks',
  stock_list: '/stock-list',
  ihsg_radar: '/market',
  reports: '/reports',
  user_permissions: '/admin/users',
  server_dashboard: '/admin/dashboard',
  sitemaps: '/admin/sitemaps',
  proxies: '/admin/proxies',
  backup: '/admin/backup',
  stock_status: '/admin/stock-status',
  idx_upload: '/admin/idx-upload',
};
