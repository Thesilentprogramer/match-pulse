import { z } from "zod";

export const summaryFilmSchema = z.object({
  matchId: z.string(),
  competition: z.string(),
  venue: z.string(),
  scenes: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(["toss", "rain", "wicket", "fighter", "collapse", "partnership", "result"]),
        headline: z.string(),
        caption: z.string(),
        narration: z.string(),
        durationSec: z.number(),
        audioSrc: z.string().nullable(),
      }),
    )
    .min(1),
});

export type SummaryFilmInput = z.infer<typeof summaryFilmSchema>;
