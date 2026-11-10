import { chunkedTextResponse, composeCompanionAnswer, templateCompanionAnswer } from "@/providers/ai/companion";
import type { Voice } from "@/domain/grounding";
import { z } from "zod";

const schema = z.object({
  question: z.string().min(2).max(400),
  seenThroughSeq: z.number().int().min(0).max(500),
  voice: z.enum(["english", "hinglish", "plain"]),
});

export async function POST(request: Request): Promise<Response> {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Ask a shorter question." }, { status: 400 });
  const input = { ...parsed.data, voice: parsed.data.voice as Voice };
  try {
    const answer = await composeCompanionAnswer(input);
    return chunkedTextResponse(answer.text, answer.source);
  } catch {
    return chunkedTextResponse(templateCompanionAnswer(input), "template");
  }
}
