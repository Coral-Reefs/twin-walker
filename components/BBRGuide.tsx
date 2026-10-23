"use client";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "dayzero-bbr-tour-seen";

type Step = {
  title: string;
  body: string;
  target?: string;
  before?: () => void;
};

export default function BBRGuide({
  setTab,
  setView,
  autoOpen,
}: {
  setTab: (id: string) => void;
  setView: (id: string) => void;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [spot, setSpot] = useState<DOMRect | null>(null);
  const highlighted = useRef<HTMLElement | null>(null);

  const steps: Step[] = [
    {
      title: "Welcome to DayZero",
      body: "A real OpenStreetMap snapshot of Bandar Bukit Raja. We simulate four illustrative residents walking, wheeling and driving their day. Every number on this page is an assumption — try changes and see who gets their time back.",
    },
    {
      title: "1 · Pick a resident",
      body: "Four mobility profiles — a working parent, a shift worker, a wheelchair user and a walking-aid user. Each starts with their own illustrative default routine and departure time. The one you pick is who you build the day for.",
      target: "[data-tour='persona']",
      before: () => {
        setView("explore");
        setTab("resident");
      },
    },
    {
      title: "2 · Build the routine",
      body: "Each stop has a destination, a travel mode (walk/wheel or drive + park) and an activity dwell time. Reorder stops with the arrows. Reset returns the persona's default routine. The time budget flags days that run long.",
      target: "[data-tour='routine']",
      before: () => {
        setView("explore");
        setTab("routine");
      },
    },
    {
      title: "3 · Watch the day on the map",
      body: "Hit Play on the dock to animate the journey. The dock shows total minutes, walking distance, wait + parking time, assumed rest barriers and % of the route that is shaded. Search for places or click a pin to add it.",
      target: "[data-tour='journey']",
      before: () => {
        setView("explore");
        setTab("routine");
      },
    },
    {
      title: "4 · Try an intervention",
      body: "Three illustrative changes: shaded rest stops, shorter crossing waits, a family pickup area. Toggle them and the route recalculates instantly. You can also click the map to place a 250 m shaded zone yourself.",
      target: "[data-tour='design']",
      before: () => {
        setView("explore");
        setTab("design");
      },
    },
    {
      title: "5 · Compare across residents",
      body: "Each persona runs their own routine. See who benefits, where the trade-offs are, and — in the Precinct impact panel — what share of ~150 candidate homes finish within the time budget before and after your changes.",
      target: "[data-tour='nav-compare']",
      before: () => setView("compare"),
    },
    {
      title: "You're set",
      body: "Everything is an illustrative assumption. Open Data & assumptions anytime to see the sources and limits. Replay this tour with the ? button in the header.",
      before: () => setView("explore"),
    },
  ];

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    if (!open) {
      if (highlighted.current) {
        highlighted.current.classList.remove("tour-highlight");
        highlighted.current = null;
      }
      setSpot(null);
      return;
    }
    const step = steps[i]!;
    step.before?.();
    const t = window.setTimeout(() => {
      if (highlighted.current) {
        highlighted.current.classList.remove("tour-highlight");
        highlighted.current = null;
      }
      if (step.target) {
        const el = document.querySelector(step.target) as HTMLElement | null;
        if (el) {
          el.classList.add("tour-highlight");
          highlighted.current = el;
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
          setSpot(el.getBoundingClientRect());
          return;
        }
      }
      setSpot(null);
    }, 60);
    return () => window.clearTimeout(t);
  }, [i, open]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (highlighted.current) setSpot(highlighted.current.getBoundingClientRect());
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const close = (markSeen: boolean) => {
    setOpen(false);
    setI(0);
    if (markSeen) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {}
    }
  };

  return (
    <>
      <button
        className="tour-launcher"
        onClick={() => {
          setI(0);
          setOpen(true);
        }}
        aria-label="Replay guided tour"
        title="Replay guided tour"
      >
        ? Tour
      </button>
      {open && (
        <>
          <div className="tour-backdrop" aria-hidden="true" />
          {spot && (
            <div
              className="tour-spotlight"
              style={{
                top: spot.top - 6,
                left: spot.left - 6,
                width: spot.width + 12,
                height: spot.height + 12,
              }}
              aria-hidden="true"
            />
          )}
          <div
            className="tour-card"
            role="dialog"
            aria-live="polite"
            aria-labelledby="tour-title"
          >
            <span className="tour-step">
              Step {i + 1} of {steps.length}
            </span>
            <h3 id="tour-title">{steps[i]!.title}</h3>
            <p>{steps[i]!.body}</p>
            <div className="tour-actions">
              <button className="text-button" onClick={() => close(true)}>
                Skip tour
              </button>
              <div>
                {i > 0 && (
                  <button
                    className="tour-btn"
                    onClick={() => setI((v) => v - 1)}
                  >
                    ← Back
                  </button>
                )}
                {i < steps.length - 1 ? (
                  <button
                    className="tour-btn primary"
                    onClick={() => setI((v) => v + 1)}
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    className="tour-btn primary"
                    onClick={() => close(true)}
                  >
                    Start exploring
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export function useFirstVisit(): boolean {
  const [first, setFirst] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setFirst(true);
    } catch {}
  }, []);
  return first;
}
