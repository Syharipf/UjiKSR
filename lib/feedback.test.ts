import { describe, expect, it } from 'bun:test'
import { validateFeedbackPayload } from './feedback'

const validPayload = {
  materi: 'Pertolongan Pertama',
  rating_overall: 5,
  rating_understanding: 4,
  rating_room: 4,
  note_speaker: 'Sangat komunikatif dan jelas.',
  note_material: 'Slide lengkap dan mudah dipahami.',
  note_practice: 'Praktik balut bidai sangat membantu.',
  note_room: 'Ruangan nyaman dan ber-AC.',
  note_next: 'Waktu praktik bisa ditambah lagi.',
}

describe('validateFeedbackPayload', () => {
  it('returns validated clean data when all 9 fields are valid', () => {
    const result = validateFeedbackPayload(validPayload)
    expect(result.errors).toEqual({})
    expect(result.data).toEqual(validPayload)
  })

  it('rejects invalid or non-object input', () => {
    expect(validateFeedbackPayload(null).errors.form).toBeDefined()
    expect(validateFeedbackPayload(undefined).errors.form).toBeDefined()
    expect(validateFeedbackPayload('invalid').errors.form).toBeDefined()
  })

  it('rejects missing or empty required text fields', () => {
    const emptyPayload = {
      materi: '   ',
      rating_overall: 5,
      rating_understanding: 5,
      rating_room: 5,
      note_speaker: '   ',
      note_material: '',
      note_practice: ' ',
      note_room: '',
      note_next: '  ',
    }
    const result = validateFeedbackPayload(emptyPayload)
    expect(result.data).toBeUndefined()
    expect(result.errors.materi).toBeDefined()
    expect(result.errors.note_speaker).toBe('Tulis masukan dan saran untuk pemateri.')
    expect(result.errors.note_material).toBe('Tulis kritik dan saran mengenai materi.')
    expect(result.errors.note_practice).toBe('Tulis masukan terkait penjelasan praktik.')
    expect(result.errors.note_room).toBe('Tulis saran terkait ruangan yang digunakan.')
    expect(result.errors.note_next).toBe('Tulis saran untuk perbaikan pertemuan selanjutnya.')
  })

  it('rejects missing rating_room and out-of-range rating_room', () => {
    const missingRoom = validateFeedbackPayload({ ...validPayload, rating_room: undefined })
    expect(missingRoom.errors.rating_room).toBe('Pilih salah satu nilai ruangan (1–5).')

    const outOfRangeLow = validateFeedbackPayload({ ...validPayload, rating_room: 0 })
    expect(outOfRangeLow.errors.rating_room).toBe('Pilih salah satu nilai ruangan (1–5).')

    const outOfRangeHigh = validateFeedbackPayload({ ...validPayload, rating_room: 6 })
    expect(outOfRangeHigh.errors.rating_room).toBe('Pilih salah satu nilai ruangan (1–5).')

    const nonInteger = validateFeedbackPayload({ ...validPayload, rating_room: 4.5 })
    expect(nonInteger.errors.rating_room).toBe('Pilih salah satu nilai ruangan (1–5).')
  })

  it('rejects text fields exceeding 2000 characters', () => {
    const longText = 'a'.repeat(2001)
    const result = validateFeedbackPayload({
      ...validPayload,
      note_speaker: longText,
    })
    expect(result.errors.note_speaker).toBe('Teks maksimal 2000 karakter.')
  })

  it('trims whitespace on text fields', () => {
    const untrimmed = {
      ...validPayload,
      materi: '  Pertolongan Pertama  ',
      note_speaker: '  Bagus sekali  ',
    }
    const result = validateFeedbackPayload(untrimmed)
    expect(result.errors).toEqual({})
    expect(result.data?.materi).toBe('Pertolongan Pertama')
    expect(result.data?.note_speaker).toBe('Bagus sekali')
  })
})
