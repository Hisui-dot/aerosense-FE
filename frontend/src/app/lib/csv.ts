// Generic over the row type so callers may pass typed model arrays (interfaces
// like Device/HighRiskArea) or inline object literals — both satisfy `object`.
export function toCsv<T extends object>(rows: readonly T[], columns?: string[]): string {
  if (!rows.length) return ''
  const cols = columns ?? Object.keys(rows[0])
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const header = cols.map(escape).join(',')
  const body = rows
    .map((r) => cols.map((c) => escape((r as Record<string, unknown>)[c])).join(','))
    .join('\r\n')
  return header + '\r\n' + body
}

export function downloadCsv<T extends object>(
  filename: string,
  rows: readonly T[],
  columns?: string[],
): void {
  const csv = toCsv(rows, columns)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
