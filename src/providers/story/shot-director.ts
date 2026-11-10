import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output, type LanguageModel } from "ai";
import { layeredPromptSchema, type LayeredPrompt } from "@/domain/shot-plan";

export interface ShotDirector {
  rewrite(prompt: LayeredPrompt): Promise<LayeredPrompt | null>;
}

/**
 * Optional wording pass. The domain guard still decides whether the
 * rewrite keeps the event. No key means no call.
 */
export function createShotDirector(env: NodeJS.ProcessEnv = process.env): ShotDirector | null {
  const model = modelFromEnv(env);
  if (!model) return null;
  return {
    async rewrite(prompt) {
      try {
        const result = await generateText({
          model,
          output: Output.object({ schema: layeredPromptSchema }),
          system: [
            "You rewrite anime shot prompts for a cricket story.",
            "Change wording only.",
            "Keep action.event exactly as given.",
            "Keep the action verb's meaning.",
            "Do not add player names, numbers, logos, flags, or betting language.",
            "Do not add a six unless the action event is six.",
          ].join(" "),
          prompt: JSON.stringify(prompt),
        });
        return result.output;
      } catch {
        return null;
      }
    },
  };
}

function modelFromEnv(env: NodeJS.ProcessEnv): LanguageModel | null {
  if (env.AI_GATEWAY_API_KEY) return (env.MATCH_PULSE_MODEL ?? "openai/gpt-4o-mini") as LanguageModel;
  if (env.NVIDIA_API_KEY) {
    const openai = createOpenAI({
      apiKey: env.NVIDIA_API_KEY,
      baseURL: env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
    });
    return openai.chat(env.NVIDIA_MODEL ?? "meta/llama-3.1-8b-instruct");
  }
  if (!env.OPENAI_API_KEY) return null;
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  return openai.chat(env.OPENAI_MODEL ?? "gpt-4o-mini");
}
