import { promptHash } from "@/providers/story/prompt-hash";

/** A model that turns one rendered shot prompt into a clip URL. */
export interface VideoGenProvider {
  readonly id: string;
  generate(shot: { prompt: string }): Promise<string | null>;
}

const clips = new Map<string, string>();

/** Remember a clip under the hash of its prompt. Tests and a future fetch share this. */
export function cacheClip(prompt: string, url: string): void {
  clips.set(promptHash(prompt), url);
}

export function cachedClip(prompt: string): string | null {
  return clips.get(promptHash(prompt)) ?? null;
}

export class PlaceholderVideoGen implements VideoGenProvider {
  readonly id = "placeholder";

  async generate(shot: { prompt: string }): Promise<string | null> {
    return cachedClip(shot.prompt);
  }
}

/**
 * Reserved for a Hugging Face video model. No request is made.
 * A finished clip can be stored with `cacheClip` under the same prompt.
 */
export class HuggingFaceVideoGen implements VideoGenProvider {
  readonly id = "huggingface";

  constructor(private readonly token: string) {}

  async generate(shot: { prompt: string }): Promise<string | null> {
    void this.token;
    return cachedClip(shot.prompt);
  }
}

export function createVideoGenProvider(env: NodeJS.ProcessEnv = process.env): VideoGenProvider {
  if (env.HF_TOKEN) return new HuggingFaceVideoGen(env.HF_TOKEN);
  return new PlaceholderVideoGen();
}
