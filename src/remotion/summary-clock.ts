import { STORY_FPS } from "@/remotion/timing";

export function summarySceneFrames(durationSec: number): number {
  return Math.max(STORY_FPS, Math.round(durationSec * STORY_FPS));
}

export function summarySceneSpans(scenes: readonly { durationSec: number }[]): { index: number; from: number; frames: number }[] {
  let from = 0;
  return scenes.map((scene, index) => {
    const frames = summarySceneFrames(scene.durationSec);
    const span = { index, from, frames };
    from += frames;
    return span;
  });
}

export function summaryDurationFrames(scenes: readonly { durationSec: number }[]): number {
  return summarySceneSpans(scenes).reduce((sum, span) => sum + span.frames, 0);
}

/** Scene on screen at `frame`. The last scene holds after the film ends. */
export function summarySceneAtFrame(scenes: readonly { durationSec: number }[], frame: number): number {
  if (scenes.length === 0) return -1;
  const spans = summarySceneSpans(scenes);
  const hit = spans.find((span) => frame < span.from + span.frames);
  return hit?.index ?? spans.length - 1;
}

/**
 * Which scene should start speaking, or null when playback should stay quiet.
 * A scene speaks once each time playback enters it.
 */
export function nextNarrationScene(
  previous: number | null,
  frame: number,
  playing: boolean,
  scenes: readonly { durationSec: number }[],
): number | null {
  if (!playing || scenes.length === 0) return null;
  const index = summarySceneAtFrame(scenes, frame);
  if (index < 0 || index === previous) return null;
  return index;
}
