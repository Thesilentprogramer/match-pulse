import type { BotPick, Market, MarketKind, PodMember, UserPick } from "@/domain/types";
import type { PickSettlement } from "@/domain/predictions";

export const POD: readonly PodMember[] = [
  { id: "you", name: "You", you: true, style: "favorites", color: "#dff56a" },
  { id: "aisha", name: "Aisha", you: false, style: "favorites", color: "#3ee0b0" },
  { id: "rohan", name: "Rohan", you: false, style: "longshot", color: "#ff6a45" },
  { id: "neha", name: "Neha", you: false, style: "balanced", color: "#8eb4ff" },
  { id: "vikram", name: "Vikram", you: false, style: "contrarian", color: "#f5c15d" },
  { id: "kunal", name: "Kunal", you: false, style: "momentum", color: "#e29bff" },
];

export function botPicksForOver(members: readonly PodMember[], markets: readonly Market[], over: number): BotPick[] {
  if (markets.length === 0) return [];
  const picks: BotPick[] = [];
  for (const member of members) {
    if (member.you) continue;
    const pick = pickFor(member, markets, over);
    if (pick) picks.push(pick);
  }
  return picks;
}

function pickFor(member: PodMember, markets: readonly Market[], over: number): BotPick | null {
  const rng = mulberry32(hash(`${member.id}:${over}`));
  const market = chooseMarket(member.style, markets, rng);
  if (!market) return null;
  const side = chooseSide(member.style, market, rng);
  const stake = member.style === "longshot" ? 50 : member.style === "momentum" ? 40 : 25;
  return {
    memberId: member.id,
    marketId: market.id,
    side,
    stake,
    odds: side === "yes" ? market.yesOdds : market.noOdds,
  };
}

function chooseMarket(style: PodMember["style"], markets: readonly Market[], rng: () => number): Market | undefined {
  if (style === "longshot") {
    return [...markets].sort((a, b) => underdogOdds(b) - underdogOdds(a))[0];
  }
  if (style === "balanced") {
    return [...markets].sort((a, b) => Math.abs(a.yesProb - 0.5) - Math.abs(b.yesProb - 0.5))[0];
  }
  if (style === "momentum") {
    const preferred: MarketKind = rng() > 0.5 ? "runs10" : "six";
    return markets.find((market) => market.kind === preferred) ?? markets[0];
  }
  return [...markets].sort((a, b) => confidence(b) - confidence(a))[0];
}

function chooseSide(style: PodMember["style"], market: Market, rng: () => number): "yes" | "no" {
  const favorite: "yes" | "no" = market.yesProb >= 0.5 ? "yes" : "no";
  if (style === "contrarian" || style === "longshot") return favorite === "yes" ? "no" : "yes";
  if (style === "balanced") return rng() < market.yesProb ? "yes" : "no";
  if (style === "momentum") return rng() > 0.35 ? "yes" : "no";
  return favorite;
}

function confidence(market: Market): number {
  return Math.max(market.yesProb, 1 - market.yesProb);
}

function underdogOdds(market: Market): number {
  return Math.max(market.yesOdds, market.noOdds);
}

export interface StandingRow {
  memberId: string;
  name: string;
  you: boolean;
  color: string;
  points: number;
  delta: number;
  streak: number;
  rank: number;
}

export function rankStandings(rows: Omit<StandingRow, "rank">[]): StandingRow[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function callout(name: string, market: Market, settlement: PickSettlement): string {
  const verb = settlement.won ? "called" : "missed";
  return `${name} ${verb} “${market.prompt.replace(/\?$/, "")}”`;
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function yourPickAsBot(pick: UserPick): BotPick {
  return { memberId: "you", marketId: pick.marketId, side: pick.side, stake: pick.stake, odds: pick.odds };
}
