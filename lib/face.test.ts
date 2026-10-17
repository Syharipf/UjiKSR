import { expect, test } from 'bun:test'
import { faceState } from './face'

// A face spanning x 0.3–0.7 with the nose at noseX.
const face = (noseX: number) => {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
  lm[234] = { x: 0.3, y: 0.5 }
  lm[454] = { x: 0.7, y: 0.5 }
  lm[1] = { x: noseX, y: 0.5 }
  return lm
}

test('faceState', () => {
  expect(faceState([])).toBe('missing')
  expect(faceState([face(0.5)])).toBe('ok')
  expect(faceState([face(0.55)])).toBe('ok') // 0.125 off centre: small head movement
  expect(faceState([face(0.57)])).toBe('turned') // 0.175 off centre
  expect(faceState([face(0.43)])).toBe('turned') // other side
})
