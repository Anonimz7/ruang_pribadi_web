/* ui/stock-widgets.js — StockSectorBadge, DelistedBadge, StockInfoCard */
import { createEl, on } from '../utils/dom.js';
import { icons } from './icons.js';

const SECTOR_COLORS = {
  'Energi': '#E86452',
  'Primer': '#6DC8EC',
  'Layanan Kesehatan': '#00C87A',
  'Industri': '#F6903D',
  'Keuangan': '#5B8FF9',
  'Utilitas': '#9270CA',
  'Teknologi': '#7B61FF',
  'Konsumer Non-Siklis': '#5AD8A6',
  'Konsumer Siklis': '#F6C022',
  'Properti & Real Estat': '#D94B4B',
  'Infrastruktur': '#90A4AE',
};

export function sectorColor(sector) {
  return SECTOR_COLORS[sector] || '#64748B';
}

export function StockSectorBadge(label, small = false) {
  if (!label) return null;
  const color = sectorColor(label);
  const el = createEl('span', {
    class: 'stock-sector-badge',
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: small ? '1px 6px' : '3px 8px',
      background: color + '26',
      border: `1px solid ${color}4D`,
      borderRadius: '10px',
      fontSize: small ? 'var(--text-xs)' : 'var(--text-sm)',
      fontWeight: 600,
      color: color,
      lineHeight: 1.4,
    }
  });
  el.textContent = label;
  return el;
}

export function DelistedBadge({ labelDelisted, stockStatus, statusReason, small = false, nowrap = false }) {
  const isBlacklisted = stockStatus === 'blacklist';
  const isDelisted = labelDelisted === 1;
  const wrap = createEl('span', {
    class: 'delisted-badge',
    style: { display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: nowrap ? 'nowrap' : 'wrap' }
  });

  // Badge blacklist (jika ditetapkan admin)
  if (isBlacklisted) {
    const bl = createEl('span', {
      style: {
        display: 'inline-flex', alignItems: 'center', gap: '2px',
        padding: small ? '1px 4px' : '2px 6px', borderRadius: '8px',
        fontSize: small ? 'var(--text-xs)' : 'var(--text-sm)', fontWeight: 600,
        cursor: statusReason ? 'pointer' : 'default',
        background: 'rgba(217, 119, 6, 0.12)', color: 'var(--c-warn)',
      }
    });
    bl.innerHTML = `${icons['alert-circle']} <span>Blacklist</span>`;
    if (statusReason) on(bl, 'click', () => showReasonModal(statusReason));
    wrap.appendChild(bl);
  }

  // Badge status listing: Aktif / Delisted (selalu tampil)
  const st = createEl('span', {
    style: {
      display: 'inline-flex', alignItems: 'center', gap: '2px',
      padding: small ? '1px 4px' : '2px 6px', borderRadius: '8px',
      fontSize: small ? 'var(--text-xs)' : 'var(--text-sm)', fontWeight: 600,
    }
  });
  const color = isDelisted ? 'var(--c-danger)' : 'var(--c-accent)';
  const bg = isDelisted ? 'rgba(220, 38, 38, 0.12)' : 'rgba(5, 150, 105, 0.12)';
  st.style.background = bg;
  st.style.color = color;
  const iconSvg = isDelisted
    ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    : icons['check'];
  st.innerHTML = `${iconSvg} <span>${isDelisted ? 'Delisted' : 'Aktif'}</span>`;
  wrap.appendChild(st);

  return wrap;
}

/* Format status reason: tiap "- " item jadi baris terpisah agar mudah dibaca */
function formatReasonLines(text) {
  if (!text) return '';
  let lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length === 1 && lines[0].includes('- ')) {
    lines = lines[0].split(/(?<=\.)\s+(?=- )/).map(s => s.trim()).filter(Boolean);
  }
  return lines.map((l, i) => {
    const isBullet = l.startsWith('- ');
    const body = isBullet ? l.slice(2) : l;
    return `<div style="display:flex;align-items:flex-start;gap:var(--s-2);${i < lines.length - 1 ? 'margin-bottom:var(--s-2);' : ''}">
      ${isBullet ? '<span style="flex-shrink:0;font-size:var(--text-sm);line-height:1.6;color:var(--c-text-3);">•</span>' : ''}
      <span style="flex:1;font-size:var(--text-sm);line-height:1.6;color:var(--c-text);">${body}</span>
    </div>`;
  }).join('');
}

