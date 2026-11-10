"use client";

import type { MatchView } from "@/domain/selectors";

export function FantasyCard({ view }: { view: MatchView }) {
  const fantasy = view.fantasy;
  if (!fantasy) return null;
  return (
    <section aria-label="Why points moved" className="mp-glass rounded-3xl p-4">
      <p className="mp-kicker text-white/45">Flex XI · sample</p>
      <div className="mt-1 flex items-end justify-between">
        <h2 className="mp-display text-4xl tabular-nums">{fantasy.total}</h2>
        <p className={`font-mono text-sm ${fantasy.delta >= 0 ? "text-[var(--mp-lime)]" : "text-[var(--mp-coral)]"}`}>
          {fantasy.delta > 0 ? "+" : ""}
          {fantasy.delta} this ball
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/80">{fantasy.summary}</p>
      <p className="mt-3 text-xs text-white/40">
        Dream11-like T20 scoring on a sample XI. Captain points double. Nothing here is entered in a contest.
      </p>
    </section>
  );
}
