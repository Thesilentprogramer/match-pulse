import { connection } from "next/server";
import { fixtureSource } from "@/domain/fixture";
import { clampSpeed } from "@/domain/pacing";
import { planBroadcast } from "@/providers/match/broadcast";
import { encodeSse } from "@/providers/match/sse";
import { SSE_HEARTBEAT_MS, shouldYieldStream, streamYieldAt } from "@/providers/match/stream-budget";

// Cache Components already runs this route on Node.js and rejects `export const runtime`.
// 300s is the Vercel budget for one connection (Hobby cannot raise it). A full 1× innings
// is longer, so the handler yields before the platform kills it and the client resumes.
export const maxDuration = 300;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done);
  });
}

export async function GET(request: Request): Promise<Response> {
  await connection();
  const url = new URL(request.url);
  const afterSeq = clampInt(url.searchParams.get("after"), 0, 10_000);
  const burstUntilSeq = clampInt(url.searchParams.get("burst"), 0, 10_000);
  const speed = clampSpeed(Number(url.searchParams.get("speed") ?? "1"));
  const jitter = url.searchParams.get("jitter") === "1";
  const steps = planBroadcast(fixtureSource, { afterSeq, speed, jitter, burstUntilSeq });
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const yieldAt = streamYieldAt(process.env, startedAt);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const sendRaw = (chunk: string) => {
        if (closed || request.signal.aborted) return;
        controller.enqueue(encoder.encode(chunk));
      };
      const send = (event: string, data: unknown, id?: number) => {
        sendRaw(encodeSse(event, data, id));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };
      try {
        // First byte immediately, so a proxy does not buffer the feed.
        sendRaw(": open\n\n");
        if (afterSeq === 0) send("meta", fixtureSource.meta());
        let yielded = false;
        for (const step of steps) {
          if (request.signal.aborted) break;
          if (shouldYieldStream(Date.now(), yieldAt, step.delayMs)) {
            yielded = true;
            break;
          }
          if (step.delayMs > 0) {
            let left = step.delayMs;
            while (left > 0) {
              if (request.signal.aborted) break;
              if (shouldYieldStream(Date.now(), yieldAt)) {
                yielded = true;
                break;
              }
              const slice = Math.min(SSE_HEARTBEAT_MS, left);
              await sleep(slice, request.signal);
              left -= slice;
              if (left > 0 && !request.signal.aborted && !shouldYieldStream(Date.now(), yieldAt)) sendRaw(": ping\n\n");
            }
          }
          if (request.signal.aborted || yielded) break;
          send("delivery", step.delivery, step.delivery.seq);
        }
        // `end` means the innings is finished. A yield is a pause, and the client resumes.
        if (!request.signal.aborted && !yielded) send("end", { ok: true });
        close();
      } catch (error) {
        if (!closed) controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

function clampInt(value: string | null, min: number, max: number): number {
  const parsed = Number(value ?? "0");
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}
