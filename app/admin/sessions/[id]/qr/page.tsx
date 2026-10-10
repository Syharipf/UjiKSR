import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import Brand from '@/app/brand'
import Prinsip from '@/app/prinsip'
import { requireAdmin } from '@/lib/admin-auth'
import { UUID } from '@/lib/attempts'
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

  const h = await headers()
  const host = h.get('host') ?? ''
  const link = `${h.get('x-forwarded-proto') ?? 'http'}://${host}/s/${session.code}`
  // SVG stays sharp at any projector size.
  const qr = `data:image/svg+xml,${encodeURIComponent(await QRCode.toString(link, { type: 'svg', margin: 1 }))}`

  const status = !open
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
      <section className="flex flex-col justify-between gap-10 bg-band p-8 text-on-band sm:p-12 lg:w-[61%] lg:p-14">
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
          <p aria-label={`Kode sesi ${session.code.split('').join(' ')}`} className="display text-[clamp(3.5rem,8vw,6.5rem)] leading-none tracking-[0.03em] whitespace-nowrap">
            {session.code}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-x-12 gap-y-4 text-lg">
          <div>
            <p className="text-on-band/80">{session.started_at ? 'Peserta' : 'Peserta masuk'}</p>
            <p className="display text-4xl">{joined}</p>
          </div>
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
      <section className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimize */}
        <img src={qr} alt={`QR ${link}`} className="aspect-square w-[min(80vw,52vh)] rounded-3xl bg-white p-5 shadow-[0_24px_60px_-24px_rgb(11_21_39/0.45)] lg:w-[min(30vw,60vh)]" />
        <p className="text-muted">Buka dengan kamera HP atau Google Lens</p>
      </section>
    </main>
  )
}
