import { z } from "zod";

export const storyBeatSchema = z.object({
  id: z.string(),
  kicker: z.string(),
  title: z.string(),
  body: z.string(),
  stat: z.string(),
  tone: z.enum(["open", "swing", "call", "room", "finish"]),
});

export const matchStorySchema = z.object({
  competition: z.string(),
  venue: z.string(),
  team: z.string(),
  target: z.number(),
  beats: z.array(storyBeatSchema).min(1),
  winSeries: z.array(z.number()).min(1),
  calls: z.array(
    z.object({
      prompt: z.string(),
      won: z.boolean(),
      profit: z.number(),
    }),
  ),
  podLines: z.array(z.string()).min(1),
  mvp: z.object({
    name: z.string(),
    line: z.string(),
  }),
  final: z.object({
    runs: z.number(),
    wickets: z.number(),
    overs: z.string(),
    result: z.enum(["chasing", "won", "lost", "tied"]),
    ballsLeft: z.number(),
  }),
  introClipUrl: z.string().nullable(),
  /** Generated anime shots. Remotion draws the words. The clip itself has none. */
  shotClips: z
    .array(
      z.object({
        beatId: z.string(),
        url: z.string(),
        seconds: z.number().min(2).max(4),
      }),
    )
    .optional(),
});

export type MatchStoryProps = z.infer<typeof matchStorySchema>;
