export interface FeedbackPayload {
  materi: string
  rating_overall: number
  rating_understanding: number
  rating_room?: number | null
  note_speaker?: string | null
  note_material?: string | null
  note_practice?: string | null
  note_room?: string | null
  note_next?: string | null
}

export interface FeedbackRow extends FeedbackPayload {
  id: string
  attempt_id: string
  session_id: string
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

  let ratingRoom: number | null = null
  if (raw.rating_room !== undefined && raw.rating_room !== null && raw.rating_room !== '') {
    const num = Number(raw.rating_room)
    if (Number.isInteger(num) && num >= 1 && num <= 5) {
      ratingRoom = num
    } else {
      errors.rating_room = 'Nilai ruangan harus antara 1–5.'
    }
  }

  const cleanText = (val: unknown, key: string): string | null => {
    if (typeof val !== 'string') return null
    const trimmed = val.trim()
    if (!trimmed) return null
    if (trimmed.length > 2000) {
      errors[key] = 'Teks maksimal 2000 karakter.'
    }
    return trimmed
  }

  const noteSpeaker = cleanText(raw.note_speaker, 'note_speaker')
  const noteMaterial = cleanText(raw.note_material, 'note_material')
  const notePractice = cleanText(raw.note_practice, 'note_practice')
  const noteRoom = cleanText(raw.note_room, 'note_room')
  const noteNext = cleanText(raw.note_next, 'note_next')

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
