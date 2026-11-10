import type { Delivery, FantasySlot, FantasyXi, InningsMeta } from "@/domain/types";
import { playerName } from "@/domain/players";
import { deliverySpan } from "@/domain/score";

/**
 * A plain-English reading of a sample Flex XI.
 * Points follow the publicly documented Dream11 T20 table, simplified:
 * economy and strike-rate bands are applied at the end of an over, not live
 * mid-over, and run-outs pay the fielder 6 (indirect) unless noted.
 * Pulse does not submit this XI anywhere. It only explains the swing.
 */

export interface FantasyLine {
  seq: number;
  playerId: string;
  text: string;
  points: number;
}

export interface FantasyView {
  total: number;
  delta: number;
  summary: string;
  lines: FantasyLine[];
  recent: FantasyLine[];
}

interface BatterTally {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  milestones: number;
  srBonus: number;
}

interface BowlerTally {
  legalBalls: number;
  runs: number;
  wickets: number;
  haulBonus: number;
  maidens: number;
  economyBonus: number;
}

interface FielderTally {
  catches: number;
  stumpings: number;
  runouts: number;
}

interface FantasyState {
  batters: Record<string, BatterTally>;
  bowlers: Record<string, BowlerTally>;
  fielders: Record<string, FielderTally>;
}

function emptyState(): FantasyState {
  return { batters: {}, bowlers: {}, fielders: {} };
}

function slotFor(xi: FantasyXi, playerId: string): FantasySlot | undefined {
  return xi.slots.find((slot) => slot.playerId === playerId);
}

function credit(base: number, slot: FantasySlot | undefined): number {
  if (!slot || base === 0) return 0;
  return Math.round(base * slot.multiplier * 10) / 10;
}

function tag(slot: FantasySlot | undefined): string {
  if (slot?.badge === "C") return " (C)";
  if (slot?.badge === "VC") return " (VC)";
  return "";
}

function srBonus(runs: number, balls: number): number {
  if (balls < 10) return 0;
  const sr = (runs / balls) * 100;
  if (sr > 170) return 6;
  if (sr > 150) return 4;
  if (sr >= 130) return 2;
  if (sr >= 70) return 0;
  if (sr >= 60) return -2;
  if (sr >= 50) return -4;
  return -6;
}

function economyBonus(runs: number, legalBalls: number): number {
  if (legalBalls < 12) return 0;
  const economy = runs / (legalBalls / 6);
  if (economy < 5) return 6;
  if (economy < 6) return 4;
  if (economy <= 7) return 2;
  if (economy < 10) return 0;
  if (economy <= 11) return -2;
  if (economy <= 12) return -4;
  return -6;
}

function haulBonus(wickets: number): number {
  if (wickets >= 5) return 16;
  if (wickets >= 4) return 8;
  if (wickets >= 3) return 4;
  return 0;
}

function milestoneBonus(runs: number): number {
  if (runs >= 100) return 16;
  if (runs >= 75) return 12;
  if (runs >= 50) return 8;
  if (runs >= 30) return 4;
  return 0;
}

export function projectFantasy(deliveries: readonly Delivery[], meta: InningsMeta): FantasyView {
  const state = emptyState();
  const lines: FantasyLine[] = [];

  for (const delivery of deliveries) {
    const ballLines = applyFantasyBall(state, delivery, meta);
    lines.push(...ballLines);
  }

  const total = Math.round(lines.reduce((sum, line) => sum + line.points, 0) * 10) / 10;
  const lastSeq = deliveries[deliveries.length - 1]?.seq;
  const recent = lastSeq ? lines.filter((line) => line.seq === lastSeq) : [];
  const delta = Math.round(recent.reduce((sum, line) => sum + line.points, 0) * 10) / 10;
  const summary = recent.length
    ? recent.map((line) => line.text).join(" ")
    : "No Flex XI players were involved in that ball.";

  return { total, delta, summary, lines, recent };
}

