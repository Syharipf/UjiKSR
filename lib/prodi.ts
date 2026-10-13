// Participants type their study programme freely ("S1. TEKNIK LOGISTIK", "s1 ilmu komunikasi",
// "Psikologi S1"); store one spelling so the recap groups them: degree first, Title Case.
// ponytail: an all-caps word of up to 4 letters is kept as an acronym (MBTI, IT, DKV), so "DATA"
// stays caps too; add a word list if that ever bites.
const DEGREE = /^[SD][1-4]$/i
const LOWER: Record<string, true> = { dan: true, of: true, and: true }

export function normalizeProdi(input: string) {
  const words = input.replace(/\./g, ' ').trim().split(/\s+/).filter(Boolean)
  const degree = words.findIndex((w) => DEGREE.test(w))
  if (degree > 0) words.unshift(...words.splice(degree, 1))
  return words
    .map((w, i) => {
      if (DEGREE.test(w)) return w.toUpperCase()
      if (w.length <= 4 && w === w.toUpperCase() && /[A-Z]/.test(w)) return w
      const lower = w.toLowerCase()
      if (i > 0 && LOWER[lower]) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}
