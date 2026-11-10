"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { MatchView } from "@/domain/selectors";

export function PodPanel({ view }: { view: MatchView }) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...view.meter.map((row) => Math.abs(row.delta)));

  return (
    <section aria-label="Pod" className="mp-glass rounded-3xl p-4">
      <p className="mp-kicker text-[var(--mp-teal)]">Pod · night watch</p>
      <h2 className="mp-display mt-1 text-4xl">Stand meter</h2>
      <p className="mt-1 text-sm text-muted-foreground">Five friends, simulated, calling the same overs you are. Nobody paid to be here.</p>
      <ul className="mt-4 grid gap-2">
        {view.meter.map((row) => {
          const width = Math.max(8, (Math.abs(row.delta) / max) * 100);
          return (
            <li key={row.memberId} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-sm">
              <span className={row.you ? "font-semibold text-[var(--mp-lime)]" : "text-white/80"}>{row.name}</span>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: row.delta === 0 ? "rgb(255 255 255 / 25%)" : row.delta < 0 ? "var(--mp-coral)" : row.color }}
                  initial={false}
                  animate={{ width: `${row.delta === 0 ? 4 : width}%` }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 18 }}
                />
              </div>
              <span className="w-10 text-right font-mono text-xs tabular-nums">
                {row.delta > 0 ? "+" : ""}
                {row.delta}
              </span>
            </li>
          );
        })}
      </ul>
      {view.take ? (
        <blockquote className="mt-4 rounded-2xl bg-black/30 px-3 py-3 text-sm leading-relaxed">
          <p className="mp-kicker text-[var(--mp-gold)]">Take of the over</p>
          <p className="mt-1">{view.take}</p>
        </blockquote>
      ) : null}
      {view.callouts.length > 0 ? (
        <ul className="mt-3 grid gap-1 text-sm text-white/70">
          {view.callouts.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      <ol className="mt-4 grid gap-1.5">
        {view.standings.map((row) => (
          <li key={row.memberId} className="flex items-center justify-between text-sm">
            <span className={row.you ? "text-[var(--mp-lime)]" : ""}>
              {row.rank}. {row.name}
              {row.streak > 1 ? <span className="ml-2 text-xs text-white/40">{row.streak} straight</span> : null}
            </span>
            <span className="font-mono tabular-nums">{row.points}</span>
          </li>
        ))}
      </ol>
      {view.badges.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {view.badges.map((badge) => (
            <li key={badge.id} className="rounded-full border border-white/15 px-2 py-1 text-xs" title={badge.detail}>
              {badge.label}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
