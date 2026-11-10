import type { FeedTransport } from "@/providers/match/feed-session";

export class FetchSseTransport implements FeedTransport {
  async *connect(url: string, signal: AbortSignal): AsyncIterable<string> {
    const response = await fetch(url, {
      signal,
      headers: { accept: "text/event-stream" },
      cache: "no-store",
    });
    if (!response.ok || !response.body) {
      throw new Error(`Ground feed responded ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        yield decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export function feedUrl(query: {
  afterSeq: number;
  speed: number;
  jitter: boolean;
  burstUntilSeq: number;
  matchId?: string;
}): string {
  const params = new URLSearchParams({
    after: String(query.afterSeq),
    speed: String(query.speed),
    jitter: query.jitter ? "1" : "0",
    burst: String(query.burstUntilSeq),
  });
  if (query.matchId) params.set("match", query.matchId);
  return `/api/match/stream?${params.toString()}`;
}
