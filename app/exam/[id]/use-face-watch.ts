'use client'

import type { FaceLandmarker as Landmarker } from '@mediapipe/tasks-vision'
import { useEffect, useRef, useState } from 'react'
import { faceState } from '@/lib/face'

// Google's pretrained MediaPipe FaceLandmarker (github.com/google-ai-edge/mediapipe), run on the phone;
// no frame leaves the device. 478 landmarks give a stable head turn where a plain face box doesn't.
// ponytail: wasm comes from jsDelivr (13 MB, cached); self-host it from node_modules if the venue blocks CDNs.
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm'
const MODEL = '/models/face_landmarker.task' // 3.6 MB, cached
const TICK_MS = 100
// Long enough to forgive a blink of motion blur, short enough that a look at a book is caught at once.
const TURNED_MS = 700
const MISSING_MS = 1500

// `on`: keep the camera open (lobby too, so the permission prompt and model download happen before the clock runs).
// `watching`: count violations. Returns false once the camera can't be used (denied, unsupported, load failure).
export function useFaceWatch(on: boolean, watching: boolean, onViolation: (type: string) => void) {
  const [ok, setOk] = useState(true)
  const watchingRef = useRef(watching)
  const violationRef = useRef(onViolation)
  useEffect(() => {
    watchingRef.current = watching
    violationRef.current = onViolation
  })

  useEffect(() => {
    if (!on) return
    let done = false
    let stream: MediaStream | undefined
    let timer: number | undefined
    let landmarker: Landmarker | undefined
    let video: HTMLVideoElement | undefined

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 }, audio: false })
        // Lazy: keeps MediaPipe out of the exam page bundle until the camera is granted.
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const fileset = await FilesetResolver.forVisionTasks(WASM)
        const create = (delegate: 'GPU' | 'CPU') =>
          FaceLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numFaces: 1 })
        // GPU runs each frame in a few ms on most phones; some browsers lack WebGL2 and need CPU.
        landmarker = await create('GPU').catch(() => create('CPU'))
        video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.srcObject = stream
        // Visible self-view: lets the participant frame their face, and iOS Safari only decodes attached videos.
        video.className = 'pointer-events-none fixed right-3 bottom-3 z-40 h-24 w-[4.5rem] rounded-lg border-[3px] border-transparent object-cover -scale-x-100 transition-colors'
        document.body.append(video)
        await video.play()
        if (done) return stop() // unmounted while loading: cleanup ran before these existed
        const lm = landmarker
        const v = video
        let since = 0 // when the face last stopped being 'ok'
        let reported = false // one violation per look-away; reset when the face is back
        let last = -1
        timer = window.setInterval(() => {
          if (!watchingRef.current || v.readyState < 2 || document.visibilityState !== 'visible') {
            since = 0
            v.style.borderColor = ''
            return
          }
          const now = performance.now()
          if (now <= last) return // detectForVideo needs increasing timestamps
          last = now
          const state = faceState(lm.detectForVideo(v, now).faceLandmarks)
          // Live hint before it counts: the self-view turns red the moment the face is off.
          v.style.borderColor = state === 'ok' ? '' : '#c8102e'
          if (state === 'ok') {
            since = 0
            reported = false
            return
          }
          since ||= now
          if (!reported && now - since >= (state === 'turned' ? TURNED_MS : MISSING_MS)) {
            reported = true
            violationRef.current(state === 'turned' ? 'face_turned' : 'face_missing')
          }
        }, TICK_MS)
      } catch {
        stop()
        if (!done) setOk(false)
      }
    })()

    function stop() {
      clearInterval(timer)
      landmarker?.close()
      landmarker = undefined
      stream?.getTracks().forEach((t) => t.stop())
      video?.remove()
    }
    return () => {
      done = true
      stop()
    }
  }, [on])

  return ok
}
