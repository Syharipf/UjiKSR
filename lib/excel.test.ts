import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import {
  calculateColumnWidths,
  generateXlsxBuffer,
  formatDateTime,
  parseQuestionsXlsx,
} from './excel'

describe('calculateColumnWidths', () => {
  it('returns empty array for empty data', () => {
    expect(calculateColumnWidths([])).toEqual([])
  })

  it('calculates width based on longest content plus padding and enforces minWidth', () => {
    const data = [
      { id: '1', description: 'Short', notes: 'This is a much longer note that requires expansion' },
      { id: '2', description: 'Medium length description', notes: 'Short note' },
    ]
    const widths = calculateColumnWidths(data, 10, 4)
    // id: max len 2 ('id') + 4 = 6 -> clamped to minWidth 10
    // description: 'Medium length description' (25) + 4 = 29
    // notes: 'This is a much longer note that requires expansion' (50) + 4 = 54
    expect(widths).toEqual([
      { wch: 10 },
      { wch: 29 },
      { wch: 54 },
    ])
  })
})

describe('generateXlsxBuffer', () => {
  it('creates a valid XLSX buffer with auto-width columns', () => {
    const rows = [
      { name: 'Alice', score: 95 },
      { name: 'Bob with a very long full name', score: 80 },
    ]
    const buf = generateXlsxBuffer('TestSheet', rows)
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(buf.byteLength).toBeGreaterThan(0)

    const wb = XLSX.read(buf, { cellStyles: true })
    expect(wb.SheetNames).toContain('TestSheet')
    const sheet = wb.Sheets['TestSheet']
    expect(sheet['!cols']).toBeDefined()
    // First column: 'Bob with a very long full name' (30) + 4 = 34
    // Second column: 'score' (5) + 4 = 9 -> clamped to 10
    expect(sheet['!cols']?.[0]?.wch).toBe(34)
    expect(sheet['!cols']?.[1]?.wch).toBe(10)
  })
})

describe('formatDateTime', () => {
  it('formats UTC ISO timestamp to Asia/Jakarta local time (sv-SE format)', () => {
    expect(formatDateTime('2025-05-10T08:30:00Z')).toBe('2025-05-10 15:30:00')
    expect(formatDateTime('2025-01-01T00:00:00Z')).toBe('2025-01-01 07:00:00')
  })

  it('returns empty string for null, undefined, or invalid dates', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime('')).toBe('')
    expect(formatDateTime('invalid-date')).toBe('')
  })
})

describe('parseQuestionsXlsx', () => {
  it('parses mc and tf rows from an XLSX workbook', () => {
    const rows = [
      { type: 'pg', question: 'Ibu kota Indonesia?', a: 'Jakarta', b: 'Bandung', c: '', d: '', e: '', answer: 'A' },
      { type: 'bs', question: 'Air mendidih 100°C', a: '', b: '', c: '', d: '', e: '', answer: 'B' },
      { type: 'tf', question: 'Api itu dingin', a: '', b: '', c: '', d: '', e: '', answer: 'S' },
    ]
    const buf = generateXlsxBuffer('Soal', rows)
    const { questions, errors } = parseQuestionsXlsx(buf)

    expect(errors).toEqual([])
    expect(questions).toEqual([
      { position: 0, type: 'mc', text: 'Ibu kota Indonesia?', options: ['Jakarta', 'Bandung'], answer_index: 0 },
      { position: 1, type: 'tf', text: 'Air mendidih 100°C', options: ['Benar', 'Salah'], answer_index: 0 },
      { position: 2, type: 'tf', text: 'Api itu dingin', options: ['Benar', 'Salah'], answer_index: 1 },
    ])
  })

  it('reports row errors with spreadsheet line numbers', () => {
    const rows = [
      { type: 'mc', question: 'Soal gap', a: 'X', b: '', c: 'Z', d: '', e: '', answer: 'A' },
      { type: 'mc', question: 'Soal invalid answer', a: 'X', b: 'Y', c: '', d: '', e: '', answer: 'C' },
      { type: 'invalid_type', question: 'Soal salah', a: '', b: '', c: '', d: '', e: '', answer: 'A' },
      { type: 'tf', question: '', a: '', b: '', c: '', d: '', e: '', answer: 'B' },
      { type: 'tf', question: 'Soal tf salah answer', a: '', b: '', c: '', d: '', e: '', answer: 'Z' },
    ]
    const buf = generateXlsxBuffer('Soal', rows)
    const { errors } = parseQuestionsXlsx(buf)

    expect(errors).toEqual([
      'Baris 2: opsi harus diisi berurutan mulai dari a (minimal 2)',
      'Baris 3: answer harus huruf opsi yang terisi (A-B)',
      'Baris 4: type harus mc/pg atau tf/bs',
      'Baris 5: question kosong',
      'Baris 6: answer untuk tf harus B (benar) atau S (salah)',
    ])
  })

  it('handles corrupt buffer and empty sheets gracefully', () => {
    const corrupt = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])
    const resultCorrupt = parseQuestionsXlsx(corrupt)
    expect(resultCorrupt.questions).toEqual([])
    expect(resultCorrupt.errors.length).toBeGreaterThan(0)

    const emptyWb = XLSX.utils.book_new()
    const emptyWs = XLSX.utils.aoa_to_sheet([])
    XLSX.utils.book_append_sheet(emptyWb, emptyWs, 'Empty')
    const emptyBuf = new Uint8Array(XLSX.write(emptyWb, { type: 'buffer', bookType: 'xlsx' }))
    const resultEmpty = parseQuestionsXlsx(emptyBuf)
    expect(resultEmpty.questions).toEqual([])
    expect(resultEmpty.errors).toEqual([])
  })
  it('correctly reads template public/contoh-soal.xlsx round-trip', () => {
    const fileBytes = new Uint8Array(readFileSync('public/contoh-soal.xlsx'))
    const { questions, errors } = parseQuestionsXlsx(fileBytes)

    expect(errors).toEqual([])
    expect(questions.length).toBe(4)
    expect(questions[0]).toMatchObject({
      type: 'mc',
      text: 'Apa kepanjangan dari KSR?',
      options: ['Korps Sukarela', 'Kelompok Siaga Relawan', 'Komunitas Sosial Remaja', 'Korps Siaga Rakyat'],
      answer_index: 0,
    })
    expect(questions[2]).toMatchObject({
      type: 'tf',
      text: 'Pada luka bakar ringan, bagian yang terbakar didinginkan dengan air mengalir.',
      options: ['Benar', 'Salah'],
      answer_index: 0,
    })
    expect(questions[3]).toMatchObject({
      type: 'tf',
      text: 'Tourniquet adalah pilihan pertama untuk semua jenis perdarahan.',
      options: ['Benar', 'Salah'],
      answer_index: 1,
    })
  })
})
