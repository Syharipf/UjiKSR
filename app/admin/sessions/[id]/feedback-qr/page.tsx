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
  if (!session || session.kind !== 'post' || !session.feedback_url) notFound()

  // Generate crisp SVG QR code for projectors
  const qr = `data:image/svg+xml,${encodeURIComponent(
    await QRCode.toString(session.feedback_url, { type: 'svg', margin: 1 }),
  )}`

  return (
    <main className="fixed inset-0 z-50 flex flex-col overflow-auto bg-page lg:flex-row">
      <section className="flex flex-col justify-between gap-10 bg-band p-8 text-on-band sm:p-12 lg:w-[61%] lg:p-14">
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
          <p className="font-semibold text-on-band">Link langsung Google Form / Form Feedback:</p>
          <a
            href={session.feedback_url}
            target="_blank"
            rel="noreferrer"
            className="block truncate underline text-on-band/90 hover:text-white"
          >
            {session.feedback_url}
          </a>
        </div>

        <Prinsip />
      </section>

      <section className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL for SVG QR */}
        <img
          src={qr}
          alt={`QR Feedback ${session.feedback_url}`}
          className="aspect-square w-[min(80vw,52vh)] rounded-3xl bg-white p-5 shadow-[0_24px_60px_-24px_rgb(11_21_39/0.45)] lg:w-[min(30vw,60vh)]"
        />
        <div className="text-center space-y-1">
          <p className="font-semibold text-fg">Scan dengan Kamera HP atau Google Lens</p>
          <p className="text-xs text-muted">Arahkan kamera HP ke QR di atas untuk membuka formulir feedback</p>
        </div>
      </section>
    </main>
  )
}
