-- Saves the selected theme (single personal user, one settings row).
-- Run once in Supabase → SQL Editor after the init migration.

create table if not exists public.app_settings (
  id         text   primary key,
  theme      text   not null default 'classic'
             check (theme in ('classic', 'glass', 'brutal', 'sage', 'crt')),
  updated_at bigint not null
);

alter table public.app_settings enable row level security;

drop policy if exists "anon manage app_settings" on public.app_settings;
create policy "anon manage app_settings" on public.app_settings
  for all to anon using (true) with check (true);
