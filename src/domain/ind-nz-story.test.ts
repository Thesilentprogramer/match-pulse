import { describe, expect, it } from "vitest";
import { indiaWicketBalls, indNzCard, indNzMeta, nzWicketBalls } from "../../fixtures/ind-nz-2nd-odi-2026";
import { containsBannedLanguage } from "@/domain/guard";
import { buildMatchStory } from "@/domain/story";
import { matchStorySchema } from "@/domain/story-schema";
import { storyDurationInFrames } from "@/remotion/timing";

describe("India vs New Zealand 2nd ODI story", () => {
  const story = buildMatchStory({
    meta: indNzMeta,
    deliveries: indiaWicketBalls,
    picks: [],
    card: indNzCard,
  });

  it("parses as Remotion props and stays on sourced lines", () => {
    const parsed = matchStorySchema.parse(story);
    const text = JSON.stringify(parsed);
    expect(parsed.team).toBe("India");
    expect(parsed.target).toBe(135);
    expect(parsed.final).toMatchObject({ runs: 113, wickets: 7, result: "won" });
    expect(parsed.mvp.name).toBe("Gurnoor Brar");
    expect(parsed.beats.map((beat) => beat.id)).toHaveLength(9);
    expect(text).toContain("Gill is out for 0");
    expect(text).toContain("4 for 30");
    expect(text).toContain("113 for 7 after 26");
    expect(text).toContain("Model estimate");
    expect(text.toLowerCase()).not.toContain("dream11");
    expect(text).not.toContain("Westpac");
    expect(containsBannedLanguage(text)).toBe(false);
    expect(storyDurationInFrames(false, parsed.beats)).toBe(1350);
  });

  it("keeps the delivery log to wicket balls whose runs were not published", () => {
    expect(nzWicketBalls).toHaveLength(10);
    expect(indiaWicketBalls).toHaveLength(7);
    for (const ball of [...nzWicketBalls, ...indiaWicketBalls]) {
      expect(ball.runsBat).toBe(0);
      expect(ball.note).toMatch(/Runs on this ball are not published/);
    }
    expect(nzWicketBalls[0]?.note).toContain("0/1");
    expect(indiaWicketBalls[0]?.note).toContain("Shubman Gill");
  });
});
