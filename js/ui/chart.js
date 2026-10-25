/* ui/chart.js — ApexCharts wrapper (Anti-Slop, theme-aware) */
import { createEl } from '../utils/dom.js';
import { formatNilaiSingkat } from '../utils/format.js';

let apexPromise = null;

export async function loadApexCharts() {
  if (apexPromise) return apexPromise;
  if (window.ApexCharts) return window.ApexCharts;
  apexPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/apexcharts@7.4.0/dist/apexcharts.min.js';
    script.onload = () => resolve(window.ApexCharts);
    script.onerror = () => reject(new Error('Failed to load ApexCharts'));
    document.head.appendChild(script);
  });
  return apexPromise;
}

function getThemeColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    isDark,
    text: isDark ? '#b0b0b0' : '#4d4d4d',
    grid: isDark ? '#2a2a2a' : '#e0e0e0',
    border: isDark ? '#404040' : '#bdbdbd',
  };
}

export function buildBaseOptions({ height, type = 'line' }) {
  const t = getThemeColors();
  return {
    chart: {
      type,
      height,
      fontFamily: 'var(--font-sans)',
      background: 'transparent',
      toolbar: {
        show: true,
        tools: {
          download: false,
          selection: false,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
        autoSelected: 'pan',
      },
      animations: { enabled: false },
      redrawOnParentResize: true,
    },
    theme: { mode: t.isDark ? 'dark' : 'light' },
    stroke: { curve: 'straight', width: 2 },
    grid: {
      borderColor: t.grid,
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      type: 'datetime',
      labels: { style: { colors: t.text, fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
      crosshairs: { show: true, stroke: { color: t.border, width: 1, dashArray: 4 } },
    },
    yaxis: {
      labels: {
        style: { colors: t.text, fontSize: '11px' },
        formatter: (v) => {
          if (v == null) return '';
          if (Math.abs(v) >= 1e12) return (v / 1e12).toFixed(1) + 'T';
          if (Math.abs(v) >= 1e9)  return (v / 1e9).toFixed(1)  + 'B';
          if (Math.abs(v) >= 1e6)  return (v / 1e6).toFixed(1)  + 'M';
          if (Math.abs(v) >= 1e3)  return (v / 1e3).toFixed(1)  + 'K';
          return String(Math.round(v * 100) / 100);
        },
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    tooltip: {
      theme: t.isDark ? 'dark' : 'light',
      x: { format: 'dd MMM yyyy' },
      marker: { show: true },
    },
    series: [],
  };
}

export function renderChart(container, options) {
  const ApexCharts = window.ApexCharts;
  if (!ApexCharts) throw new Error('ApexCharts not loaded');
  const chart = new ApexCharts(container, options);
  chart.render();
  return chart;
}

export function destroyChart(chart) {
  if (chart && typeof chart.destroy === 'function') {
    try { chart.destroy(); } catch (_) {}
  }
}

export function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const clean = String(dateStr).split('T')[0].split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  return dateStr;
}

/* ─── Pembangun chart bersama (dipakai market.js & stocks.js) ─── */

export function toTs(dateStr) {
  const d = new Date(normalizeDate(dateStr));
  return isNaN(d) ? 0 : d.getTime();
}

export function buildLineChartApex(container, data, color, { height = 210, name = 'Value', timeKey = 'date' } = {}) {
  const opts = buildBaseOptions({ height, type: 'line' });
  opts.colors = [color];
  opts.stroke.width = 2.5;
  opts.series = [{
    name,
    data: data.filter(d => d[timeKey] && d.close != null).map(d => ({ x: toTs(d[timeKey]), y: d.close })),
  }];
  return renderChart(container, opts);
}

export function buildBarChartApex(container, data, color, { timeKey = 'date' } = {}) {
  const opts = buildBaseOptions({ height: 200, type: 'bar' });
  opts.colors = [color];
  opts.plotOptions = { bar: { columnWidth: '60%', borderRadius: 2, borderRadiusApplication: 'end' } };
  opts.series = [{
    name: 'Value',
    data: data.filter(d => d[timeKey] && d.value != null).map(d => ({ x: toTs(d[timeKey]), y: d.value })),
  }];
  return renderChart(container, opts);
}

export function buildPositionChartApex(container, series) {
  const opts = buildBaseOptions({ height: 230, type: 'line' });
  opts.colors = ['#0EA5A4'];
  opts.stroke.width = 2.5;
  opts.series = [{
    name: 'Cumulative position',
    data: series.filter(d => d.date && d.value != null).map(d => ({ x: toTs(d.date), y: d.value })),
  }];
  opts.tooltip.y = { formatter: (v) => (v >= 0 ? '+' : '') + formatNilaiSingkat(v) };
  return renderChart(container, opts);
}

/* Panel chart per halaman: pageClass = awalan class CSS halaman
   ('market-page' / 'stocks-page') agar kait styling tiap halaman utuh. */
export function createChartPanel(pageClass) {
  return function chartPanel(title, subtitle, legend, height) {
    const panel = createEl('div', { class: `${pageClass}__chart-panel`, style: { marginBottom: 'var(--s-6)' } });
    const legendHtml = legend.map(l => `
    <span style="display:inline-flex;align-items:center;gap:4px;font-size:var(--text-xs);color:var(--c-text-3);">
      <span style="width:8px;height:8px;border-radius:50%;background:${l.color};display:inline-block;"></span>${l.label}
    </span>
  `).join('');
    panel.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--s-3);flex-wrap:wrap;margin-bottom:var(--s-3);">
      <div><div style="font-size:var(--text-md);font-weight:700;">${title}</div>
      <div style="font-size:var(--text-xs);color:var(--c-text-3);margin-top:2px;">${subtitle}</div></div>
      <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;">${legendHtml}</div>
    </div>
    <div class="${pageClass}__chart" style="height:${height}px;width:100%;" data-chart-type="${title}"></div>
  `;
    return panel;
  };
}
