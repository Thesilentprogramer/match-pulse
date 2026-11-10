import { cardFromCopy, renderMoment, toneFor } from "@/domain/copy";
import { playerName, teamById } from "@/domain/players";
import { applyDelivery, emptyScore, equationFor, foldDeliveries } from "@/domain/score";
import type { Delivery, InningsMeta, MomentCard, MomentContext, ScoreState } from "@/domain/types";
import { winProbability } from "@/domain/win-prob";

export interface Frame {
  delivery: Delivery;
  before: ScoreState;
  after: ScoreState;
  prevProb: number;
  prob: number;
  context: MomentContext;
  card: MomentCard;
}

export interface Projection {
  frames: Frame[];
  final: ScoreState;
}

export function projectInnings(deliveries: readonly Delivery[], meta: InningsMeta): Projection {
  const frames: Frame[] = [];
  let before = emptyScore(meta);
  let prevProb = winProbability(before, meta.target);

  for (const delivery of deliveries) {
    const after = applyDelivery(before, delivery, meta);
    const prob = winProbability(after, meta.target);
    const context = momentContext(delivery, after, prevProb, prob, meta);
    frames.push({
      delivery,
      before,
      after,
      prevProb,
      prob,
      context,
      card: cardFromCopy(context, renderMoment(context), delivery.strikerId),
    });
    before = after;
    prevProb = prob;
  }

  return { frames, final: before };
}

function momentContext(
  delivery: Delivery,
  after: ScoreState,
  prevProb: number,
  prob: number,
  meta: InningsMeta,
): MomentContext {
  const batting = teamById(meta, meta.battingTeamId);
  const equation = equationFor(after);

  const tone = toneFor({
    result: after.result,
    dismissal: delivery.wicket?.dismissal,
    boundary: delivery.boundary,
    runsBat: delivery.runsBat,
    tone: "run",
  });

  return {
    seq: delivery.seq,
    overLabel: after.oversLabel,
    tone,
    playerName: playerName(meta, delivery.strikerId),
    bowlerName: playerName(meta, delivery.bowlerId, "Bowler"),
    battingTeam: batting?.name ?? "The chase",
    equation,
    scoreLabel: `${batting?.short ?? "BAT"} ${after.runs}/${after.wickets}`,
    winProb: prob,
    winDelta: prob - prevProb,
    rrr: after.rrr,
    crr: after.crr,
    ballsLeft: after.ballsLeft,
    wicketsInHand: 10 - after.wickets,
    note: delivery.note,
    dismissal: delivery.wicket?.dismissal,
    runsBat: delivery.runsBat,
    boundary: delivery.boundary,
    phase: after.phase,
    result: after.result,
  };
}

/** Score as it stood before `overIndex` (0-based). */
export function projectPrefix(deliveries: readonly Delivery[], meta: InningsMeta, overIndex: number): ScoreState {
  return foldDeliveries(
    deliveries.filter((delivery) => delivery.over < overIndex),
    meta,
  );
}
