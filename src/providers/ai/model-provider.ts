import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { copyIsSafe, glossaryFor, renderMoment } from "@/domain/copy";
import { createTemplateProvider } from "@/providers/ai/template-provider";
import type { CopyProvider, PredictionContext } from "@/providers/ai/contract";
import type { ExplainCopy, MarketKind, MomentContext, MomentCopy, PredictionCopy } from "@/domain/types";

const momentSchema = z.object({
  headline: z.string(),
  dek: z.string(),
  why: z.string(),
  whisper: z.string(),
});

const predictionSchema = z.object({
  lines: z.array(
    z.object({
      kind: z.enum(["wicket", "runs10", "lastBoundary", "six", "dots3"]),
      prompt: z.string(),
      detail: z.string(),
    }),
  ),
});

const SYSTEM = [
  "You write copy for Match Pulse, a live cricket second screen.",
  "Use only the numbers and names in the prompt. Do not invent shots, fielders, or results.",
  "Short sentences. Warm, specific, never corporate.",
  "Never mention betting, cash, wagers, gambling, Dream11, or DreamBucks.",
  "Win chance is a model, not a price.",
].join(" ");

function modelFromEnv(env: NodeJS.ProcessEnv): { id: CopyProvider["id"]; model: LanguageModel } | null {
  if (env.AI_GATEWAY_API_KEY) {
    const modelId = env.MATCH_PULSE_MODEL ?? "openai/gpt-4o-mini";
    return { id: "gateway", model: modelId as LanguageModel };
  }
  if (!env.OPENAI_API_KEY) return null;
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  return { id: "openai", model: openai.chat(env.OPENAI_MODEL ?? "gpt-4o-mini") };
}

export function createModelProvider(env: NodeJS.ProcessEnv = process.env): CopyProvider | null {
  const resolved = modelFromEnv(env);
  if (!resolved) return null;
  const { id, model } = resolved;

  return {
    id,
    moment: (ctx) => generateMoment(model, ctx),
    explain: async (ctx) => {
      const full = await generateMoment(model, ctx);
      const explained: ExplainCopy = { whisper: full.whisper, terms: glossaryFor(ctx), source: "model" };
      return explained;
    },
    predictions: (ctx) => generatePredictions(model, ctx),
  };
}

/** Model when a key is configured, otherwise the deterministic desk voice. */
export function resolveCopyProvider(env: NodeJS.ProcessEnv = process.env): CopyProvider {
  return createModelProvider(env) ?? createTemplateProvider();
}

async function generateMoment(model: LanguageModel, ctx: MomentContext): Promise<MomentCopy> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: momentSchema }),
    system: SYSTEM,
    prompt: JSON.stringify({
      task: "Write headline, dek, why, and whisper for this ball.",
      limits: { headline: 80, dek: 220, why: 280, whisper: 700 },
      context: ctx,
    }),
    abortSignal: AbortSignal.timeout(8000),
  });
  if (!output || !copyIsSafe(output)) {
    return renderMoment(ctx);
  }
  return { ...output, source: "model" };
}

async function generatePredictions(model: LanguageModel, ctx: PredictionContext): Promise<PredictionCopy> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: predictionSchema }),
    system: SYSTEM,
    prompt: JSON.stringify({
      task: "Rewrite each prompt and detail. Keep kind values exactly. Do not change probabilities.",
      context: ctx,
    }),
    abortSignal: AbortSignal.timeout(8000),
  });
  return { source: "model", lines: overlay(ctx, output?.lines ?? []) };
}

function overlay(
  ctx: PredictionContext,
  lines: { kind: MarketKind; prompt: string; detail: string }[],
): PredictionCopy["lines"] {
  return ctx.markets.map((market) => {
    const line = lines.find((item) => item.kind === market.kind);
    if (!line) return { kind: market.kind, prompt: market.prompt, detail: market.detail };
    const prompt = line.prompt.trim();
    const detail = line.detail.trim();
    const safe =
      prompt.length >= 8 &&
      prompt.length <= 80 &&
      detail.length >= 12 &&
      detail.length <= 220 &&
      copyIsSafe({
        headline: "Pulse desk line",
        dek: prompt,
        why: detail,
        whisper: "Pulse Points are free and cannot be redeemed for anything.",
      });
    return safe
      ? { kind: market.kind, prompt, detail }
      : { kind: market.kind, prompt: market.prompt, detail: market.detail };
  });
}
