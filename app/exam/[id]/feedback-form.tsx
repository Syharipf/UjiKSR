'use client'

import { useState } from 'react'

function ScaleInput({
  value,
  onChange,
  leftLabel,
  rightLabel,
  name,
  error,
}: Readonly<{
  value: number | null
  onChange: (val: number) => void
  leftLabel: string
  rightLabel: string
  name?: string
  error?: string
}>) {
  return (
    <div className="space-y-2">
      <div data-scale-name={name} className="flex items-center justify-between gap-1 sm:gap-2">
        {[1, 2, 3, 4, 5].map((val) => {
          const selected = value === val
          return (
            <button
              key={val}
              type="button"
              onClick={() => onChange(val)}
              className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all cursor-pointer border ${
                selected
                  ? 'border-primary bg-primary text-white shadow-xs'
                  : 'border-line bg-surface text-secondary hover:bg-subtle hover:text-fg'
              } ${error ? 'border-danger/70' : ''}`}
            >
              {val}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-[0.75rem] text-muted px-0.5">
        <span>1: {leftLabel}</span>
        <span>5: {rightLabel}</span>
      </div>
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  )
}

export default function ParticipantFeedbackForm({
  attemptId,
  initialSubmitted = false,
  onSuccess,
}: Readonly<{
  attemptId: string
  initialSubmitted?: boolean
  onSuccess?: () => void
}>) {
  const [materi, setMateri] = useState('')
  const [ratingOverall, setRatingOverall] = useState<number | null>(null)
  const [ratingUnderstanding, setRatingUnderstanding] = useState<number | null>(null)
  const [ratingRoom, setRatingRoom] = useState<number | null>(null)

  const [noteSpeaker, setNoteSpeaker] = useState('')
  const [noteMaterial, setNoteMaterial] = useState('')
  const [notePractice, setNotePractice] = useState('')
  const [noteRoom, setNoteRoom] = useState('')
  const [noteNext, setNoteNext] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(initialSubmitted)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError('')

    // Client validation matching SPEK-FEEDBACK
    const validationErrors: Record<string, string> = {}
    if (!materi.trim()) {
      validationErrors.materi = 'Tulis materi yang disampaikan hari ini.'
    }
    if (!ratingOverall) {
      validationErrors.rating_overall = 'Pilih salah satu nilai.'
    }
    if (!ratingUnderstanding) {
      validationErrors.rating_understanding = 'Pilih salah satu nilai.'
    }
    if (!ratingRoom) {
      validationErrors.rating_room = 'Pilih salah satu nilai ruangan.'
    }
    if (!noteSpeaker.trim()) {
      validationErrors.note_speaker = 'Tulis masukan dan saran untuk pemateri.'
    }
    if (!noteMaterial.trim()) {
      validationErrors.note_material = 'Tulis kritik dan saran mengenai materi.'
    }
    if (!notePractice.trim()) {
      validationErrors.note_practice = 'Tulis masukan terkait penjelasan praktik.'
    }
    if (!noteRoom.trim()) {
      validationErrors.note_room = 'Tulis saran terkait ruangan yang digunakan.'
    }
    if (!noteNext.trim()) {
      validationErrors.note_next = 'Tulis saran untuk perbaikan pertemuan selanjutnya.'
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      const count = Object.keys(validationErrors).length
      setGeneralError(`${count} pertanyaan wajib belum diisi. Lihat tanda merah di atas.`)
      return
    }

    setErrors({})
    setSubmitting(true)

    try {
      const res = await fetch(`/api/attempts/${attemptId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materi: materi.trim(),
          rating_overall: ratingOverall,
          rating_understanding: ratingUnderstanding,
          rating_room: ratingRoom,
          note_speaker: noteSpeaker.trim(),
          note_material: noteMaterial.trim(),
          note_practice: notePractice.trim(),
          note_room: noteRoom.trim(),
          note_next: noteNext.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim feedback')
      }

      setSubmitted(true)
      onSuccess?.()
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Terjadi kesalahan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="card space-y-3 border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="display text-xl font-bold text-fg">Feedback terkirim!</h3>
        <p className="text-sm text-secondary max-w-sm mx-auto">
          Terima kasih atas partisipasi dan penilaianmu. Masukan ini sangat berharga untuk peningkatan mutu pertemuan berikutnya.
        </p>
      </div>
    )
  }

  return (
    <section aria-labelledby="feedback-form-title" className="card space-y-6 p-5 sm:p-6 border border-line">
      <div className="space-y-1">
        <h2 id="feedback-form-title" className="display text-xl font-bold text-fg">
          Feedback &amp; Evaluasi Kegiatan
        </h2>
        <p className="text-xs text-muted">
          Bantu kami mengevaluasi pertemuan hari ini. Jawabanmu tercatat bersama data diri peserta untuk panitia.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* 01. Materi hari ini (Wajib) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-fg">
            01. Materi apa yang disampaikan hari ini? <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={200}
            value={materi}
            onChange={(e) => {
              setMateri(e.target.value)
              if (errors.materi) setErrors((prev) => ({ ...prev, materi: '' }))
            }}
            placeholder="Tuliskan nama materi/topik yang disampaikan..."
            className={`field w-full text-sm font-normal ${errors.materi ? 'border-danger' : ''}`}
          />
          {errors.materi && <p className="text-xs font-semibold text-danger">{errors.materi}</p>}
        </div>

        {/* 02. Penilaian keseluruhan (Wajib, 1-5) */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-fg">
            02. Penilaian keseluruhan pertemuan hari ini <span className="text-danger">*</span>
          </label>
          <ScaleInput
            name="overall"
            value={ratingOverall}
            onChange={(val) => {
              setRatingOverall(val)
              if (errors.rating_overall) setErrors((prev) => ({ ...prev, rating_overall: '' }))
            }}
            leftLabel="Sangat buruk"
            rightLabel="Sangat baik"
            error={errors.rating_overall}
          />
        </div>

        {/* 03. Pemahaman materi (Wajib, 1-5) */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-fg">
            03. Apakah materi yang disampaikan dapat dipahami dengan baik? <span className="text-danger">*</span>
          </label>
          <ScaleInput
            name="understanding"
            value={ratingUnderstanding}
            onChange={(val) => {
              setRatingUnderstanding(val)
              if (errors.rating_understanding) setErrors((prev) => ({ ...prev, rating_understanding: '' }))
            }}
            leftLabel="Tidak paham"
            rightLabel="Sangat paham"
            error={errors.rating_understanding}
          />
        </div>

        {/* 04. Penilaian ruangan (Wajib, 1-5) */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-fg">
            04. Penilaian ruangan yang digunakan <span className="text-danger">*</span>
          </label>
          <ScaleInput
            name="room"
            value={ratingRoom}
            onChange={(val) => {
              setRatingRoom(val)
              if (errors.rating_room) setErrors((prev) => ({ ...prev, rating_room: '' }))
            }}
            leftLabel="Sangat buruk"
            rightLabel="Sangat baik"
            error={errors.rating_room}
          />
        </div>

        {/* 05. Masukan untuk pemateri (Wajib) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-fg">
            05. Masukan dan saran untuk pemateri <span className="text-danger">*</span>
          </label>
          <textarea
            required
            value={noteSpeaker}
            onChange={(e) => {
              setNoteSpeaker(e.target.value)
              if (errors.note_speaker) setErrors((prev) => ({ ...prev, note_speaker: '' }))
            }}
            rows={2}
            maxLength={2000}
            placeholder="Saran cara penyampaian, tempo, interaksi..."
            className={`field w-full text-sm font-normal ${errors.note_speaker ? 'border-danger' : ''}`}
          />
          {errors.note_speaker && <p className="text-xs font-semibold text-danger">{errors.note_speaker}</p>}
        </div>

        {/* 06. Kritik/saran mengenai materi (Wajib) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-fg">
            06. Kritik dan saran mengenai materi <span className="text-danger">*</span>
          </label>
          <textarea
            required
            value={noteMaterial}
            onChange={(e) => {
              setNoteMaterial(e.target.value)
              if (errors.note_material) setErrors((prev) => ({ ...prev, note_material: '' }))
            }}
            rows={2}
            maxLength={2000}
            placeholder="Kelengkapan slide, kejelasan modul..."
            className={`field w-full text-sm font-normal ${errors.note_material ? 'border-danger' : ''}`}
          />
          {errors.note_material && <p className="text-xs font-semibold text-danger">{errors.note_material}</p>}
        </div>

        {/* 07. Penjelasan saat praktik (Wajib) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-fg">
            07. Apakah penjelasan saat praktik sudah jelas? (jika ada praktik) <span className="text-danger">*</span>
          </label>
          <textarea
            required
            value={notePractice}
            onChange={(e) => {
              setNotePractice(e.target.value)
              if (errors.note_practice) setErrors((prev) => ({ ...prev, note_practice: '' }))
            }}
            rows={2}
            maxLength={2000}
            placeholder="Penjelasan peragaan, pendampingan saat praktik..."
            className={`field w-full text-sm font-normal ${errors.note_practice ? 'border-danger' : ''}`}
          />
          {errors.note_practice && <p className="text-xs font-semibold text-danger">{errors.note_practice}</p>}
        </div>

        {/* 08. Saran terkait ruangan (Wajib) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-fg">
            08. Saran terkait ruangan yang digunakan <span className="text-danger">*</span>
          </label>
          <textarea
            required
            value={noteRoom}
            onChange={(e) => {
              setNoteRoom(e.target.value)
              if (errors.note_room) setErrors((prev) => ({ ...prev, note_room: '' }))
            }}
            rows={2}
            maxLength={2000}
            placeholder="Suhu AC, pencahayaan, proyektor, kebersihan..."
            className={`field w-full text-sm font-normal ${errors.note_room ? 'border-danger' : ''}`}
          />
          {errors.note_room && <p className="text-xs font-semibold text-danger">{errors.note_room}</p>}
        </div>

        {/* 09. Saran perbaikan pertemuan selanjutnya (Wajib) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-fg">
            09. Saran untuk perbaikan pertemuan selanjutnya <span className="text-danger">*</span>
          </label>
          <textarea
            required
            value={noteNext}
            onChange={(e) => {
              setNoteNext(e.target.value)
              if (errors.note_next) setErrors((prev) => ({ ...prev, note_next: '' }))
            }}
            rows={2}
            maxLength={2000}
            placeholder="Hal yang perlu ditingkatkan di kegiatan berikutnya..."
            className={`field w-full text-sm font-normal ${errors.note_next ? 'border-danger' : ''}`}
          />
          {errors.note_next && <p className="text-xs font-semibold text-danger">{errors.note_next}</p>}
        </div>
        {/* Validation note & Submit button */}
        <div className="space-y-2 pt-2 border-t border-line">
          {generalError && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs font-semibold text-danger text-center">
              {generalError}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary h-12 w-full text-base font-semibold cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Mengirim feedback…' : 'Kirim feedback'}
          </button>
        </div>
      </form>
    </section>
  )
}
