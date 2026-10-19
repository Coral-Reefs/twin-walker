# DayZero Admin Dashboard: setup

Unzip over the project root (same folder as `package.json`). It adds 13 new files and replaces 2 (this guide and the patch are extras). No new npm packages are needed.

## 1. Run the database migration
Supabase Dashboard -> SQL Editor -> paste `supabase/migrations/20261018000000_admin_dashboard.sql` -> Run.
(Or `supabase db push` if you use the CLI.)

## 2. Create your admin user
1. Dashboard -> Authentication -> Users -> **Add user** (tick *Auto Confirm User*).
2. SQL Editor, run (with your email):
   ```sql
   update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
    where email = 'you@example.com';
   ```
   Only users with this role can read feedback or edit the planner. This is enforced by the database, so it holds even if public sign-ups are on.

## 3. Environment
`.env.local` needs the two variables already listed in `.env.example`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Restart `npm run dev` after editing.

## 4. Switch mode
Edit `lib/admin/mode.ts`:
```ts
export const APP_MODE: AppMode = "ADMIN";   // or "RESIDENT"
```
Restart `npm run dev`. Sign in with the user from step 2.

## 5. Check it works (2 minutes)
1. Run once as `RESIDENT`, open **Resident jury**, pick a proposal and save a suggestion. The notice should say it reached the planning team.
2. Switch to `ADMIN` and sign in. The vote and suggestion are there, and the header badge says **Live**.
3. Keep the admin tab open, submit another suggestion from a second browser or a private window running `RESIDENT` (run a second dev server on another port with the constant flipped). It appears in about a second with a "Just in" highlight and a toast.

## What changed
| File | Change |
|---|---|
| `lib/admin/mode.ts` | **new**: the RESIDENT / ADMIN constant |
| `app/page.tsx` | **edit**: renders `AdminApp` or `BBRApp` from the constant |
| `components/BBRApp.tsx` | **edit** (4 spots): sends votes and suggestions to Supabase; the jury copy now says feedback is shared with the planning team |
| `lib/jury/api.ts` | **new**: resident to Supabase sync with an offline queue |
| `supabase/migrations/20261018000000_admin_dashboard.sql` | **new**: tables, RLS, vote RPC, realtime |
| `lib/admin/{types,supabase,useAdminData,planner}.ts` | **new**: types, admin client, auth + realtime data hook, Gantt maths |
| `components/admin/{AdminApp,Overview,FeedbackInbox,ProjectPlanner,ui}.tsx` | **new**: the dashboard |
| `lib/admin/__tests__/planner.test.ts` | **new**: unit tests (run with `npm test`) |

`modified-files.patch` holds the two edits as a patch: `git apply --ignore-whitespace modified-files.patch`.

## Things to know
- **Existing local-only feedback is not back-filled.** Votes and suggestions residents made before this change live only in their own browsers.
- **Submissions are anonymous and unthrottled.** Anyone with the site URL can submit. Add a CAPTCHA or an edge rate limit before a public launch.
- **The constant is a switch, not security.** Both bundles ship; the admin data is protected by login + row level security.
- **Unused code left alone:** `DayZeroApp`, `DbProvider`, `RankingForm` and the old `votes` / `events` tables are not wired to `app/page.tsx`, and I did not touch them.
