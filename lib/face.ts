// Head-pose rule for the exam camera, fed by MediaPipe's BlazeFace keypoints
// (0 right eye, 1 left eye, 2 nose tip, … in normalized image coordinates).
type Point = { x: number; y: number }

// How far the nose sits off the eye midpoint, in eye distances. Facing the phone ≈ 0;
// it grows with tan(yaw): ~0.23 at 30°, ~0.39 at 45°.
export const TURN_RATIO = 0.25

export type FaceState = 'ok' | 'turned' | 'missing'

export function faceState(faces: { keypoints: Point[] }[]): FaceState {
  const kp = faces[0]?.keypoints
  if (!kp || kp.length < 3) return 'missing'
  const [r, l, nose] = kp
  const eyes = Math.abs(l.x - r.x)
  if (eyes === 0) return 'turned'
  return Math.abs(nose.x - (l.x + r.x) / 2) / eyes > TURN_RATIO ? 'turned' : 'ok'
}