function showReasonModal(reason) {
  const overlay = createEl('div', {
    class: 'modal-overlay',
    style: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 'var(--s-4)',
    }
  });
  overlay.innerHTML = `
    <div class="modal" style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);max-width:420px;width:100%;max-height:80vh;overflow:auto;">
      <div class="modal__head" style="display:flex;align-items:center;justify-content:space-between;padding:var(--s-4);border-bottom:1px solid var(--c-border);">
        <h3 style="font-size:var(--text-md);font-weight:600;">Alasan Blacklist</h3>
        <button class="btn btn--ghost btn--sm modal__close" style="padding:var(--s-1);width:28px;height:28px;min-width:28px;min-height:28px;" aria-label="Tutup">${icons['x']}</button>
      </div>
      <div class="modal__body" style="padding:var(--s-4);">${formatReasonLines(reason)}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.modal__close').onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
}

export function StockInfoCard(stock) {
  const hasSector = !!(stock.sector || stock.primarySector);
  const hasCore = !!(stock.coreBusiness && stock.coreBusiness.length > 0);
  if (!hasSector && !hasCore && stock.labelDelisted == null) return null;

  const card = createEl('div', {
    class: 'card stock-info-card',
    style: { marginTop: 'var(--s-3)', background: 'var(--c-surface-2)' }
  });

  const badge = DelistedBadge({
    labelDelisted: stock.labelDelisted,
    stockStatus: stock.stockStatus,
    statusReason: stock.statusReason
  });

  let html = `<div style="display:flex;align-items:center;gap:var(--s-2);margin-bottom:var(--s-3);">
    <span style="color:var(--c-primary);">${icons['globe']}</span>
    <span style="font-size:var(--text-sm);font-weight:700;">Info Sektor</span>
    <span style="margin-left:auto;"></span>
  </div>`;

  if (stock.sector) html += infoRow('Sektor', stock.sector);
  if (stock.primarySector) html += infoRow('Sub Sektor Primer', stock.primarySector);
  if (stock.subSector) html += infoRow('Sub Sektor', stock.subSector);

  if (stock.sector || stock.subSector) {
    html += `<div style="display:flex;gap:var(--s-1);flex-wrap:wrap;margin-top:var(--s-2);">`;
    if (stock.sector) {
      const b = StockSectorBadge(stock.sector);
      if (b) html += b.outerHTML;
    }
    if (stock.primarySector) {
      const b = StockSectorBadge(stock.primarySector, true);
      if (b) html += b.outerHTML;
    }
    if (stock.subSector) {
      const b = StockSectorBadge(stock.subSector, true);
      if (b) html += b.outerHTML;
    }
    html += `</div>`;
  }

  if (hasCore) {
    html += `<div style="margin-top:var(--s-3);padding-top:var(--s-3);border-top:1px solid var(--c-border);">
      <div style="font-size:var(--text-xs);font-weight:600;color:var(--c-text-2);margin-bottom:var(--s-1);">Bisnis Inti</div>
      <p style="font-size:var(--text-sm);line-height:1.5;color:var(--c-text-2);">${stock.coreBusiness}</p>
    </div>`;
    const query = encodeURIComponent(`Apa itu saham ${stock.ticker} (${stock.companyName})?`);
    html += `<a href="https://www.google.com/search?udm=50&q=${query}" target="_blank" rel="noopener" class="btn btn--secondary" style="margin-top:var(--s-3);width:100%;font-size:var(--text-sm);justify-content:center;">${icons['search']} Pelajari ${stock.companyName}</a>`;
  }

  card.innerHTML = html;
  const headSpan = card.querySelector('span:last-child');
  if (headSpan && badge) headSpan.appendChild(badge);
  return card;
}

function infoRow(label, value) {
  return `<div style="display:flex;gap:var(--s-2);margin-bottom:var(--s-1);">
    <span style="width:120px;flex-shrink:0;font-size:var(--text-sm);font-weight:600;color:var(--c-text-2);">${label}</span>
    <span style="font-size:var(--text-sm);color:var(--c-text);">${value}</span>
  </div>`;
}
