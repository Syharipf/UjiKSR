import Link from 'next/link'
import LinkPending from '@/app/link-pending'
import SubmitButton from '@/app/submit-button'
import { requireAdmin } from '@/lib/admin-auth'
import { db, must } from '@/lib/db'
import { cleanTopic, formatDate, isOpen, type Session } from '@/lib/exam'
import { createSession, logout } from './actions'
import SessionForm from './session-form'
import SetupError from './setup-error'

type Row = Session & { attempts: { score: number | null }[] }


// A post-test and pre-test that are paired (via pre_session_id or matching title) sit together under a shared header.
function group(sessions: Row[]) {
  const byId = new Map(sessions.map((s) => [s.id, s]))
  const used = new Set<string>()
  const groups: { title: string; items: Row[]; pre?: string; post?: string }[] = []

  // 1. Group sessions that are explicitly linked via pre_session_id
  for (const s of sessions) {
    if (used.has(s.id)) continue
    const pre = s.kind === 'post' && s.pre_session_id ? byId.get(s.pre_session_id) : undefined
    if (pre && !used.has(pre.id)) {
      used.add(s.id).add(pre.id)
      const title = cleanTopic(s.title) || cleanTopic(pre.title) || s.title
      groups.push({ title, items: [s, pre], pre: pre.id, post: s.id })
    }
  }

  // 2. Group pre-test and post-test that share the exact cleaned topic/title
  for (const s of sessions) {
    if (used.has(s.id)) continue
    const topic = cleanTopic(s.title)
    if (topic) {
      // find counterpart with same cleaned topic
      const counterpart = sessions.find(
        (other) => !used.has(other.id) && other.id !== s.id && other.kind !== s.kind && cleanTopic(other.title).toLowerCase() === topic.toLowerCase(),
      )
      if (counterpart) {
        used.add(s.id).add(counterpart.id)
        const post = s.kind === 'post' ? s : counterpart
        const pre = s.kind === 'pre' ? s : counterpart
        groups.push({ title: topic, items: [post, pre], pre: pre.id, post: post.id })
        continue
      }
    }

    // 3. Standalone session
    used.add(s.id)
    groups.push({ title: '', items: [s] })
  }

  return groups
}

const average = (scores: (number | null)[]) => {
  const xs = scores.filter((x): x is number => x !== null)
  return xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toLocaleString('id-ID', { maximumFractionDigits: 1 }) : '–'
}

export default async function AdminHome() {
  await requireAdmin()
  let sessions: Row[]
  try {
    sessions = must(
      await db().from('exam_sessions').select('*, attempts(score)').order('held_on', { ascending: false }).order('created_at', { ascending: false }),
    )
  } catch (error) {
    return <SetupError error={error} />
  }

  // Count feedback separately and tolerantly so missing table never crashes AdminHome
  const feedbackCounts: Record<string, number> = {}
  try {
    const fbRes = await db().from('feedback').select('session_id')
    if (Array.isArray(fbRes.data)) {
      for (const row of fbRes.data) {
        const sid = String(row.session_id)
        feedbackCounts[sid] = (feedbackCounts[sid] || 0) + 1
      }
    }
  } catch {}
  const groups = group(sessions)

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 pt-7 pb-14 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-4xl">Sesi ujian</h1>
        <div className="flex flex-wrap gap-2">
          <a href="#buat-sesi" className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Buat sesi baru
          </a>
          <Link href="/admin/uji-deteksi" className="btn btn-secondary">
            Uji deteksi HP <LinkPending />
          </Link>
          <form action={logout}>
            <SubmitButton className="btn btn-secondary">Keluar</SubmitButton>
          </form>
        </div>
      </header>

      {!sessions.length && <p className="card p-6 text-center text-muted">Belum ada sesi. Buat sesi pertama di bawah.</p>}

      <div className="space-y-7">
        {groups.map((g) => (
          <section key={g.items[0].id} className="space-y-2.5">
            {g.title && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-hidden />
                  <h2 className="display text-lg tracking-tight font-extrabold">{g.title}</h2>
                  <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-muted">Pre & Post</span>
                </div>
                {g.pre && g.post && (
                  <Link href={`/admin/compare?pre=${g.pre}&post=${g.post}`} className="text-xs font-bold text-navy-text hover:underline">
                    Bandingkan pre vs post <LinkPending />
                  </Link>
                )}
              </div>
            )}
            <ul className="card divide-y divide-line overflow-hidden">
              {g.items.map((s) => {
                const open = isOpen(s)
                return (
                  <li key={s.id}>
                    <Link
                      href={`/admin/sessions/${s.id}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-subtle sm:grid-cols-[6rem_minmax(0,1fr)_5.5rem_5.5rem_5.5rem_7.5rem] sm:px-5"
                    >
                      <span className={`hidden justify-self-start rounded-lg px-2.5 py-1 text-xs font-extrabold sm:inline ${s.kind === 'pre' ? 'bg-navy-soft text-navy' : 'bg-primary-soft text-danger'}`}>
                        {s.kind === 'pre' ? 'Pre-test' : 'Post-test'}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-extrabold">{s.title}</span>
                        <span className="mt-0.5 block text-sm text-muted">
                          {formatDate(s.held_on)}, kode <b className="tracking-wider text-secondary">{s.code}</b>
                        </span>
                      </span>
                      <span className="hidden text-sm text-muted sm:block">
                        Peserta
                        <b className="block text-lg text-fg">{s.attempts.length}</b>
                      </span>
                      <span className="hidden text-sm text-muted sm:block">
                        Rata-rata
                        <b className="block text-lg text-fg">{average(s.attempts.map((a) => a.score))}</b>
                      </span>
                      <span className="hidden text-sm text-muted sm:block">
                        Feedback
                        <b className="block text-lg text-fg">
                          {s.kind === 'pre' ? '–' : `${feedbackCounts[s.id] || 0}`}
                        </b>
                      </span>
                      <span className="flex items-center justify-self-end gap-2">
                        <span className={`badge ${open ? 'bg-ok-soft text-ok' : 'bg-subtle text-muted'}`}>{open ? (s.started_at ? 'Berjalan' : 'Lobi') : 'Ditutup'}</span>
                        <LinkPending />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <Link href="/admin/compare" className="btn btn-secondary text-sm">
        Bandingkan pre-test vs post-test lainnya <LinkPending />
      </Link>

      <section id="buat-sesi" className="card scroll-mt-6 p-4 sm:p-6">
        <h2 className="display mb-4 text-xl">Buat sesi baru</h2>
        <SessionForm action={createSession} submitLabel="Buat sesi" preSessions={sessions.filter((s) => s.kind === 'pre').map(({ id, title, held_on, code }) => ({ id, title, held_on, code }))} />
      </section>
    </main>
  )
}
