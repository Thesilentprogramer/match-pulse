import { creaseAfter, openingCrease } from "@/domain/crease";
import type { BatterCard, BowlerCard, Delivery, InningsMeta, Phase, Result, ScoreState } from "@/domain/types";

export function oversLabel(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

/** A first innings with no published target. Not a chase. */
export function openBoard(toWin: number): boolean {
  return toWin > 5000;
}

export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

export function formatPct(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

export function emptyScore(meta: InningsMeta): ScoreState {
  const crease = openingCrease(meta.battingOrder);
  return {
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    oversLabel: "0.0",
    ballsLeft: meta.balls,
    toWin: meta.target,
    crr: 0,
    rrr: openBoard(meta.target) ? null : (meta.target / meta.balls) * 6,
    strikerId: crease.strikerId,
    nonStrikerId: crease.nonStrikerId,
    bowlerId: meta.overs[0]?.bowlerId ?? null,
    phase: "powerplay",
    result: "chasing",
    overIndex: -1,
    thisOver: [],
    thisOverRuns: 0,
    partnershipRuns: 0,
    partnershipBalls: 0,
    batters: {},
    bowlers: {},
    dismissed: [],
    yetToBat: meta.battingOrder.slice(2),
    recent: [],
  };
}

function phaseFor(legalBalls: number, result: Result): Phase {
  if (result !== "chasing") return "complete";
  if (legalBalls < 36) return "powerplay";
  if (legalBalls >= 90) return "death";
  return "middle";
}

function resultFor(runs: number, wickets: number, legalBalls: number, meta: InningsMeta): Result {
  if (runs >= meta.target) return "won";
  const finished = wickets >= 10 || legalBalls >= meta.balls;
  if (!finished) return "chasing";
  if (runs === meta.target - 1) return "tied";
  return "lost";
}

function ballChip(delivery: Delivery): string {
  if ((delivery.boardSpan ?? 1) > 1) {
    const total = delivery.runsBat + delivery.extras;
    return delivery.wicket ? `${total}*` : `${total}*`;
  }
  if (delivery.kind === "wide") return delivery.extras > 1 ? `${delivery.extras}wd` : "wd";
  if (delivery.wicket) return delivery.runsBat > 0 ? `${delivery.runsBat}W` : "W";
  if (delivery.boundary === 6) return "6";
  if (delivery.boundary === 4) return "4";
  return String(delivery.runsBat + delivery.extras);
}

function isDot(delivery: Delivery): boolean {
  return delivery.kind === "legal" && delivery.runsBat + delivery.extras === 0 && !delivery.wicket;
}

function bowlerWicket(delivery: Delivery): boolean {
  if (!delivery.wicket) return false;
  return delivery.wicket.dismissal !== "runout" && delivery.wicket.dismissal !== "unspecified";
}

/** Legal balls a row contributes. A wide adds none. A scoreboard passage may add many. */
export function deliverySpan(delivery: Pick<Delivery, "kind" | "boardSpan">): number {
  if (delivery.kind === "wide") return 0;
  const span = delivery.boardSpan ?? 1;
  if (!Number.isFinite(span) || span <= 1) return 1;
  return Math.min(2700, Math.floor(span));
}

function touchBatter(card: BatterCard | undefined): BatterCard {
  return card ?? { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
}

function touchBowler(card: BowlerCard | undefined): BowlerCard {
  return card ?? { legalBalls: 0, runs: 0, wickets: 0, dots: 0, maidens: 0 };
}

export function applyDelivery(score: ScoreState, delivery: Delivery, meta: InningsMeta): ScoreState {
  const batters = { ...score.batters };
  const bowlers = { ...score.bowlers };
  const striker = touchBatter(batters[delivery.strikerId]);
  const faced = delivery.kind !== "wide";
  batters[delivery.strikerId] = {
    ...striker,
    runs: striker.runs + delivery.runsBat,
    balls: striker.balls + (faced ? deliverySpan(delivery) : 0),
    fours: striker.fours + (delivery.boundary === 4 ? 1 : 0),
    sixes: striker.sixes + (delivery.boundary === 6 ? 1 : 0),
    out: striker.out || delivery.wicket?.playerOutId === delivery.strikerId,
    dismissal:
      delivery.wicket?.playerOutId === delivery.strikerId ? delivery.wicket.dismissal : striker.dismissal,
  };
  if (delivery.wicket && delivery.wicket.playerOutId !== delivery.strikerId) {
    const other = touchBatter(batters[delivery.wicket.playerOutId]);
    batters[delivery.wicket.playerOutId] = {
      ...other,
      out: true,
      dismissal: delivery.wicket.dismissal,
    };
  }

  const bowler = touchBowler(bowlers[delivery.bowlerId]);
  const legal = delivery.kind !== "wide";
  const conceded = delivery.runsBat + delivery.extras;
  const opensTape = delivery.over !== score.overIndex;
  const overRuns = (opensTape ? 0 : score.thisOverRuns) + conceded;
  const span = deliverySpan(delivery);
  const completedMaiden = legal && span === 1 && delivery.legalBall === 6 && overRuns === 0;
  bowlers[delivery.bowlerId] = {
    legalBalls: bowler.legalBalls + span,
    runs: bowler.runs + conceded,
    wickets: bowler.wickets + (bowlerWicket(delivery) ? 1 : 0),
    dots: bowler.dots + (isDot(delivery) ? 1 : 0),
    maidens: bowler.maidens + (completedMaiden ? 1 : 0),
  };

  const runs = score.runs + conceded;
  const wickets = score.wickets + (delivery.wicket ? 1 : 0);
  const legalBalls = score.legalBalls + span;
  const result = resultFor(runs, wickets, legalBalls, meta);
  const ballsLeft = Math.max(0, meta.balls - legalBalls);
  const toWin = Math.max(0, meta.target - runs);
  const crr = legalBalls === 0 ? 0 : runs / (legalBalls / 6);
  const rrr = openBoard(toWin) || result !== "chasing" || ballsLeft <= 0 ? null : toWin / (ballsLeft / 6);

  const crease = creaseAfter(
    {
      strikerId: delivery.strikerId,
      nonStrikerId: delivery.nonStrikerId,
      nextIndex: 2 + score.wickets,
      dismissed: score.dismissed,
    },
    delivery,
    meta.battingOrder,
  );
  // creaseAfter's nextIndex input above is approximate if dismissals already happened.
  // Recompute the waiting batter from the batting order and the crease ends we just produced.
  const dismissed = crease.dismissed;
  const occupied = new Set([crease.strikerId, crease.nonStrikerId].filter((id): id is string => Boolean(id)));
  const yetToBat = meta.battingOrder.filter((id) => !dismissed.includes(id) && !occupied.has(id));

  const chip = ballChip(delivery);
  const overTape = opensTape ? [chip] : [...score.thisOver, chip];
  const recent = legal ? [...score.recent, chip].slice(-6) : score.recent;
  const partnershipBroken = Boolean(delivery.wicket);
  const partnershipRuns = partnershipBroken ? 0 : score.partnershipRuns + conceded;
  const partnershipBalls = partnershipBroken ? 0 : score.partnershipBalls + span;

  return {
    runs,
    wickets,
    legalBalls,
    oversLabel: oversLabel(legalBalls),
    ballsLeft,
    toWin,
    crr,
    rrr,
    strikerId: result === "chasing" ? crease.strikerId : null,
    nonStrikerId: result === "chasing" ? crease.nonStrikerId : null,
    bowlerId: delivery.bowlerId,
    phase: phaseFor(legalBalls, result),
    result,
    overIndex: delivery.over,
    thisOver: overTape,
    thisOverRuns: overRuns,
    partnershipRuns,
    partnershipBalls,
    batters,
    bowlers,
    dismissed,
    yetToBat,
    recent,
  };
}

export function foldDeliveries(deliveries: readonly Delivery[], meta: InningsMeta): ScoreState {
  return deliveries.reduce((score, delivery) => applyDelivery(score, delivery, meta), emptyScore(meta));
}

export function isInningsDone(score: ScoreState): boolean {
  return score.result !== "chasing";
}

export function equationFor(score: ScoreState): string {
  if (score.result === "won") {
    if (score.ballsLeft <= 0) return "Won on the last ball";
    return `Won with ${score.ballsLeft} ball${score.ballsLeft === 1 ? "" : "s"} to spare`;
  }
  if (score.result === "lost") return "The chase is over";
  if (score.result === "tied") return "Scores level";
  // A scoreboard with no published target uses a sentinel (see Cricbuzz chaseTarget).
  // That is not a chase, so it must not read as "2685 needed".
  if (openBoard(score.toWin)) {
    return `No target yet · ${score.runs}/${score.wickets} (${score.oversLabel})`;
  }
  return `${score.toWin} needed from ${score.ballsLeft} · RRR ${formatRate(score.rrr)}`;
}

export function teamRuns(delivery: Delivery): number {
  return delivery.runsBat + delivery.extras;
}
