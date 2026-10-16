-- Run once in Supabase → SQL Editor.
-- All access goes through the Next.js server with the secret key; RLS is on with no
-- policies, so the public anon key can read nothing.
--
-- Upgrading a database created before exam dates existed? Run just this:
--   alter table exam_sessions add column held_on date;
--   update exam_sessions set held_on = (created_at at time zone 'Asia/Jakarta')::date;
--   alter table exam_sessions alter column held_on set not null, alter column held_on set default current_date;
--
-- Upgrading a database created before sessions closed on their own? Run just this:
--   alter table exam_sessions add column closes_at timestamptz;
--
-- Upgrading a database created before the lobby and prodi existed? Run just this, with no exam running
-- (sessions already used count as started; reopening one gives a fresh lobby):
--   alter table exam_sessions add column started_at timestamptz;
--   update exam_sessions set started_at = created_at where exists (select 1 from attempts where attempts.session_id = exam_sessions.id);
--   alter table attempts add column prodi text not null default '';
-- Already ran the earlier version of this upgrade? Also run:
--   update exam_sessions set started_at = null, closes_at = null where started_at = created_at and not exists (select 1 from attempts where attempts.session_id = exam_sessions.id);
--
-- Upgrading a database created before post-tests were paired with a pre-test? Run just this:
--   alter table exam_sessions add column pre_session_id uuid references exam_sessions (id) on delete set null;
-- Upgrading a database created before post-test feedback existed? Run just this:
--   alter table exam_sessions add column feedback_url text;
-- Upgrading a database created before in-app feedback existed? Run just this:
--   alter table exam_sessions add column feedback_webhook_url text;
--   create table if not exists feedback (
--     id uuid primary key default gen_random_uuid(),
--     attempt_id uuid not null unique references attempts (id) on delete cascade,
--     session_id uuid not null references exam_sessions (id) on delete cascade,
--     materi text not null check (char_length(materi) between 1 and 200),
--     rating_overall smallint not null check (rating_overall between 1 and 5),
--     rating_understanding smallint not null check (rating_understanding between 1 and 5),
--     rating_room smallint check (rating_room between 1 and 5),
--     note_speaker text check (char_length(note_speaker) <= 2000),
--     note_material text check (char_length(note_material) <= 2000),
--     note_practice text check (char_length(note_practice) <= 2000),
--     note_room text check (char_length(note_room) <= 2000),
--     note_next text check (char_length(note_next) <= 2000),
--     created_at timestamptz not null default now()
--   );
--   create index if not exists feedback_session_idx on feedback (session_id, created_at desc);

create table exam_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  held_on date not null default current_date,
  kind text not null check (kind in ('pre', 'post')),
  timer_mode text not null check (timer_mode in ('total', 'per_question')),
  duration_sec int not null default 1800 check (duration_sec > 0),
  per_question_sec int not null default 45 check (per_question_sec > 0),
  max_violations int not null default 3 check (max_violations > 0),
  is_open boolean not null default false,
  closes_at timestamptz, -- set by "Mulai ujian": no new participants after this (null = until closed by hand)
  started_at timestamptz, -- set by "Mulai ujian": every attempt's clock starts here (null = lobby)
  pre_session_id uuid references exam_sessions (id) on delete set null, -- post-test: its pre-test, compared by NIM
  feedback_url text, -- post-test optional: Google Form or external evaluation survey
  feedback_webhook_url text, -- post-test optional: Google Sheets Webhook URL to inject rows directly into Drive spreadsheet
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references exam_sessions (id) on delete cascade,
  position int not null,
  type text not null check (type in ('mc', 'tf')),
  text text not null,
  options text[] not null,
  answer_index int not null check (answer_index >= 0 and answer_index < cardinality(options))
);
create index questions_session_idx on questions (session_id);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references exam_sessions (id) on delete cascade,
  name text not null,
  nim text not null,
  prodi text not null default '',
  question_order uuid[] not null,
  option_orders jsonb not null,
  answers jsonb not null default '{}',
  current_index int not null default 0,
  question_started_at timestamptz not null,
  started_at timestamptz not null,
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  submit_reason text check (submit_reason in ('manual', 'timeout', 'violation')),
  score int,
  violation_count int not null default 0,
  unique (session_id, nim)
);

create table violations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts (id) on delete cascade,
  type text not null,
  created_at timestamptz not null default now()
);
create index violations_attempt_idx on violations (attempt_id);

alter table exam_sessions enable row level security;
alter table questions enable row level security;
alter table attempts enable row level security;
alter table violations enable row level security;
create table feedback (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references attempts (id) on delete cascade,
  session_id uuid not null references exam_sessions (id) on delete cascade,
  materi text not null check (char_length(materi) between 1 and 200),
  rating_overall smallint not null check (rating_overall between 1 and 5),
  rating_understanding smallint not null check (rating_understanding between 1 and 5),
  rating_room smallint check (rating_room between 1 and 5),
  note_speaker text check (char_length(note_speaker) <= 2000),
  note_material text check (char_length(note_material) <= 2000),
  note_practice text check (char_length(note_practice) <= 2000),
  note_room text check (char_length(note_room) <= 2000),
  note_next text check (char_length(note_next) <= 2000),
  created_at timestamptz not null default now()
);
create index feedback_session_idx on feedback (session_id, created_at desc);
alter table feedback enable row level security;


-- Merge one answer atomically. Guarded by current_index so a stale per-question
-- answer (or a concurrent one) updates nothing and returns no row.
create function record_answer(
  p_attempt uuid, p_question text, p_choice int,
  p_expect_index int, p_next_index int, p_now timestamptz
) returns setof attempts language sql as $$
  update attempts
     set answers = answers || jsonb_build_object(p_question, p_choice),
         question_started_at = case when p_next_index <> p_expect_index then p_now else question_started_at end,
         current_index = p_next_index
   where id = p_attempt and submitted_at is null and current_index = p_expect_index
  returning *;
$$;

-- Log a violation and return the new count (null if already submitted).
create function add_violation(p_attempt uuid, p_type text) returns int language sql as $$
  insert into violations (attempt_id, type)
    select id, p_type from attempts where id = p_attempt and submitted_at is null;
  update attempts set violation_count = violation_count + 1
   where id = p_attempt and submitted_at is null
  returning violation_count;
$$;

revoke execute on function record_answer(uuid, text, int, int, int, timestamptz) from public, anon, authenticated;
revoke execute on function add_violation(uuid, text) from public, anon, authenticated;
grant execute on function record_answer(uuid, text, int, int, int, timestamptz) to service_role;
grant execute on function add_violation(uuid, text) to service_role;
grant usage on schema public to service_role;
grant select, insert, update, delete on exam_sessions, questions, attempts, violations, feedback to service_role;
