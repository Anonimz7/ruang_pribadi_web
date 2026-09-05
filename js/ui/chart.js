/* ui/chart.js — ApexCharts wrapper (Anti-Slop, theme-aware) */
import { createEl } from '../utils/dom.js';

let apexPromise = null;

export async function loadApexCharts() {
  if (apexPromise) return apexPromise;
  if (window.ApexCharts) return window.ApexCharts;
  apexPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/apexcharts@3.54.0/dist/apexcharts.min.js';
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
    text: isDark ? '#a3a3a3' : '#616161',
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
