-- Deadline Maker schema.
-- Run this once in Supabase → SQL Editor (or `supabase db push` with the CLI).
-- Timestamps are stored as epoch milliseconds (bigint) to match the app model.

create table if not exists public.tasks (
  id          text primary key,
  title       text   not null check (char_length(title) between 1 and 500),
  consequence text   not null default '' check (char_length(consequence) <= 1000),
  created_at  bigint not null,
  deadline    bigint not null,
  status      text   not null check (status in ('active', 'done', 'missed')),
  resolved_at bigint,
  day         text   not null check (day ~ '^\d{4}-\d{2}-\d{2}$'),
  updated_at  bigint not null
);

create index if not exists tasks_day_idx on public.tasks (day);
create index if not exists tasks_created_at_idx on public.tasks (created_at desc);

create table if not exists public.todos (
  id         text    primary key,
  text       text    not null check (char_length(text) between 1 and 1000),
  done       boolean not null default false,
  created_at bigint  not null,
  subs       jsonb   not null default '[]'::jsonb check (jsonb_typeof(subs) = 'array'),
  updated_at bigint  not null
);

create index if not exists todos_created_at_idx on public.todos (created_at desc);

-- Row Level Security.
-- The app has no sign-in (single personal user), so the browser talks to
-- Supabase with the public anon key. These policies let the anon role manage
-- both tables. Anyone who has your project URL + anon key can read/write this
-- data, so keep the deployed URL private, or add Supabase Auth later and
-- change `to anon using (true)` to `to authenticated using (auth.uid() = owner)`.
alter table public.tasks enable row level security;
alter table public.todos enable row level security;

drop policy if exists "anon manage tasks" on public.tasks;
create policy "anon manage tasks" on public.tasks
  for all to anon using (true) with check (true);

drop policy if exists "anon manage todos" on public.todos;
create policy "anon manage todos" on public.todos
  for all to anon using (true) with check (true);
