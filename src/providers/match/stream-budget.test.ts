import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fixtureSource } from "@/domain/fixture";
import { planBroadcast } from "@/providers/match/broadcast";
import { consumeSse, encodeSse } from "@/providers/match/sse";
import { SSE_MAX_DURATION_SEC, shouldYieldStream, streamYieldAt } from "@/providers/match/stream-budget";

describe("sse budget", () => {
  it("yields only on Vercel, ahead of the function limit", () => {
    const started = 1_000;
    expect(streamYieldAt({ NODE_ENV: "test" }, started)).toBeNull();
    const yieldAt = streamYieldAt({ NODE_ENV: "test", VERCEL: "1" }, started);
    expect(yieldAt).toBe(started + SSE_MAX_DURATION_SEC * 1000 - 15_000);
    expect(shouldYieldStream(started, null, 60_000)).toBe(false);
    if (yieldAt === null) throw new Error("expected a Vercel deadline");
    expect(shouldYieldStream(yieldAt - 8_000, yieldAt, 8_000)).toBe(true);
    expect(shouldYieldStream(yieldAt - 8_001, yieldAt, 8_000)).toBe(false);
  });

  it("the route exports the same literal budget Next.js can read", () => {
    const source = readFileSync(new URL("../../app/api/match/stream/route.ts", import.meta.url), "utf8");
    expect(source).toContain(`export const maxDuration = ${SSE_MAX_DURATION_SEC}`);
    expect(source).not.toMatch(/^export const runtime\b/m);
  });

  it("a full 1× innings does not fit in one function", () => {
    const plan = planBroadcast(fixtureSource, { afterSeq: 0, speed: 1, jitter: false, burstUntilSeq: 0 });
    const total = plan.reduce((sum, step) => sum + step.delayMs, 0);
    expect(total).toBeGreaterThan(SSE_MAX_DURATION_SEC * 1000);
  });

  it("ignores heartbeat comments", () => {
    const consumed = consumeSse(`: open\n\n: ping\n\n${encodeSse("delivery", { seq: 4 }, 4)}`);
    expect(consumed.messages).toHaveLength(1);
    expect(consumed.messages[0]?.event).toBe("delivery");
  });
});
