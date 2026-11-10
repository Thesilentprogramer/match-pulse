import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { mp4UnavailableResponse, serverMp4Available, tempDownloadPath } from "@/lib/host";
import { summaryFilmSchema } from "@/remotion/summary-schema";

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
    return await startSummaryRender(request);
  } catch {
    return mp4UnavailableResponse();
  }
}

async function startSummaryRender(request: Request): Promise<Response> {
  if (!serverMp4Available()) return mp4UnavailableResponse();
  const json = await request.json().catch(() => null);
  const parsed = summaryFilmSchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Summary props are invalid." }, { status: 400 });
  const id = randomUUID();
  const file = tempDownloadPath(`match-summary-${id}.mp4`);
  jobs.set(id, { progress: 0, status: "rendering", file });
  try {
    const { renderComposition } = await import("@/remotion/render-story");
    void renderComposition("SummaryFilm", parsed.data, file, (progress) => {
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
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return Response.json({ available: serverMp4Available() });
  }
  const job = jobs.get(jobId);
  if (!job) return Response.json({ error: "Unknown job." }, { status: 404 });
  if (url.searchParams.get("download") === "1" && job.status === "done" && job.file) {
    const info = await stat(job.file);
    const stream = createReadStream(job.file);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(info.size),
        "Content-Disposition": 'attachment; filename="match-summary.mp4"',
      },
    });
  }
  return Response.json({ status: job.status, progress: job.progress, error: job.error ?? null });
}
