"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[DayZero] page error", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-ink-muted">DayZero runs on local data, so reloading usually fixes this.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-strong"
      >
        Try again
      </button>
    </main>
  );
}
