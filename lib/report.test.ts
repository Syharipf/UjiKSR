import { describe, expect, it } from 'bun:test'
import { calculateQuestionAccuracy, calculateScoreDistribution, calculateSessionStats, compareScores, progressPairs, recapScores } from './report'

describe('compareScores', () => {
  it('joins pre and post by NIM, computes deltas and averages', () => {
    const r = compareScores(
      [
        { name: 'Ani', nim: '1', score: 40 },
        { name: 'Budi', nim: 'x2', score: 60 },
        { name: 'Cici', nim: '3', score: null },
      ],
      [
        { name: 'Ani', nim: ' 1 ', score: 80 },
        { name: 'Budi', nim: 'X2', score: 70 },
        { name: 'Dodi', nim: '4', score: 90 },
      ],
    )
    expect(r.rows).toEqual([
      { nim: '1', name: 'Ani', pre: 40, post: 80, delta: 40 },
      { nim: 'x2', name: 'Budi', pre: 60, post: 70, delta: 10 },
      { nim: '3', name: 'Cici', pre: null, post: null, delta: null },
      { nim: '4', name: 'Dodi', pre: null, post: 90, delta: null },
    ])
    expect(r.avgPre).toBe(50)
    expect(r.avgPost).toBe(80)
    expect(r.avgDelta).toBe(25)
  })

  it('returns null averages when there is nothing to average', () => {
    expect(compareScores([], [])).toEqual({ rows: [], avgPre: null, avgPost: null, avgDelta: null })
  })
})

describe('calculateSessionStats', () => {
  it('computes average, max, min, completed count, and total violations', () => {
    const attempts = [
      { score: 80, submitted_at: '2026-10-10T10:00:00Z', violation_count: 1 },
      { score: 60, submitted_at: '2026-10-10T10:05:00Z', violation_count: 0 },
      { score: 100, submitted_at: '2026-10-10T10:10:00Z', violation_count: 2 },
      { score: null, submitted_at: null, violation_count: 0 }, // still working
    ]
    const stats = calculateSessionStats(attempts)
    expect(stats).toEqual({
      submittedCount: 3,
      totalCount: 4,
      avgScore: 80,
      maxScore: 100,
      minScore: 60,
      totalViolations: 3,
    })
  })

  it('handles empty attempts array', () => {
    const stats = calculateSessionStats([])
    expect(stats).toEqual({
      submittedCount: 0,
      totalCount: 0,
      avgScore: null,
      maxScore: null,
      minScore: null,
      totalViolations: 0,
    })
  })
})

describe('calculateQuestionAccuracy', () => {
  it('calculates answered count, correct count, and accuracy percentage', () => {
    const questions = [
      { id: 'q1', answer_index: 0 },
      { id: 'q2', answer_index: 1 },
      { id: 'q3', answer_index: 2 },
    ]
    const attempts: { answers: Record<string, number> }[] = [
      { answers: { q1: 0, q2: 1 } }, // q1 correct, q2 correct
      { answers: { q1: 0, q2: 0 } }, // q1 correct, q2 wrong
      { answers: { q1: 1, q2: 1 } }, // q1 wrong, q2 correct
      { answers: {} }, // didn't answer anything yet
    ]
    const accuracy = calculateQuestionAccuracy(questions, attempts)

    // q1: 3 answered, 2 correct -> 67%
    expect(accuracy.get('q1')).toEqual({
      questionId: 'q1',
      answered: 3,
      correct: 2,
      percentage: 67,
    })

    // q2: 3 answered, 2 correct -> 67%
    expect(accuracy.get('q2')).toEqual({
      questionId: 'q2',
      answered: 3,
      correct: 2,
      percentage: 67,
    })

    // q3: 0 answered -> null percentage
    expect(accuracy.get('q3')).toEqual({
      questionId: 'q3',
      answered: 0,
      correct: 0,
      percentage: null,
    })
  })
})

