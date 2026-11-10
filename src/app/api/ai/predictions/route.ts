import { resolveCopyProvider } from "@/providers/ai/model-provider";
import { createTemplateProvider } from "@/providers/ai/template-provider";
import type { PredictionContext } from "@/providers/ai/contract";
import { z } from "zod";

const schema = z.object({
  over: z.number().int().min(1).max(20),
  bowlerName: z.string(),
  equation: z.string(),
  phase: z.string(),
  markets: z.array(
    z.object({
      kind: z.enum(["wicket", "runs10", "lastBoundary", "six", "dots3"]),
      yesProb: z.number(),
      prompt: z.string(),
      detail: z.string(),
    }),
  ),
});

export async function POST(request: Request): Promise<Response> {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Invalid markets." }, { status: 400 });
  const ctx = parsed.data as PredictionContext;
  try {
    return Response.json(await resolveCopyProvider().predictions(ctx));
  } catch {
    return Response.json(await createTemplateProvider().predictions(ctx));
  }
}
