import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { matchStorySchema } from "@/domain/story-schema";
import { renderStoryMp4 } from "@/remotion/render-story";

export const maxDuration = 300;

type Job = {
  progress: number;
  status: "rendering" | "done" | "error";
  file?: string;
  error?: string;
};

const jobs = new Map<string, Job>();

export async function POST(request: Request): Promise<Response> {
  const json = await request.json().catch(() => null);
  const parsed = matchStorySchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Story props are invalid." }, { status: 400 });
  const id = randomUUID();
  const file = path.join("/tmp", `match-story-${id}.mp4`);
  jobs.set(id, { progress: 0, status: "rendering", file });
  void renderStoryMp4(parsed.data, file, (progress) => {
    const current = jobs.get(id);
    if (current) jobs.set(id, { ...current, progress });
  })
    .then(() => {
      const current = jobs.get(id);
      if (current) jobs.set(id, { ...current, progress: 1, status: "done" });
    })
    .catch((error: unknown) => {
      jobs.set(id, {
        progress: 0,
        status: "error",
        error: error instanceof Error ? error.message : "Render failed.",
      });
    });
  return Response.json({ jobId: id });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get("jobId");
  const job = id ? jobs.get(id) : undefined;
  if (!job) return Response.json({ error: "Unknown render." }, { status: 404 });
  if (url.searchParams.get("download") === "1" && job.status === "done" && job.file) {
    const info = await stat(job.file);
    const stream = Readable.toWeb(createReadStream(job.file)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "content-type": "video/mp4",
        "content-length": String(info.size),
        "content-disposition": 'attachment; filename="match-pulse-story.mp4"',
      },
    });
  }
  return Response.json({ progress: job.progress, status: job.status, error: job.error ?? null });
}
