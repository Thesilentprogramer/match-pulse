import { teamRuns } from "@/domain/score";
import type { Delivery, InningsMeta, Market, MarketKind, MarketPhase, Player, Result, ScoreState, UserPick } from "@/domain/types";

export const STARTING_BANK = 1000;
export const STAKE_CHOICES = [25, 50, 100] as const;

const KINDS: MarketKind[] = ["wicket", "runs10", "six", "lastBoundary", "dots3"];

export function decimalOdds(probability: number): number {
  const fair = 1 / clamp(probability, 0.08, 0.85);
  return Math.max(1.25, Math.round(fair * 100) / 100);
}

export function proposeMarkets(
  score: ScoreState,
  overNumber: number,
  bowler: Player | undefined,
): Market[] {
  const probs = kindProbabilities(score, bowler);
  const ranked = [...KINDS].sort((a, b) => {
    const da = Math.abs(probs[a] - 0.5);
    const db = Math.abs(probs[b] - 0.5);
    if (da !== db) return da - db;
    return KINDS.indexOf(a) - KINDS.indexOf(b);
  });
  return ranked.slice(0, 3).map((kind) => {
    const yesProb = roundProb(probs[kind]);
    return {
      id: `${overNumber}:${kind}`,
      over: overNumber,
      kind,
      prompt: promptFor(kind),
      detail: detailFor(kind, yesProb, bowler, score),
      yesProb,
      yesOdds: decimalOdds(yesProb),
      noOdds: decimalOdds(1 - yesProb),
      bowlerId: bowler?.id ?? score.bowlerId ?? "",
    };
  });
}

function kindProbabilities(score: ScoreState, bowler: Player | undefined): Record<MarketKind, number> {
  const death = score.phase === "death" || score.ballsLeft <= 30;
  const powerplay = score.phase === "powerplay";
  const spin = (bowler?.bowlStyle ?? "").includes("spin");
  const pressure = (score.rrr ?? 0) >= 11;

  let wicket = death ? 0.4 : powerplay ? 0.33 : 0.3;
  if (spin && !death) wicket += 0.04;
  if (pressure) wicket += 0.05;
  if (score.wickets >= 7) wicket += 0.08;

  const mean = clamp(score.rrr ?? (score.crr || 8), 5, 14);
  const runs10 = 1 / (1 + Math.exp(-(mean - 9.1) / 1.7));
  const six = clamp((death ? 0.36 : powerplay ? 0.22 : 0.2) + (pressure ? 0.06 : 0), 0.12, 0.62);
  const lastBoundary = clamp(death ? 0.34 : 0.22, 0.12, 0.55);
  const dots3 = clamp(spin && !death ? 0.48 : death ? 0.28 : 0.36, 0.15, 0.62);

  return {
    wicket: clamp(wicket, 0.14, 0.62),
    runs10: clamp(runs10, 0.16, 0.78),
    six,
    lastBoundary,
    dots3,
  };
}

function promptFor(kind: MarketKind): string {
  switch (kind) {
    case "wicket":
      return "Wicket this over?";
    case "runs10":
      return "This over goes for 10 or more?";
    case "lastBoundary":
      return "Boundary off the last ball?";
    case "six":
      return "A six in this over?";
    case "dots3":
      return "Three or more dot balls?";
  }
}

function detailFor(kind: MarketKind, yesProb: number, bowler: Player | undefined, score: ScoreState): string {
  const who = bowler?.name ?? "This bowler";
  const pct = Math.round(yesProb * 100);
  switch (kind) {
    case "wicket":
      return `${who} is the bowler. The model puts a wicket at ${pct}%, from the phase and the wickets already down.`;
    case "runs10":
      return score.rrr
        ? `The chase wants ${score.rrr.toFixed(1)} an over. ${pct}% of similar overs clear 10.`
        : `${pct}% chance the over costs 10 or more.`;
    case "lastBoundary":
      return `Last-ball boundary, including a six. Sitting at ${pct}% in this phase.`;
    case "six":
      return `Any six, off any ball. ${pct}% given the hitting to come.`;
    case "dots3":
      return `${who.split(" ").slice(-1)[0] ?? who} has been hard to get away. ${pct}% chance of three dots.`;
  }
}

export function overDeliveries(deliveries: readonly Delivery[], overIndex: number): Delivery[] {
  return deliveries.filter((delivery) => delivery.over === overIndex);
}

export function inningsResult(deliveries: readonly Delivery[], meta: InningsMeta): Result {
  let runs = 0;
  let wickets = 0;
  let legal = 0;
  for (const delivery of deliveries) {
    runs += teamRuns(delivery);
    if (delivery.wicket) wickets += 1;
    if (delivery.kind !== "wide") legal += 1;
  }
  if (runs >= meta.target) return "won";
  if (wickets >= 10 || legal >= meta.balls) return runs === meta.target - 1 ? "tied" : "lost";
  return "chasing";
}

