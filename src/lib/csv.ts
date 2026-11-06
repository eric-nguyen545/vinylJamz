export interface Column<T> { header: string; value: (row: T) => string | number | boolean | undefined | null }

/**
 * RFC 4180 quoting, plus spreadsheet formula-injection protection: text cells that start with
 * = + - @ (or a tab/CR) get a leading apostrophe so Excel/Sheets treat them as plain text.
 * Real numbers are left alone so negative values stay numeric.
 */
export function escapeCell(v: string | number | boolean | undefined | null): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  let s = typeof v === 'boolean' ? (v ? 'yes' : 'no') : v
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  const lines = [columns.map((c) => escapeCell(c.header)).join(',')]
  for (const r of rows) lines.push(columns.map((c) => escapeCell(c.value(r))).join(','))
  return `${lines.join('\r\n')}\r\n`
}
