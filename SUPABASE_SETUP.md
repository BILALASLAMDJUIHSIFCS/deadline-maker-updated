# Connecting Supabase

The app is **local-first**: it always reads/writes localStorage instantly, and
when Supabase is configured it also syncs every deadline and todo to the
database. Without Supabase it works exactly as before (header shows `LOCAL ONLY`).

## 1. Create the tables

Open your Supabase project → **SQL Editor** → paste and run
`supabase/migrations/20261115000000_init_deadline_maker.sql`.

Then run `supabase/migrations/20261116000000_app_settings_theme.sql` too — it
creates the `app_settings` table that stores your selected theme.

(With the Supabase CLI instead: `supabase link` then `supabase db push`.)

## 2. Add the keys

From **Project Settings → API**, copy the Project URL and the `anon` public key.

- Local dev: copy `.env.example` to `.env.local` and fill both values.
- Vercel / v0: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as
  environment variables (v0: Settings → Vars), then redeploy.

Restart `pnpm dev` after changing env vars. The header badge switches to
`CLOUD SYNCED`. Existing local data is uploaded automatically on first load.

## How sync works

| Piece                   | File                     |
| ----------------------- | ------------------------ |
| Supabase client         | `src/lib/supabase.ts`    |
| Deadlines (7-day window)| `src/lib/storage.ts`     |
| Scratch todo list       | `src/lib/todos.ts`       |
| Sync status badge state | `src/lib/sync.ts`        |

- On load and whenever the tab regains focus, remote rows are merged with local
  ones; for each id the most recently `updated_at` version wins.
- Writes go to localStorage immediately and are upserted to Supabase.
- Todos deleted while offline are queued and deleted remotely on the next save.
- Deadlines older than 7 days are pruned locally and in the database.

## Security note

There is no sign-in, so the browser uses the public anon key and the RLS
policies allow the `anon` role full access to these two tables. Anyone with
your deployed URL could read/write that data. Keep the URL private, or add
Supabase Auth later and scope the policies to `auth.uid()`.

The `utils/supabase` and `supabase/functions/server` folders are leftovers from
Figma Make and are not used by the app.
