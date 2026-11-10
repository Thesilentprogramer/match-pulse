import { createOpenAI } from "@ai-sdk/openai";
import { isStepCount, streamText, tool, type LanguageModel } from "ai";
import { z } from "zod";
import { renderCommentary } from "@/domain/commentary";
import { fixtureSource } from "@/domain/fixture";
import {
  allowedNumberTokens,
  answerFromSnapshot,
  buildGroundedSnapshot,
  explainTerm,
  validateGroundedAnswer,
  type GroundedSnapshot,
  type Voice,
} from "@/domain/grounding";
import { projectInnings } from "@/domain/project";

export interface CompanionRequest {
  question: string;
  seenThroughSeq: number;
  voice: Voice;
}

export function snapshotForSeq(seenThroughSeq: number): GroundedSnapshot {
  const deliveries = fixtureSource.deliveries().filter((delivery) => delivery.seq <= seenThroughSeq);
  return buildGroundedSnapshot(fixtureSource.meta(), deliveries);
}

export function templateCompanionAnswer(input: CompanionRequest): string {
  return answerFromSnapshot(input.question, snapshotForSeq(input.seenThroughSeq), input.voice);
}

export async function composeCompanionAnswer(input: CompanionRequest): Promise<{ text: string; source: "template" | "model" }> {
  const snapshot = snapshotForSeq(input.seenThroughSeq);
  const fallback = answerFromSnapshot(input.question, snapshot, input.voice);
  const model = resolveModel();
  if (!model) return { text: fallback, source: "template" };
  try {
    const allowed = allowedNumberTokens(snapshot);
    const result = streamText({
      model,
      system: systemPrompt(input.voice),
      tools: companionTools(snapshot),
      stopWhen: isStepCount(4),
      prompt: input.question.slice(0, 400),
      abortSignal: AbortSignal.timeout(12000),
    });
    const text = (await result.text).trim();
    const check = validateGroundedAnswer(text, allowed);
    if (!text || !check.ok) return { text: fallback, source: "template" };
    return { text, source: "model" };
  } catch {
    return { text: fallback, source: "template" };
  }
}

export async function composeCommentary(input: {
  seq: number;
  seenThroughSeq: number;
  voice: Voice;
}): Promise<{ line: string; source: "template" | "model" }> {
  const seq = Math.min(input.seq, input.seenThroughSeq);
  const deliveries = fixtureSource.deliveries().filter((delivery) => delivery.seq <= seq);
  const snapshot = buildGroundedSnapshot(fixtureSource.meta(), deliveries);
  const frame = projectInnings(deliveries, fixtureSource.meta()).frames.at(-1);
  const fallback = frame ? renderCommentary(frame.context, input.voice) : answerFromSnapshot("summary", snapshot, input.voice);
  const model = resolveModel();
  if (!model || !frame) return { line: fallback, source: "template" };
  try {
    const result = streamText({
      model,
      system: `${systemPrompt(input.voice)} Write one commentary sentence for this ball. No tools needed if the JSON is enough, but do not add numbers that are not in it.`,
      prompt: JSON.stringify({ voice: input.voice, ball: frame.context }),
      abortSignal: AbortSignal.timeout(8000),
    });
    const line = (await result.text).trim();
    const check = validateGroundedAnswer(line, allowedNumberTokens(snapshot));
    if (!line || !check.ok) return { line: fallback, source: "template" };
    return { line, source: "model" };
  } catch {
    return { line: fallback, source: "template" };
  }
}

function companionTools(snapshot: GroundedSnapshot) {
  return {
    getScore: tool({
      description: "Score, overs, and equation from the balls received so far.",
      inputSchema: z.object({}),
      execute: async () => ({
        runs: snapshot.runs,
        wickets: snapshot.wickets,
        overs: snapshot.overs,
        target: snapshot.target,
        toWin: snapshot.toWin,
        ballsLeft: snapshot.ballsLeft,
        equation: snapshot.equation,
        result: snapshot.result,
        seenThroughSeq: snapshot.seenThroughSeq,
      }),
    }),
    getRequiredRate: tool({
      description: "Current rate and required rate from the received score.",
      inputSchema: z.object({}),
      execute: async () => ({ crr: snapshot.crr, rrr: snapshot.rrr, toWin: snapshot.toWin, ballsLeft: snapshot.ballsLeft }),
    }),
    getWinProbability: tool({
      description: "Model win chance for the received score. Not a price.",
      inputSchema: z.object({}),
      execute: async () => ({ winPercent: snapshot.winPercent, winProb: snapshot.winProb }),
    }),
    getPlayer: tool({
      description: "Batting or bowling figures for a name already in the log.",
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => {
        const q = name.toLowerCase();
        const batter = snapshot.batters.find((item) => item.name.toLowerCase().includes(q));
        const bowler = snapshot.bowlers.find((item) => item.name.toLowerCase().includes(q));
        if (!batter && !bowler) {
          return { found: false, batters: snapshot.batters.map((item) => item.name), bowlers: snapshot.bowlers.map((item) => item.name) };
        }
        return { found: true, batter: batter ?? null, bowler: bowler ?? null };
      },
    }),
    getRecentOvers: tool({
      description: "The last few overs already received.",
      inputSchema: z.object({ count: z.number().int().min(1).max(3).default(2) }),
      execute: async ({ count }) => snapshot.recentOvers.slice(-count),
    }),
    explainTerm: tool({
      description: "Plain meaning of a cricket word. Does not invent match numbers.",
      inputSchema: z.object({ term: z.string() }),
      execute: async ({ term }) => ({ term, plain: explainTerm(term) }),
    }),
  };
}

function systemPrompt(voice: Voice): string {
  const tone =
    voice === "hinglish"
      ? "Answer in Hinglish, short and spoken."
      : voice === "plain"
        ? "Answer as if the fan has never watched cricket. Short sentences."
        : "Answer in plain English, two or three sentences.";
  return [
    "You are the Match Pulse companion.",
    "You may only describe balls the tools return. The tools cover only deliveries received so far.",
    "Call a tool before you quote a score, rate, or win chance.",
    "Never invent a number. If a player is not in the tool result, say they are not on the timeline the fan has seen.",
    "Never mention betting, wagers, cash, gambling, or DreamBucks.",
    "Win chance is a model, not a price.",
    tone,
  ].join(" ");
}

function resolveModel(): LanguageModel | null {
  if (process.env.AI_GATEWAY_API_KEY) {
    return (process.env.MATCH_PULSE_MODEL ?? "openai/gpt-4o-mini") as LanguageModel;
  }
  if (!process.env.OPENAI_API_KEY) return null;
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai.chat(process.env.OPENAI_MODEL ?? "gpt-4o-mini");
}

export function chunkedTextResponse(text: string, source: "template" | "model"): Response {
  const encoder = new TextEncoder();
  const parts = text.split(/(\s+)/);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const part of parts) {
        controller.enqueue(encoder.encode(part));
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-pulse-source": source,
    },
  });
}
