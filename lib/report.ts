import type { Attempt, Question } from './exam'

export interface ScoreRow {
  name: string
  nim: string
  score: number | null
}

export interface CompareRow {
  nim: string
  name: string
  pre: number | null
  post: number | null
  delta: number | null
}

const norm = (nim: string) => nim.trim().toUpperCase()

function average(values: (number | null)[]) {
  const nums = values.filter((v): v is number => v !== null)
  return nums.length ? Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10 : null
}

// Pre-test vs post-test per participant, matched by NIM (case/whitespace-insensitive).
export function compareScores(pre: ScoreRow[], post: ScoreRow[]) {
  const byNim = new Map<string, CompareRow>()
  const row = (r: ScoreRow) => {
    const key = norm(r.nim)
    if (!byNim.has(key)) byNim.set(key, { nim: r.nim.trim(), name: r.name, pre: null, post: null, delta: null })
    return byNim.get(key)!
  }
  for (const r of pre) row(r).pre = r.score
  for (const r of post) row(r).post = r.score

  const rows = [...byNim.values()]
    .map((r) => ({ ...r, delta: r.pre !== null && r.post !== null ? r.post - r.pre : null }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return {
    rows,
    avgPre: average(rows.map((r) => r.pre)),
    avgPost: average(rows.map((r) => r.post)),
    avgDelta: average(rows.map((r) => r.delta)),
  }
}
export interface RecapAttempt {
  session_id: string
  name: string
  nim: string
  prodi: string
  score: number | null
}

export interface RecapRow {
  nim: string
  name: string
  prodi: string
  scores: (number | null)[] // one per sessionIds entry; null = did not join, or joined but no score yet
  attended: number // selected sessions this NIM joined
  average: number | null // over the non-null scores, 1 decimal
}

export interface Recap {
  rows: RecapRow[]
  sessionAverages: (number | null)[] // per column
  overall: number | null // over every non-null score in the selected sessions
}

// Several sessions side by side, one row per participant matched by NIM (case/whitespace-insensitive).
// sessionIds sets the column order; attempts of other sessions are ignored.
export function recapScores(sessionIds: string[], attempts: RecapAttempt[]): Recap {
  const col = new Map(sessionIds.map((id, i) => [id, i]))
  const kept = attempts
    .filter((a) => col.has(a.session_id))
    .sort((a, b) => col.get(a.session_id)! - col.get(b.session_id)!)

  const byNim = new Map<string, RecapRow>()
  for (const a of kept) {
    const key = norm(a.nim)
    let row = byNim.get(key)
    if (!row) {
      row = {
        nim: a.nim.trim(),
        name: a.name,
        prodi: a.prodi,
        scores: sessionIds.map(() => null),
        attended: 0,
        average: null,
      }
      byNim.set(key, row)
    }
    row.name = a.name
    if (a.prodi.trim()) {
      row.prodi = a.prodi
    }
    const colIdx = col.get(a.session_id)!
    row.scores[colIdx] = a.score
    row.attended++
  }

  const rows = [...byNim.values()]
    .map((r) => ({ ...r, average: average(r.scores) }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.nim.localeCompare(b.nim))

  const sessionAverages = sessionIds.map((_, i) => average(rows.map((r) => r.scores[i])))
  const overall = average(kept.map((a) => a.score))

  return {
    rows,
    sessionAverages,
    overall,
  }
}

export interface Progress {
  pre: number // indexes into the selected sessions
  post: number
  delta: number | null // post − pre; null when either score is missing
}

// A participant's pre→post pairs among the selected sessions (a post-test names its pre-test in pre_session_id).
export function progressPairs(sessions: { id: string; pre_session_id?: string | null }[], scores: (number | null)[]): Progress[] {
  return sessions.flatMap((s, post) => {
    const pre = sessions.findIndex((p) => p.id === s.pre_session_id)
    if (pre < 0) return []
    const a = scores[pre]
    const b = scores[post]
    return [{ pre, post, delta: a !== null && b !== null ? b - a : null }]
  })
}


export interface SessionStats {
  submittedCount: number
  totalCount: number
  avgScore: number | null
  maxScore: number | null
  minScore: number | null
  totalViolations: number
}

export function calculateSessionStats(
  attempts: Pick<Attempt, 'score' | 'submitted_at' | 'violation_count'>[],
): SessionStats {
  const submitted = attempts.filter((a) => a.submitted_at !== null)
  const scores = submitted.map((a) => a.score).filter((s): s is number => s !== null)
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const maxScore = scores.length ? Math.max(...scores) : null
  const minScore = scores.length ? Math.min(...scores) : null
  const totalViolations = attempts.reduce((acc, a) => acc + (a.violation_count || 0), 0)
  return {
    submittedCount: submitted.length,
    totalCount: attempts.length,
    avgScore,
    maxScore,
    minScore,
    totalViolations,
  }
}

export interface QuestionAccuracy {
  questionId: string
  answered: number
  correct: number
  percentage: number | null
}

export function calculateQuestionAccuracy(
  questions: Pick<Question, 'id' | 'answer_index'>[],
  attempts: Pick<Attempt, 'answers'>[],
): Map<string, QuestionAccuracy> {
  const result = new Map<string, QuestionAccuracy>()
  for (const q of questions) {
    let answered = 0
    let correct = 0
    for (const a of attempts) {
      if (a.answers && a.answers[q.id] !== undefined) {
        answered++
        if (a.answers[q.id] === q.answer_index) correct++
      }
    }
    const percentage = answered > 0 ? Math.round((correct / answered) * 100) : null
    result.set(q.id, { questionId: q.id, answered, correct, percentage })
  }
  return result
}

export interface ParticipantScore {
  name: string
  nim: string
  score: number
}

export interface ScoreTier {
  range: string
  label: string
  count: number
  percentage: number
  participants: ParticipantScore[]
}

export interface ScoreDistribution {
  tiers: ScoreTier[]
  passedCount: number
  failedCount: number
  passRate: number | null
  totalGraded: number
}

export function calculateScoreDistribution(
  attempts: (Pick<Attempt, 'score' | 'submitted_at'> & Partial<Pick<Attempt, 'name' | 'nim'>>)[],
  passThreshold = 70,
): ScoreDistribution {
  const graded = attempts.filter((a) => a.submitted_at !== null && a.score !== null)
  const total = graded.length
  let passed = 0

  const p90_100: ParticipantScore[] = []
  const p80_89: ParticipantScore[] = []
  const p70_79: ParticipantScore[] = []
  const p60_69: ParticipantScore[] = []
  const pBelow60: ParticipantScore[] = []

  for (const a of graded) {
    const s = a.score as number
    const p: ParticipantScore = {
      name: a.name ?? 'Peserta',
      nim: a.nim ?? '-',
      score: s,
    }
    if (s >= passThreshold) passed++
    if (s >= 90) p90_100.push(p)
    else if (s >= 80) p80_89.push(p)
    else if (s >= 70) p70_79.push(p)
    else if (s >= 60) p60_69.push(p)
    else pBelow60.push(p)
  }

  const sortFn = (x: ParticipantScore, y: ParticipantScore) => y.score - x.score || x.name.localeCompare(y.name)
  p90_100.sort(sortFn)
  p80_89.sort(sortFn)
  p70_79.sort(sortFn)
  p60_69.sort(sortFn)
  pBelow60.sort(sortFn)

  const pct = (c: number) => (total > 0 ? Math.round((c / total) * 100) : 0)

  const tiers: ScoreTier[] = [
    { range: '90–100', label: 'Istimewa', count: p90_100.length, percentage: pct(p90_100.length), participants: p90_100 },
    { range: '80–89', label: 'Sangat Baik', count: p80_89.length, percentage: pct(p80_89.length), participants: p80_89 },
    { range: '70–79', label: 'Baik', count: p70_79.length, percentage: pct(p70_79.length), participants: p70_79 },
    { range: '60–69', label: 'Cukup', count: p60_69.length, percentage: pct(p60_69.length), participants: p60_69 },
    { range: '< 60', label: 'Kurang', count: pBelow60.length, percentage: pct(pBelow60.length), participants: pBelow60 },
  ]

  return {
    tiers,
    passedCount: passed,
    failedCount: total - passed,
    passRate: total > 0 ? Math.round((passed / total) * 100) : null,
    totalGraded: total,
  }
}
