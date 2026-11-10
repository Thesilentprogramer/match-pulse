import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { matchStorySchema } from "@/domain/story-schema";
import { mp4UnavailableResponse, serverMp4Available, tempDownloadPath } from "@/lib/host";

export const maxDuration = 300;

type Job = {
  progress: number;
  status: "rendering" | "done" | "error";
  file?: string;
  error?: string;
};

const jobs = new Map<string, Job>();

export async function POST(request: Request): Promise<Response> {
  try {
    return await startStoryRender(request);
  } catch {
    return mp4UnavailableResponse();
  }
}

async function startStoryRender(request: Request): Promise<Response> {
  if (!serverMp4Available()) return mp4UnavailableResponse();
  const json = await request.json().catch(() => null);
  const parsed = matchStorySchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Story props are invalid." }, { status: 400 });
  const id = randomUUID();
  const file = tempDownloadPath(`match-story-${id}.mp4`);
  jobs.set(id, { progress: 0, status: "rendering", file });
  try {
    const { renderStoryMp4 } = await import("@/remotion/render-story");
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
  } catch {
    jobs.set(id, { progress: 0, status: "error", error: "This host cannot render an MP4." });
    return mp4UnavailableResponse();
  }
  return Response.json({ jobId: id });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get("jobId");
  if (!id) return Response.json({ available: serverMp4Available() });
  const job = jobs.get(id);
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
