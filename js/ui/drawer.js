/* ui/drawer.js — Dynamic side navigation driven by server permissions */
import { store, subscribe } from '../core/state.js';
import { Auth } from '../core/auth.js';
import { fetchMenuConfig, ROUTE_MAP, MENU_SECTIONS } from '../core/menu-config.js';
import { navigate } from '../core/router.js';
import { icons } from './icons.js';

let menuConfig = null;

/**
 * Map Flutter-style icon names (e.g., "Icons.book") to our icon registry keys.
 * Falls back to 'help' icon if the mapping is unknown.
 */
function getIcon(flutterName) {
  const key = flutterName.replace(/^Icons\./, '');
  return icons[key] || icons['help'];
}

/**
 * Filter menu items based on login status, tier, and permissions.
 * Returns array of { section, label, items: [...] }
 */
function filterMenuItems() {
  if (!menuConfig) return [];

  const isLoggedIn = !!store.token;
  const sections = [];

  // System section (settings, profile) — always visible
  const systemItems = menuConfig
    .filter((app) => app.section === 'system')
    .map((app) => ({
      key: app.key,
      label: app.label,
      icon: getIcon(app.icon),
      path: ROUTE_MAP[app.key] || '/',
    }));
  if (systemItems.length) {
    sections.push({ label: 'System', items: systemItems });
  }

  if (!isLoggedIn) {
    return sections; // Only system section visible for guests
  }

  // For logged-in users: filter menu, market, admin sections
  const sectionFilters = {
    menu: 'menu',
    market: 'market',
    admin: 'admin',
  };

  for (const { value: sec, label: secLabel } of MENU_SECTIONS) {
    if (sec === 'system') continue;

    let items = menuConfig.filter((app) => app.section === sec);

    if (sec === 'admin') {
      // Admin section requires admin tier
      if (store.tier !== 'admin') continue;
      items = items.filter((app) => Auth.canAccess(app.key));
    } else {
      // Menu and market sections: check permissions
      items = items.filter((app) => {
        if (app.defaultPermission && sec !== 'admin') return true;
        if (Auth.isMenuHidden(app.key)) return false;
        return Auth.canAccess(app.key);
      });
    }

    if (items.length === 0) continue;

    const renderedItems = items.map((app) => ({
      key: app.key,
      label: app.label,
      icon: getIcon(app.icon),
      path: ROUTE_MAP[app.key] || '/',
    }));

    sections.push({
      label: secLabel,
      items: renderedItems,
    });
  }

  return sections;
}

/**
 * Render the user profile card at the top of the drawer.
 */
function renderUserCard() {
  const isLoggedIn = !!store.token;
  const userCard = document.createElement('div');
  userCard.className = 'drawer__user';
  const displayName = isLoggedIn ? (store.username || 'User') : 'Guest';
  const displayTier = isLoggedIn ? store.tier : 'guest';

  // Avatar: first letter of username, or "G" for guest
  const avatarText = displayName.substring(0, 1).toUpperCase() || 'G';

  userCard.innerHTML = `
    <div class="drawer__avatar">${avatarText}</div>
    <div class="drawer__user-info">
      <div class="drawer__user-name">${displayName}</div>
      <div class="drawer__user-tier">${displayTier}</div>
    </div>
  `;

  return userCard;
}

/**
 * Render the navigation links based on filtered menu items.
 */
function renderNav(sections) {
  const nav = document.createElement('nav');
  nav.className = 'drawer__nav';
  nav.style.paddingBottom = 'var(--s-4)';

  sections.forEach((group) => {
    const label = document.createElement('div');
    label.className = 'drawer__section-label';
    label.textContent = group.label;
    nav.appendChild(label);

    group.items.forEach((item) => {
      const a = document.createElement('a');
      a.href = '#' + item.path;
      a.className = 'drawer__item';
      a.dataset.key = item.key;
      a.dataset.path = item.path;
      a.innerHTML = `
        <span class="drawer__icon">${item.icon}</span>
        <span class="drawer__label">${item.label}</span>
      `;
      a.addEventListener('click', () => {
        navigate(item.path);
        if (window.innerWidth <= 768) store.drawerOpen = false;
      });
      nav.appendChild(a);
    });
  });

  return nav;
}

/**
 * Render the footer section with Logout or Login button.
 */
function renderFooter() {
  const isLoggedIn = !!store.token;
  const logoutWrap = document.createElement('div');
  logoutWrap.style.marginTop = 'auto';
  logoutWrap.style.padding = 'var(--s-3) var(--s-4)';

  const btn = document.createElement('button');
  btn.className = 'drawer__item';
  btn.style.width = '100%';
  btn.style.margin = '0';

  if (isLoggedIn) {
    btn.innerHTML = `
      <span class="drawer__icon">${icons['log-out']}</span>
      <span class="drawer__label">Logout</span>
    `;
    btn.addEventListener('click', async () => {
      await Auth.logout();
      store.drawerOpen = false;
      window.location.hash = '/';
      window.location.reload();
    });
  } else {
    btn.innerHTML = `
      <span class="drawer__icon">${icons['log-in'] || icons['user']}</span>
      <span class="drawer__label">Login</span>
    `;
    btn.addEventListener('click', () => {
      navigate('/login');
      if (window.innerWidth <= 768) store.drawerOpen = false;
    });
  }

  logoutWrap.appendChild(btn);
  return logoutWrap;
}

/**
 * Re-render the entire drawer content based on current auth state.
 */
function renderDrawer() {
  const drawerEl = document.querySelector('.drawer');
  if (!drawerEl) return;

  // Clear entire drawer content to prevent duplicates
  drawerEl.innerHTML = '';

  // Rebuild drawer cleanly
  const userCard = renderUserCard();
  userCard.className = 'drawer__user';
  drawerEl.appendChild(userCard);

  const sections = filterMenuItems();
  const newNav = renderNav(sections);
  newNav.classList.add('drawer__nav');
  drawerEl.appendChild(newNav);

  const footer = renderFooter();
  footer.classList.add('drawer__footer');
  drawerEl.appendChild(footer);
}

/**
 * Create the complete drawer element with initial content.
 * Call this once during app bootstrap.
 */
export async function createDrawer() {
  const el = document.createElement('aside');
  el.className = 'drawer';
  el.id = 'drawer';

  // Load menu config
  menuConfig = await fetchMenuConfig();

  // Initial render
  el.appendChild(renderUserCard());

  const sections = filterMenuItems();
  const nav = renderNav(sections);
  el.appendChild(nav);

  const footer = renderFooter();
  el.appendChild(footer);

  // Listen for auth state changes and re-render
  subscribe('token', () => {
    renderDrawer();
  });
  subscribe('permissions', () => {
    renderDrawer();
  });
  subscribe('hiddenMenus', () => {
    renderDrawer();
  });
  subscribe('tier', () => {
    renderDrawer();
  });

  // Active state sync
  subscribe('currentPage', (path) => {
    el.querySelectorAll('.drawer__item').forEach((item) => {
      item.classList.toggle('drawer__item--active', item.dataset.path === path);
    });
  });

  // Touch swipe to close on mobile
  let touchStartX = 0;
  el.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    const diff = e.touches[0].clientX - touchStartX;
    if (diff < -60 && window.innerWidth <= 768) {
      store.drawerOpen = false;
    }
  }, { passive: true });

  return el;
}

// Helper for internal use
function $(sel, ctx = el) {
  return ctx?.querySelector(sel);
}

// Re-export for app.js to call renderDrawer if needed
export { renderDrawer };
