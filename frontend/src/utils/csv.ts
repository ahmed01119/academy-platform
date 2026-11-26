/**
 * CSV export helpers (RFC 4180 quoting, Excel-friendly UTF-8 BOM).
 *
 * Cells that a spreadsheet would run as a formula (starting with =, +, -, @, tab or carriage return) are prefixed
 * with an apostrophe, so free text such as payment notes can never execute in Excel or Sheets (CSV injection).
 * Plain numbers, including negative ones, are written as they are.
 */
export type CsvCell = string | number | null | undefined;

const NUMERIC = /^-?\d+(\.\d+)?$/;
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  if (typeof value !== 'number' && !NUMERIC.test(text) && FORMULA_START.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** Downloads rows as a UTF-8 CSV file (with BOM so Excel shows Arabic correctly). */
export function downloadCsv(filename: string, rows: readonly (readonly CsvCell[])[]): void {
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
