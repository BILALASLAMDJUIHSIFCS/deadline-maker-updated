-- Later-list upgrades: priority tags, deadline links, and the 10 new themes.
-- Run once in Supabase → SQL Editor after the earlier migrations.
-- Safe to re-run.

-- Priority tag (high / medium / low) on each later-list item.
alter table public.todos
  add column if not exists tag text;

alter table public.todos
  drop constraint if exists todos_tag_check;
alter table public.todos
  add constraint todos_tag_check check (tag is null or tag in ('high', 'medium', 'low'));

-- The live deadline an item was sent to, so its time budget follows the timer.
alter table public.todos
  add column if not exists task_id text;

-- Allow the new themes (the old constraint only knew the original five).
alter table public.app_settings
  drop constraint if exists app_settings_theme_check;
alter table public.app_settings
  add constraint app_settings_theme_check check (
    theme in (
      'classic', 'glass', 'brutal', 'sage', 'crt',
      'linear', 'vercel', 'stripe', 'github', 'spotify',
      'notion', 'netflix', 'discord', 'apple', 'nord'
    )
  );

-- Make PostgREST pick up the new columns immediately.
notify pgrst, 'reload schema';
