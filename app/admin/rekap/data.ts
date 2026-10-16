import { finalizeExpired } from '@/lib/attempts'
import { db, must } from '@/lib/db'
import type { Session } from '@/lib/exam'
import { recapScores, type Recap, type RecapAttempt } from '@/lib/report'

export const sessionLabel = (s: Session) => `${s.title} (${s.code})`

export async function loadRecap(wanted: string[]): Promise<{
  sessions: Session[]
  selected: Session[]
  recap: Recap | null
}> {
  const sessions: Session[] = must(
    await db()
      .from('exam_sessions')
      .select('*')
      .order('held_on', { ascending: false })
      .order('created_at', { ascending: false }),
  )

  const selected = sessions
    .filter((s) => wanted.includes(s.id))
    .reverse()

  if (selected.length === 0) {
    return { sessions, selected, recap: null }
  }

  const attemptsPerSession = await Promise.all(
    selected.map(async (s): Promise<RecapAttempt[]> => {
      await finalizeExpired(s.id)
      return must(
        await db()
          .from('attempts')
          .select('session_id, name, nim, prodi, score')
          .eq('session_id', s.id),
      )
    }),
  )

  const attempts = attemptsPerSession.flat()
  const recap = recapScores(
    selected.map((s) => s.id),
    attempts,
  )

  return { sessions, selected, recap }
}
