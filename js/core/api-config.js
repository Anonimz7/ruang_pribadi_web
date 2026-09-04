/* core/api-config.js — Centralized API endpoint configuration */

export const ApiConfig = {
  baseUrl: 'https://www.onix.my.id', // Production server
  prefix: '/api',

  // Helper to construct a full endpoint URL
  url(path) {
    return `${this.baseUrl}${this.prefix}${path}`;
  },
};
