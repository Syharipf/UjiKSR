// Every violation type use-anti-cheat.ts and the exam page report, with its admin log label.
// The violation API rejects anything not listed here.
export const VIOLATION_LABELS: Readonly<Record<string, string>> = {
  hidden: 'pindah aplikasi/tab',
  blur: 'hilang fokus',
  fullscreen_exit: 'keluar layar penuh',
  resize: 'layar mengecil (split screen)',
  reopen: 'membuka ulang ujian',
  edge_swipe: 'geser tepi layar (navbar/notifikasi)',
  multi_touch: 'sentuhan 3 jari (screenshot)',
  face_turned: 'menoleh dari layar (kamera)',
  face_missing: 'wajah tidak terlihat (kamera)',
  no_camera: 'kamera tidak aktif (catatan, tidak dihitung)',
}

// Logged for the committee but not counted toward max_violations.
export const NOTE_TYPES: Readonly<Record<string, true>> = { no_camera: true }

export const VIOLATION_TYPES: Readonly<Record<string, true>> = {
  hidden: true,
  blur: true,
  fullscreen_exit: true,
  resize: true,
  reopen: true,
  edge_swipe: true,
  multi_touch: true,
  face_turned: true,
  face_missing: true,
  no_camera: true,
}
