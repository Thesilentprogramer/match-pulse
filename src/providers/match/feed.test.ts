import { describe, expect, it } from "vitest";
import { fixtureSource } from "@/domain/fixture";
import { planBroadcast } from "@/providers/match/broadcast";
import { FeedSession, type FeedTransport } from "@/providers/match/feed-session";
import { consumeSse, encodeSse } from "@/providers/match/sse";
import type { Delivery, FeedStatus } from "@/domain/types";

describe("sse framing", () => {
  it("reassembles a message split across chunks", () => {
    const encoded = encodeSse("delivery", { seq: 1 }, 1);
    const mid = Math.floor(encoded.length / 2);
    const first = consumeSse(encoded.slice(0, mid));
    expect(first.messages).toEqual([]);
    const second = consumeSse(first.rest + encoded.slice(mid));
    expect(second.messages).toHaveLength(1);
    expect(second.messages[0]?.event).toBe("delivery");
    expect(JSON.parse(second.messages[0]?.data ?? "{}")).toEqual({ seq: 1 });
  });
});

describe("broadcast plan", () => {
  it("keeps seq order and opens later overs with a real break", () => {
    const plan = planBroadcast(fixtureSource, { afterSeq: 0, speed: 1, jitter: false, burstUntilSeq: 0 });
    const seqs = plan.map((step) => step.delivery.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    const secondOver = plan.find((step) => step.delivery.over === 1 && step.delivery.legalBall === 1);
    expect(secondOver?.delayMs).toBeGreaterThanOrEqual(4200);
  });

  it("swaps a pair when jitter is on, after the break balls", () => {
    const plan = planBroadcast(fixtureSource, { afterSeq: 0, speed: 5, jitter: true, burstUntilSeq: 0 });
    const seqs = plan.map((step) => step.delivery.seq);
    expect(seqs).not.toEqual([...seqs].sort((a, b) => a - b));
    const sorted = [...seqs].sort((a, b) => a - b);
    expect(new Set(seqs)).toEqual(new Set(sorted));
  });

  it("bursts history with a short gap", () => {
    const plan = planBroadcast(fixtureSource, { afterSeq: 0, speed: 1, jitter: false, burstUntilSeq: 12 });
    expect(plan[0]?.delayMs).toBeLessThan(50);
    expect(plan.find((step) => step.delivery.seq === 13)?.delayMs).toBeGreaterThan(200);
  });
});

describe("feed session", () => {
  it("reorders a swapped pair and ignores the duplicate on reconnect", async () => {
    const deliveries: Delivery[] = [];
    const statuses: FeedStatus[] = [];
    const transport = new ScriptTransport([
      [encodeSse("delivery", { seq: 2 }), encodeSse("delivery", { seq: 1 }), encodeSse("end", { ok: true })],
    ]);
    const session = new FeedSession({
      transport,
      url: (query) => `http://feed.local/stream?after=${query.afterSeq}`,
      sleep: async () => {},
      onMeta: () => {},
      onDelivery: (delivery) => deliveries.push(delivery),
      onStatus: (status) => statuses.push(status),
    });
    session.start({ afterSeq: 0, speed: 1, jitter: false, burstUntilSeq: 0, generation: 0 });
    await flush();
    expect(deliveries.map((delivery) => delivery.seq)).toEqual([1, 2]);
    expect(statuses).toContain("ended");
    session.stop();
  });

  it("backfills a gap from the last contiguous ball", async () => {
    const seen: number[] = [];
    let connects = 0;
    const transport: FeedTransport = {
      async *connect() {
        connects += 1;
        if (connects === 1) {
          yield encodeSse("delivery", { seq: 2 });
          return;
        }
        yield encodeSse("delivery", { seq: 1 });
        yield encodeSse("delivery", { seq: 2 });
        yield encodeSse("end", { ok: true });
      },
    };
    const session = new FeedSession({
      transport,
      url: (query) => `http://feed.local/stream?after=${query.afterSeq}`,
      sleep: async () => {},
      gapMs: 5_000,
      onMeta: () => {},
      onDelivery: (delivery) => seen.push(delivery.seq),
      onStatus: () => {},
    });
    session.start({ afterSeq: 0, speed: 1, jitter: false, burstUntilSeq: 0, generation: 0 });
    await flush();
    expect(seen).toEqual([1, 2]);
    expect(connects).toBeGreaterThanOrEqual(2);
    session.stop();
  });
});

class ScriptTransport implements FeedTransport {
  private index = 0;
  constructor(private readonly scripts: string[][]) {}
  async *connect(): AsyncIterable<string> {
    const script = this.scripts[Math.min(this.index, this.scripts.length - 1)] ?? [];
    this.index += 1;
    for (const chunk of script) yield chunk;
  }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}
