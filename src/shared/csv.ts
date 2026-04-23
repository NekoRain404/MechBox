const normalizeCsvText = (text: string): string =>
  text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

const escapeCsvValue = (value: unknown): string => {
  const text = value == null ? '' : String(value)
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const parseCsvRows = (csvText: string): string[][] => {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  const pushCell = () => {
    currentRow.push(currentCell)
    currentCell = ''
  }

  const pushRow = () => {
    if (currentRow.length === 1 && currentRow[0] === '') {
      currentRow = []
      return
    }

    if (currentRow.some((cell) => cell.trim() !== '')) {
      rows.push(currentRow)
    }
    currentRow = []
  }

  const normalized = normalizeCsvText(csvText)

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    const nextChar = normalized[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"'
        index += 1
        continue
      }

      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      pushCell()
      continue
    }

    if (char === '\n' && !inQuotes) {
      pushCell()
      pushRow()
      continue
    }

    currentCell += char
  }

  if (inQuotes) {
    throw new Error('CSV 引号未正确闭合')
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    pushCell()
    pushRow()
  }

  return rows
}

export const parseCsvText = (csvText: string): { headers: string[]; rows: Record<string, string>[] } => {
  const rows = parseCsvRows(csvText)
  if (rows.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = rows[0].map((header) => header.trim())
  const dataRows = rows.slice(1).map((row) => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() ?? ''
    })
    return record
  })

  return { headers, rows: dataRows }
}

export const stringifyCsv = (rows: Record<string, unknown>[]): string => {
  if (rows.length === 0) {
    return ''
  }

  const headers = Object.keys(rows[0])
  const lines = [
    headers.map((header) => escapeCsvValue(header)).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ]

  return `${lines.join('\n')}\n`
}
