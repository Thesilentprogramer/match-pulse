import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createLivePoller, type PollerDeps } from "@/providers/live/poller";
import type { CricApiResult } from "@/providers/cricapi/client";

const liveHtml = readFileSync(new URL("../../../fixtures/cricbuzz/live-scores.html", import.meta.url), "utf8");
const matchHtml = readFileSync(new URL("../../../fixtures/cricbuzz/match-page.html", import.meta.url), "utf8");

function harness(over: Partial<PollerDeps> & { api?: () => Promise<CricApiResult> } = {}) {
  let now = 1_000_000;
  let matchCalls = 0;
  let apiCalls = 0;
  const logs: string[] = [];
  const poller = createLivePoller({
    cricbuzzLive: async () => liveHtml,
    cricbuzzMatch: async () => {
      matchCalls += 1;
      if (over.cricbuzzMatch) return over.cricbuzzMatch(175690);
      return matchHtml;
    },
    cricApi: async () => {
      apiCalls += 1;
      if (over.api) return over.api();
      throw new Error("no-key");
    },
    log: (message) => logs.push(message),
    ...over,
    now: () => now,
  });
  return {
    poller,
    logs,
    advance: (ms: number) => {
      now += ms;
    },
    calls: () => ({ matchCalls, apiCalls }),
  };
}

describe("live poller", () => {
  it("serves every client from one Cricbuzz fetch until the delay elapses", async () => {
    const { poller, calls, advance } = harness();
    const catalog = await poller.getCatalog();
    expect(catalog.matches.some((match) => match.badge === "cricbuzz" && match.id === "cb-175690")).toBe(true);
    expect(catalog.matches.some((match) => match.badge === "demo")).toBe(true);
    const first = await poller.getMatch("cb-175690");
    const second = await poller.getMatch("cb-175690");
    expect(first.badge).toBe("cricbuzz");
    expect(second.deliveries).toEqual(first.deliveries);
    expect(calls().matchCalls).toBe(1);
    advance(first.waitMs + 1);
    await poller.getMatch("cb-175690");
    expect(calls().matchCalls).toBe(2);
    expect(calls().apiCalls).toBe(0);
  });

  it("fails over to CricAPI, then the demo, without an empty list", async () => {
    const blocked = harness({
      cricbuzzMatch: async () => {
        throw new Error("Cricbuzz blocked the request.");
      },
      api: async () => ({
        body: {
          status: "success",
          data: [
            {
              id: "nz-ind",
              name: "India U19 vs United Arab Emirates U19",
              teams: ["India U19", "United Arab Emirates U19"],
              matchType: "odi",
              score: [{ r: 80, w: 2, o: 10, inning: "India U19 Inning 1" }],
              matchStarted: true,
              matchEnded: false,
              status: "In play",
            },
          ],
          info: { hitsToday: 4, hitsLimit: 100 },
        },
        hitsToday: 4,
        hitsLimit: 100,
      }),
    });
    await blocked.poller.getCatalog();
    const snap = await blocked.poller.getMatch("cb-175690");
    expect(snap.badge).toBe("cricapi");
    expect(snap.note).toMatch(/CricAPI/);
    expect(snap.deliveries.length).toBeGreaterThan(0);
    expect(snap.hitsToday).toBe(4);

    const down = harness({
      cricbuzzLive: async () => {
        throw new Error("Cricbuzz blocked the request.");
      },
    });
    const catalog = await down.poller.getCatalog();
    expect(catalog.source).toBe("demo");
    expect(catalog.matches.length).toBeGreaterThan(0);
    expect(catalog.note).toMatch(/CRICAPI_KEY/);
    expect(down.logs.length).toBeGreaterThan(0);
  });
});
