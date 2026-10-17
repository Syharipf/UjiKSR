import { handle, readJson } from '@/lib/api'
import { finalize, loadCtx, sync, view } from '@/lib/attempts'
import { db, must } from '@/lib/db'
import { ExamError, hasStarted } from '@/lib/exam'

import { NOTE_TYPES, VIOLATION_TYPES } from '@/lib/violations'

export async function POST(req: Request, ctx: RouteContext<'/api/attempts/[id]/violation'>) {
  return handle(async () => {
    const now = new Date()
    const type = String((await readJson(req)).type)
    if (!Object.hasOwn(VIOLATION_TYPES, type)) throw new ExamError(400, 'Jenis pelanggaran tidak valid')
    const exam = await loadCtx((await ctx.params).id)
    await sync(exam, now)
    if (exam.attempt.submitted_at || !hasStarted(exam.session, now.getTime())) return view(exam, now) // nothing to leave in the lobby

    if (Object.hasOwn(NOTE_TYPES, type)) {
      must(await db().from('violations').insert({ attempt_id: exam.attempt.id, type }))
      return view(exam, now)
    }
    const count: number | null = must(await db().rpc('add_violation', { p_attempt: exam.attempt.id, p_type: type }))
    if (count !== null) exam.attempt.violation_count = count
    if (exam.attempt.violation_count >= exam.session.max_violations) await finalize(exam, 'violation', now)
    return view(exam, now)
  })
}
