import * as XLSX from 'xlsx'
import { toQuestion, type ParsedQuestion } from './csv'

const LETTERS = ['a', 'b', 'c', 'd', 'e']

export function calculateColumnWidths(
  data: Record<string, unknown>[],
  minWidth = 10,
  padding = 4,
): XLSX.ColInfo[] {
  if (data.length === 0) return []
  const keys = Array.from(new Set(data.flatMap((row) => Object.keys(row))))
  return keys.map((key) => {
    let maxLen = key.length
    for (const row of data) {
      const val = row[key]
      if (val !== undefined && val !== null) {
        const len = String(val).length
        if (len > maxLen) maxLen = len
      }
    }
    return { wch: Math.max(maxLen + padding, minWidth) }
  })
}

export function generateXlsxBuffer(
  sheetName: string,
  rows: Record<string, unknown>[],
): Uint8Array {
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = calculateColumnWidths(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new Uint8Array(buf)
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' })
}

export function parseQuestionsXlsx(bytes: Uint8Array): {
  questions: ParsedQuestion[]
  errors: string[]
} {
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(bytes, { type: 'buffer' })
  } catch {
    return { questions: [], errors: ['File Excel tidak dapat dibaca atau rusak'] }
  }

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    return { questions: [], errors: ['File Excel tidak memiliki sheet'] }
  }

  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) {
    return { questions: [], errors: ['File Excel tidak memiliki sheet'] }
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const questions: ParsedQuestion[] = []
  const errors: string[] = []
  rows.forEach((row, i) => {
    const normalized: Record<string, string> = {}
    for (const [key, val] of Object.entries(row)) {
      normalized[key.trim().toLowerCase()] = val !== undefined && val !== null ? String(val) : ''
    }

    const type = (normalized.type ?? '').trim()
    const question = (normalized.question ?? '').trim()
    const answer = (normalized.answer ?? '').trim()
    const hasContent = type !== '' || question !== '' || answer !== '' || LETTERS.some((k) => (normalized[k] ?? '').trim() !== '')
    if (!hasContent) return

    const q = toQuestion({
      type,
      text: question,
      options: LETTERS.map((k) => normalized[k] ?? ''),
      answer,
    })
    if (typeof q === 'string') {
      errors.push(`Baris ${i + 2}: ${q}`)
    } else {
      questions.push({ position: questions.length, ...q })
    }
  })

  return { questions, errors }
}
