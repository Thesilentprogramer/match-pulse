"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export function NumberTicker({
  value,
  className,
  format = (next) => String(Math.round(next)),
}: {
  value: number;
  className?: string;
  format?: (value: number) => string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduce || Math.abs(value - from.current) > 30) {
      from.current = value;
      setDisplay(value);
      return;
    }
    const startValue = from.current;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 420);
      const eased = 1 - (1 - t) ** 3;
      const next = startValue + (value - startValue) * eased;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, value]);

  return <span className={className}>{format(display)}</span>;
}
