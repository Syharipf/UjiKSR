'use client'

import { useEffect } from 'react'
import { isFullscreen } from '@/lib/fullscreen'

// One slip (switching apps) fires blur + visibilitychange + fullscreenchange together; count it once.
const DEBOUNCE_MS = 2000
// Split screen roughly halves the viewport; rotating the phone keeps the area about the same.
const MIN_AREA_RATIO = 0.6
const BLOCKED = ['contextmenu', 'copy', 'cut', 'selectstart', 'dragstart'] as const
// Only trigger edge swipe when the touch truly originates at the extreme physical edge (14px)
// and travels significantly inward (40px) to reveal system navbar/status bar.
// This prevents accidental triggers when scrolling or tapping near bottom buttons.
const EDGE_PX = 14
const EDGE_TRAVEL_PX = 40

// `awake`: hold the screen on (also while waiting in the lobby, so the phone is unlocked when the questions appear).
export function useAntiCheat(active: boolean, onViolation: (type: string) => void, awake = active) {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault()
    BLOCKED.forEach((t) => document.addEventListener(t, block))
    return () => BLOCKED.forEach((t) => document.removeEventListener(t, block))
  }, [])

  // Keep the screen on: a phone that auto-locks while someone reads a question would count as leaving.
  // The lock is dropped whenever the page is hidden, so take it again on return.
  useEffect(() => {
    if (!awake || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | undefined
    let done = false
    const acquire = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen').then(
        (l) => {
          if (done) l.release().catch(() => {})
          else lock = l
        },
        () => {},
      )
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      done = true
      document.removeEventListener('visibilitychange', acquire)
      lock?.release().catch(() => {})
    }
  }, [awake])

  useEffect(() => {
    if (!active) return
    let last = 0
    let maxArea = window.innerWidth * window.innerHeight

    const report = (type: string) => {
      const now = Date.now()
      if (now - last < DEBOUNCE_MS) return
      last = now
      onViolation(type)
    }

    // Android notification panel / Google Assistant / Circle to Search overlay:
    // When the top status bar / notification shade is pulled down or an assistant overlay appears,
    // Android pauses input focus from the web view.
    // 1. document.hasFocus() immediately returns false even before any blur event is dispatched.
    // 2. window.blur & window.focusout fire when focus transitions.
    // 3. fullscreenchange fires if pulling down the notification shade cancels immersion.
    const checkFocus = () => {
      if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
        report('blur')
      }
    }
    // In fullscreen the system bars are hidden, and a swipe in from the top or bottom edge brings
    // them back (notification shade; navbar -> hold Home -> Circle to Search/Lens/Gemini).
    // Firefox/Samsung give the page no blur for those overlays, so the swipe is the only signal.
    // Only check this in real fullscreen; anywhere else the screen edge is ordinary page content.
    let edge: { id: number; y: number; dir: 1 | -1 } | null = null

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 3) {
        edge = null
        report('multi_touch')
        return
      }
      if (e.touches.length !== 1 || !document.fullscreenElement) {
        edge = null
        return
      }
      const t = e.touches[0]
      const h = window.innerHeight
      if (t.clientY <= EDGE_PX) {
        edge = { id: t.identifier, y: t.clientY, dir: 1 }
      } else if (t.clientY >= h - EDGE_PX) {
        edge = { id: t.identifier, y: t.clientY, dir: -1 }
      } else {
        edge = null
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!edge) return
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]
        if (t.identifier === edge.id) {
          if ((t.clientY - edge.y) * edge.dir >= EDGE_TRAVEL_PX) {
            edge = null
            report('edge_swipe')
          }
          break
        }
      }
    }

    const onTouchCancel = () => {
      edge = null
    }

    const onTouchEnd = () => {
      edge = null
    }

    type ListenerEntry = [EventTarget, string, EventListener, AddEventListenerOptions?]

    const listeners: ListenerEntry[] = [
      [document, 'visibilitychange', (() => document.visibilityState === 'hidden' && report('hidden')) as EventListener],
      [window, 'blur', (() => report('blur')) as EventListener],
      [window, 'focusout', (() => checkFocus()) as EventListener],
      [document, 'fullscreenchange', (() => !isFullscreen() && report('fullscreen_exit')) as EventListener],
      [
        window,
        'resize',
        (() => {
          const area = window.innerWidth * window.innerHeight
          if (isFullscreen()) maxArea = Math.max(maxArea, area)
          if (area < maxArea * MIN_AREA_RATIO) report('resize')
        }) as EventListener,
      ],
      [document, 'touchstart', onTouchStart as EventListener, { passive: true }],
      [document, 'touchmove', onTouchMove as EventListener, { passive: true }],
      [document, 'touchcancel', onTouchCancel as EventListener, { passive: true }],
      [document, 'touchend', onTouchEnd as EventListener, { passive: true }],
    ]
    listeners.forEach(([target, type, fn, opts]) => target.addEventListener(type, fn, opts))
    // Active polling for document.hasFocus() to catch notification shade dragging & floating overlays
    const focusInterval = setInterval(checkFocus, 350)

    return () => {
      clearInterval(focusInterval)
      listeners.forEach(([target, type, fn, opts]) => target.removeEventListener(type, fn, opts))
    }
  }, [active, onViolation])
}
