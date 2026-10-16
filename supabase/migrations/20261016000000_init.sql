-- DayZero: jury votes and lightweight analytics only.
-- All persona / map data ships with the app as local JSON; nothing personal is stored here.

-- ---------------------------------------------------------------------------
-- Votes: one anonymous ranking of the three design changes per session
-- ---------------------------------------------------------------------------
create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null unique check (char_length(session_id) between 8 and 64),
  ranking     text[] not null,
  created_at  timestamptz not null default now(),
  constraint ranking_has_three check (cardinality(ranking) = 3),
  constraint ranking_known_designs check (
    ranking <@ array['shaded-seating', 'crossing-reposition', 'family-pickup']::text[]
  ),
  constraint ranking_distinct check (
    ranking[1] <> ranking[2] and ranking[1] <> ranking[3] and ranking[2] <> ranking[3]
  )
);

-- ---------------------------------------------------------------------------
-- Analytics events: persona_selected, design_toggled, vote_submitted
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  session_id  text not null check (char_length(session_id) between 8 and 64),
  name        text not null check (name in ('persona_selected', 'design_toggled', 'vote_submitted')),
  props       jsonb not null default '{}'::jsonb check (pg_column_size(props) < 4096),
  created_at  timestamptz not null default now()
);

create index if not exists events_name_created_idx on public.events (name, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
--   anon can insert votes and events,
--   anon can read only the ranking column of votes (for the live tally),
--   anon cannot read events or session ids.
-- ---------------------------------------------------------------------------
alter table public.votes  enable row level security;
alter table public.events enable row level security;

drop policy if exists "anon can vote" on public.votes;
create policy "anon can vote" on public.votes
  for insert to anon with check (true);

drop policy if exists "anon can read rankings" on public.votes;
create policy "anon can read rankings" on public.votes
  for select to anon using (true);

drop policy if exists "anon can log events" on public.events;
create policy "anon can log events" on public.events
  for insert to anon with check (true);

-- Column-level privileges: rankings are public, session ids are not.
-- (The app inserts with return=minimal and treats a duplicate session id as "already stored",
--  so anon never needs SELECT on session_id.)
revoke all on public.votes from anon;
grant insert (session_id, ranking) on public.votes to anon;
grant select (ranking, created_at) on public.votes to anon;

revoke all on public.events from anon;
grant insert (session_id, name, props, created_at) on public.events to anon;

-- Handy view for the organisers (not exposed to anon).
create or replace view public.event_counts as
  select name, count(*) as total, max(created_at) as last_seen
  from public.events
  group by name;
revoke all on public.event_counts from anon, authenticated;
