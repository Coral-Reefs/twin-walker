"use client";

import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * Animates a number to its new value. The animated text is hidden from screen readers;
 * they get the final value only (announcements come from the page's live region).
 */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const shown = useRef(value);

  useEffect(() => {
    if (reduced) {
      shown.current = value;
      setDisplay(value);
      return undefined;
    }
    const controls = animate(shown.current, value, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (v) => {
        shown.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [value, reduced]);

  return (
    <>
      <span aria-hidden="true" className="tabular-nums">
        {format(display)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
