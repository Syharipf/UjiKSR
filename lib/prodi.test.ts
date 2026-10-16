import { expect, test } from 'bun:test'
import { normalizeProdi } from './prodi'

test('prodi gets one spelling: degree first, Title Case, acronyms kept', () => {
  expect(normalizeProdi('S1 TEKNIK LOGISTIK')).toBe('S1 Teknik Logistik')
  expect(normalizeProdi('S1. TEKNIK LOGISTIK')).toBe('S1 Teknik Logistik')
  expect(normalizeProdi('s1 ilmu komunikasi')).toBe('S1 Ilmu Komunikasi')
  expect(normalizeProdi('S1 DiGITAL PUBLIC RELATIONS')).toBe('S1 Digital Public Relations')
  expect(normalizeProdi('Psikologi S1')).toBe('S1 Psikologi')
  expect(normalizeProdi(' S1  IT ')).toBe('S1 IT')
  expect(normalizeProdi('S1 MBTI')).toBe('S1 MBTI')
  expect(normalizeProdi('d3 sistem informasi dan akuntansi')).toBe('D3 Sistem Informasi dan Akuntansi')
})
