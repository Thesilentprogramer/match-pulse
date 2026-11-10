/** Matches `maxDuration` on the live feed route. Hobby cannot raise this. */
export const SSE_MAX_DURATION_SEC = 300;

/** Close the stream before the platform kills the function, so the client can resume. */
export const SSE_YIELD_MARGIN_MS = 15_000;

export const SSE_HEARTBEAT_MS = 5_000;

/**
 * On Vercel, return the timestamp when this invocation should stop sending balls.
 * Local Node has no platform deadline, so the innings stays on one connection.
 */
export function streamYieldAt(
  env: NodeJS.ProcessEnv,
  startedAt: number,
  maxDurationSec = SSE_MAX_DURATION_SEC,
): number | null {
  if (env.VERCEL !== "1") return null;
  return startedAt + maxDurationSec * 1000 - SSE_YIELD_MARGIN_MS;
}

export function shouldYieldStream(now: number, yieldAt: number | null, upcomingDelayMs = 0): boolean {
  if (yieldAt === null) return false;
  return now + Math.max(0, upcomingDelayMs) >= yieldAt;
}
