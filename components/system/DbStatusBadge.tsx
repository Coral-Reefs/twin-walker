"use client";

import { Icon } from "./Icon";
import { useDb } from "./DbProvider";

const COPY = {
  connecting: { text: "Connecting…", detail: "Checking the vote database", cls: "bg-stone-100 text-ink", icon: "database" },
  online: { text: "Live", detail: "Votes and analytics are syncing", cls: "bg-good-soft text-good", icon: "database" },
  offline: { text: "Offline mode", detail: "Using local data; votes are saved on this device", cls: "bg-warn-soft text-warn", icon: "database-off" },
  unconfigured: { text: "Demo mode", detail: "No database configured; everything runs on local data", cls: "bg-stone-100 text-ink", icon: "database-off" },
} as const;

/** Always-visible database status, with a retry path when it is unreachable. */
export function DbStatusBadge() {
  const { status, error, retry, retrying, pendingVotes, pendingEventCount } = useDb();
  const c = COPY[status];
  const pending = pendingVotes.length + pendingEventCount;

  return (
    <div className="flex items-center gap-2">
      <p role="status" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${c.cls}`} title={error ?? c.detail}>
        <Icon name={c.icon} size={14} className={status === "connecting" ? "animate-pulse" : undefined} />
        {c.text}
        <span className="sr-only">: {c.detail}</span>
        {pending > 0 && status !== "unconfigured" && <span className="font-medium">· {pending} waiting to sync</span>}
      </p>
      {status === "offline" && (
        <button
          type="button"
          onClick={() => void retry()}
          disabled={retrying}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-stone-50 disabled:opacity-60"
        >
          <Icon name="refresh" size={14} className={retrying ? "animate-spin" : undefined} />
          {retrying ? "Retrying…" : "Retry"}
        </button>
      )}
    </div>
  );
}
