import { contiguousCursor, createReorder, hasGap, pushReorder } from "@/domain/reorder";
import type { Delivery, FeedStatus, InningsMeta } from "@/domain/types";
import { consumeSse } from "@/providers/match/sse";

export interface FeedTransport {
  connect(url: string, signal: AbortSignal): AsyncIterable<string>;
}

export interface FeedQuery {
  afterSeq: number;
  speed: number;
  jitter: boolean;
  burstUntilSeq: number;
  generation: number;
}

export interface FeedSessionDeps {
  transport: FeedTransport;
  url: (query: FeedQuery) => string;
  clock?: { now(): number };
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  gapMs?: number;
  onMeta: (meta: InningsMeta) => void;
  onDelivery: (delivery: Delivery) => void;
  onSync?: (body: {
    deliveries: Delivery[];
    meta?: InningsMeta;
    badge?: "cricbuzz" | "cricapi" | "demo";
    note?: string | null;
    hitsToday?: number | null;
    hitsLimit?: number | null;
  }) => void;
  onStatus: (status: FeedStatus, detail?: string) => void;
}

const sleepDefault = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    if (signal.aborted) done();
    else signal.addEventListener("abort", done, { once: true });
  });

/**
 * Client session over any chunk transport.
 * Owns reconnect, backoff, idempotent reorder, and gap repair.
 * The store only ever sees deliveries in seq order.
 */
export class FeedSession {
  private mode: "idle" | "running" | "paused" | "stopped" = "idle";
  private conn = 0;
  private attempt = 0;
  private afterSeq = 0;
  private reorder = createReorder<Delivery>(1);
  private query: FeedQuery = { afterSeq: 0, speed: 1, jitter: false, burstUntilSeq: 0, generation: 0 };
  private abort: AbortController | null = null;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly deps: FeedSessionDeps) {}

  start(query: FeedQuery): void {
    this.mode = "running";
    this.apply(query);
    this.deps.onStatus("connecting");
    this.connect();
  }

  stop(): void {
    this.mode = "stopped";
    this.clearGap();
    this.abort?.abort();
  }

  pause(): void {
    if (this.mode === "stopped") return;
    this.mode = "paused";
    this.clearGap();
    this.abort?.abort();
    this.deps.onStatus("paused", "Broadcast held.");
  }

  resume(): void {
    if (this.mode !== "paused") return;
    this.mode = "running";
    this.connect();
  }

  async drop(ms: number): Promise<void> {
    if (this.mode === "stopped") return;
    this.pause();
    this.deps.onStatus("reconnecting", "Link dropped on purpose. Backfilling in a moment.");
    const signal = new AbortController();
    await (this.deps.sleep ?? sleepDefault)(ms, signal.signal);
    if (this.mode === "paused") this.resume();
  }

  configure(query: FeedQuery): void {
    const changed = this.apply(query);
    if (changed && this.mode === "running") this.connect();
  }

  private apply(query: FeedQuery): boolean {
    const reset = query.generation !== this.query.generation;
    const changed =
      reset ||
      query.speed !== this.query.speed ||
      query.jitter !== this.query.jitter ||
      query.burstUntilSeq !== this.query.burstUntilSeq;
    this.query = { ...query, afterSeq: reset ? 0 : this.afterSeq };
    if (reset) {
      this.afterSeq = 0;
      this.reorder = createReorder(1);
      this.attempt = 0;
    }
    return changed;
  }

  private connect(): void {
    this.conn += 1;
    const id = this.conn;
    this.abort?.abort();
    const abort = new AbortController();
    this.abort = abort;
    void this.pump(id, abort);
  }

  private async pump(id: number, abort: AbortController): Promise<void> {
    if (this.mode !== "running" || id !== this.conn) return;
    let sawEnd = false;
    try {
      const stream = this.deps.transport.connect(
        this.deps.url({ ...this.query, afterSeq: this.afterSeq }),
        abort.signal,
      );
      let buffer = "";
      for await (const chunk of stream) {
        if (id !== this.conn || this.mode !== "running") return;
        this.attempt = 0;
        this.deps.onStatus("live");
        const consumed = consumeSse(buffer + chunk);
        buffer = consumed.rest;
        for (const message of consumed.messages) {
          if (message.event === "meta") this.deps.onMeta(JSON.parse(message.data) as InningsMeta);
          if (message.event === "delivery") this.ingest(JSON.parse(message.data) as Delivery);
          if (message.event === "sync") {
            const body = JSON.parse(message.data) as { deliveries: Delivery[]; meta?: InningsMeta };
            this.deps.onSync?.(body);
            this.afterSeq = body.deliveries.at(-1)?.seq ?? this.afterSeq;
          }
          if (message.event === "end") sawEnd = true;
        }
      }
    } catch {
      if (id !== this.conn || this.mode !== "running" || abort.signal.aborted) return;
    }

    if (id !== this.conn || this.mode !== "running") return;
    if (sawEnd) {
      this.deps.onStatus("ended", "Innings complete.");
      this.mode = "stopped";
      return;
    }
    this.attempt += 1;
    if (this.attempt > 8) {
      this.deps.onStatus("error", "The ground feed stayed down. Try the demo controls to reconnect.");
      this.mode = "stopped";
      return;
    }
    const wait = Math.min(400 * 2 ** this.attempt, 4000);
    this.deps.onStatus("reconnecting", "Ground link dropped. Backfilling from the last ball.");
    await (this.deps.sleep ?? sleepDefault)(wait, abort.signal);
    if (id === this.conn && this.mode === "running") this.connect();
  }

  private ingest(delivery: Delivery): void {
    const result = pushReorder(this.reorder, delivery);
    this.reorder = result.buffer;
    if (result.duplicate || result.ready.length === 0) {
      if (hasGap(this.reorder)) this.armGap();
      return;
    }
    this.clearGap();
    for (const item of result.ready) {
      this.afterSeq = item.seq;
      this.deps.onDelivery(item);
    }
    // cursor stays on the contiguous prefix even if a later swap is queued again
    this.afterSeq = Math.max(this.afterSeq, contiguousCursor(this.reorder));
  }

  private armGap(): void {
    if (this.gapTimer) return;
    this.gapTimer = setTimeout(() => {
      this.gapTimer = null;
      if (this.mode === "running" && hasGap(this.reorder)) this.connect();
    }, this.deps.gapMs ?? 2500);
  }

  private clearGap(): void {
    if (this.gapTimer) clearTimeout(this.gapTimer);
    this.gapTimer = null;
  }
}
