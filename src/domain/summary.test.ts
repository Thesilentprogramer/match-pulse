import { describe, expect, it } from "vitest";
import { FIXTURE } from "@/domain/fixture";
import { indiaWicketBalls, indNzCard, indNzMeta } from "../../fixtures/ind-nz-2nd-odi-2026";
import { validateGroundedAnswer } from "@/domain/grounding";
import { allowedSummaryNumbers, buildMatchSummary, narrateBeat, sketchKind, summaryCacheKey } from "@/domain/summary";
import { buildMatchStory } from "@/domain/story";

describe("match summary", () => {
  it("maps shot events onto sketch scenes", () => {
    expect(sketchKind("spell")).toBe("wicket");
    expect(sketchKind("block")).toBe("fighter");
    expect(sketchKind("collapse")).toBe("collapse");
    expect(sketchKind("partnership")).toBe("partnership");
    expect(sketchKind("rain")).toBe("rain");
    expect(sketchKind("celebration")).toBe("result");
    expect(sketchKind("establish")).toBe("toss");
  });

  it("builds a spoken summary for two different matches, quoting only known numbers", () => {
    const harbor = buildMatchSummary({ meta: FIXTURE.meta, deliveries: FIXTURE.deliveries, picks: [] });
    const wellington = buildMatchSummary({
      meta: indNzMeta,
      deliveries: indiaWicketBalls,
      picks: [],
      card: indNzCard,
    });
    expect(harbor.scenes.length).toBeGreaterThan(1);
    expect(wellington.scenes.map((scene) => scene.kind)).toEqual([
      "wicket",
      "fighter",
      "collapse",
      "partnership",
      "rain",
      "result",
    ]);
    expect(harbor.scenes[0]?.headline).not.toBe(wellington.scenes[0]?.headline);
    const harborStory = buildMatchStory({ meta: FIXTURE.meta, deliveries: FIXTURE.deliveries, picks: [] });
    const wellingtonStory = buildMatchStory({ meta: indNzMeta, deliveries: indiaWicketBalls, picks: [], card: indNzCard });
    for (const scene of harbor.scenes) {
      expect(validateGroundedAnswer(scene.narration, allowedSummaryNumbers(harborStory, null)).ok).toBe(true);
    }
    for (const scene of wellington.scenes) {
      expect(validateGroundedAnswer(scene.narration, allowedSummaryNumbers(wellingtonStory, null)).ok).toBe(true);
      expect(scene.narration).not.toMatch(/\bbet|wager|cash\b/i);
    }
  });

  it("drops a number the story does not contain", () => {
    const story = buildMatchStory({ meta: FIXTURE.meta, deliveries: FIXTURE.deliveries, picks: [] });
    const allowed = allowedSummaryNumbers(story, null);
    const beat = { ...story.beats[0]!, title: "Chase 9999", body: story.beats[0]!.body };
    const line = narrateBeat(beat, allowed);
    expect(line).not.toContain("9999");
  });

  it("keys the cache on the balls received", () => {
    expect(summaryCacheKey("harbor", [{ seq: 1 }, { seq: 2 }], null)).toBe("harbor:2:2:log");
    expect(summaryCacheKey("harbor", [{ seq: 1 }, { seq: 2 }, { seq: 3 }], null)).not.toBe("harbor:2:2:log");
  });
});
