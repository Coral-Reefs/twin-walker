/**
 * Which experience this build serves. Change the value, then restart `npm run dev`.
 *
 *   "RESIDENT"  the public township explorer + Resident Jury (default)
 *   "ADMIN"     the admin dashboard (overview, feedback inbox, project planner)
 *
 * This is a convenience switch, NOT access control. Admin data is protected by
 * Supabase Auth + row level security (see supabase/migrations/20261018000000_admin_dashboard.sql).
 */
export type AppMode = "RESIDENT" | "ADMIN";

export const APP_MODE: AppMode = "RESIDENT";
