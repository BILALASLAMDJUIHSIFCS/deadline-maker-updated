-- Daily snapshots for monthly progress history.
-- Run once in Supabase → SQL Editor after the init migrations.

create table if not exists public.daily_snapshots (
  day                text    primary key,
  cycles_completed   integer not null default 0,
  tasks_completed    integer not null default 0,
  tasks_missed       integer not null default 0,
  total_done_min     integer not null default 0,
  updated_at         bigint  not null
);

alter table public.daily_snapshots enable row level security;

drop policy if exists "anon manage daily_snapshots" on public.daily_snapshots;
create policy "anon manage daily_snapshots" on public.daily_snapshots
  for all to anon using (true) with check (true);
