import { expect, test } from 'bun:test'
import { faceState } from './face'

const face = (noseX: number) => ({ keypoints: [{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: noseX, y: 0.5 }] })

test('faceState', () => {
  expect(faceState([])).toBe('missing')
  expect(faceState([face(0.5)])).toBe('ok')
  expect(faceState([face(0.54)])).toBe('ok') // slight tilt, 0.2 eye distances
  expect(faceState([face(0.56)])).toBe('turned') // 0.3 eye distances to the left eye side
  expect(faceState([face(0.43)])).toBe('turned') // mirrored
})