function applyFantasyBall(state: FantasyState, delivery: Delivery, meta: InningsMeta): FantasyLine[] {
  const lines: FantasyLine[] = [];
  const xi = meta.fantasy;

  const batterSlot = slotFor(xi, delivery.strikerId);
  const batter = state.batters[delivery.strikerId] ?? {
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    out: false,
    milestones: 0,
    srBonus: 0,
  };
  const faced = delivery.kind !== "wide";
  batter.runs += delivery.runsBat;
  batter.balls += faced ? Math.max(1, deliverySpan(delivery)) : 0;
  if (delivery.boundary === 4) batter.fours += 1;
  if (delivery.boundary === 6) batter.sixes += 1;
  state.batters[delivery.strikerId] = batter;

  if (batterSlot && (delivery.runsBat > 0 || delivery.boundary)) {
    const boundaryBonus = delivery.boundary === 6 ? 2 : delivery.boundary === 4 ? 1 : 0;
    const base = delivery.runsBat + boundaryBonus;
    const points = credit(base, batterSlot);
    const name = playerName(meta, delivery.strikerId);
    const bits = [`${delivery.runsBat} run${delivery.runsBat === 1 ? "" : "s"}`];
    if (boundaryBonus) bits.push(`${boundaryBonus} boundary bonus`);
    lines.push({
      seq: delivery.seq,
      playerId: delivery.strikerId,
      points,
      text: `${name}${tag(batterSlot)} scores ${bits.join(" + ")} = ${base}${multText(batterSlot, points)}.`,
    });
  }

  const nextMilestone = milestoneBonus(batter.runs);
  if (batterSlot && nextMilestone !== batter.milestones) {
    const base = nextMilestone - batter.milestones;
    batter.milestones = nextMilestone;
    const points = credit(base, batterSlot);
    lines.push({
      seq: delivery.seq,
      playerId: delivery.strikerId,
      points,
      text: `${playerName(meta, delivery.strikerId)}${tag(batterSlot)} crosses a batting milestone: ${base > 0 ? "+" : ""}${base}${multText(batterSlot, points)}.`,
    });
  }

  if (delivery.wicket?.playerOutId === delivery.strikerId && batter.runs === 0 && batterSlot) {
    const points = credit(-2, batterSlot);
    lines.push({
      seq: delivery.seq,
      playerId: delivery.strikerId,
      points,
      text: `${playerName(meta, delivery.strikerId)}${tag(batterSlot)} is out for a duck: −2${multText(batterSlot, points)}.`,
    });
  }

  const bowlerSlot = slotFor(xi, delivery.bowlerId);
  const bowler = state.bowlers[delivery.bowlerId] ?? {
    legalBalls: 0,
    runs: 0,
    wickets: 0,
    haulBonus: 0,
    maidens: 0,
    economyBonus: 0,
  };
  bowler.runs += delivery.runsBat + delivery.extras;
  if (delivery.kind !== "wide") bowler.legalBalls += deliverySpan(delivery);
  state.bowlers[delivery.bowlerId] = bowler;

  if (delivery.wicket && delivery.wicket.dismissal !== "runout" && delivery.wicket.dismissal !== "unspecified" && bowlerSlot) {
    bowler.wickets += 1;
    let base = 25;
    const extras: string[] = ["25 for the wicket"];
    if (delivery.wicket.dismissal === "bowled" || delivery.wicket.dismissal === "lbw") {
      base += 8;
      extras.push("8 for bowled or lbw");
    }
    const points = credit(base, bowlerSlot);
    lines.push({
      seq: delivery.seq,
      playerId: delivery.bowlerId,
      points,
      text: `${playerName(meta, delivery.bowlerId)} takes the wicket: ${extras.join(" + ")}${multText(bowlerSlot, points)}.`,
    });
    const nextHaul = haulBonus(bowler.wickets);
    if (nextHaul !== bowler.haulBonus) {
      const haulBase = nextHaul - bowler.haulBonus;
      bowler.haulBonus = nextHaul;
      const haulPoints = credit(haulBase, bowlerSlot);
      lines.push({
        seq: delivery.seq,
        playerId: delivery.bowlerId,
        points: haulPoints,
        text: `${playerName(meta, delivery.bowlerId)} hits a wicket haul bonus: +${haulBase}${multText(bowlerSlot, haulPoints)}.`,
      });
    }
  } else if (delivery.wicket && delivery.wicket.dismissal === "runout" && bowlerSlot) {
    lines.push({
      seq: delivery.seq,
      playerId: delivery.bowlerId,
      points: 0,
      text: `${playerName(meta, delivery.bowlerId)} bowled it, but a run-out does not pay the bowler.`,
    });
  }

  if (delivery.wicket?.dismissal === "caught" && delivery.wicket.fielderId) {
    const fielderSlot = slotFor(xi, delivery.wicket.fielderId);
    if (fielderSlot) {
      const points = credit(8, fielderSlot);
      lines.push({
        seq: delivery.seq,
        playerId: delivery.wicket.fielderId,
        points,
        text: `${playerName(meta, delivery.wicket.fielderId)} takes the catch: +8${multText(fielderSlot, points)}.`,
      });
    }
  }

  if (delivery.wicket?.dismissal === "runout" && delivery.wicket.fielderId) {
    const fielderSlot = slotFor(xi, delivery.wicket.fielderId);
    if (fielderSlot) {
      const points = credit(6, fielderSlot);
      lines.push({
        seq: delivery.seq,
        playerId: delivery.wicket.fielderId,
        points,
        text: `${playerName(meta, delivery.wicket.fielderId)} with the run-out: +6${multText(fielderSlot, points)}.`,
      });
    }
  }

  const overClosed = delivery.kind !== "wide" && delivery.legalBall === 6;
  if (overClosed) {
    if (bowlerSlot) {
      const nextEco = economyBonus(bowler.runs, bowler.legalBalls);
      if (nextEco !== bowler.economyBonus) {
        const base = nextEco - bowler.economyBonus;
        bowler.economyBonus = nextEco;
        const points = credit(base, bowlerSlot);
        lines.push({
          seq: delivery.seq,
          playerId: delivery.bowlerId,
          points,
          text: `${playerName(meta, delivery.bowlerId)} economy adjustment ${base > 0 ? "+" : ""}${base}${multText(bowlerSlot, points)}.`,
        });
      }
    }
    if (batterSlot) {
      const nextSr = srBonus(batter.runs, batter.balls);
      if (nextSr !== batter.srBonus) {
        const base = nextSr - batter.srBonus;
        batter.srBonus = nextSr;
        const points = credit(base, batterSlot);
        lines.push({
          seq: delivery.seq,
          playerId: delivery.strikerId,
          points,
          text: `${playerName(meta, delivery.strikerId)}${tag(batterSlot)} strike-rate adjustment ${base > 0 ? "+" : ""}${base}${multText(batterSlot, points)}.`,
        });
      }
    }
  }

  return lines;
}

function multText(slot: FantasySlot, points: number): string {
  if (slot.multiplier === 1) return ` → ${signed(points)}`;
  const label = slot.multiplier === 2 ? "captain ×2" : "vice-captain ×1.5";
  return `, ${label} → ${signed(points)}`;
}

function signed(points: number): string {
  return `${points > 0 ? "+" : ""}${points}`;
}