describe('calculateScoreDistribution', () => {
  it('buckets scores into tiers and computes pass rates', () => {
    const attempts = [
      { name: 'Ani', nim: '1001', score: 95, submitted_at: '2026-10-10T10:00:00Z' }, // 90-100
      { name: 'Budi', nim: '1002', score: 85, submitted_at: '2026-10-10T10:01:00Z' }, // 80-89
      { name: 'Cici', nim: '1003', score: 75, submitted_at: '2026-10-10T10:02:00Z' }, // 70-79
      { name: 'Dedi', nim: '1004', score: 65, submitted_at: '2026-10-10T10:03:00Z' }, // 60-69
      { name: 'Eka', nim: '1005', score: 50, submitted_at: '2026-10-10T10:04:00Z' }, // < 60
      { name: 'Fani', nim: '1006', score: null, submitted_at: null }, // unsubmitted, ignored
    ]
    const dist = calculateScoreDistribution(attempts, 70)
    expect(dist.totalGraded).toBe(5)
    expect(dist.passedCount).toBe(3) // 95, 85, 75
    expect(dist.failedCount).toBe(2) // 65, 50
    expect(dist.passRate).toBe(60) // 3/5 = 60%

    expect(dist.tiers).toEqual([
      { range: '90–100', label: 'Istimewa', count: 1, percentage: 20, participants: [{ name: 'Ani', nim: '1001', score: 95 }] },
      { range: '80–89', label: 'Sangat Baik', count: 1, percentage: 20, participants: [{ name: 'Budi', nim: '1002', score: 85 }] },
      { range: '70–79', label: 'Baik', count: 1, percentage: 20, participants: [{ name: 'Cici', nim: '1003', score: 75 }] },
      { range: '60–69', label: 'Cukup', count: 1, percentage: 20, participants: [{ name: 'Dedi', nim: '1004', score: 65 }] },
      { range: '< 60', label: 'Kurang', count: 1, percentage: 20, participants: [{ name: 'Eka', nim: '1005', score: 50 }] },
    ])
  })

  it('handles empty attempts array', () => {
    const dist = calculateScoreDistribution([])
    expect(dist.totalGraded).toBe(0)
    expect(dist.passedCount).toBe(0)
    expect(dist.failedCount).toBe(0)
    expect(dist.passRate).toBeNull()
    expect(dist.tiers.every((t) => t.count === 0 && t.percentage === 0)).toBe(true)
  })
})

describe('recapScores', () => {
  it('aggregates scores across sessions, computes session and overall averages', () => {
    const r = recapScores(
      ['a', 'b', 'c'],
      [
        { session_id: 'a', name: 'Ani', nim: ' 1001 ', prodi: 'S1 TI', score: 60 },
        { session_id: 'c', name: 'Ani', nim: '1001', prodi: '', score: 80 },
        { session_id: 'b', name: 'Budi', nim: '1002', prodi: 'S1 SI', score: null },
        { session_id: 'a', name: 'Budi', nim: '1002', prodi: 'S1 SI', score: 40 },
      ],
    )
    expect(r.rows).toEqual([
      { nim: '1001', name: 'Ani', prodi: 'S1 TI', scores: [60, null, 80], attended: 2, average: 70 },
      { nim: '1002', name: 'Budi', prodi: 'S1 SI', scores: [40, null, null], attended: 2, average: 40 },
    ])
    expect(r.sessionAverages).toEqual([50, null, 80])
    expect(r.overall).toBe(60)
  })

  it('uses name from the latest column', () => {
    const r = recapScores(
      ['a', 'b'],
      [
        { session_id: 'b', name: 'Ani Putri', nim: '1001', prodi: 'S1 TI', score: 90 },
        { session_id: 'a', name: 'ani', nim: '1001', prodi: 'S1 TI', score: 70 },
      ],
    )
    expect(r.rows).toEqual([
      { nim: '1001', name: 'Ani Putri', prodi: 'S1 TI', scores: [70, 90], attended: 2, average: 80 },
    ])
  })

  it('ignores attempts of unselected sessions and handles empty input', () => {
    const r = recapScores(
      ['a', 'b'],
      [{ session_id: 'z', name: 'Zack', nim: '9999', prodi: '', score: 100 }],
    )
    expect(r).toEqual({
      rows: [],
      sessionAverages: [null, null],
      overall: null,
    })
  })
})

describe('progressPairs', () => {
  it('pairs each post-test with its selected pre-test, in any column order', () => {
    const sessions = [
      { id: 'post1', pre_session_id: 'pre1' },
      { id: 'pre1' },
      { id: 'post2', pre_session_id: 'pre2' }, // pre-test not selected: no pair
      { id: 'pre3' },
      { id: 'post3', pre_session_id: 'pre3' },
    ]
    expect(progressPairs(sessions, [80, 50, 90, null, 70])).toEqual([
      { pre: 1, post: 0, delta: 30 },
      { pre: 3, post: 4, delta: null }, // missed the pre-test
    ])
  })
})

