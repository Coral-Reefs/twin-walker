-- DayZero admin dashboard
--   1. The Resident Jury (BBRApp) now syncs to Supabase: one editable vote per browser + free-text suggestions.
--   2. Admin-only project planner (Gantt).
-- The older public.votes / public.events tables are left untouched.
--
-- Run this in: Supabase Dashboard -> SQL Editor (or `supabase db push`).
-- Then promote your admin user (see the bottom of this file).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- app_metadata can only be written by the service role / SQL editor, never by a signed-in
-- user, so this stays safe even if public sign-ups are enabled on the project.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Planner projects (admin only)
-- ---------------------------------------------------------------------------
create table if not exists public.planner_projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  -- Optional link to a Resident Jury proposal id from lib/bbr/engine.ts (seating | crossing | pickup)
  option_id   text check (option_id is null or option_id ~ '^[a-z0-9-]{1,40}$'),
  start_date  date not null,
  end_date    date not null,
  status      text not null default 'planned' check (status in ('planned', 'in_progress', 'blocked', 'done')),
  progress    integer not null default 0 check (progress between 0 and 100),
  budget_rm   numeric(12, 2) check (budget_rm is null or budget_rm >= 0),
  owner       text check (owner is null or char_length(owner) <= 80),
  -- Finish-to-start dependencies: this project should start after every listed project ends.
  depends_on  uuid[] not null default '{}',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint planner_dates_ordered check (end_date >= start_date)
);

create index if not exists planner_projects_order_idx on public.planner_projects (sort_order, start_date);

drop trigger if exists planner_projects_touch on public.planner_projects;
create trigger planner_projects_touch
  before update on public.planner_projects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Resident Jury: votes (one editable preference per browser session)
-- ---------------------------------------------------------------------------
create table if not exists public.jury_votes (
  session_id  text primary key check (char_length(session_id) between 8 and 64),
  option_id   text not null check (option_id ~ '^[a-z0-9-]{1,40}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Resident Jury: free-text suggestions
-- ---------------------------------------------------------------------------
create table if not exists public.jury_suggestions (
  id          uuid primary key default gen_random_uuid(),
  -- Generated in the browser so a retried send can never create a duplicate row.
  client_id   text not null unique check (char_length(client_id) between 8 and 64),
  session_id  text not null check (char_length(session_id) between 8 and 64),
  place       text not null check (char_length(place) between 1 and 120),
  body        text not null check (char_length(btrim(body)) between 1 and 600),
  status      text not null default 'new' check (status in ('new', 'reviewing', 'planned', 'declined')),
  admin_note  text check (admin_note is null or char_length(admin_note) <= 1000),
  project_id  uuid references public.planner_projects (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists jury_suggestions_created_idx on public.jury_suggestions (created_at desc);

-- ---------------------------------------------------------------------------
-- Residents cast / change a vote through a function, so the anon role never needs
-- SELECT or UPDATE on jury_votes (and can never read other people's session ids).
-- ---------------------------------------------------------------------------
create or replace function public.cast_jury_vote(p_session text, p_option text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session is null or char_length(p_session) not between 8 and 64 then
    raise exception 'invalid session' using errcode = '22023';
  end if;
  if p_option is null or p_option !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'invalid option' using errcode = '22023';
  end if;

  insert into public.jury_votes (session_id, option_id)
  values (p_session, p_option)
  on conflict (session_id) do update
    set option_id = excluded.option_id,
        updated_at = now();
end;
$$;

revoke all on function public.cast_jury_vote(text, text) from public;
grant execute on function public.cast_jury_vote(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
--   anon          : may insert suggestions (and vote via the function above). Reads nothing.
--   authenticated : only users whose app_metadata.role = 'admin' can read or manage anything.
-- ---------------------------------------------------------------------------
alter table public.planner_projects enable row level security;
alter table public.jury_votes       enable row level security;
alter table public.jury_suggestions enable row level security;

revoke all on public.planner_projects from anon, authenticated;
revoke all on public.jury_votes       from anon, authenticated;
revoke all on public.jury_suggestions from anon, authenticated;

-- Projects: admin full access
grant select, insert, update, delete on public.planner_projects to authenticated;
drop policy if exists "admin manages projects" on public.planner_projects;
create policy "admin manages projects" on public.planner_projects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Votes: admin read-only (writes happen through cast_jury_vote)
grant select on public.jury_votes to authenticated;
drop policy if exists "admin reads votes" on public.jury_votes;
create policy "admin reads votes" on public.jury_votes
  for select to authenticated
  using (public.is_admin());

-- Suggestions: residents insert, admin reads / triages / deletes (resident text itself is never editable)
grant insert (client_id, session_id, place, body) on public.jury_suggestions to anon;
drop policy if exists "residents can suggest" on public.jury_suggestions;
create policy "residents can suggest" on public.jury_suggestions
  for insert to anon
  with check (true);

grant select, delete on public.jury_suggestions to authenticated;
grant update (status, admin_note, project_id) on public.jury_suggestions to authenticated;

drop policy if exists "admin reads suggestions" on public.jury_suggestions;
create policy "admin reads suggestions" on public.jury_suggestions
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admin triages suggestions" on public.jury_suggestions;
create policy "admin triages suggestions" on public.jury_suggestions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin deletes suggestions" on public.jury_suggestions;
create policy "admin deletes suggestions" on public.jury_suggestions
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Realtime: lets the dashboard receive new feedback instantly.
-- (Safe to re-run: "already a member" is ignored.)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['jury_votes', 'jury_suggestions', 'planner_projects'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;   -- already in the publication
      when undefined_object then null;   -- no supabase_realtime publication (plain Postgres)
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- MAKE YOUR ADMIN USER (run once, after creating the user in
-- Supabase Dashboard -> Authentication -> Users -> "Add user", with "Auto Confirm User" ticked).
-- The user must sign out and back in afterwards so their token picks up the new role.
-- ---------------------------------------------------------------------------
-- update auth.users
--    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
--  where email = 'you@example.com';
