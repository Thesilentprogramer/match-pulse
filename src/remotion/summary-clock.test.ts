import { describe, expect, it } from "vitest";
import { nextNarrationScene, summaryDurationFrames, summarySceneAtFrame, summarySceneFrames } from "@/remotion/summary-clock";

const scenes = [{ durationSec: 2.4 }, { durationSec: 3 }];

describe("summary clock", () => {
  it("lines scene changes up with the film", () => {
    const first = summarySceneFrames(2.4);
    expect(summarySceneAtFrame(scenes, 0)).toBe(0);
    expect(summarySceneAtFrame(scenes, first - 1)).toBe(0);
    expect(summarySceneAtFrame(scenes, first)).toBe(1);
    expect(summarySceneAtFrame(scenes, summaryDurationFrames(scenes) + 10)).toBe(1);
  });

  it("speaks a scene once when playback enters it", () => {
    expect(nextNarrationScene(null, 0, false, scenes)).toBeNull();
    expect(nextNarrationScene(null, 0, true, scenes)).toBe(0);
    expect(nextNarrationScene(0, 10, true, scenes)).toBeNull();
    const next = summarySceneFrames(2.4);
    expect(nextNarrationScene(0, next, true, scenes)).toBe(1);
    expect(nextNarrationScene(1, next + 4, true, scenes)).toBeNull();
  });
});
