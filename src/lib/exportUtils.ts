/**
 * Export Utilities for SHCO Legal Practice Management
 * Supports CSV/Excel export and Word/DOCX export
 */

export const exportToCsv = (filename: string, rows: Record<string, any>[]) => {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
          const escaped = val.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToWordDoc = (filename: string, htmlContent: string) => {
  const header = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${filename}</title>
      <style>
        body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #16223A; line-height: 1.4; margin: 20pt; }
        h1, h2, h3 { font-family: 'Georgia', serif; color: #16223A; }
        table { width: 100%; border-collapse: collapse; margin-top: 10pt; margin-bottom: 10pt; }
        th, td { border: 1px solid #D1D5DB; padding: 6pt 8pt; text-align: left; font-size: 10pt; }
        th { background-color: #F3F4F6; font-weight: bold; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .header-title { font-size: 16pt; font-weight: bold; text-align: center; color: #16223A; }
        .firm-sub { text-align: center; font-size: 9pt; color: #4B5563; margin-bottom: 15pt; }
      </style>
    </head>
    <body>
  `;
  const footer = '</body></html>';
  const sourceHTML = header + htmlContent + footer;

  const blob = new Blob(['\uFEFF' + sourceHTML], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
