'use client'

import type { FaceDetector as Detector } from '@mediapipe/tasks-vision'
import { useEffect, useRef, useState } from 'react'
import { faceState } from '@/lib/face'

// Google's pretrained BlazeFace (MediaPipe), run on the phone; no frame leaves the device.
// ponytail: wasm comes from jsDelivr (13 MB, cached); self-host it from node_modules if the venue blocks CDNs.
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm'
const MODEL = '/models/blaze_face_short_range.tflite'
const TICK_MS = 400
// A glance at the timer or a sneeze shouldn't count; reading a book next to the phone takes longer.
const TURNED_MS = 2000
const MISSING_MS = 3000

// `on`: keep the camera open (lobby too, so the permission prompt comes before the clock runs).
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
    let detector: Detector | undefined
    let video: HTMLVideoElement | undefined

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 }, audio: false })
        // Lazy: keeps MediaPipe out of the exam page bundle until the camera is granted.
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const fileset = await FilesetResolver.forVisionTasks(WASM)
        detector = await FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        })
        video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.srcObject = stream
        // Visible self-view: lets the participant frame their face, and iOS Safari only decodes attached videos.
        video.className = 'pointer-events-none fixed right-3 bottom-3 z-40 h-20 w-16 rounded-lg object-cover opacity-80 -scale-x-100'
        document.body.append(video)
        await video.play()
        if (done) return stop() // unmounted while loading: cleanup ran before these existed
        const d = detector
        const v = video
        let since = 0 // when the face last stopped being 'ok'
        let reported = false // one violation per look-away; reset when the face is back
        timer = window.setInterval(() => {
          if (!watchingRef.current || v.readyState < 2 || document.visibilityState !== 'visible') {
            since = 0
            return
          }
          const now = performance.now()
          const state = faceState(d.detectForVideo(v, now).detections)
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
      detector?.close()
      detector = undefined
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
