/** Free CricAPI tier. A reserve stays unused so the last calls of the day are not a surprise. */
export const CRICAPI_DAILY_LIMIT = 100;
export const CRICAPI_RESERVE = 4;

export type CricPhase = "live" | "break" | "soon" | "finished";

export interface BudgetInput {
  hitsToday: number;
  hitsLimit: number;
  now: number;
  phase: CricPhase;
  changed: boolean;
}

/**
 * Spread the remaining hits across a live window instead of the whole day.
 * A fresh day and a live, moving match lands near 150 seconds. Silence, a break,
 * and an exhausted quota all wait longer.
 */
export function nextCricApiDelayMs(input: BudgetInput): number {
  const limit = input.hitsLimit > 0 ? input.hitsLimit : CRICAPI_DAILY_LIMIT;
  const left = limit - Math.max(0, input.hitsToday) - CRICAPI_RESERVE;
  const dayLeft = msUntilUtcMidnight(input.now);
  if (left <= 0) return dayLeft;

  if (input.phase === "finished") return clamp(Math.max(30 * 60_000, dayLeft / left), 30 * 60_000, 60 * 60_000);
  if (input.phase === "soon") return clamp(dayLeft / left, 15 * 60_000, 45 * 60_000);

  const horizon = Math.min(dayLeft, input.phase === "break" ? 2 * 60 * 60_000 : 4 * 60 * 60_000);
  let even = horizon / left;
  if (input.phase === "break") even *= 3;
  else if (!input.changed) even *= 2;
  if (input.phase === "break") return clamp(even, 10 * 60_000, 30 * 60_000);
  if (!input.changed) return clamp(even, 3 * 60_000, 20 * 60_000);
  return clamp(even, 90_000, 15 * 60_000);
}

export function msUntilUtcMidnight(now: number): number {
  const date = new Date(now);
  const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return Math.max(60_000, next - now);
}

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}

/** Cricbuzz is the fast source. Stay inside 15–30s while a match is live. */
export function nextCricbuzzDelayMs(input: { live: boolean; changed: boolean; failures: number }): number {
  if (!input.live) return 120_000;
  const base = input.changed ? 15_000 : 25_000;
  return Math.min(30_000, base + Math.max(0, input.failures) * 5_000);
}
