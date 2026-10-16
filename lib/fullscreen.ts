// Browsers without the Fullscreen API (e.g. iPhone Safari) are treated as always fullscreen, and so are
// in-app browsers (Instagram, LINE, …) whose request fails or silently does nothing: otherwise the exam
// would stay behind "Layar ujian terkunci" for good. Tab/app switching is still detected there.
let failed = false
const listeners = new Set<() => void>()

const supported = () =>
  typeof document !== 'undefined' && typeof document.documentElement.requestFullscreen === 'function' && document.fullscreenEnabled

export const isFullscreen = () => !supported() || failed || document.fullscreenElement !== null

export async function enterFullscreen() {
  if (!supported()) return
  if (document.fullscreenElement) {
    // If already in fullscreen but system bars (status bar / navbar) were revealed by a transient swipe,
    // browsers ignore a redundant requestFullscreen().
    // Exiting and re-entering fullscreen immediately forces the OS WindowInsetsController to reset immersion mode.
    try {
      await document.exitFullscreen()
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    } catch {
      try {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      } catch {}
    }
    return
  }
  let changed = false
  document.addEventListener(
    'fullscreenchange',
    () => {
      changed = true
      if (document.fullscreenElement) failed = false // it was only slow
    },
    { once: true },
  )
  const fail = () => {
    if (changed || failed || document.fullscreenElement) return
    failed = true
    listeners.forEach((l) => l())
  }
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(fail)
  setTimeout(fail, 2000)
}

export function exitFullscreen() {
  if (supported() && document.fullscreenElement) document.exitFullscreen().catch(() => {})
}

export function subscribeFullscreen(onChange: () => void) {
  listeners.add(onChange)
  document.addEventListener('fullscreenchange', onChange)
  return () => {
    listeners.delete(onChange)
    document.removeEventListener('fullscreenchange', onChange)
  }
}
