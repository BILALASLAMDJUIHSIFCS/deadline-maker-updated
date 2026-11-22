-- Pause support + the new 12-theme collection.
-- Run once in Supabase → SQL Editor after the earlier migrations. Safe to re-run.

-- Pause state on each deadline. While paused, `paused_at` holds the epoch-ms
-- the timer stopped; on resume the deadline is pushed back and the gap is
-- added to `paused_ms`.
alter table public.tasks
  add column if not exists paused_at bigint;

alter table public.tasks
  add column if not exists paused_ms bigint not null default 0;

-- Themes: keep Classic Ember + Neo Brutal, replace the rest with the new ten.
-- Anyone still on a removed theme falls back to Classic Ember.
alter table public.app_settings
  drop constraint if exists app_settings_theme_check;

update public.app_settings
  set theme = 'classic'
  where theme not in (
    'classic', 'brutal',
    'molten', 'sphere', 'dopamine', 'citrus', 'cobalt',
    'turbine', 'bloom', 'pixel', 'honey', 'porcelain'
  );

alter table public.app_settings
  add constraint app_settings_theme_check check (
    theme in (
      'classic', 'brutal',
      'molten', 'sphere', 'dopamine', 'citrus', 'cobalt',
      'turbine', 'bloom', 'pixel', 'honey', 'porcelain'
    )
  );

notify pgrst, 'reload schema';
