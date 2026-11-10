import { wavDuration, type Spoken, type TtsProvider } from "@/providers/story/tts";

/** Eight scenes at this budget stay inside the voice route's 60s maxDuration. */
export const GNANI_TIMEOUT_MS = 7_000;

const ENDPOINT = "https://api.vachana.ai/api/v1/tts/inference";

export interface GnaniConfig {
  apiKey: string;
  voice?: string;
  language?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

let tail: Promise<unknown> = Promise.resolve();

/** One Gnani call at a time. The account allows a single active request. */
export function enqueueGnani<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job, job);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Vachana TTS. POST returns raw wav bytes.
 * https://docs.gnani.ai/api/TTS/tts-inference
 */
export class GnaniTtsProvider implements TtsProvider {
  readonly id = "gnani";
  private readonly voice: string;
  private readonly language: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly config: GnaniConfig) {
    this.voice = config.voice || "Nalini";
    this.language = config.language || "en-IN";
    this.model = config.model || "timbre-v2.5";
    this.timeoutMs = config.timeoutMs ?? GNANI_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.sleep = config.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  synthesize(text: string): Promise<Spoken> {
    return enqueueGnani(() => this.speak(text));
  }

  private async speak(text: string): Promise<Spoken> {
    let wait = 400;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.fetchImpl(ENDPOINT, {
        method: "POST",
        headers: {
          "X-API-Key-ID": this.config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.slice(0, 500),
          voice: this.voice,
          model: this.model,
          language: this.language,
          speed: 1,
          audio_config: {
            sample_rate: 24000,
            num_channels: 1,
            sample_width: 2,
            encoding: "linear_pcm",
            container: "wav",
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (response.status === 429 && attempt < 2) {
        await this.sleep(wait);
        wait *= 3;
        continue;
      }
      if (!response.ok) throw new Error(`gnani ${response.status}`);
      const wav = new Uint8Array(await response.arrayBuffer());
      if (wav.length < 44 || wav[0] !== 82) throw new Error("gnani returned no wav");
      return { wav, durationSec: wavDuration(wav) };
    }
    throw new Error("gnani 429");
  }
}
