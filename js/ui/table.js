/* ui/table.js — Data table component */
export function createTable({ columns, rows, actions } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';

  const table = document.createElement('table');
  table.className = 'table';

  // Header
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label || col.key;
    hr.appendChild(th);
  });
  if (actions) {
    const th = document.createElement('th');
    th.style.width = '1px';
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    columns.forEach(col => {
      const td = document.createElement('td');
      const val = row[col.key];
      if (col.render) {
        td.appendChild(col.render(val, row));
      } else {
        td.textContent = val ?? '-';
      }
      tr.appendChild(td);
    });
    if (actions) {
      const td = document.createElement('td');
      td.className = 'table__actions';
      actions.forEach(act => {
        const btn = document.createElement('button');
        btn.className = 'btn btn--ghost btn--sm';
        btn.innerHTML = act.icon || act.label;
        btn.addEventListener('click', () => act.onClick(row));
        td.appendChild(btn);
      });
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);

  return wrap;
}
