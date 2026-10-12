import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import Brand from '@/app/brand'
import Prinsip from '@/app/prinsip'
import { requireAdmin } from '@/lib/admin-auth'
import { UUID } from '@/lib/attempts'
import { db, must } from '@/lib/db'
import type { Session } from '@/lib/exam'
import { FullscreenButton } from '../live'

export default async function FeedbackQrPage(props: PageProps<'/admin/sessions/[id]/feedback-qr'>) {
  await requireAdmin()
  const { id } = await props.params
  if (!UUID.test(id)) notFound()

  const session: Pick<Session, 'title' | 'code' | 'kind' | 'feedback_url'> | null = must(
    await db().from('exam_sessions').select('title, code, kind, feedback_url').eq('id', id).maybeSingle(),
  )
  if (!session || session.kind !== 'post') notFound()

  const h = await headers()
  const host = h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? 'http'

  // If committee entered an external form (Google Form), use it;
  // Otherwise point to the in-app session exam page so participants open the in-app form directly!
  const targetUrl = session.feedback_url || `${proto}://${host}/s/${session.code}`

  // Generate crisp SVG QR code for projectors
  const qr = `data:image/svg+xml,${encodeURIComponent(
    await QRCode.toString(targetUrl, { type: 'svg', margin: 1 }),
  )}`

  return (
    <main className="fixed inset-0 z-50 flex flex-col overflow-auto bg-page lg:flex-row">
      <section className="projector-ambient-bg relative flex flex-col justify-between gap-10 bg-gradient-to-br from-band via-[#8f091e] to-band p-8 text-on-band sm:p-12 lg:w-[61%] lg:p-14 overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -top-20 size-80 rounded-full bg-black/10 blur-2xl" />
        <div className="flex items-center justify-between gap-4">
          <Brand onBand />
          <div className="hide-in-fullscreen shrink-0">
            <FullscreenButton />
          </div>
        </div>

        <div className="space-y-4">
          <div className="inline-block rounded-full bg-white/15 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-on-band">
            Evaluasi &amp; Feedback Post-Test
          </div>
          <p className="text-xl font-semibold text-on-band/90 lg:text-2xl">{session.title}</p>
          <h1 className="display text-3xl font-extrabold sm:text-4xl lg:text-5xl text-balance">
            Terima kasih telah mengikuti kegiatan &amp; ujian!
          </h1>
          <p className="text-lg text-on-band/90 lg:text-xl max-w-xl">
            Mohon luangkan waktu sejenak untuk scan QR dan mengisi form feedback / evaluasi demi peningkatan kualitas kegiatan mendatang.
          </p>
        </div>

        <div className="rounded-xl bg-white/10 p-4 border border-white/15 text-sm space-y-1">
          <p className="font-semibold text-on-band">
            {session.feedback_url ? 'Link Form Feedback:' : 'Alamat Web Ujian & Feedback:'}
          </p>
          <a
            href={targetUrl}
            target="_blank"
            rel="noreferrer"
            className="block truncate underline text-on-band/90 hover:text-white"
          >
            {targetUrl}
          </a>
        </div>

        <Prinsip />
      </section>

      <section className="relative flex flex-1 flex-col items-center justify-center gap-5 p-8 overflow-hidden bg-subtle/30">
        <div className="relative group">
          <div className="projector-hud-reticle">
            <span className="projector-hud-corner projector-hud-corner-tl" />
            <span className="projector-hud-corner projector-hud-corner-tr" />
            <span className="projector-hud-corner projector-hud-corner-bl" />
            <span className="projector-hud-corner projector-hud-corner-br" />
          </div>
          <div className="projector-qr-card relative aspect-square w-[min(80vw,52vh)] rounded-3xl bg-white p-5 lg:w-[min(30vw,60vh)] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL for SVG QR */}
            <img
              src={qr}
              alt={`QR Feedback ${targetUrl}`}
              className="size-full rounded-2xl"
            />
            <div className="projector-scanline" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-1.5 shadow-sm border border-line text-sm">
            <span className="inline-block size-2 rounded-full bg-primary animate-ping" />
            <p className="font-semibold text-fg">Scan dengan Kamera HP atau Google Lens</p>
          </div>
          <p className="text-xs text-muted">Arahkan kamera HP ke QR di atas untuk membuka formulir feedback</p>
        </div>
      </section>
    </main>
  )
}
