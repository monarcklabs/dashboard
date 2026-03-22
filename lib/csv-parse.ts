/**
 * Simple CSV parser for the Docs browser preview.
 * Handles quoted fields, escaped quotes, CRLF/LF.
 * Not a full RFC 4180 implementation — designed for preview, not data processing.
 */

export interface CsvData {
  headers: string[]
  rows: string[][]
}

/**
 * Parse a CSV string into headers and rows.
 * First row is treated as the header row.
 */
export function parseCsv(raw: string): CsvData {
  if (!raw.trim()) return { headers: [], rows: [] }

  const lines = parseLines(raw)
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = lines[0]
  const rows = lines.slice(1)

  return { headers, rows }
}

/**
 * Parse CSV text into an array of rows, each row being an array of field values.
 * Handles quoted fields containing commas, newlines, and escaped quotes ("").
 */
function parseLines(raw: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < raw.length) {
    const ch = raw[i]

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (i + 1 < raw.length && raw[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        // End of quoted field
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }

    // Not in quotes
    if (ch === '"' && field === '') {
      // Start of quoted field
      inQuotes = true
      i++
      continue
    }

    if (ch === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }

    if (ch === '\r') {
      // CRLF or standalone CR
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i++
      if (i < raw.length && raw[i] === '\n') i++
      continue
    }

    if (ch === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i++
      continue
    }

    field += ch
    i++
  }

  // Final field/row
  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}
