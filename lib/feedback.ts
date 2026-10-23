export interface FeedbackPayload {
  materi: string
  rating_overall: number
  rating_understanding: number
  rating_room: number
  note_speaker: string
  note_material: string
  note_practice: string
  note_room: string
  note_next: string
}

export interface FeedbackRow {
  id: string
  attempt_id: string
  session_id: string
  materi: string
  rating_overall: number
  rating_understanding: number
  rating_room: number | null
  note_speaker: string | null
  note_material: string | null
  note_practice: string | null
  note_room: string | null
  note_next: string | null
  created_at: string
}

export interface FeedbackWithParticipant extends FeedbackRow {
  name: string
  nim: string
  prodi: string
  score: number | null
}

export interface GoogleSheetsFeedbackPayload {
  timestamp: string
  session_title: string
  session_code: string
  name: string
  nim: string
  prodi: string
  score: number | string
  materi: string
  rating_overall: number
  rating_understanding: number
  rating_room: number | string
  note_speaker: string
  note_material: string
  note_practice: string
  note_room: string
  note_next: string
}

export function validateFeedbackPayload(input: unknown): { errors: Record<string, string>; data?: FeedbackPayload } {
  const errors: Record<string, string> = {}
  if (!input || typeof input !== 'object') {
    return { errors: { form: 'Data tidak valid' } }
  }

  const raw = input as Record<string, unknown>
  const materi = typeof raw.materi === 'string' ? raw.materi.trim() : ''
  if (!materi || materi.length < 1 || materi.length > 200) {
    errors.materi = 'Tulis materi yang disampaikan hari ini (maks. 200 karakter).'
  }

  const ratingOverall = Number(raw.rating_overall)
  if (!Number.isInteger(ratingOverall) || ratingOverall < 1 || ratingOverall > 5) {
    errors.rating_overall = 'Pilih salah satu nilai (1–5).'
  }

  const ratingUnderstanding = Number(raw.rating_understanding)
  if (!Number.isInteger(ratingUnderstanding) || ratingUnderstanding < 1 || ratingUnderstanding > 5) {
    errors.rating_understanding = 'Pilih salah satu nilai (1–5).'
  }

  const ratingRoom = Number(raw.rating_room)
  if (!Number.isInteger(ratingRoom) || ratingRoom < 1 || ratingRoom > 5) {
    errors.rating_room = 'Pilih salah satu nilai ruangan (1–5).'
  }

  const cleanRequiredText = (val: unknown, key: string, requiredMsg: string): string => {
    if (typeof val !== 'string') {
      errors[key] = requiredMsg
      return ''
    }
    const trimmed = val.trim()
    if (!trimmed) {
      errors[key] = requiredMsg
      return ''
    }
    if (trimmed.length > 2000) {
      errors[key] = 'Teks maksimal 2000 karakter.'
    }
    return trimmed
  }

  const noteSpeaker = cleanRequiredText(raw.note_speaker, 'note_speaker', 'Tulis masukan dan saran untuk pemateri.')
  const noteMaterial = cleanRequiredText(raw.note_material, 'note_material', 'Tulis kritik dan saran mengenai materi.')
  const notePractice = cleanRequiredText(raw.note_practice, 'note_practice', 'Tulis masukan terkait penjelasan praktik.')
  const noteRoom = cleanRequiredText(raw.note_room, 'note_room', 'Tulis saran terkait ruangan yang digunakan.')
  const noteNext = cleanRequiredText(raw.note_next, 'note_next', 'Tulis saran untuk perbaikan pertemuan selanjutnya.')

  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  return {
    errors: {},
    data: {
      materi,
      rating_overall: ratingOverall,
      rating_understanding: ratingUnderstanding,
      rating_room: ratingRoom,
      note_speaker: noteSpeaker,
      note_material: noteMaterial,
      note_practice: notePractice,
      note_room: noteRoom,
      note_next: noteNext,
    },
  }
}
