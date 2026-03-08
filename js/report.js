import { euro, escapeHtml } from './ui.js';

function buildGroupedHtml(expenses) {
  const groups = new Map();

  for (const item of expenses) {
    const key = item.category_name || 'Altro';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, items]) => {
      const subtotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const rows = items.map(item => `
        <tr>
          <td>${escapeHtml(item.expense_date)}</td>
          <td>${escapeHtml(item.subject_name)}</td>
          <td>${escapeHtml(item.account_name)}</td>
          <td>${escapeHtml(item.description)}</td>
          <td class="r">${euro(item.amount)}</td>
        </tr>
      `).join('');

      return `
        <h3>${escapeHtml(name)} <span class="pill">Subtotale: <b>${euro(subtotal)}</b></span></h3>
        <table>
          <thead>
            <tr><th>Data</th><th>Soggetto</th><th>Conto</th><th>Descrizione</th><th class="r">Importo</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }).join('');
}

function buildBaseStyles() {
  return `
    body{font-family:system-ui,Arial,sans-serif;margin:24px;color:#111}
    table{width:100%;border-collapse:collapse;margin:10px 0 24px}
    th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}
    .r{text-align:right}
    .pill{display:inline-block;padding:4px 10px;border-radius:999px;background:#f2f2f7;font-size:12px}
    .muted{color:#666;font-size:12px}
    button{margin-bottom:16px}
    .page-break{page-break-before:always;break-before:page}
    .ai-box{border:1px solid #ddd;border-radius:14px;padding:14px 16px;margin:12px 0;background:#fafafa}
    .ai-box h2{margin:0 0 8px}
    .ai-box p{margin:0;line-height:1.6;white-space:pre-line}
    .small-table td,.small-table th{font-size:12px;padding:6px 8px}
  `;
}

function buildMainReportBody({ filters, expenses }) {
  const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const groupedHtml = buildGroupedHtml(expenses);

  return `
    <h1>Report Spese</h1>
    <div class="muted">Range: ${escapeHtml(filters.from || '-')} → ${escapeHtml(filters.to || '-')} · Soggetto: ${escapeHtml(filters.subjectName || 'tutti')} · Conto: ${escapeHtml(filters.accountName || 'tutti')} · Categoria: ${escapeHtml(filters.categoryName || 'tutte')}</div>
    <p><span class="pill">Totale: <b>${euro(total)}</b></span></p>
    ${groupedHtml || '<p class="muted">Nessuna spesa trovata.</p>'}
  `;
}

export function buildReportHtml({ filters, expenses }) {
  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Report Spese</title>
      <style>${buildBaseStyles()}</style>
    </head>
    <body>
      <button onclick="window.print()">Stampa / Salva PDF</button>
      ${buildMainReportBody({ filters, expenses })}
    </body>
  </html>`;
}

function buildRecurringTable(recurringRows = []) {
  if (!recurringRows.length) return '<p class="muted">Nessuna ricorrenza significativa nel confronto selezionato.</p>';

  const rows = recurringRows.map(item => `
    <tr>
      <td>${escapeHtml(item.name || '-')}</td>
      <td>${escapeHtml(item.trend_label || item.trend || '-')}</td>
      <td class="r">${euro(item.current || 0)}</td>
      <td class="r">${euro(item.previous || 0)}</td>
      <td class="r">${euro(item.difference || 0)}</td>
    </tr>
  `).join('');

  return `
    <table class="small-table">
      <thead>
        <tr>
          <th>Ricorrenza</th>
          <th>Stato</th>
          <th class="r">Periodo</th>
          <th class="r">Confronto</th>
          <th class="r">Differenza</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function buildAiReportHtml({ filters, expenses, compareInfo, aiText, recurringRows = [] }) {
  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Report Spese AI</title>
      <style>${buildBaseStyles()}</style>
    </head>
    <body>
      <button onclick="window.print()">Stampa / Salva PDF</button>
      ${buildMainReportBody({ filters, expenses })}

      <div class="page-break"></div>

      <h1>Analisi AI del periodo</h1>
      <div class="muted">Confronto con periodo spostato indietro di ${escapeHtml(String(compareInfo.monthsBack || 1))} mese/i · Range confronto: ${escapeHtml(compareInfo.from || '-')} → ${escapeHtml(compareInfo.to || '-')}</div>

      <div class="ai-box">
        <h2>Sintesi del periodo</h2>
        <p>${escapeHtml(aiText.overview || '')}</p>
      </div>

      <div class="ai-box">
        <h2>Spese anomale</h2>
        <p>${escapeHtml(aiText.anomalies || '')}</p>
      </div>

      <div class="ai-box">
        <h2>Spese ricorrenti del periodo</h2>
        <p>${escapeHtml(aiText.recurring || '')}</p>
        ${buildRecurringTable(recurringRows)}
      </div>

      <div class="ai-box">
        <h2>Crescite principali</h2>
        <p>${escapeHtml(aiText.growth || '')}</p>
      </div>

      <div class="ai-box">
        <h2>Conclusione</h2>
        <p>${escapeHtml(aiText.conclusion || '')}</p>
      </div>
    </body>
  </html>`;
}

export function openPdfPreview(html) {
  const w = window.open('', '_blank');
  if (!w) throw new Error('Popup bloccato.');
  w.document.open();
  w.document.write(html);
  w.document.close();
}
