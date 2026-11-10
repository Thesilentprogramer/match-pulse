import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface Spoken {
  wav: Uint8Array;
  durationSec: number;
}

/** Turns one narration line into a wav. Implementations must not invent words. */
export interface TtsProvider {
  readonly id: string;
  synthesize(text: string): Promise<Spoken>;
}

export function wavDataUrl(wav: Uint8Array): string {
  return `data:audio/wav;base64,${Buffer.from(wav).toString("base64")}`;
}

export function wavDuration(wav: Uint8Array): number {
  if (wav.length < 44) return 0;
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const rate = view.getUint32(24, true);
  const channels = view.getUint16(22, true);
  const bits = view.getUint16(34, true);
  const data = Math.max(0, wav.length - 44);
  const bytesPerSec = rate * channels * (bits / 8);
  if (!bytesPerSec) return 0;
  return data / bytesPerSec;
}

export class EspeakTts implements TtsProvider {
  readonly id = "espeak";

  constructor(private readonly bin: string) {}

  async synthesize(text: string): Promise<Spoken> {
    const dir = await mkdtemp(path.join(tmpdir(), "mp-tts-"));
    const file = path.join(dir, "line.wav");
    try {
      await exec(this.bin, ["-v", "en", "-s", "148", "-w", file, text.slice(0, 500)], { timeout: 20000 });
      const wav = new Uint8Array(await readFile(file));
      return { wav, durationSec: wavDuration(wav) };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

export class OpenAiTts implements TtsProvider {
  readonly id = "openai";

  constructor(private readonly key: string) {}

  async synthesize(text: string): Promise<Spoken> {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", voice: "alloy", input: text.slice(0, 500), response_format: "wav" }),
    });
    if (!response.ok) throw new Error(`Speech request failed (${response.status}).`);
    const wav = new Uint8Array(await response.arrayBuffer());
    return { wav, durationSec: wavDuration(wav) };
  }
}

/** Silent wav so the film still has timing when no speaker is installed. */
export class SilentTts implements TtsProvider {
  readonly id = "silent";

  async synthesize(text: string): Promise<Spoken> {
    const durationSec = Math.min(12, Math.max(2.2, text.split(/\s+/).filter(Boolean).length / 2.4));
    const rate = 22050;
    const samples = Math.floor(durationSec * rate);
    const data = samples * 2;
    const wav = new Uint8Array(44 + data);
    const view = new DataView(wav.buffer);
    wav.set([82, 73, 70, 70], 0);
    view.setUint32(4, 36 + data, true);
    wav.set([87, 65, 86, 69, 102, 109, 116, 32], 8);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    wav.set([100, 97, 116, 97], 36);
    view.setUint32(40, data, true);
    return { wav, durationSec };
  }
}

async function espeakBin(): Promise<string | null> {
  for (const bin of ["espeak-ng", "espeak"]) {
    try {
      await exec(bin, ["--version"], { timeout: 4000 });
      return bin;
    } catch {
      /* try the next name */
    }
  }
  return null;
}

export async function createTtsProvider(env: NodeJS.ProcessEnv = process.env): Promise<TtsProvider> {
  const bin = await espeakBin();
  if (bin) return new EspeakTts(bin);
  if (env.OPENAI_API_KEY) return new OpenAiTts(env.OPENAI_API_KEY);
  return new SilentTts();
}
