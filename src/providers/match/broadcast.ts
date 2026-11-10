import type { MatchDataSource } from "@/domain/fixture";
import { leadInMs, PACE, type PlaybackSpeed } from "@/domain/pacing";
import type { Delivery } from "@/domain/types";

export interface BroadcastOptions {
  afterSeq: number;
  speed: PlaybackSpeed;
  jitter: boolean;
  burstUntilSeq: number;
}

export interface BroadcastStep {
  delivery: Delivery;
  delayMs: number;
}

/**
 * Pure plan for the ground feed. The HTTP route only sleeps and writes.
 * A WebSocket or vendor feed can replace MatchDataSource without touching this loop.
 */
export function planBroadcast(source: MatchDataSource, options: BroadcastOptions): BroadcastStep[] {
  const balls = source.deliveries().filter((delivery) => delivery.seq > options.afterSeq);
  const steps: BroadcastStep[] = [];
  let first = true;
  let index = 0;

  while (index < balls.length) {
    const ball = balls[index];
    const next = balls[index + 1];
    if (!ball) break;
    const swap =
      options.jitter &&
      !first &&
      ball.legalBall !== 1 &&
      ball.seq % 17 === 8 &&
      next?.seq === ball.seq + 1 &&
      ball.seq > options.burstUntilSeq;

    if (swap && next) {
      steps.push({ delivery: next, delayMs: 40 });
      steps.push({ delivery: ball, delayMs: 420 });
      index += 2;
      first = false;
      continue;
    }

    const catchup = ball.seq <= options.burstUntilSeq;
    steps.push({
      delivery: ball,
      delayMs: catchup ? PACE.catchupGapMs : leadInMs(ball, options.speed, first),
    });
    first = false;
    index += 1;
  }

  return steps;
}
