export type SurveyQuestionType = 'yes_no_detail' | 'text' | 'yes_no'

export interface SurveyQuestion {
  id: string
  text: string
  type: SurveyQuestionType
  detail_label?: string
  placeholder?: string
  required?: boolean
}

export interface SurveyAnswerValue {
  value: string
  detail?: string
}

export const DEFAULT_SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'q_training',
    text: 'Apakah pernah mengikuti pelatihan terkait materi ini sebelumnya?',
    type: 'yes_no_detail',
    detail_label: 'Kalau iya, apa dan di mana?',
    required: true,
  },
  {
    id: 'q_pmr',
    text: 'Apakah kamu sebelumnya anggota PMR?',
    type: 'text',
    placeholder: 'Contoh: Bukan PMR / PMR Wira SMAN 1 Bandung',
    required: true,
  },
]

export function validateSurveyAnswers(
  questions: SurveyQuestion[],
  rawAnswers: unknown,
): { valid: true; data: Record<string, string | SurveyAnswerValue> } | { valid: false; error: string } {
  if (!rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) {
    return { valid: false, error: 'Format data survei tidak valid' }
  }

  const input = rawAnswers as Record<string, unknown>
  const cleaned: Record<string, string | SurveyAnswerValue> = {}

  for (const q of questions) {
    const val = input[q.id]

    if (q.type === 'yes_no') {
      if (typeof val !== 'string' || !['ya', 'tidak'].includes(val.toLowerCase())) {
        if (q.required) return { valid: false, error: `Pertanyaan "${q.text}" wajib dijawab (Ya / Tidak)` }
      } else {
        cleaned[q.id] = val.toLowerCase()
      }
    } else if (q.type === 'yes_no_detail') {
      if (!val || typeof val !== 'object' || Array.isArray(val)) {
        if (q.required) return { valid: false, error: `Pertanyaan "${q.text}" wajib dijawab` }
      } else {
        const obj = val as Record<string, unknown>
        const choice = typeof obj.value === 'string' ? obj.value.toLowerCase() : ''
        if (!['ya', 'tidak'].includes(choice)) {
          if (q.required) return { valid: false, error: `Pertanyaan "${q.text}" wajib dipilih Ya atau Tidak` }
        } else {
          const detail = typeof obj.detail === 'string' ? obj.detail.trim().slice(0, 500) : ''
          if (choice === 'ya' && q.required && !detail) {
            return { valid: false, error: `Mohon isi penjelasan untuk pertanyaan "${q.text}"` }
          }
          cleaned[q.id] = { value: choice, detail }
        }
      }
    } else {
      // 'text'
      const str = typeof val === 'string' ? val.trim().slice(0, 500) : ''
      if (q.required && !str) {
        return { valid: false, error: `Pertanyaan "${q.text}" wajib diisi` }
      }
      cleaned[q.id] = str
    }
  }

  return { valid: true, data: cleaned }
}
