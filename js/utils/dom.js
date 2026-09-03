/* utils/dom.js — DOM helpers */
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
export const on = (el, evt, fn, opts) => el.addEventListener(evt, fn, opts);
export const off = (el, evt, fn) => el.removeEventListener(evt, fn);

export function html(strings, ...values) {
  const tmpl = document.createElement('template');
  tmpl.innerHTML = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');
  return tmpl.content;
}

export function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v);
  });
  children.forEach(c => el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return el;
}
