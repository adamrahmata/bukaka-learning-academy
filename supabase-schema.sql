create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  title text not null,
  criterion_id integer not null default 1,
  host_name text not null,
  status text not null default 'waiting' check (status in ('waiting', 'live', 'ended')),
  started_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.live_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  name text not null,
  avatar text not null default '🦺',
  score integer not null default 0,
  answered boolean not null default false,
  correct boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, name)
);

alter table public.live_sessions enable row level security;
alter table public.live_participants enable row level security;
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.live_sessions to anon, authenticated;
grant select, insert, update on public.live_participants to anon, authenticated;
create policy "live sessions public read" on public.live_sessions for select to anon, authenticated using (true);
create policy "live sessions public insert" on public.live_sessions for insert to anon, authenticated with check (true);
create policy "live sessions public update" on public.live_sessions for update to anon, authenticated using (true) with check (true);
create policy "live participants public read" on public.live_participants for select to anon, authenticated using (true);
create policy "live participants public insert" on public.live_participants for insert to anon, authenticated with check (true);
create policy "live participants public update" on public.live_participants for update to anon, authenticated using (true) with check (true);
alter table public.live_sessions replica identity full;
alter table public.live_participants replica identity full;
alter table public.live_sessions add column if not exists current_question integer not null default 0;
alter table public.live_participants add column if not exists answered_question integer not null default -1;
