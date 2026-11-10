import { describe, expect, it } from "vitest";
import { indiaWicketBalls, indNzCard, indNzMeta } from "../../fixtures/ind-nz-2nd-odi-2026";
import { buildMatchStory } from "@/domain/story";
import {
  acceptRewrite,
  buildShotPlan,
  moodFor,
  negativePrompt,
  renderPrompt,
  resolveShotPrompt,
  type LayeredPrompt,
} from "@/domain/shot-plan";
import { cacheClip, createVideoGenProvider, PlaceholderVideoGen } from "@/providers/story/video-gen";
import { storyDurationInFrames } from "@/remotion/timing";

const story = buildMatchStory({
  meta: indNzMeta,
  deliveries: indiaWicketBalls,
  picks: [],
  card: indNzCard,
});

const names = indNzMeta.players.map((player) => player.name);

describe("shot plan", () => {
  const plan = buildShotPlan(story.beats, {
    venue: story.venue,
    chaseTeam: story.team,
    winSeries: story.winSeries,
  });

  it("picks six sourced shots and never names a player in the prompt", () => {
    expect(plan.shots.map((shot) => shot.beatId)).toEqual([
      "arc-brar",
      "arc-mitchell",
      "arc-wobble",
      "arc-stand",
      "arc-rain",
      "arc-potm",
    ]);
    expect(plan.shots.every((shot) => shot.seconds >= 2 && shot.seconds <= 4)).toBe(true);
    const prompts = plan.shots.map((shot) => renderPrompt(shot, plan.globals));
    const blob = prompts.join("\n");
    for (const name of names) {
      for (const part of name.split(" ")) {
        if (part.length < 4) continue;
        expect(blob).not.toContain(part);
      }
    }
    expect(blob).not.toMatch(/\bsix\b/i);
    expect(plan.shots.find((shot) => shot.event === "six")).toBeUndefined();
    expect(plan.shots.map((shot) => [shot.beatId, shot.mood.lighting, shot.mood.tension])).toEqual([
      ["arc-brar", "brooding storm light, a cluster of wickets", 0.8],
      ["arc-mitchell", "brooding storm light, wickets are down", 0.6],
      ["arc-wobble", "brooding storm light, wickets are down", 0.58],
      ["arc-stand", "brooding storm light, wickets are down", 0.7],
      ["arc-rain", "brooding storm light, rain has stopped play", 0.82],
      ["arc-potm", "electric rim light, the side has won", 0.64],
    ]);
    expect(
      storyDurationInFrames(false, story.beats, [{ beatId: "arc-rain", url: "https://example.com/a.mp4", seconds: 4 }]),
    ).toBe(1350 + 120);
    expect(prompts).toMatchSnapshot();
    expect(plan.shots.map((shot) => negativePrompt(shot.event))).toMatchSnapshot();
  });

  it("keeps a rewrite only when the event and the verb survive", async () => {
    const shot = plan.shots[0];
    if (!shot) throw new Error("missing shot");
    const base = {
      ...plan.globals,
      action: shot.action,
      camera: shot.camera,
      mood: shot.mood,
    } satisfies LayeredPrompt;
    const drifted: LayeredPrompt = { ...base, action: { ...base.action, event: "six", verb: "hits a six" } };
    expect(acceptRewrite(shot, drifted, names)).toBe(false);
    const named: LayeredPrompt = { ...base, action: { ...base.action, object: "at Mitchell" } };
    expect(acceptRewrite(shot, named, names)).toBe(false);
    const safe: LayeredPrompt = { ...base, action: { ...base.action, object: "at the stumps, late on the shot" } };
    expect(acceptRewrite(shot, safe, names)).toBe(true);
    const resolved = await resolveShotPrompt(shot, plan.globals, names, {
      async rewrite() {
        return drifted;
      },
    });
    expect(resolved.source).toBe("template");
    expect(resolved.prompt).toBe(renderPrompt(shot, plan.globals));
  });

  it("uses tension when the chase model is flat, and swing when the model actually jumps", () => {
    const quiet = moodFor("establish", "The players walk out.", 0);
    expect(quiet.lighting).toBe("calm overcast, the innings is quiet");
    expect(quiet.tension).toBe(0);
    const jumped = moodFor("establish", "The players walk out.", 0.9);
    expect(jumped.lighting).toBe("electric rim light, the chance has jumped");
    expect(moodFor("celebration", "A quiet finish.", 0).lighting.startsWith("electric rim light")).toBe(true);
  });
});

describe("video gen cache", () => {
  it("returns a clip only after the same prompt was stored", async () => {
    const gen = new PlaceholderVideoGen();
    const prompt = "Style: test";
    expect(await gen.generate({ prompt })).toBeNull();
    cacheClip(prompt, "https://example.com/clip.mp4");
    expect(await gen.generate({ prompt })).toBe("https://example.com/clip.mp4");
    expect(createVideoGenProvider({ NODE_ENV: "test" }).id).toBe("placeholder");
    expect(createVideoGenProvider({ NODE_ENV: "test", HF_TOKEN: "hf_test" }).id).toBe("huggingface");
  });
});
