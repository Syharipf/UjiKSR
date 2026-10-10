import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const COOKIE = 'ksr_admin'
export const TTL_MS = 12 * 60 * 60 * 1000

// The admin password doubles as the HMAC key, so changing it logs every admin out.
function secret() {
  const s = process.env.ADMIN_PASSWORD
  if (!s) throw new Error('ADMIN_PASSWORD belum diset di .env.local')
  return s
}

const sign = (value: string, key: string) => createHmac('sha256', key).update(value).digest('base64url')
const digest = (value: string) => createHash('sha256').update(value).digest()

export function makeToken(now = Date.now(), key = secret()) {
  const exp = String(now + TTL_MS)
  return `${exp}.${sign(exp, key)}`
}

export function verifyToken(token: string | undefined, now = Date.now(), key?: string) {
  const [exp, mac] = token?.split('.') ?? []
  if (!exp || !mac || !(Number(exp) > now)) return false
  const secretKey = key ?? secret()
  const given = Buffer.from(mac)
  const expected = Buffer.from(sign(exp, secretKey))
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export const passwordMatches = (input: string, key?: string) => {
  const secretKey = key ?? secret()
  return timingSafeEqual(digest(input), digest(secretKey))
}
