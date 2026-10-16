"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { Icon } from "@/components/system/Icon";
import { useDb } from "@/components/system/DbProvider";
import type { DesignChange } from "@/lib/simulation/types";
import { DESIGN_ICON } from "@/lib/ui/styles";

interface Props {
  designs: DesignChange[];
  announce: (message: string) => void;
}

type Result = "synced" | "queued" | "local" | null;

const ORDINALS = ["1st", "2nd", "3rd"];

const RESULT_COPY: Record<Exclude<Result, null>, string> = {
  synced: "Your ranking has been added to the jury results.",
  queued: "The database is unreachable, so your ranking is saved on this device and will sync automatically.",
  local: "Saved on this device (demo mode: no database configured).",
};

export function RankingForm({ designs, announce }: Props) {
  const db = useDb();
  const [order, setOrder] = useState(() => designs.map((d) => d.id));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement | null>());

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    setOrder(next);
    const title = designs.find((d) => d.id === item)?.shortTitle ?? item;
    announce(`${title} moved to position ${target + 1} of ${order.length}.`);
    // Keep focus on the moved item; if it hit the end, use the other arrow.
    const atEdge = target === 0 || target === order.length - 1;
    const key = `${item}:${atEdge ? (dir === -1 ? "down" : "up") : dir === -1 ? "up" : "down"}`;
    requestAnimationFrame(() => buttons.current.get(key)?.focus());
  };

  const submit = async () => {
    setSubmitting(true);
    const r = await db.submitVote(order);
    setSubmitting(false);
    setResult(r);
    announce(`Ranking submitted. ${RESULT_COPY[r]}`);
  };

  const nextVisitor = () => {
    db.newVisitor();
    setOrder(designs.map((d) => d.id));
    setResult(null);
    announce("Ready for the next visitor.");
  };

  if (db.hasVoted || result) {
    return (
      <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
        <p className="flex items-center gap-2 text-base font-semibold text-good">
          <Icon name="check" size={20} strokeWidth={3} /> Thank you for serving on the jury
        </p>
        <p className="mt-1 text-sm text-ink">{result ? RESULT_COPY[result] : "This visitor has already voted."}</p>
        <button
          type="button"
          onClick={nextVisitor}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
        >
          <Icon name="refresh" size={16} /> Next visitor
        </button>
      </div>
    );
  }

  return (
    <form
      className="rounded-2xl border border-line bg-card p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      aria-labelledby="rank-heading"
    >
      <h3 id="rank-heading" className="text-base font-semibold">
        Your ranking
      </h3>
      <p id="rank-help" className="mt-1 text-sm text-ink-muted">
        Put the change you&rsquo;d fund first at the top. Use the arrow buttons to reorder.
      </p>
      <ol className="mt-3 space-y-2" aria-describedby="rank-help">
        <AnimatePresence initial={false}>
          {order.map((id, i) => {
            const d = designs.find((x) => x.id === id);
            if (!d) return null;
            return (
              <motion.li
                key={id}
                layout
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className="flex items-center gap-3 rounded-xl border border-line bg-white p-2.5"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                  <span aria-hidden="true">{i + 1}</span>
                  <span className="sr-only">{ORDINALS[i] ?? `${i + 1}th`} choice:</span>
                </span>
                <Icon name={DESIGN_ICON[d.icon]} size={20} className="shrink-0 text-brand" />
                <span className="min-w-0 flex-1 font-medium">{d.title}</span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    ref={(el) => {
                      buttons.current.set(`${id}:up`, el);
                    }}
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${d.shortTitle} up`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line hover:bg-stone-50 disabled:opacity-35"
                  >
                    <Icon name="arrow-up" size={18} />
                  </button>
                  <button
                    type="button"
                    ref={(el) => {
                      buttons.current.set(`${id}:down`, el);
                    }}
                    onClick={() => move(i, 1)}
                    disabled={i === order.length - 1}
                    aria-label={`Move ${d.shortTitle} down`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line hover:bg-stone-50 disabled:opacity-35"
                  >
                    <Icon name="arrow-down" size={18} />
                  </button>
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
      <button
        type="submit"
        disabled={submitting}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
      >
        <Icon name="ballot" size={18} />
        {submitting ? "Submitting…" : "Submit my ranking"}
      </button>
    </form>
  );
}
