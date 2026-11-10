import { describe, expect, it } from "vitest";
import { FIXTURE } from "@/domain/fixture";
import { buildMatchStory } from "@/domain/story";
import { matchStorySchema } from "@/domain/story-schema";

describe("match story input props", () => {
  it("parses the fixture story as Remotion inputProps", () => {
    const story = buildMatchStory({
      meta: FIXTURE.meta,
      deliveries: FIXTURE.deliveries,
      picks: [],
    });
    const parsed = matchStorySchema.parse(story);
    expect(parsed.team).toBe("Harbor Kings");
    expect(parsed.target).toBe(186);
    expect(parsed.final.result).toBe("won");
    expect(parsed.winSeries.every((point) => point >= 0 && point <= 1)).toBe(true);
    expect(parsed.beats[0]?.tone).toBe("open");
    expect(parsed.podLines[0]?.length).toBeGreaterThan(0);
  });
});
