import { fixtureSource } from "@/domain/fixture";
import { clampSpeed } from "@/domain/pacing";
import { planBroadcast } from "@/providers/match/broadcast";
import { encodeSse } from "@/providers/match/sse";

export const maxDuration = 300;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    if (signal.aborted) done();
    else signal.addEventListener("abort", done, { once: true });
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const afterSeq = clampInt(url.searchParams.get("after"), 0, 10_000);
  const burstUntilSeq = clampInt(url.searchParams.get("burst"), 0, 10_000);
  const speed = clampSpeed(Number(url.searchParams.get("speed") ?? "1"));
  const jitter = url.searchParams.get("jitter") === "1";
  const steps = planBroadcast(fixtureSource, { afterSeq, speed, jitter, burstUntilSeq });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown, id?: number) => {
        controller.enqueue(encoder.encode(encodeSse(event, data, id)));
      };
      try {
        if (afterSeq === 0) send("meta", fixtureSource.meta());
        for (const step of steps) {
          if (request.signal.aborted) break;
          if (step.delayMs > 0) await sleep(step.delayMs, request.signal);
          if (request.signal.aborted) break;
          send("delivery", step.delivery, step.delivery.seq);
        }
        if (!request.signal.aborted) send("end", { ok: true });
        controller.close();
      } catch (error) {
        controller.error(error);
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
