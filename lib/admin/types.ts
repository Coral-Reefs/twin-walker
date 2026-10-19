export type SuggestionStatus = "new" | "reviewing" | "planned" | "declined";
export type ProjectStatus = "planned" | "in_progress" | "blocked" | "done";

export const SUGGESTION_STATUSES: SuggestionStatus[] = ["new", "reviewing", "planned", "declined"];
export const PROJECT_STATUSES: ProjectStatus[] = ["planned", "in_progress", "blocked", "done"];

/** One row per browser session; a resident can change their choice, so this is the latest one. */
export interface JuryVote {
  session_id: string;
  option_id: string;
  created_at: string;
  updated_at: string;
}

export interface JurySuggestion {
  id: string;
  client_id: string;
  session_id: string;
  place: string;
  body: string;
  status: SuggestionStatus;
  admin_note: string | null;
  project_id: string | null;
  created_at: string;
}

/** The only suggestion fields an admin may change (enforced again by column grants in SQL). */
export type SuggestionPatch = Partial<Pick<JurySuggestion, "status" | "admin_note" | "project_id">>;

export interface PlannerProject {
  id: string;
  title: string;
  description: string;
  /** Resident Jury proposal id (seating | crossing | pickup) or null for a custom project. */
  option_id: string | null;
  /** ISO dates, YYYY-MM-DD, both inclusive. */
  start_date: string;
  end_date: string;
  status: ProjectStatus;
  progress: number;
  budget_rm: number | null;
  owner: string | null;
  /** Finish-to-start: this project should start after each of these has ended. */
  depends_on: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ProjectDraft = Omit<PlannerProject, "id" | "created_at" | "updated_at">;

/** Sent from the overview / inbox to the planner to open the editor with a pre-filled project. */
export interface PlannerRequest {
  draft: Partial<ProjectDraft>;
  /** When set, the new project is linked to this suggestion and the suggestion is marked "planned". */
  suggestionId?: string;
}
