import type { MatchStory } from "@/domain/story";

/**
 * Optional intro clip in front of the Remotion story.
 * A Hugging Face video model can implement this later. The pure story
 * generator never calls it.
 */
export interface IntroClipProvider {
  readonly id: string;
  resolve(story: MatchStory): Promise<string | null>;
}

const cache = new Map<string, string>();

export class PlaceholderIntroClip implements IntroClipProvider {
  readonly id = "placeholder";

  async resolve(): Promise<string | null> {
    return null;
  }
}

/**
 * Reserved for HF video inference. With HF_TOKEN set, a future version
 * would request a short intro and store the URL in `cache`.
 */
export class HuggingFaceIntroClip implements IntroClipProvider {
  readonly id = "huggingface";

  constructor(private readonly token: string) {}

  async resolve(story: MatchStory): Promise<string | null> {
    const key = `${story.team}:${story.target}:${story.final.runs}:${story.final.wickets}`;
    return cache.get(key) ?? null;
  }
}

export function createIntroClipProvider(env: NodeJS.ProcessEnv = process.env): IntroClipProvider {
  if (env.HF_TOKEN) return new HuggingFaceIntroClip(env.HF_TOKEN);
  return new PlaceholderIntroClip();
}
