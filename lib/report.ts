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

export interface ScoreTier {
  range: string
  label: string
  count: number
  percentage: number
}

export interface ScoreDistribution {
  tiers: ScoreTier[]
  passedCount: number
  failedCount: number
  passRate: number | null
  totalGraded: number
}

export function calculateScoreDistribution(
  attempts: Pick<Attempt, 'score' | 'submitted_at'>[],
  passThreshold = 70,
): ScoreDistribution {
  const scores = attempts
    .filter((a) => a.submitted_at !== null && a.score !== null)
    .map((a) => a.score as number)

  const total = scores.length
  let c90_100 = 0
  let c80_89 = 0
  let c70_79 = 0
  let c60_69 = 0
  let cBelow60 = 0
  let passed = 0

  for (const s of scores) {
    if (s >= passThreshold) passed++
    if (s >= 90) c90_100++
    else if (s >= 80) c80_89++
    else if (s >= 70) c70_79++
    else if (s >= 60) c60_69++
    else cBelow60++
  }

  const pct = (c: number) => (total > 0 ? Math.round((c / total) * 100) : 0)

  const tiers: ScoreTier[] = [
    { range: '90–100', label: 'Istimewa', count: c90_100, percentage: pct(c90_100) },
    { range: '80–89', label: 'Sangat Baik', count: c80_89, percentage: pct(c80_89) },
    { range: '70–79', label: 'Baik', count: c70_79, percentage: pct(c70_79) },
    { range: '60–69', label: 'Cukup', count: c60_69, percentage: pct(c60_69) },
    { range: '< 60', label: 'Kurang', count: cBelow60, percentage: pct(cBelow60) },
  ]

  return {
    tiers,
    passedCount: passed,
    failedCount: total - passed,
    passRate: total > 0 ? Math.round((passed / total) * 100) : null,
    totalGraded: total,
  }
}
