export type CsvCell = string | number | boolean | null | undefined

const escapeCell = (value: CsvCell): string => {
  const normalized = value == null ? "" : String(value)
  return `"${normalized.replace(/"/g, '""')}"`
}

export const buildCsv = (headers: CsvCell[], rows: CsvCell[][]): string => {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","))
  return lines.join("\r\n")
}

export const downloadCsv = (filename: string, headers: CsvCell[], rows: CsvCell[][]): void => {
  const csv = buildCsv(headers, rows)
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" })
  const href = URL.createObjectURL(blob)

  const anchor = document.createElement("a")
  anchor.href = href
  anchor.download = filename
  anchor.click()

  URL.revokeObjectURL(href)
}
