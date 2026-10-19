import { getSupabase, withTimeout } from "@/lib/supabase/client";
import { KEYS, newId, readJson, writeJson } from "@/lib/supabase/storage";

/**
 * Resident Jury -> Supabase. BBRApp keeps its own localStorage copy exactly as before;
 * these helpers additionally send each vote / suggestion to the township team's dashboard.
 *
 *   "sent"         stored in Supabase
 *   "queued"       network problem; kept on this device and retried automatically
 *   "unavailable"  Supabase isn't configured (demo mode), nothing to send to
 *   "failed"       the database rejected it (e.g. text too long); will not be retried
 */
export type JuryOutcome = "sent" | "queued" | "unavailable" | "failed";

type QueueItem =
  | { kind: "vote"; session_id: string; option_id: string }
  | { kind: "suggestion"; client_id: string; session_id: string; place: string; body: string };

type Queued = QueueItem & { qid: string };
type SendResult = "ok" | "retry" | "drop";

const QUEUE_KEY = "dayzero.bbr.pendingJury";
const MAX_QUEUE = 100;
const SYNC_MS = 30_000;
const UNIQUE_VIOLATION = "23505";

let flushing = false;

/** Same anonymous per-browser id the rest of the app already uses. */
function sessionId(): string {
  let sid = readJson<string>(KEYS.session, "");
  if (!sid) {
    sid = newId();
    writeJson(KEYS.session, sid);
  }
  return sid;
}

const readQueue = (): Queued[] => readJson<Queued[]>(QUEUE_KEY, []);
const writeQueue = (queue: Queued[]) => writeJson(QUEUE_KEY, queue.slice(-MAX_QUEUE));

/** Only the latest vote per session matters, so a newer vote replaces any queued older one. */
function dropQueuedVotes(session: string) {
  writeQueue(readQueue().filter((q) => !(q.kind === "vote" && q.session_id === session)));
}

function enqueue(item: QueueItem) {
  const base = item.kind === "vote" ? readQueue().filter((q) => !(q.kind === "vote" && q.session_id === item.session_id)) : readQueue();
  writeQueue([...base, { ...item, qid: newId() }]);
}

/**
 * Network trouble (no response, timeout) -> "retry".
 * The database answering with an error code (constraint / policy violation) -> "drop", because retrying cannot help.
 * A duplicate client_id means an earlier attempt already landed, which counts as success.
 */
async function send(item: QueueItem): Promise<SendResult> {
  const client = getSupabase();
  if (!client) return "retry";
  try {
    const { error } =
      item.kind === "vote"
        ? await withTimeout(client.rpc("cast_jury_vote", { p_session: item.session_id, p_option: item.option_id }))
        : await withTimeout(
            client.from("jury_suggestions").insert({
              client_id: item.client_id,
              session_id: item.session_id,
              place: item.place,
              body: item.body,
            }),
          );
    if (!error || error.code === UNIQUE_VIOLATION) return "ok";
    if (error.code) {
      console.warn("[DayZero] jury item rejected by the database", error.code, error.message);
      return "drop";
    }
    return "retry";
  } catch {
    return "retry";
  }
}

/** Sends everything that was queued while offline. Never throws. */
export async function flushJuryQueue(): Promise<void> {
  if (flushing || !getSupabase()) return;
  flushing = true;
  try {
    for (const item of readQueue()) {
      const result = await send(item);
      if (result === "retry") break;
      writeQueue(readQueue().filter((q) => q.qid !== item.qid));
    }
  } finally {
    flushing = false;
  }
}

export async function castVote(optionId: string): Promise<JuryOutcome> {
  if (!getSupabase()) return "unavailable";
  const session = sessionId();
  const result = await send({ kind: "vote", session_id: session, option_id: optionId });
  if (result === "retry") {
    enqueue({ kind: "vote", session_id: session, option_id: optionId });
    return "queued";
  }
  dropQueuedVotes(session); // a stale queued vote must never overwrite this newer choice
  return result === "ok" ? "sent" : "failed";
}

export async function submitSuggestion(input: { place: string; text: string }): Promise<JuryOutcome> {
  if (!getSupabase()) return "unavailable";
  const item: QueueItem = {
    kind: "suggestion",
    client_id: newId(),
    session_id: sessionId(),
    place: input.place.trim().slice(0, 120) || "Study area",
    body: input.text.trim().slice(0, 600),
  };
  const result = await send(item);
  if (result === "retry") {
    enqueue(item);
    return "queued";
  }
  return result === "ok" ? "sent" : "failed";
}

/** Call once from a mount effect: flushes now, when the browser comes back online, and every 30 s. Returns the cleanup. */
export function startJurySync(): () => void {
  void flushJuryQueue();
  const timer = window.setInterval(() => {
    if (document.visibilityState === "visible") void flushJuryQueue();
  }, SYNC_MS);
  const onOnline = () => void flushJuryQueue();
  window.addEventListener("online", onOnline);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("online", onOnline);
  };
}
