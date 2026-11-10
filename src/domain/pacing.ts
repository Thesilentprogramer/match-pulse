/**
 * Broadcast pacing is a product constant, not a transport detail.
 * The server sleeps these gaps. The client's delay buffer then shifts
 * the same arrivals. Tests lock the numbers so a "3 minute arc" stays honest.
 */

export const PACE = {
  /** Gap between balls inside an over at 1×, in ms. */
  ballGapMs: 3800,
  /** Pause before the first ball of overs 2–20 at 1×. This is the pick window. */
  overBreakMs: 8000,
  /** Floor so fast-forward still leaves a moment to call the over. */
  minOverBreakMs: 4200,
  /** First ball after connect, so the shell does not sit empty. */
  firstEventMs: 280,
  /** Seek catch-up gap. Fast, but not a single dumped frame. */
  catchupGapMs: 12,
} as const;

export type PlaybackSpeed = 1 | 5 | 20;

export function ballGapMs(speed: number): number {
  return PACE.ballGapMs / clampSpeed(speed);
}

export function overBreakMs(speed: number): number {
  return Math.max(PACE.minOverBreakMs, PACE.overBreakMs / clampSpeed(speed));
}

export function clampSpeed(speed: number): PlaybackSpeed {
  if (speed >= 20) return 20;
  if (speed >= 5) return 5;
  return 1;
}

/** Delay before sending `delivery`, given it is not a catch-up event. */
export function leadInMs(
  delivery: { over: number; legalBall: number; kind: string },
  speed: number,
  first: boolean,
): number {
  if (first) return PACE.firstEventMs;
  const opensOver = delivery.legalBall === 1 && delivery.kind !== "wide" && delivery.over > 0;
  return opensOver ? overBreakMs(speed) : ballGapMs(speed);
}
