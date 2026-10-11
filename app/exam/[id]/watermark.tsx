// Tiled name + NIM over the whole exam so a leaked photo identifies its source.
// Two tints: dark text on the light theme, light text on the dark theme, so it stays visible in both.
import { AI_NOTICE_SHORT } from './ai-notice'

export default function Watermark({ text }: { text: string }) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  const safe = esc(text)
  const noticeSafe = esc(AI_NOTICE_SHORT)
  const tile = (fill: string) =>
    `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='170'>` +
        `<g transform='rotate(-25 150 85)'>` +
        `<text x='20' y='80' font-family='sans-serif' font-size='16' fill='${fill}'>${safe}</text>` +
        `<text x='20' y='104' font-family='sans-serif' font-size='12' fill='${fill}'>${noticeSafe}</text>` +
        `</g></svg>`,
    )}")`
  return (
    <>
      <div aria-hidden className="watermark-light pointer-events-none fixed inset-0 z-40" style={{ backgroundImage: tile('rgba(15,26,46,0.12)') }} />
      <div
        aria-hidden
        className="watermark-dark pointer-events-none fixed inset-0 z-40"
        style={{ backgroundImage: tile('rgba(238,242,248,0.12)') }}
      />
    </>
  )
}
