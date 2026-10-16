import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import Brand from '@/app/brand'
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
  const showDone = Boolean(session.started_at) && !open && joined > 0

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

  // Everyone-finished overlay (styles: .done-* in globals.css): one dot per participant in seven
  // columns, one per Fundamental Principle, each its own shade of the PMI palette (red, white, blue).
  const shades = ['#e8384c', '#ff6b7a', '#ffa3ad', '#ffffff', '#b9ceff', '#8fb2ff', '#5b86e0']
  // ponytail: dots shrink in steps so up to ~150 participants fit; beyond that the columns clip.
  const dot = finished > 84 ? 14 : finished > 42 ? 20 : 30
  const floaters = ['#ffffff', '#ffc2c9', '#b9ceff', '#13294b']

  return (
    <main className="fixed inset-0 z-50 flex flex-col overflow-auto bg-page lg:flex-row">
      <AutoRefresh />
      <section className="projector-ambient-bg relative flex flex-col justify-between gap-10 bg-gradient-to-br from-band via-[#8f091e] to-band p-8 text-on-band sm:p-12 lg:w-[61%] lg:px-16 lg:py-14 overflow-hidden">
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
          <p className="text-xl font-semibold opacity-90 lg:text-2xl">{session.title}</p>
          <p className="text-lg opacity-90 lg:text-xl">
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
            <div className="flex items-center gap-2 opacity-80">
              <span className="projector-live-pulse inline-block size-2 rounded-full bg-ok shadow-[0_0_8px_#4fd18b]" />
              <span>{session.started_at ? 'Peserta' : 'Peserta masuk'}</span>
            </div>
            <p className="display text-4xl">{joined}</p>
          </div>
          {session.started_at && (
            <div>
              <p className="opacity-80">Selesai</p>
              <p className="display text-4xl">
                {finished}
                <span className="text-2xl opacity-60"> / {joined}</span>
              </p>
            </div>
          )}
          {open && session.started_at && !hasStarted(session, serverNow) && (
            <div>
              <p className="opacity-80">Ujian dimulai dalam</p>
              <Countdown until={Date.parse(session.started_at)} serverNow={serverNow} className="display block text-4xl" />
            </div>
          )}
          {open && session.closes_at && hasStarted(session, serverNow) && (
            <div>
              <p className="opacity-80">Sisa waktu</p>
              <Countdown until={Date.parse(session.closes_at)} serverNow={serverNow} className="display block text-4xl" />
            </div>
          )}
          <p className="opacity-80">{status}</p>
        </div>
      </section>
      {/* Seven segments, one per Fundamental Principle (as .prinsip, stood upright). */}
      <div aria-hidden className="ml-1.5 hidden w-2 shrink-0 grid-rows-7 gap-1.5 lg:grid">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="bg-band" />
        ))}
      </div>
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
      {showDone && (
        <div role="status" className="fixed inset-0 z-10 overflow-hidden bg-bar text-white">
          <div aria-hidden className="done-grid absolute inset-0 flex items-center justify-center pb-24" style={{ gap: dot * 1.5 }}>
            {shades.map((color, c) => (
              <div key={color} className="flex flex-col-reverse" style={{ gap: dot / 2 }}>
                {Array.from({ length: Math.ceil((finished - c) / 7) }, (_, r) => (
                  <span
                    key={r}
                    className="done-dot"
                    style={{ width: dot, height: dot, background: color, boxShadow: `0 0 18px ${color}99`, animationDelay: `${0.6 + ((r * 7 + c) / finished) * 2.9}s` }}
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="done-count absolute inset-x-0 bottom-[18%] text-center text-2xl font-bold">
            Mengumpulkan jawaban… <b className="display">{finished}</b> / {joined}
          </p>
          <div className="done-flood absolute inset-0 flex flex-col items-center justify-center gap-8 bg-band px-8 text-center text-on-band">
            <div aria-hidden className="absolute inset-0">
              {Array.from({ length: 14 }, (_, i) => (
                <span
                  key={i}
                  className="done-float"
                  style={{ left: `${8 + ((i * 53) % 84)}%`, top: `${62 + ((i * 29) % 34)}%`, width: 10 + (i % 4) * 5, height: 10 + (i % 4) * 5, background: floaters[i % 4], animationDelay: `${4.7 + ((i * 0.37) % 4.5)}s` }}
                />
              ))}
            </div>
            <div className="done-msg relative space-y-5">
              <h2 className="display text-[clamp(3.5rem,9vw,7rem)] leading-[0.95] tracking-[-0.035em]">Semua selesai.</h2>
              <p className="text-[clamp(1.25rem,2.2vw,1.75rem)] font-semibold opacity-90">Terima kasih sudah mengerjakan dengan jujur.</p>
            </div>
            <div aria-hidden className="relative grid w-full max-w-[700px] grid-cols-7 gap-3">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="done-seg" style={{ animationDelay: `${4.9 + 0.07 * i}s` }}>
                  <span className="done-shine" style={{ animationDelay: `${0.18 * i}s` }} />
                </span>
              ))}
            </div>
            <div className="done-msg relative space-y-2" style={{ animationDelay: '5.1s' }}>
              <p className="text-xl lg:text-2xl">{open ? 'Nilai muncul di HP masing-masing setelah panitia menutup sesi.' : 'Nilai sudah bisa dilihat di HP masing-masing.'}</p>
              <p className="text-lg italic opacity-80">Siamo tutti fratelli</p>
            </div>
          </div>
          <header className="absolute inset-x-0 top-0 flex items-center justify-between gap-4 p-8 sm:px-14 sm:py-10">
            <Brand onBand subtitle={session.title} />
            {open && (
              <p className="text-right text-sm opacity-85">
                Peserta susulan: kode <b className="font-mono">{session.code}</b>
              </p>
            )}
          </header>
        </div>
      )}
    </main>
  )
}
