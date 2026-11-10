import type { Voice } from "@/domain/grounding";
import { chunkedTextResponse, composeCommentary } from "@/providers/ai/companion";
import { z } from "zod";

const schema = z.object({
  seq: z.number().int().min(1),
  seenThroughSeq: z.number().int().min(0),
  voice: z.enum(["english", "hinglish", "plain"]),
});

export async function POST(request: Request): Promise<Response> {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Bad commentary request." }, { status: 400 });
  const answer = await composeCommentary({ ...parsed.data, voice: parsed.data.voice as Voice });
  return chunkedTextResponse(answer.line, answer.source);
}
