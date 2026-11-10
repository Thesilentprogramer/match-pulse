import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { foldDeliveries } from "@/domain/score";
import { parseLiveScoresHtml, parseMatchHtml } from "@/providers/cricbuzz/parse";

const liveHtml = readFileSync(new URL("../../../fixtures/cricbuzz/live-scores.html", import.meta.url), "utf8");
const matchHtml = readFileSync(new URL("../../../fixtures/cricbuzz/match-page.html", import.meta.url), "utf8");

describe("cricbuzz parsers", () => {
  it("reads in-progress matches from the live scores page", () => {
    const matches = parseLiveScoresHtml(liveHtml);
    expect(matches.map((match) => match.matchId)).toEqual([175690, 161260]);
    expect(matches[0]?.inProgress).toBe(true);
    expect(matches[1]?.inProgress).toBe(false);
    expect(matches[0]?.title).toContain("INDU19");
    expect(matches[0]?.city).toBe("Al Amerat");
    expect(matches[0]?.scoreText).toContain("11/2");
  });

  it("turns commentary plus the scoreboard into one log", () => {
    const snapshot = parseMatchHtml(matchHtml);
    const score = foldDeliveries(snapshot.deliveries, snapshot.meta);
    expect(score.runs).toBe(11);
    expect(score.wickets).toBe(2);
    expect(score.legalBalls).toBe(6);
    const summary = snapshot.deliveries.find((delivery) => delivery.feed === "scoreboard");
    expect(summary?.note).toMatch(/Scoreboard before the live commentary/);
    expect(summary?.boardSpan).toBeGreaterThan(1);
    const four = snapshot.deliveries.find((delivery) => delivery.boundary === 4);
    expect(four?.feed).toBe("ball");
    expect(four?.strikerId).toBe("1");
    const wicket = snapshot.deliveries.find((delivery) => delivery.wicket && delivery.feed === "ball");
    expect(wicket?.wicket?.dismissal).toBe("caught");
    expect(snapshot.deliveries.some((delivery) => delivery.kind === "wide")).toBe(true);
    expect(snapshot.meta.venue).toContain("Al Amerat");
    expect(snapshot.inProgress).toBe(true);
  });

  it("rejects a page with no payload", () => {
    expect(() => parseLiveScoresHtml("<html><body>nothing</body></html>")).toThrow(/no match payload/);
  });
});