export function overFinished(overNumber: number, deliveries: readonly Delivery[], result: Result): boolean {
  const balls = overDeliveries(deliveries, overNumber - 1);
  const legal = balls.filter((delivery) => delivery.kind !== "wide").length;
  if (legal >= 6) return true;
  const later = deliveries.some((delivery) => delivery.over > overNumber - 1);
  return result !== "chasing" && balls.length > 0 && !later;
}

export function marketPhase(overNumber: number, deliveries: readonly Delivery[], meta: InningsMeta): MarketPhase {
  const overIndex = overNumber - 1;
  if (overIndex < 0 || overIndex >= meta.overs.length) return "upcoming";
  const balls = overDeliveries(deliveries, overIndex);
  const result = inningsResult(deliveries, meta);
  if (overFinished(overNumber, deliveries, result)) return "resolved";
  if (balls.length > 0) return "locked";
  if (result !== "chasing") return "upcoming";
  if (overIndex === 0 || overFinished(overNumber - 1, deliveries, result)) return "open";
  return "upcoming";
}

export function resolveMarket(market: Market, balls: readonly Delivery[]): "yes" | "no" {
  const legal = balls.filter((delivery) => delivery.kind !== "wide");
  const runs = balls.reduce((sum, delivery) => sum + teamRuns(delivery), 0);
  switch (market.kind) {
    case "wicket":
      return balls.some((delivery) => delivery.wicket) ? "yes" : "no";
    case "runs10":
      return runs >= 10 ? "yes" : "no";
    case "six":
      return balls.some((delivery) => delivery.boundary === 6) ? "yes" : "no";
    case "dots3":
      return legal.filter((delivery) => delivery.runsBat + delivery.extras === 0 && !delivery.wicket).length >= 3
        ? "yes"
        : "no";
    case "lastBoundary": {
      const last = legal[legal.length - 1];
      return last?.boundary === 4 || last?.boundary === 6 ? "yes" : "no";
    }
  }
}

export interface PickSettlement {
  marketId: string;
  outcome: "yes" | "no";
  won: boolean;
  /** Signed change versus the stake already locked. */
  profit: number;
  /** Amount added back to the bank. 0 on a loss. Includes the stake on a win. */
  returned: number;
}

export function settlePick(pick: UserPick, outcome: "yes" | "no"): PickSettlement {
  const won = pick.side === outcome;
  const returned = won ? Math.round(pick.stake * pick.odds) : 0;
  return {
    marketId: pick.marketId,
    outcome,
    won,
    profit: returned - pick.stake,
    returned,
  };
}

export interface Ledger {
  bank: number;
  streak: number;
  bestStreak: number;
  settled: PickSettlement[];
  committedStake: number;
}

/**
 * Bank is always derived from the starting stack plus picks.
 * Recomputing from the log beats mutating, so a replay cannot double-pay.
 */
export function projectLedger(
  picks: readonly UserPick[],
  markets: readonly Market[],
  deliveries: readonly Delivery[],
  result: Result,
): Ledger {
  const byId = new Map(markets.map((market) => [market.id, market]));
  let bank = STARTING_BANK;
  let streak = 0;
  let bestStreak = 0;
  let committedStake = 0;
  const settled: PickSettlement[] = [];
  const ordered = [...picks].sort((a, b) => pickSortKey(a.marketId) - pickSortKey(b.marketId));

  for (const pick of ordered) {
    bank -= pick.stake;
    committedStake += pick.stake;
    const market = byId.get(pick.marketId);
    if (!market || !overFinished(market.over, deliveries, result)) continue;
    const settlement = settlePick(pick, resolveMarket(market, overDeliveries(deliveries, market.over - 1)));
    bank += settlement.returned;
    settled.push(settlement);
    streak = settlement.won ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  }

  return { bank, streak, bestStreak, settled, committedStake };
}

export function canStake(bank: number, stake: number, alreadyPicked: boolean, phase: MarketPhase): string | null {
  if (alreadyPicked) return "You've already called this one.";
  if (phase !== "open") return phase === "locked" ? "Locked. The over has started on your stream." : "That over isn't open.";
  if (!STAKE_CHOICES.includes(stake as (typeof STAKE_CHOICES)[number])) return "Stake must be 25, 50, or 100 Pulse Points.";
  if (stake > bank) return "Not enough Pulse Points.";
  return null;
}

function pickSortKey(marketId: string): number {
  const [over, kind] = marketId.split(":");
  return Number(over) * 10 + Math.max(0, KINDS.indexOf(kind as MarketKind));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundProb(value: number): number {
  return Math.round(value * 100) / 100;
}
