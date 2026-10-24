import { describe, expect, it } from 'bun:test'
import { DEFAULT_SURVEY_QUESTIONS, type SurveyQuestion, validateSurveyAnswers } from './survey'

describe('lib/survey.ts', () => {
  it('validates default questions with valid answers', () => {
    const raw = {
      q_training: { value: 'ya', detail: 'Pelatihan PMR Madya di SMPN 1' },
      q_pmr: 'PMR Wira SMAN 1 Bandung',
    }
    const res = validateSurveyAnswers(DEFAULT_SURVEY_QUESTIONS, raw)
    expect(res.valid).toBe(true)
    if (res.valid) {
      expect(res.data.q_pmr).toBe('PMR Wira SMAN 1 Bandung')
      expect(res.data.q_training).toEqual({ value: 'ya', detail: 'Pelatihan PMR Madya di SMPN 1' })
    }
  })

  it('rejects missing detail if yes_no_detail has choice "ya" and required', () => {
    const raw = {
      q_training: { value: 'ya', detail: '   ' },
      q_pmr: 'Bukan PMR',
    }
    const res = validateSurveyAnswers(DEFAULT_SURVEY_QUESTIONS, raw)
    expect(res.valid).toBe(false)
    if (!res.valid) {
      expect(res.error).toContain('Mohon isi penjelasan')
    }
  })

  it('accepts empty detail if yes_no_detail has choice "tidak"', () => {
    const raw = {
      q_training: { value: 'tidak', detail: '' },
      q_pmr: 'Bukan PMR',
    }
    const res = validateSurveyAnswers(DEFAULT_SURVEY_QUESTIONS, raw)
    expect(res.valid).toBe(true)
  })

  it('validates simple yes_no question', () => {
    const qs: SurveyQuestion[] = [
      { id: 'q_simple', text: 'Paham?', type: 'yes_no', required: true },
    ]
    expect(validateSurveyAnswers(qs, { q_simple: 'ya' }).valid).toBe(true)
    expect(validateSurveyAnswers(qs, { q_simple: 'tidak' }).valid).toBe(true)
    expect(validateSurveyAnswers(qs, { q_simple: 'maybe' }).valid).toBe(false)
    expect(validateSurveyAnswers(qs, {}).valid).toBe(false)
  })

  it('rejects invalid top-level format', () => {
    expect(validateSurveyAnswers(DEFAULT_SURVEY_QUESTIONS, null).valid).toBe(false)
    expect(validateSurveyAnswers(DEFAULT_SURVEY_QUESTIONS, 'string').valid).toBe(false)
    expect(validateSurveyAnswers(DEFAULT_SURVEY_QUESTIONS, []).valid).toBe(false)
  })
})
