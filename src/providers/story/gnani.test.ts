import { describe, expect, it } from "vitest";
import { GnaniTtsProvider } from "@/providers/story/gnani";
import { FallbackTts, SilentTts, wavDuration } from "@/providers/story/tts";

async function sampleWav(): Promise<Uint8Array> {
  return (await new SilentTts().synthesize("India won by four runs.")).wav;
}

function jsonRequest(init?: RequestInit): { language?: string; voice?: string } {
  return JSON.parse(String(init?.body ?? "{}")) as { language?: string; voice?: string };
}

describe("Gnani TTS", () => {
  it("returns a wav and its duration", async () => {
    const wav = await sampleWav();
    const provider = new GnaniTtsProvider({
      apiKey: "test-key",
      fetchImpl: async (_url, init) => {
        expect(jsonRequest(init).voice).toBe("Nalini");
        expect(jsonRequest(init).language).toBe("en-IN");
        expect(new Headers(init?.headers).get("X-API-Key-ID")).toBe("test-key");
        return new Response(Buffer.from(wav), { status: 200 });
      },
    });
    const spoken = await provider.synthesize("India won by four runs.");
    expect(spoken.wav[0]).toBe(82);
    expect(spoken.durationSec).toBeCloseTo(wavDuration(wav), 2);
  });

  it("retries a 429 and then accepts the wav", async () => {
    const wav = await sampleWav();
    let calls = 0;
    const provider = new GnaniTtsProvider({
      apiKey: "test-key",
      sleep: async () => undefined,
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return new Response("busy", { status: 429 });
        return new Response(Buffer.from(wav), { status: 200 });
      },
    });
    const spoken = await provider.synthesize("One more over.");
    expect(calls).toBe(2);
    expect(spoken.durationSec).toBeGreaterThan(1);
  });

  it("falls back on 401 and 402 without logging the key", async () => {
    const logs: string[] = [];
    for (const status of [401, 402]) {
      const gnani = new GnaniTtsProvider({
        apiKey: "super-secret-key",
        fetchImpl: async () => new Response("no", { status }),
      });
      const chain = new FallbackTts([gnani, new SilentTts()], (message) => logs.push(message));
      const spoken = await chain.synthesize("Harbor need twelve.");
      expect(chain.id).toBe("silent");
      expect(spoken.durationSec).toBeGreaterThan(1);
    }
    expect(logs.join(" ")).toContain("gnani 401");
    expect(logs.join(" ")).toContain("gnani 402");
    expect(logs.join(" ")).not.toContain("super-secret-key");
  });

  it("falls back when the request times out", async () => {
    const gnani = new GnaniTtsProvider({
      apiKey: "test-key",
      timeoutMs: 30,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;
          const fail = () => reject(signal.reason ?? new Error("timeout"));
          if (signal.aborted) fail();
          else signal.addEventListener("abort", fail, { once: true });
        }),
    });
    const chain = new FallbackTts([gnani, new SilentTts()], () => undefined);
    const spoken = await chain.synthesize("The chase is level.");
    expect(chain.id).toBe("silent");
    expect(spoken.wav.byteLength).toBeGreaterThan(44);
  });

  it("speaks one line at a time", async () => {
    const wav = await sampleWav();
    let active = 0;
    let peak = 0;
    const provider = new GnaniTtsProvider({
      apiKey: "test-key",
      fetchImpl: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 40));
        active -= 1;
        return new Response(Buffer.from(wav), { status: 200 });
      },
    });
    await Promise.all([provider.synthesize("First line here."), provider.synthesize("Second line here.")]);
    expect(peak).toBe(1);
  });
});
