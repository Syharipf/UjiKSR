'use client'

import { useState } from 'react'
import SubmitButton from '@/app/submit-button'
import { formatDate, type Session, type TimerMode } from '@/lib/exam'
import { DEFAULT_SURVEY_QUESTIONS, type SurveyQuestion, type SurveyQuestionType } from '@/lib/survey'

const input = 'field font-normal'

export type PreOption = Pick<Session, 'id' | 'title' | 'held_on' | 'code'>

export default function SessionForm({
  action,
  session,
  submitLabel,
  preSessions = [],
}: {
  action: (formData: FormData) => Promise<void>
  session?: Session
  submitLabel: string
  preSessions?: PreOption[] // pre-tests a post-test can be paired with
}) {
  // Only the chosen mode's time can be filled. A disabled field isn't submitted, so the server
  // keeps its stored (or default) value.
  const initialMode = session?.timer_mode ?? 'per_question'
  const [mode, setMode] = useState<TimerMode>(initialMode)
  const initialKind = session?.kind ?? 'pre'
  const [kind, setKind] = useState(initialKind)
  const [autoSubmit, setAutoSubmit] = useState((session?.max_violations ?? 3) < 999)
  const pairs = preSessions.filter((p) => p.id !== session?.id)
  const [surveyEnabled, setSurveyEnabled] = useState(session?.survey_enabled ?? false)
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>(
    session?.survey_questions && session.survey_questions.length > 0 ? session.survey_questions : DEFAULT_SURVEY_QUESTIONS,
  )
  return (
    <form
      action={action}
      onReset={() => {
        setMode(initialMode)
        setKind(initialKind)
      }} className="grid gap-4 text-sm font-semibold sm:grid-cols-2">
      <label className="grid gap-1.5 sm:col-span-2">
        Judul
        <input name="title" required maxLength={120} defaultValue={session?.title} placeholder="Pre-test Pertolongan Pertama" className={input} />
      </label>
      <label className="grid gap-1.5 sm:col-span-2">
        Tanggal sesi
        {/* sv-SE formats as YYYY-MM-DD, the value <input type="date"> expects */}
        <input
          type="date"
          name="held_on"
          required
          defaultValue={session?.held_on ?? new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })}
          className={input}
        />
      </label>
      <label className="grid gap-1.5">
        Jenis
        <select name="kind" defaultValue={initialKind} onChange={(e) => setKind(e.target.value as Session['kind'])} className={input}>
          <option value="pre">Pre-test</option>
          <option value="post">Post-test</option>
        </select>
      </label>
      <label className="grid gap-1.5">
        Mode timer
        <select name="timer_mode" defaultValue={initialMode} onChange={(e) => setMode(e.target.value as TimerMode)} className={input}>
          <option value="per_question">Per soal (tidak bisa kembali)</option>
          <option value="total">Total (bebas bolak-balik)</option>
        </select>
      </label>
      <label className={`grid gap-1.5 ${mode === 'total' ? '' : 'text-muted'}`}>
        Durasi total, menit (mode total)
        <input
          type="number"
          name="duration_min"
          min={1}
          max={600}
          required
          disabled={mode !== 'total'}
          defaultValue={session ? session.duration_sec / 60 : 30}
          className={input}
        />
      </label>
      <label className={`grid gap-1.5 ${mode === 'per_question' ? '' : 'text-muted'}`}>
        Waktu per soal, detik (mode per soal)
        <input
          type="number"
          name="per_question_sec"
          min={5}
          max={600}
          required
          disabled={mode !== 'per_question'}
          defaultValue={session?.per_question_sec ?? 45}
          className={input}
        />
      </label>
      {kind === 'post' && (
        <label className="grid gap-1.5 sm:col-span-2">
          Pasangan pre-test
          <select name="pre_session_id" defaultValue={session?.pre_session_id ?? ''} className={input}>
            <option value="">Tanpa pasangan</option>
            {pairs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({formatDate(p.held_on)}, {p.code})
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-muted">Peserta melihat kenaikan nilainya dibanding pre-test ini, dicocokkan lewat NIM.</span>
        </label>
      )}
      <div className="grid gap-2 sm:col-span-2">
        <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
          <input
            type="checkbox"
            checked={autoSubmit}
            onChange={(e) => setAutoSubmit(e.target.checked)}
            className="size-4 rounded accent-primary"
          />
          <span>Kumpulkan otomatis jika melebihi batas pelanggaran</span>
        </label>
        {autoSubmit ? (
          <label className="grid gap-1.5 sm:max-w-xs">
            <span className="text-xs text-muted">Batas pelanggaran (auto-submit)</span>
            <input
              type="number"
              name="max_violations"
              min={1}
              max={20}
              required
              defaultValue={session?.max_violations && session.max_violations < 999 ? session.max_violations : 3}
              className={input}
            />
          </label>
        ) : (
          <>
            <input type="hidden" name="max_violations" value="999" />
            <p className="text-xs text-muted">Hanya menampilkan peringatan dan mengunci layar sementara saat pelanggaran terjadi, tanpa pernah mengumpulkan jawaban secara otomatis.</p>
          </>
        )}
      </div>
      <label className="flex items-start gap-2 cursor-pointer text-sm font-semibold sm:col-span-2">
        <input type="checkbox" name="camera_check" defaultChecked={session?.camera_check ?? false} className="mt-0.5 size-4 rounded accent-primary" />
        <span>
          Pantau wajah lewat kamera depan
          <span className="block text-xs font-normal text-muted">
            Peringatan saat peserta menoleh atau wajahnya tidak terlihat. Diproses di HP peserta, tidak ada gambar yang dikirim. Peserta yang menolak izin kamera tetap bisa ujian (tercatat).
          </span>
        </span>
      </label>
      <div className="grid gap-3 sm:col-span-2 rounded-lg border border-border p-4 bg-surface/50">
        <label className="flex items-start gap-2 cursor-pointer text-sm font-semibold">
          <input
            type="checkbox"
            name="survey_enabled"
            checked={surveyEnabled}
            onChange={(e) => setSurveyEnabled(e.target.checked)}
            className="mt-0.5 size-4 rounded accent-primary"
          />
          <span>
            Aktifkan Survei Pengalaman Peserta Setelah Ujian
            <span className="block text-xs font-normal text-muted">
              Peserta mengisi survei singkat setelah menyelesaikan ujian sebelum diarahkan ke pengumuman nilai / feedback evaluasi.
            </span>
          </span>
        </label>

        {surveyEnabled && (
          <div className="mt-2 grid gap-3 border-t border-border pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted">Daftar Pertanyaan Survei ({surveyQuestions.length})</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSurveyQuestions(DEFAULT_SURVEY_QUESTIONS)}
                  className="btn btn-secondary text-xs px-2.5 py-1"
                >
                  Reset ke Template Pertolongan Pertama
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSurveyQuestions((prev) => [
                      ...prev,
                      {
                        id: `q_${Date.now().toString(36)}`,
                        text: '',
                        type: 'text',
                        required: true,
                      },
                    ])
                  }
                  className="btn btn-secondary text-xs px-2.5 py-1"
                >
                  + Tambah Pertanyaan
                </button>
              </div>
            </div>

            {/* Hidden serialized field for form submission */}
            <input type="hidden" name="survey_questions" value={JSON.stringify(surveyQuestions)} />

            <div className="grid gap-3">
              {surveyQuestions.map((q, idx) => (
                <div key={q.id || idx} className="rounded border border-border p-3 grid gap-2 bg-surface text-xs font-normal">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">Pertanyaan #{idx + 1}</span>
                    {surveyQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSurveyQuestions((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-danger hover:underline"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                  <label className="grid gap-1">
                    <span className="text-muted">Teks Pertanyaan:</span>
                    <input
                      type="text"
                      value={q.text}
                      required
                      onChange={(e) => {
                        const val = e.target.value
                        setSurveyQuestions((prev) => prev.map((item, i) => (i === idx ? { ...item, text: val } : item)))
                      }}
                      placeholder="Tuliskan pertanyaan survei..."
                      className={input}
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="grid gap-1">
                      <span className="text-muted">Tipe Jawaban:</span>
                      <select
                        value={q.type}
                        onChange={(e) => {
                          const type = e.target.value as SurveyQuestionType
                          setSurveyQuestions((prev) => prev.map((item, i) => (i === idx ? { ...item, type } : item)))
                        }}
                        className={input}
                      >
                        <option value="yes_no_detail">Ya / Tidak + Penjelasan</option>
                        <option value="text">Teks Bebas</option>
                        <option value="yes_no">Ya / Tidak Saja</option>
                      </select>
                    </label>
                    {q.type === 'yes_no_detail' && (
                      <label className="grid gap-1">
                        <span className="text-muted">Label Penjelasan (jika Ya):</span>
                        <input
                          type="text"
                          value={q.detail_label ?? ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setSurveyQuestions((prev) => prev.map((item, i) => (i === idx ? { ...item, detail_label: val } : item)))
                          }}
                          placeholder="Kalau iya, apa dan di mana?"
                          className={input}
                        />
                      </label>
                    )}
                    {q.type === 'text' && (
                      <label className="grid gap-1">
                        <span className="text-muted">Placeholder contoh:</span>
                        <input
                          type="text"
                          value={q.placeholder ?? ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setSurveyQuestions((prev) => prev.map((item, i) => (i === idx ? { ...item, placeholder: val } : item)))
                          }}
                          placeholder="Contoh: Bukan PMR / PMR Wira..."
                          className={input}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-end">
        <SubmitButton className="btn btn-primary w-full">{submitLabel}</SubmitButton>
      </div>
    </form>
  )
}
