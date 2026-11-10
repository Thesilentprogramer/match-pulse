"use client";

import { motion, useReducedMotion } from "framer-motion";
import { playerName } from "@/domain/players";
import type { InningsMeta } from "@/domain/types";
import type { MatchView } from "@/domain/selectors";
import { NumberTicker } from "@/components/number-ticker";

export function Scorebug({
  meta,
  view,
  burst,
}: {
  meta: InningsMeta | null;
  view: MatchView;
  burst: "six" | "wicket" | "result" | null;
}) {
  const score = view.score;
  const batting = meta?.teams.find((team) => team.id === meta.battingTeamId);
  const bowling = meta?.teams.find((team) => team.id === meta.bowlingTeamId);
  const striker = batterLine(meta, score?.strikerId ?? null, score, true);
  const nonStriker = batterLine(meta, score?.nonStrikerId ?? null, score, false);

  return (
    <section
      className={`mp-glass relative mt-3 overflow-visible rounded-3xl p-4 sm:p-5 ${burst ? "pt-8" : ""}`}
      aria-label="Score"
    >
      {burst ? (
        <p
          className={`mp-display absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 rounded-full px-4 py-1 text-2xl shadow-[var(--mp-elev-2)] ${
            burst === "wicket" ? "bg-[var(--mp-coral)] text-black" : "bg-[var(--mp-accent)] text-white"
          }`}
        >
          {burst === "wicket" ? "Wicket" : burst === "result" ? "Home" : "Six"}
        </p>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mp-kicker text-muted-foreground">
            <span className="mr-2 inline-block size-1.5 rounded-full" style={{ background: batting?.color ?? "var(--mp-teal)" }} />
            {batting?.name ?? "Harbor Kings"}
            <span className="mx-2 text-white/35">vs</span>
            <span className="mr-2 inline-block size-1.5 rounded-full" style={{ background: bowling?.color ?? "var(--mp-coral)" }} />
            {bowling?.short ?? "LIONS"} {meta ? meta.firstInnings.replace(`${bowling?.name ?? ""} `, "") : "185/6"}
          </p>
          <div className="mt-2 flex items-end gap-3">
            <p className="mp-display text-6xl text-white tabular-nums sm:text-7xl">
              {score ? (
                <>
                  <NumberTicker value={score.runs} />
                  <span className="text-white/35">/{score.wickets}</span>
                </>
              ) : (
                <span className="text-white/30">–</span>
              )}
            </p>
            <p className="mb-1 font-mono text-sm text-[var(--mp-lime)] tabular-nums">{score?.oversLabel ?? "0.0"}</p>
          </div>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{view.equation}</p>
        </div>
        <WinDial value={view.winProb} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label="CRR" value={view.crrLabel} />
        <Stat label="RRR" value={view.rrrLabel} />
        <Stat label="Strike" value={striker} />
        <Stat label="Other end" value={nonStriker} />
      </dl>
      {view.tape.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-1.5" aria-label={view.tapeLabel}>
          <span className="mp-kicker mr-1 text-muted-foreground">{view.tapeLabel}</span>
          {view.tape.map((chip, index) => (
            <span
              key={`${chip}-${index}`}
              className={`grid size-7 place-items-center rounded-md font-mono text-xs ${chipColor(chip)}`}
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2">
      <dt className="mp-kicker text-white/40">{label}</dt>
      <dd className="mt-1 truncate font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function batterLine(meta: InningsMeta | null, id: string | null, score: MatchView["score"], strike: boolean): string {
  if (!meta || !id || !score) return "—";
  const card = score.batters[id] ?? { runs: 0, balls: 0, out: false };
  const star = card.out ? "" : strike ? "*" : "";
  const surname = playerName(meta, id).split(" ").slice(-1)[0] ?? "";
  return `${surname} ${card.runs}${star} (${card.balls})`;
}

function chipColor(chip: string): string {
  if (chip.includes("W")) return "bg-[var(--mp-coral)] text-black";
  if (chip === "6") return "bg-[var(--mp-accent)] text-white";
  if (chip === "4") return "bg-[var(--mp-teal)] text-black";
  if (chip === "0" || chip === "wd") return "bg-white/10 text-white/70";
  return "bg-white/15 text-white";
}

function WinDial({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  return (
    <div className="relative grid size-[4.5rem] shrink-0 place-items-center">
      <svg viewBox="0 0 72 72" className="absolute inset-0 size-full" aria-hidden>
        <circle cx="36" cy="36" r={radius} stroke="rgb(255 255 255 / 16%)" strokeWidth="7" fill="none" />
        <motion.circle
          cx="36"
          cy="36"
          r={radius}
          stroke="var(--mp-lime)"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={false}
          animate={{ strokeDashoffset: circ * (1 - Math.min(1, Math.max(0, value))) }}
          transition={reduce ? { duration: 0 } : { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ transformOrigin: "36px 36px", rotate: -90 }}
        />
      </svg>
      <div className="text-center">
        <p className="mp-display text-xl tabular-nums">{Math.round(value * 100)}</p>
        <p className="mp-kicker text-[0.55rem] text-white/50">win</p>
      </div>
    </div>
  );
}
