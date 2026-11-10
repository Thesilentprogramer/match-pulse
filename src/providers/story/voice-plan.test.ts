import { describe, expect, it } from "vitest";
import { SilentTts, type TtsProvider } from "@/providers/story/tts";
import { browserVoicePlan, planVoice } from "@/providers/story/voice-plan";

describe("summary voice plan", () => {
  it("asks the browser to speak when the server has no voice", async () => {
    const plan = await planVoice(new SilentTts(), ["Harbor need twelve from six."]);
    expect(plan.voice).toBe("browser");
    expect(plan.clips[0]?.url).toBeNull();
    expect(plan.clips[0]?.durationSec).toBeGreaterThan(2);
    expect(browserVoicePlan(["", "A six."]).clips).toHaveLength(2);
  });

  it("embeds a spoken wav when a provider can speak", async () => {
    const provider: TtsProvider = {
      id: "desk",
      async synthesize(text) {
        return new SilentTts().synthesize(text);
      },
    };
    const plan = await planVoice(provider, ["India won by four runs."]);
    expect(plan.voice).toBe("desk");
    expect(plan.clips[0]?.url?.startsWith("data:audio/wav;base64,")).toBe(true);
    expect(plan.clips[0]?.durationSec).toBeGreaterThan(1);
  });

  it("does not speak a line twice for the same match state", async () => {
    let calls = 0;
    const provider: TtsProvider = {
      id: "gnani",
      async synthesize(text) {
        calls += 1;
        return new SilentTts().synthesize(text);
      },
    };
    const line = "Cached line for the harbor final.";
    await planVoice(provider, [line], "harbor:1");
    await planVoice(provider, [line], "harbor:1");
    expect(calls).toBe(1);
  });
});
