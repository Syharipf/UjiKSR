import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import Brand from '@/app/brand'
import Confetti from '@/app/exam/[id]/confetti'
import Prinsip from '@/app/prinsip'
import { requireAdmin } from '@/lib/admin-auth'
import { finalizeExpired, UUID } from '@/lib/attempts'
import { db, must } from '@/lib/db'
import { hasStarted, isOpen, type Session } from '@/lib/exam'
import { AutoRefresh, Countdown, FullscreenButton } from '../live'

// Share-screen / projector view: only what participants need to join. The session page itself must
// not be shared, since its question list shows the answer key.
export default async function QrDisplayPage(props: PageProps<'/admin/sessions/[id]/qr'>) {
  await requireAdmin()
  const { id } = await props.params
  if (!UUID.test(id)) notFound()
  const session: (Pick<Session, 'title' | 'code' | 'kind' | 'held_on' | 'is_open' | 'closes_at' | 'started_at'> & { attempts: { count: number }[] }) | null = must(
    await db().from('exam_sessions').select('title, code, kind, held_on, is_open, closes_at, started_at, attempts(count)').eq('id', id).maybeSingle(),
  )
  if (!session) notFound()
  // eslint-disable-next-line react-hooks/purity -- server component, rendered once per request
  const serverNow = Date.now()
  const open = isOpen(session, serverNow)
  const joined = session.attempts[0]?.count ?? 0
  if (session.started_at) await finalizeExpired(id)
  const { count: finishedCount, error } = await db().from('attempts').select('id', { count: 'exact', head: true }).eq('session_id', id).not('submitted_at', 'is', null)
  if (error) throw error
  const finished = finishedCount ?? 0
  const allDone = Boolean(session.started_at) && joined > 0 && finished === joined

  const h = await headers()
  const host = h.get('host') ?? ''
  const link = `${h.get('x-forwarded-proto') ?? 'http'}://${host}/s/${session.code}`
  // SVG stays sharp at any projector size.
  const qr = `data:image/svg+xml,${encodeURIComponent(await QRCode.toString(link, { type: 'svg', margin: 1 }))}`

  const status = allDone
    ? 'Semua peserta sudah selesai'
    : !open
    ? session.is_open || session.started_at
      ? 'Sesi sudah ditutup'
      : 'Sesi belum dibuka'
    : !session.started_at
      ? 'Silakan masuk, ujian dimulai serentak'
      : !hasStarted(session, serverNow)
        ? 'Ujian segera dimulai'
        : 'Ujian berjalan, yang telat dapat sisa waktu'

  return (
    <main className="fixed inset-0 z-50 flex flex-col overflow-auto bg-page lg:flex-row">
      <AutoRefresh />
      <section className="projector-ambient-bg relative flex flex-col justify-between gap-10 bg-gradient-to-br from-band via-[#8f091e] to-band p-8 text-on-band sm:p-12 lg:w-[61%] lg:p-14 overflow-hidden">
        <div className="projector-ambient-orb-1" />
        <div className="projector-ambient-orb-2" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -top-20 size-80 rounded-full bg-black/10 blur-2xl" />
        <div className="flex items-center justify-between gap-4">
          <Brand onBand />
          <div className="hide-in-fullscreen shrink-0">
            <FullscreenButton />
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-xl font-semibold text-on-band/90 lg:text-2xl">{session.title}</p>
          <p className="text-lg text-on-band/90 lg:text-xl">
            Scan QR, atau buka <b>{host}</b> lalu masukkan kode
          </p>
          <div
            aria-label={`Kode sesi ${session.code.split('').join(' ')}`}
            className="projector-code-wrap select-all font-black"
          >
            {session.code.split('').map((char, index) => (
              <span
                key={index}
                style={{ animationDelay: `${index * 120}ms` }}
                className="projector-code-char display text-[clamp(2.75rem,6.5vw,5.5rem)] leading-none text-white drop-shadow-md"
              >
                {char}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-x-12 gap-y-4 text-lg">
          <div>
            <div className="flex items-center gap-2 text-on-band/80">
              <span className="projector-live-pulse inline-block size-2 rounded-full bg-ok shadow-[0_0_8px_#4fd18b]" />
              <span>{session.started_at ? 'Peserta' : 'Peserta masuk'}</span>
            </div>
            <p className="display text-4xl">{joined}</p>
          </div>
          {session.started_at && (
            <div>
              <p className="text-on-band/80">Selesai</p>
              <p className="display text-4xl">{finished}<span className="text-on-band/60 text-2xl"> / {joined}</span></p>
            </div>
          )}
          {open && session.started_at && !hasStarted(session, serverNow) && (
            <div>
              <p className="text-on-band/80">Ujian dimulai dalam</p>
              <Countdown until={Date.parse(session.started_at)} serverNow={serverNow} className="display block text-4xl" />
            </div>
          )}
          {open && session.closes_at && hasStarted(session, serverNow) && (
            <div>
              <p className="text-on-band/80">Sisa waktu</p>
              <Countdown until={Date.parse(session.closes_at)} serverNow={serverNow} className="display block text-4xl" />
            </div>
          )}
          <p className="text-on-band/80">{status}</p>
        </div>
        <Prinsip />
      </section>
      <section className="relative flex flex-1 flex-col items-center justify-center gap-5 p-8 overflow-hidden bg-subtle/30">
        <div className="relative group">
          <div className="projector-qr-backdrop-glow" />
          <div className="projector-hud-reticle">
            <span className="projector-hud-corner projector-hud-corner-tl" />
            <span className="projector-hud-corner projector-hud-corner-tr" />
            <span className="projector-hud-corner projector-hud-corner-bl" />
            <span className="projector-hud-corner projector-hud-corner-br" />
          </div>
          <div className="projector-qr-card relative aspect-square w-[min(80vw,52vh)] rounded-3xl bg-white p-5 lg:w-[min(30vw,60vh)] overflow-hidden shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimize */}
            <img src={qr} alt={`QR ${link}`} className="size-full rounded-2xl" />
            <div className="projector-scanline" />
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-surface px-4 py-1.5 shadow-sm border border-line text-sm">
          <span className="inline-block size-2 rounded-full bg-primary animate-ping" />
          <p className="font-medium text-fg">Buka kamera HP atau Google Lens untuk scan</p>
        </div>
      </section>
      {allDone && (
        <div role="status" className="fixed inset-0 z-10 flex flex-col overflow-hidden bg-page text-center text-fg">
          <div aria-hidden className="h-2 shrink-0 bg-band" />
          <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <Confetti />
          <div className="done-rise relative flex justify-center p-8">
            <Brand />
          </div>
          <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-8">
            <div className="relative text-primary">
              <div className="done-halo absolute -inset-5 rounded-full bg-primary/15 blur-xl" />
              <svg viewBox="0 0 110 110" aria-hidden className="relative size-28 lg:size-36">
                <circle cx="55" cy="55" r="48" fill="var(--surface)" stroke="currentColor" strokeWidth="6" className="done-check-ring" />
                <path d="M33 56l15 15 29-31" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" className="done-check-mark" />
              </svg>
            </div>
            <p className="done-rise text-xl font-semibold text-muted lg:text-2xl" style={{ animationDelay: '300ms' }}>
              {session.title}
            </p>
            <h2 className="done-rise display text-[clamp(2.5rem,6vw,5rem)] leading-tight text-navy-text" style={{ animationDelay: '450ms' }}>
              Semua peserta sudah selesai
            </h2>
            <p className="done-rise text-xl text-secondary lg:text-2xl" style={{ animationDelay: '600ms' }}>
              <b className="display text-3xl text-primary lg:text-4xl">{finished}</b> peserta telah mengumpulkan jawaban. Terima kasih!
            </p>
            <div className="done-rise mt-4 space-y-1" style={{ animationDelay: '850ms' }}>
              <p className="text-[clamp(1.75rem,3.5vw,3rem)] font-semibold italic text-primary">“Siamo tutti fratelli”</p>
              <p className="text-sm tracking-[0.2em] text-muted uppercase">Kita semua bersaudara · Solferino, 1859</p>
            </div>
          </div>
          {open && (
            <p className="relative p-8 text-sm text-muted">
              Peserta susulan masih bisa masuk dengan kode <b className="font-mono text-fg">{session.code}</b>
            </p>
          )}
        </div>
      )}
    </main>
  )
}
