import type { Delivery, Dismissal } from "@/domain/types";

export interface PassageInput {
  seq: number;
  /** Legal balls already on the log, used only to place the over index. */
  fromBalls: number;
  balls: number;
  runs: number;
  wickets: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  note: string;
  groundOffsetMs: number;
}

/**
 * One scoreboard passage. Runs sit on the last row. Each wicket is its own row.
 * The span totals the legal balls, so selectors add up without invented shot detail.
 */
export function passageDeliveries(input: PassageInput): Delivery[] {
  const balls = Math.max(0, Math.floor(input.balls));
  const runs = Math.max(0, Math.floor(input.runs));
  const wickets = Math.max(0, Math.floor(input.wickets));
  if (balls === 0 && runs === 0 && wickets === 0) return [];

  if (balls === 0) {
    return [
      row({
        seq: input.seq,
        over: overIndex(input.fromBalls),
        legalBall: 0,
        kind: "wide",
        runsBat: 0,
        extras: runs,
        span: 1,
        wicket: wickets > 0,
        input,
      }),
    ];
  }

  const wicketRows = Math.min(wickets, balls);
  const rows: Delivery[] = [];
  let seq = input.seq;
  let cursor = input.fromBalls;
  for (let i = 0; i < wicketRows; i += 1) {
    const last = i === wicketRows - 1;
    const span = last ? balls - (wicketRows - 1) : 1;
    rows.push(
      row({
        seq,
        over: overIndex(cursor),
        legalBall: ballInOver(cursor + span),
        kind: "legal",
        runsBat: last ? runs : 0,
        extras: 0,
        span,
        wicket: true,
        input,
      }),
    );
    seq += 1;
    cursor += span;
  }
  if (wicketRows === 0) {
    rows.push(
      row({
        seq,
        over: overIndex(cursor),
        legalBall: ballInOver(cursor + balls),
        kind: "legal",
        runsBat: runs,
        extras: 0,
        span: balls,
        wicket: false,
        input,
      }),
    );
  }
  return rows;
}

function overIndex(legalBallsBefore: number): number {
  return Math.max(0, Math.floor(legalBallsBefore / 6));
}

function ballInOver(legalBallsAfter: number): number {
  const mod = legalBallsAfter % 6;
  return mod === 0 ? 6 : mod;
}

function row(args: {
  seq: number;
  over: number;
  legalBall: number;
  kind: Delivery["kind"];
  runsBat: number;
  extras: number;
  span: number;
  wicket: boolean;
  input: PassageInput;
}): Delivery {
  const wicket = args.wicket
    ? { playerOutId: args.input.strikerId, dismissal: "unspecified" as Dismissal, end: "striker" as const }
    : undefined;
  return {
    seq: args.seq,
    over: args.over,
    legalBall: args.legalBall,
    kind: args.kind,
    runsBat: args.runsBat,
    extras: args.extras,
    boardSpan: args.span > 1 ? args.span : undefined,
    feed: "scoreboard",
    wicket,
    strikerId: args.input.strikerId,
    nonStrikerId: args.input.nonStrikerId,
    bowlerId: args.input.bowlerId,
    groundOffsetMs: args.input.groundOffsetMs,
    note: args.input.note,
  };
}
