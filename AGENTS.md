<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Aturan Kerja

- **Selalu commit perubahan**: Setiap kali selesai membuat perubahan kode atau konfigurasi yang sudah terverifikasi, langsung buat git commit.

## Project

Anti-cheat pre-test/post-test exam web app (UjiKSR) for KSR PMI Unit Universitas Telkom, one session per material (e.g. "Pre-test Pertolongan Pertama"). Participants open a session by QR/link on Android Chrome (no login: name + NIM + prodi); committee uses `/admin`. Design spec: `docs/superpowers/specs/2026-09-27-ujian-ksr-anticheat-design.md`. UI copy is Indonesian.

Stack: Next.js 16 App Router (Turbopack) + Supabase Postgres, run with **Bun** (`node` on this machine is a Bun symlink). Tailwind v4.

## Commands

```bash
bun run dev              # needs .env.local (see .env.example)
bun test                 # unit tests: lib/*.test.ts + supabase/schema.test.ts (schema runs on in-memory PGlite)
bun test lib/exam.test.ts -t "settle"   # single file / test name
bun run lint             # eslint
bun run build            # also type-checks; run `bunx next typegen` if PageProps/RouteContext are "not found"
bun run e2e              # full stack without Supabase: PGlite → PostgREST (auto-downloaded) → next dev :3100 → headless Chromium
BASE=https://ujiksr.vercel.app CODE=ABC123 N=150 bun e2e/load.ts   # load test against an open test session (delete it after); without CODE it runs on the local e2e stack
```

E2E notes: set `CHROMIUM_PATH` if Chromium isn't at `/usr/bin/chromium-browser`; logs and failure screenshots land in `e2e/.bin/`. PGlite drops the connection on any SQL error, so DB error paths (e.g. duplicate NIM → 23505) are covered only by `supabase/schema.test.ts`, not by E2E.

## Architecture

