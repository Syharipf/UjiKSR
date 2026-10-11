'use client'

import { useState } from 'react'
import SubmitButton from '@/app/submit-button'
import { formatDate, type Session, type TimerMode } from '@/lib/exam'

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
  const pairs = preSessions.filter((p) => p.id !== session?.id)
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
      {kind === 'post' && (
        <label className="grid gap-1.5 sm:col-span-2">
          Link Feedback (Google Form / Kuisioner)
          <input
            type="url"
            name="feedback_url"
            defaultValue={session?.feedback_url ?? ''}
            placeholder="https://forms.gle/... atau https://docs.google.com/forms/..."
            className={input}
          />
          <span className="text-xs font-normal text-muted">
            Opsional. Ditampilkan ke peserta setelah selesai post-test dan tersedia tayangan QR layar proyektor untuk panitia.
          </span>
        </label>
      )}
      <label className="grid gap-1.5">
        Batas pelanggaran (auto-submit)
        <input type="number" name="max_violations" min={1} max={20} required defaultValue={session?.max_violations ?? 3} className={input} />
      </label>
      <div className="flex items-end">
        <SubmitButton className="btn btn-primary w-full">{submitLabel}</SubmitButton>
      </div>
    </form>
  )
}
