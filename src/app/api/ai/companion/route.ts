import { chunkedTextResponse, composeCompanionAnswer, templateCompanionAnswer } from "@/providers/ai/companion";
import type { Voice } from "@/domain/grounding";
import type { MatchDataSource } from "@/domain/fixture";
import { isDemoMatch } from "@/providers/live/demos";
import { livePoller } from "@/providers/live/poller";
import { z } from "zod";

const schema = z.object({
  question: z.string().min(2).max(400),
  seenThroughSeq: z.number().int().min(0).max(5000),
  voice: z.enum(["english", "hinglish", "plain"]),
  matchId: z.string().max(80).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Ask in one sentence, under 400 characters." }, { status: 400 });
  }
  const input = { ...parsed.data, voice: parsed.data.voice as Voice };
  const source = await sourceFor(parsed.data.matchId);
  try {
    const answer = await composeCompanionAnswer(input, source);
    return chunkedTextResponse(answer.text, answer.source);
  } catch {
    return chunkedTextResponse(templateCompanionAnswer(input, source), "template");
  }
}

async function sourceFor(matchId: string | undefined): Promise<MatchDataSource | undefined> {
  if (!matchId || isDemoMatch(matchId)) return undefined;
  const snap = await livePoller.getMatch(matchId);
  return { meta: () => snap.meta, deliveries: () => snap.deliveries };
}
