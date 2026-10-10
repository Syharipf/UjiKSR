import { expect, test } from 'bun:test'
import { isValidNim } from './nim'

test('NIM accepts digits only', () => {
  expect(isValidNim('1301223002')).toBe(true)
  expect(isValidNim('1001')).toBe(true)
  expect(isValidNim('')).toBe(false)
  expect(isValidNim('13012 23002')).toBe(false)
  expect(isValidNim('A1301223002')).toBe(false)
  expect(isValidNim('1'.repeat(21))).toBe(false)
})
