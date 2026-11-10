import { describe, expect, it } from "vitest";
import { nextCricApiDelayMs, nextCricbuzzDelayMs } from "@/providers/cricapi/budget";
import { deliveriesFromTicks, readTick, snapshotFromMatch } from "@/providers/cricapi/delta";
import { foldDeliveries } from "@/domain/score";

const noon = Date.UTC(2026, 0, 1, 12, 0, 0);

describe("cricapi budget", () => {
  it("polls a moving live match about every 150 seconds on a fresh day", () => {
    const delay = nextCricApiDelayMs({ hitsToday: 0, hitsLimit: 100, now: noon, phase: "live", changed: true });
    expect(delay).toBe(150_000);
  });

  it("slows down when the score is still, on a break, and when the quota is gone", () => {
    const still = nextCricApiDelayMs({ hitsToday: 0, hitsLimit: 100, now: noon, phase: "live", changed: false });
    const gap = nextCricApiDelayMs({ hitsToday: 0, hitsLimit: 100, now: noon, phase: "break", changed: true });
    const spent = nextCricApiDelayMs({ hitsToday: 96, hitsLimit: 100, now: noon, phase: "live", changed: true });
    expect(still).toBeGreaterThan(150_000);
    expect(gap).toBeGreaterThan(still);
    expect(spent).toBe(12 * 60 * 60 * 1000);
  });

  it("keeps Cricbuzz inside a 15 to 30 second live window", () => {
    expect(nextCricbuzzDelayMs({ live: true, changed: true, failures: 0 })).toBe(15_000);
    expect(nextCricbuzzDelayMs({ live: true, changed: false, failures: 0 })).toBe(25_000);
    expect(nextCricbuzzDelayMs({ live: true, changed: false, failures: 3 })).toBe(30_000);
    expect(nextCricbuzzDelayMs({ live: false, changed: true, failures: 0 })).toBeGreaterThan(30_000);
  });
});

describe("cricapi score delta", () => {
  it("turns score jumps into over summaries and survives missing fields", () => {
    expect(readTick(undefined)).toEqual({ runs: 0, wickets: 0, legalBalls: 0 });
    expect(readTick({ r: "40", w: null, o: 6.2 })).toEqual({ runs: 40, wickets: 0, legalBalls: 38 });
    const deliveries = deliveriesFromTicks([
      { runs: 6, wickets: 0, legalBalls: 6 },
      { runs: 14, wickets: 1, legalBalls: 12 },
    ]);
    const summary = deliveries.find((delivery) => (delivery.boardSpan ?? 1) > 1);
    expect(summary?.note).toMatch(/Over summary/);
    expect(summary?.feed).toBe("scoreboard");
    expect(deliveries.some((delivery) => delivery.boundary)).toBe(false);
    const built = snapshotFromMatch({
      id: "abc",
      name: "India vs New Zealand",
      matchType: "odi",
      status: "India need 40",
      teams: ["India", "New Zealand"],
      score: [{ r: 200, w: 8, o: 40, inning: "NZ Inning 1" }, { r: 14, w: 1, o: 2, inning: "India Inning 1" }],
      matchStarted: true,
      matchEnded: false,
    });
    const score = foldDeliveries(built.deliveries, built.meta);
    expect(score.runs).toBe(14);
    expect(score.wickets).toBe(1);
    expect(score.legalBalls).toBe(12);
    expect(built.meta.target).toBe(201);
  });
});
