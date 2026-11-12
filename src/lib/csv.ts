/**
 * CSV no padrão do Excel em português: separador ";", vírgula decimal e BOM UTF-8.
 * Células de texto que começam com = + - @ recebem um apóstrofo (proteção contra
 * injeção de fórmulas ao abrir no Excel/Sheets).
 */
export type CsvCell = string | number | null | undefined;

export function csvMoney(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function cell(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "number" ? String(v).replace(".", ",") : v;
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
