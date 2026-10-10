'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@/lib/exam'
import { PendingLabel } from '@/app/pending'
import Band from '@/app/band'
import Brand from '@/app/brand'
import { NIM_MAX, NIM_MIN, NIM_PATTERN } from '@/lib/nim'
import ThemeToggle from '@/app/theme-toggle'
import { enterFullscreen, exitFullscreen } from '@/lib/fullscreen'
import ResultLink from './result-link'

type Props = {
  session: Pick<Session, 'code' | 'title' | 'kind' | 'timer_mode' | 'duration_sec' | 'per_question_sec' | 'max_violations'>
  total: number
}

const noSubscribe = () => () => {}
function stored(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export default function JoinForm({ session, total }: Props) {
  const router = useRouter()
  const key = `attempt:${session.code}`
  const existing = useSyncExternalStore(noSubscribe, () => stored(key), () => null)
  // Set by the exam page after submitting: this phone already took this session, so no second attempt
  // (with another NIM) from it. It can only open its score.
  const finished = useSyncExternalStore(noSubscribe, () => stored(`result:${session.code}`), () => null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false) // stays true through the navigation to the exam
  const [resuming, startResume] = useTransition()

  function resume() {
    enterFullscreen()
    startResume(() => router.push(`/exam/${existing}`))
  }

  async function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    enterFullscreen() // must run inside the tap that submitted the form
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: session.code, name: form.get('name'), nim: form.get('nim'), prodi: form.get('prodi') }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Gagal memulai ujian')
      try {
        localStorage.setItem(key, body.id)
        sessionStorage.setItem(`fresh:${body.id}`, '1')
      } catch {}
      router.push(`/exam/${body.id}`)
    } catch (err) {
      exitFullscreen()
      setBusy(false)
      setError(err instanceof TypeError ? 'Koneksi bermasalah, coba lagi' : (err as Error).message)
    }
  }

  const perQuestion = session.timer_mode === 'per_question'
  const timeStat = perQuestion ? { value: session.per_question_sec, unit: 'detik per soal' } : { value: session.duration_sec / 60, unit: 'menit total' }

  return (
    <div className="min-h-dvh">
      <Band>
        <div className="flex items-center justify-between gap-3">
          <Brand onBand subtitle={null} />
          <ThemeToggle compact onBand />
        </div>
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2 text-sm font-bold">
            <span className="rounded-full bg-on-band/18 px-2.5 py-1">{session.kind === 'pre' ? 'Pre-test' : 'Post-test'}</span>
            <span className="rounded-full bg-on-band/18 px-2.5 py-1">Kode {session.code}</span>
          </div>
          <h1 className="display text-[1.7rem] text-balance">{session.title}</h1>
        </div>
      </Band>

      <main className="mx-auto max-w-md space-y-6 px-5 pt-6 pb-10">
        <section className="space-y-4">
          <h2 className="display text-[1.05rem]">Sebelum mulai</h2>
          <dl className="grid grid-cols-3 gap-2">
            <Stat value={timeStat.value} label={timeStat.unit} />
            <Stat value={total} label="soal" />
            <Stat value={`${session.max_violations}×`} label="batas pelanggaran" accent />
          </dl>
          <ul className="space-y-3.5 text-[0.95rem] leading-relaxed text-secondary">
            <Rule icon="clock">
              {perQuestion
                ? 'Soal muncul satu per satu dan tidak bisa kembali ke soal sebelumnya. '
                : 'Kamu bisa bolak-balik antarsoal dan mengubah jawaban sampai dikumpulkan. '}
              Ujian dimulai serentak oleh panitia; yang masuk terlambat hanya mendapat sisa waktu.
            </Rule>
            <Rule icon="bell">
              Aktifkan <b className="text-fg">Jangan Ganggu</b> dan tutup aplikasi lain.
            </Rule>
            <Rule icon="megaphone">
              Pindah aplikasi, membuka notifikasi, split screen, atau keluar layar penuh dihitung pelanggaran. Pelanggaran ke-
              {session.max_violations} mengumpulkan jawabanmu otomatis.
            </Rule>
            <Rule icon="globe">
              Buka di <b className="text-fg">Chrome</b> atau <b className="text-fg">Safari</b>, bukan dari dalam Instagram, LINE, atau TikTok.
            </Rule>
          </ul>
        </section>

        <div className="border-t-2 border-dashed border-line" />

        <ResultLink code={session.code} />

        {existing ? (
          <button onClick={resume} disabled={resuming} aria-busy={resuming} className="btn btn-primary h-13 w-full text-base">
            <PendingLabel pending={resuming}>Lanjutkan ujian</PendingLabel>
          </button>
        ) : finished ? (
          <p className="text-center text-sm text-muted">Ujian ini sudah dikerjakan dari HP ini. Satu HP hanya bisa dipakai satu peserta per sesi.</p>
        ) : (
          <form onSubmit={start} className="space-y-4">
            <h2 className="display text-[1.05rem]">Data peserta</h2>
            <label className="grid gap-1.5 text-sm font-bold">
              <span>Nama lengkap</span>
              <input name="name" required maxLength={100} autoComplete="name" className="field font-normal" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              <span>NIM</span>
              <input
                name="nim"
                required
                inputMode="numeric"
                pattern={NIM_PATTERN}
                minLength={NIM_MIN}
                maxLength={NIM_MAX}
                autoComplete="off"
                onChange={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '')
                }}
                title={`NIM hanya angka, maksimal ${NIM_MAX} digit`}
                aria-describedby="nim-hint"
                className="field font-normal"
              />
              <span id="nim-hint" className="text-xs font-normal text-muted">
                Hanya angka. Pakai NIM yang sama di pre-test dan post-test supaya nilaimu bisa dibandingkan.
              </span>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              <span>Prodi</span>
              <input name="prodi" required maxLength={100} placeholder="mis. S1 Informatika" className="field font-normal" />
            </label>
            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} aria-busy={busy} className="btn btn-primary h-13 w-full text-base">
              <PendingLabel pending={busy}>Masuk ujian</PendingLabel>
            </button>
            <p className="text-center text-sm text-muted">Layar penuh aktif setelah kamu menekan tombol ini.</p>
          </form>
        )}
      </main>
    </div>
  )
}

function Stat({ value, label, accent = false }: Readonly<{ value: React.ReactNode; label: string; accent?: boolean }>) {
  return (
    <div className="flex flex-col-reverse rounded-xl border border-line bg-surface px-2.5 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`display text-[1.4rem] ${accent ? 'text-primary' : ''}`}>{value}</dd>
    </div>
  )
}

const ICONS = {
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  bell: <path d="M8.7 3A6 6 0 0 1 18 8c0 3 .5 5 1.3 6.5M6 8c0 7-3 9-3 9h14M10.3 21a1.9 1.9 0 0 0 3.4 0M2 2l20 20" />,
  megaphone: <><path d="M3 11l15-6v14L3 13z" /><path d="M18 9a3 3 0 0 1 0 6" /><path d="M7 13.5l1.5 5.5h3L10 14.6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
}

function Rule({ icon, children }: Readonly<{ icon: keyof typeof ICONS; children: React.ReactNode }>) {
  return (
    <li className="flex gap-3">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0 text-navy-text">
        {ICONS[icon]}
      </svg>
      <span>{children}</span>
    </li>
  )
}
