// Head-pose rule for the exam camera, fed by MediaPipe FaceLandmarker's 478 landmarks
// (normalized image coordinates). 1 = nose tip, 234 / 454 = the face's outer edges at the cheeks.
type Point = { x: number; y: number }

// Where the nose sits between the two face edges: 0.5 facing the phone, toward 0 or 1 as the head turns.
// Measured on photos: frontal 0.52, a slight three-quarter turn 0.35/0.63, ~35° of yaw −0.03.
// 0.15 off centre catches a turn toward a book beside the phone; reading the screen stays near 0.5.
export const TURN_OFFSET = 0.15

export type FaceState = 'ok' | 'turned' | 'missing'

export function faceState(faces: Point[][]): FaceState {
  const lm = faces[0]
  if (!lm || lm.length < 455) return 'missing'
  const left = lm[234].x
  const width = lm[454].x - left
  if (width === 0) return 'turned'
  return Math.abs((lm[1].x - left) / width - 0.5) > TURN_OFFSET ? 'turned' : 'ok'
}
