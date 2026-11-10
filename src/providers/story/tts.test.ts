import { describe, expect, it } from "vitest";
import { EspeakTts, SilentTts, createTtsProvider, wavDuration, type TtsProvider } from "@/providers/story/tts";

class FakeTts implements TtsProvider {
  readonly id = "fake";
  async synthesize(text: string) {
    return new SilentTts().synthesize(text);
  }
}

describe("tts port", () => {
  it("a provider returns a wav whose header matches its duration", async () => {
    const spoken = await new FakeTts().synthesize("India won by four runs.");
    expect(spoken.wav[0]).toBe(82);
    expect(Math.abs(wavDuration(spoken.wav) - spoken.durationSec)).toBeLessThan(0.05);
    expect(spoken.durationSec).toBeGreaterThan(1);
  });

  it("uses espeak when the binary is on the machine", async () => {
    const provider = await createTtsProvider({ NODE_ENV: "test" });
    expect(["espeak", "openai", "silent"]).toContain(provider.id);
    if (provider instanceof EspeakTts || provider.id === "espeak") {
      const spoken = await provider.synthesize("New Zealand are all out.");
      expect(spoken.durationSec).toBeGreaterThan(0.4);
      expect(spoken.wav.byteLength).toBeGreaterThan(1000);
    }
  });
});
