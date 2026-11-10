import { renderMoment } from "@/domain/copy";
import type { MomentContext } from "@/domain/types";
import { resolveCopyProvider } from "@/providers/ai/model-provider";
import { z } from "zod";

const schema = z.object({
  seq: z.number(),
  overLabel: z.string(),
  tone: z.enum(["boundary", "six", "wicket", "dot", "run", "extra", "result"]),
  playerName: z.string(),
  bowlerName: z.string(),
  battingTeam: z.string(),
  equation: z.string(),
  scoreLabel: z.string(),
  winProb: z.number(),
  winDelta: z.number(),
  rrr: z.number().nullable(),
  crr: z.number(),
  ballsLeft: z.number(),
  wicketsInHand: z.number(),
  note: z.string().optional(),
  dismissal: z.enum(["bowled", "caught", "lbw", "runout", "stumped", "unspecified"]).optional(),
  runsBat: z.number(),
  boundary: z.union([z.literal(4), z.literal(6)]).optional(),
  phase: z.enum(["powerplay", "middle", "death", "complete"]),
  result: z.enum(["chasing", "won", "lost", "tied"]),
});

export async function POST(request: Request): Promise<Response> {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Invalid moment." }, { status: 400 });
  const ctx = parsed.data as MomentContext;
  try {
    const copy = await resolveCopyProvider().moment(ctx);
    return Response.json(copy);
  } catch {
    return Response.json(renderMoment(ctx));
  }
}
