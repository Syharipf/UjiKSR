'use client'

import { useState } from 'react'
import type { SurveyAnswerValue, SurveyQuestion } from '@/lib/survey'

export function SurveyModal({
  attemptId,
  questions,
  onSubmitted,
}: {
  attemptId: string
  questions: SurveyQuestion[]
  onSubmitted: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, string | SurveyAnswerValue>>(() => {
    const init: Record<string, string | SurveyAnswerValue> = {}
    for (const q of questions) {
      if (q.type === 'yes_no_detail') {
        init[q.id] = { value: '', detail: '' }
      } else {
        init[q.id] = ''
      }
    }
    return init
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch(`/api/attempts/${attemptId}/survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim survei')
      }
      onSubmitted()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat mengirim jawaban survei'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl">

        {error && (
          <div className="mb-4 rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {questions.map((q, idx) => {
            const val = answers[q.id]

            if (q.type === 'yes_no_detail') {
              const currentVal = typeof val === 'object' && val !== null ? val : { value: '', detail: '' }
              const isYes = currentVal.value === 'ya'

              return (
                <div key={q.id} className="rounded-xl border border-line bg-surface/50 p-3.5 space-y-2.5">
                  <p className="text-sm font-semibold">
                    {idx + 1}. {q.text}
                    {q.required && <span className="text-danger ml-1">*</span>}
                  </p>

                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name={`q_${q.id}`}
                        value="ya"
                        checked={currentVal.value === 'ya'}
                        onChange={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: { value: 'ya', detail: currentVal.detail || '' },
                          }))
                        }
                        className="size-4 accent-primary"
                        required={q.required}
                      />
                      <span>Ya</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name={`q_${q.id}`}
                        value="tidak"
                        checked={currentVal.value === 'tidak'}
                        onChange={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: { value: 'tidak', detail: '' },
                          }))
                        }
                        className="size-4 accent-primary"
                        required={q.required}
                      />
                      <span>Tidak</span>
                    </label>
                  </div>

                  {isYes && (
                    <div className="pt-1">
                      <label className="block text-xs text-muted mb-1 font-medium">
                        {q.detail_label || 'Jelaskan secara singkat:'}
                        {q.required && <span className="text-danger ml-0.5">*</span>}
                      </label>
                      <input
                        type="text"
                        value={currentVal.detail || ''}
                        required={q.required}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: { value: 'ya', detail: e.target.value },
                          }))
                        }
                        placeholder={q.placeholder || 'Tuliskan penjelasan singkat...'}
                        className="field w-full text-sm"
                      />
                    </div>
                  )}
                </div>
              )
            }

            if (q.type === 'yes_no') {
              const currentVal = typeof val === 'string' ? val : ''

              return (
                <div key={q.id} className="rounded-xl border border-line bg-surface/50 p-3.5 space-y-2">
                  <p className="text-sm font-semibold">
                    {idx + 1}. {q.text}
                    {q.required && <span className="text-danger ml-1">*</span>}
                  </p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name={`q_${q.id}`}
                        value="ya"
                        checked={currentVal === 'ya'}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: 'ya' }))}
                        className="size-4 accent-primary"
                        required={q.required}
                      />
                      <span>Ya</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name={`q_${q.id}`}
                        value="tidak"
                        checked={currentVal === 'tidak'}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: 'tidak' }))}
                        className="size-4 accent-primary"
                        required={q.required}
                      />
                      <span>Tidak</span>
                    </label>
                  </div>
                </div>
              )
            }

            // 'text'
            const currentVal = typeof val === 'string' ? val : ''
            return (
              <div key={q.id} className="rounded-xl border border-line bg-surface/50 p-3.5 space-y-1.5">
                <label className="block text-sm font-semibold">
                  {idx + 1}. {q.text}
                  {q.required && <span className="text-danger ml-1">*</span>}
                </label>
                <input
                  type="text"
                  value={currentVal}
                  required={q.required}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder={q.placeholder || 'Tulis jawabanmu di sini...'}
                  className="field w-full text-sm"
                />
              </div>
            )
          })}

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-full py-2.5 text-sm font-bold shadow-md"
            >
              {submitting ? 'Menyimpan…' : 'Simpan & Lanjutkan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