- **Trust boundary**: the browser never talks to Supabase. `lib/db.ts` (secret key, bypasses RLS) is server-only; RLS is enabled with no policies. The answer key (`answer_index`) never leaves the server — `buildView` in `lib/exam.ts` is the only shape sent to participants. A participant's own `score` is included only once `resultsStatus()` (`lib/attempts.ts`) says the session is closed and nobody is still working; until then it reports `results_at` (the later of the session's `closes_at` and the last deadline) for the participants' countdown. "Buka sesi" opens a lobby (`started_at` null): participants join and wait, no clock runs and no questions are sent. "Mulai ujian" (`startExam`) sets the session's `started_at` = now + `START_DELAY_MS` (so every polling phone learns it in time) and `closes_at` = that + the exam's duration, and re-times lobby attempts to it; a join that lands mid-start is re-timed lazily in `sync`. Every attempt's clock starts at the session's `started_at`, so latecomers get only the time left. Past `closes_at` the session counts as closed (`isOpen` in `lib/exam.ts`, evaluated on read, no cron). Closing by hand force-submits active attempts and closes the session; reopening always opens a fresh lobby without resuming the previous countdown. "Reset semua" also returns the session to the lobby.
- **Rules are pure** in `lib/exam.ts` (shuffle order, deadlines, `settle` for timeouts/per-question skipping, grading, `buildView`). DB orchestration is in `lib/attempts.ts`: every participant API call does `loadCtx → sync (apply clock) → action → view`. The server clock is authoritative (`GRACE_MS` slack); the client timer is display only.
- **Answer indices**: options are shuffled per attempt. `attempts.option_orders[qid]` maps display index → original index; `answers` stores original indices; the client only ever sends/sees display indices.
- **Atomic writes** go through SQL functions in `supabase/schema.sql`: `record_answer` (guarded by `current_index`, so stale per-question answers are rejected) and `add_violation`. Changing the schema means updating `schema.sql` and re-running it in Supabase; `schema.test.ts` covers both functions.
- **Anti-cheat client** (`app/exam/[id]/`): `use-anti-cheat.ts` reports `hidden`/`blur`/`fullscreen_exit`/`resize` (debounced 2s) and blocks context menu/copy/selection; reload/reopen without the `fresh:<id>` sessionStorage flag set by the join page counts as a `reopen` violation. The exam client serializes answer/submit requests through a queue so responses never arrive out of order. It also holds a screen Wake Lock so an auto-locking phone isn't counted as leaving. The violation API accepts only those five types. `lib/fullscreen.ts` treats a browser without the Fullscreen API (iPhone) or one that refuses it (Instagram/LINE in-app browsers) as fullscreen, so nobody gets stuck behind the lock screen.
- **Camera check** (`use-face-watch.ts`, per session: `exam_sessions.camera_check`, off by default, toggled in the session settings): Google MediaPipe FaceLandmarker (pretrained, `public/models/face_landmarker.task`, wasm from jsDelivr, GPU with CPU fallback) runs on the phone every 100 ms; no frame leaves the device. The yaw rule is pure in `lib/face.ts` (nose position between the cheek landmarks). The self-view turns red at once; head turned ≥0.7s → `face_turned`, no face ≥1.5s → `face_missing` (one report per look-away). Camera denied/unsupported does not block the exam: it logs `no_camera` once, a note type (`NOTE_TYPES` in `lib/violations.ts`) that the violation API inserts without counting toward `max_violations`.
- **Pre/post pairing**: a post-test may name its pre-test (`exam_sessions.pre_session_id`; "Duplikat" of a pre-test sets it). Once scores are released, `view()` in `lib/attempts.ts` adds that pre-test's score for the same NIM (`pre_score`, null = none). NIM is digits only (`lib/nim.ts`, checked in the join API).
- **Rapor**: `/admin/rekap/rapor?s=…&nim=…` (linked per row of the recap) is a printable per-NIM report; "Unduh PDF" is the browser's print → Save as PDF. `/admin/rekap/rapor/zip?s=…` downloads bulk ZIP of all participant PDFs (generated server-side using pdf-lib + @pdf-lib/fontkit and zipped with fflate; font & logo assets in `lib/rapor`). Pre→post pairs come from `progressPairs` in `lib/report.ts`.
- **Question images** (optional): stored base64 in `question_images` (kept out of `questions` so `loadCtx` stays small), served by `/api/questions/[id]/image`, cached forever via `?v=<questions.image_rev>`. The admin form shrinks the picture to JPEG ≤1200 px in the browser; `saveQuestion` re-checks size (700 KB) and type by magic bytes. CSV/Excel upload stays text-only.
- **Admin**: server actions in `app/admin/actions.ts` — each must call `requireAdmin()` (actions are public endpoints). Questions and the timer settings are locked once a session has attempts (they were dealt/timed with the old ones). The session page lists the answer key, so share-screen/projector use goes through `/admin/sessions/[id]/qr` (QR + code only). Auth is an HMAC cookie keyed by `ADMIN_PASSWORD` (`lib/admin-token.ts`). Admin result pages call `finalizeExpired` so participants who closed their browser still get a timeout score.
- **UI**: colours are semantic tokens in `app/globals.css` (`bg-surface`, `text-muted`, `bg-primary`, …, light/dark); shared `card` / `btn btn-primary|btn-secondary|btn-danger` / `field` / `badge` utilities live there too. `app/brand.tsx` (the name only, no logo yet) heads every page; participant pages open with `app/band.tsx` (red band) closed by `app/prinsip.tsx`, seven segments for the Seven Fundamental Principles. Palette: PMI red for brand and main actions, navy for structure and selection (a chosen answer is never red). Never draw the red cross emblem (protected by UU 1/2018). Font: Archivo, self-hosted in `app/fonts/` via `next/font/local`; headings use `.display` (expanded width).
- **Deploy**: Vercel (production `ujiksr.vercel.app`) + Supabase in ap-northeast-1 (Tokyo). `vercel.json` pins functions to `hnd1` (Tokyo) next to the database: each API call makes 3–5 sequential queries, so a far region adds ~0.2 s per query.
- Security headers (no framing, nosniff, `Referrer-Policy: same-origin` since `/exam/<attempt id>` is the participant's credential) are set in `next.config.ts`.
- Next 16 specifics: `params`/`searchParams` are Promises (use global `PageProps<'/route'>` / `RouteContext<'/route'>`); pages that read the DB without cookies call `await connection()` to avoid being prerendered.
