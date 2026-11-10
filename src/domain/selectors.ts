import { projectFantasy } from "@/domain/fantasy";
import { playerById, teamById } from "@/domain/players";
import { botPicksForOver, callout, POD, rankStandings, type StandingRow } from "@/domain/pod";
import {
  canStake,
  inningsResult,
  marketPhase,
  overDeliveries,
  overFinished,
  projectLedger,
  proposeMarkets,
  resolveMarket,
  settlePick,
  STARTING_BANK,
  type PickSettlement,
} from "@/domain/predictions";
import { projectInnings, projectPrefix } from "@/domain/project";
import { equationFor, formatPct, formatRate, openBoard } from "@/domain/score";
import type {
  BotPick,
  Delivery,
  InningsMeta,
  Market,
  MarketKind,
  MarketPhase,
  MomentCard,
  MomentContext,
  ScoreState,
  UserPick,
} from "@/domain/types";
import { winProbability } from "@/domain/win-prob";

export interface Enrichment {
  headline?: string;
  dek?: string;
  why?: string;
  whisper?: string;
  source: "template" | "model";
}

export interface MarketView {
  market: Market;
  phase: MarketPhase;
  pick: UserPick | null;
  outcome: "yes" | "no" | null;
  profit: number | null;
  blockReason: string | null;
}

export interface Badge {
  id: string;
  label: string;
  detail: string;
}

export interface MatchView {
  ready: boolean;
  score: ScoreState | null;
  scoreLine: string;
  equation: string;
  crrLabel: string;
  rrrLabel: string;
  winProb: number;
  winSeries: number[];
  ballCount: number;
  cards: MomentCard[];
  latestCard: MomentCard | null;
  focusOver: number | null;
  focusPhase: MarketPhase | "waiting";
  markets: MarketView[];
  tape: string[];
  tapeLabel: string;
  ledgerBank: number;
  streak: number;
  bestStreak: number;
  standings: StandingRow[];
  meter: { memberId: string; name: string; color: string; delta: number; you: boolean }[];
  callouts: string[];
  take: string | null;
  badges: Badge[];
  fantasy: ReturnType<typeof projectFantasy> | null;
  announcement: string;
  result: ScoreState["result"] | null;
  copySource: "template" | "model";
  latestContext: MomentContext | null;
}

export interface SelectorInput {
  meta: InningsMeta | null;
  /** Contiguous deliveries accepted from the feed, in seq order. */
  deliveries: readonly Delivery[];
  picks: readonly UserPick[];
  fantasyOn: boolean;
  enrichments: Readonly<Record<number, Enrichment>>;
  predictionLines?: readonly { kind: MarketKind; prompt: string; detail: string }[] | null;
  stake: number;
}

export function selectMatchView(input: SelectorInput): MatchView {
  if (!input.meta) return emptyView();
  const meta = input.meta;
  const deliveries = input.deliveries;
  const projection = projectInnings(deliveries, meta);
  const score = projection.final;
  const batting = teamById(meta, meta.battingTeamId);
  const winProb = projection.frames.at(-1)?.prob ?? winProbability(score, meta.target);
  const cards = projection.frames.map((frame) => applyEnrichment(frame.card, input.enrichments[frame.delivery.seq]));
  const result = deliveries.length ? inningsResult(deliveries, meta) : "chasing";

  const markets = collectMarkets(deliveries, meta);
  const ledger = projectLedger(input.picks, markets, deliveries, result);
  const focusOver = focusOverNumber(deliveries, meta);
  const focusPhase: MatchView["focusPhase"] = focusOver ? marketPhase(focusOver, deliveries, meta) : "waiting";
  const focusMarkets = markets
    .filter((market) => market.over === focusOver)
    .map((market) => overlayLine(market, input.predictionLines ?? null));
  const marketViews: MarketView[] = focusMarkets.map((market) => {
    const pick = input.picks.find((item) => item.marketId === market.id) ?? null;
    const finished = overFinished(market.over, deliveries, result);
    const outcome = finished ? resolveMarket(market, overDeliveries(deliveries, market.over - 1)) : null;
    const profit = pick && outcome ? settlePick(pick, outcome).profit : null;
    return {
      market,
      phase: marketPhase(market.over, deliveries, meta),
      pick,
      outcome,
      profit,
      blockReason: canStake(ledger.bank + (pick ? pick.stake : 0), input.stake, Boolean(pick), marketPhase(market.over, deliveries, meta)),
    };
  });

  const botPicks = allBotPicks(markets);
  const standings = buildStandings(meta, markets, deliveries, result, input.picks, botPicks, ledger.bank, ledger.streak);
  const meterOver = focusPhase === "open" ? (focusOver ?? 1) - 1 : (focusOver ?? 0);
  const meter = buildMeter(standings, markets, deliveries, result, input.picks, botPicks, meterOver);
  const { callouts, take } = buildCallouts(markets, deliveries, result, input.picks, botPicks, meterOver);

  const equation = equationFor(score);
  const scoreLine = `${batting?.name ?? "Chase"} ${score.runs}/${score.wickets}`;
  const announcement = openBoard(score.toWin)
    ? `${batting?.short ?? "BAT"} ${score.runs} for ${score.wickets} after ${score.oversLabel}. ${equation}.`
    : [
        `${batting?.short ?? "BAT"} ${score.runs} for ${score.wickets} after ${score.oversLabel}.`,
        score.result === "chasing" ? `${score.toWin} needed from ${score.ballsLeft}.` : equation,
        `Win chance ${formatPct(winProb)}.`,
      ].join(" ");

  const fantasy = input.fantasyOn ? projectFantasy(deliveries, meta) : null;
  const copySource = cards.some((card) => input.enrichments[card.seq]?.source === "model") ? "model" : "template";

  return {
    ready: true,
    score,
    scoreLine,
    equation,
    crrLabel: formatRate(score.crr),
    rrrLabel: formatRate(score.rrr),
    winProb,
    winSeries: projection.frames.map((frame) => frame.prob),
    ballCount: deliveries.length,
    cards,
    latestCard: cards.at(-1) ?? null,
    focusOver,
    focusPhase,
    markets: marketViews,
    tape: score.thisOver,
    tapeLabel: focusPhase === "locked" ? "This over" : score.thisOver.length ? "Last over" : "Yet to start",
    ledgerBank: ledger.bank,
    streak: ledger.streak,
    bestStreak: ledger.bestStreak,
    standings,
    meter,
    callouts,
    take,
    badges: badgesFor(input, ledger.bestStreak, ledger.settled, standings),
    fantasy,
    announcement,
    result: score.result,
    copySource,
    latestContext: projection.frames.at(-1)?.context ?? null,
  };
}

function emptyView(): MatchView {
  return {
    ready: false,
    score: null,
    scoreLine: "Linking the ground feed",
    equation: "The first ball is on its way",
    crrLabel: "—",
    rrrLabel: "—",
    winProb: 0.5,
    winSeries: [],
    ballCount: 0,
    cards: [],
    latestCard: null,
    focusOver: null,
    focusPhase: "waiting",
    markets: [],
    tape: [],
    tapeLabel: "Yet to start",
    ledgerBank: STARTING_BANK,
    streak: 0,
    bestStreak: 0,
    standings: [],
    meter: [],
    callouts: [],
    take: null,
    badges: [],
    fantasy: null,
    announcement: "Linking the ground feed.",
    result: null,
    copySource: "template",
    latestContext: null,
  };
}

function collectMarkets(released: readonly Delivery[], meta: InningsMeta): Market[] {
  const markets: Market[] = [];
  for (let over = 1; over <= meta.overs.length; over += 1) {
    if (marketPhase(over, released, meta) === "upcoming") continue;
    const before = projectPrefix(released, meta, over - 1);
    const bowler = playerById(meta, meta.overs[over - 1]?.bowlerId);
    markets.push(...proposeMarkets(before, over, bowler));
  }
  return markets;
}

function focusOverNumber(released: readonly Delivery[], meta: InningsMeta): number | null {
  let open: number | null = null;
  let locked: number | null = null;
  let resolved: number | null = null;
  for (let over = 1; over <= meta.overs.length; over += 1) {
    const phase = marketPhase(over, released, meta);
    if (phase === "open") open = over;
    if (phase === "locked") locked = over;
    if (phase === "resolved") resolved = over;
  }
  return open ?? locked ?? resolved;
}

function allBotPicks(markets: readonly Market[]): BotPick[] {
  const overs = new Set(markets.map((market) => market.over));
  const picks: BotPick[] = [];
  for (const over of overs) {
    picks.push(...botPicksForOver(POD, markets.filter((market) => market.over === over), over));
  }
  return picks;
}

function buildStandings(
  meta: InningsMeta,
  markets: readonly Market[],
  released: readonly Delivery[],
  result: ScoreState["result"],
  picks: readonly UserPick[],
  botPicks: readonly BotPick[],
  yourBank: number,
  yourStreak: number,
): StandingRow[] {
  const rows = POD.map((member) => {
    if (member.you) {
      return { memberId: member.id, name: member.name, you: true, color: member.color, points: yourBank, delta: 0, streak: yourStreak };
    }
    const mine = botPicks.filter((pick) => pick.memberId === member.id);
    const ledger = projectLedger(mine, markets, released, result);
    return {
      memberId: member.id,
      name: member.name,
      you: false,
      color: member.color,
      points: ledger.bank,
      delta: 0,
      streak: ledger.streak,
    };
  });
  void meta;
  return rankStandings(rows);
}

function buildMeter(
  standings: readonly StandingRow[],
  markets: readonly Market[],
  released: readonly Delivery[],
  result: ScoreState["result"],
  picks: readonly UserPick[],
  botPicks: readonly BotPick[],
  over: number,
): MatchView["meter"] {
  if (over < 1) {
    return standings.map((row) => ({ memberId: row.memberId, name: row.name, color: row.color, delta: 0, you: row.you }));
  }
  return standings.map((row) => {
    const mine = row.you
      ? picks.filter((pick) => pick.marketId.startsWith(`${over}:`))
      : botPicks.filter((pick) => pick.memberId === row.memberId && pick.marketId.startsWith(`${over}:`));
    const ledger = projectLedger(mine, markets, released, result);
    const delta = ledger.settled.reduce((sum, item) => sum + item.profit, 0);
    return { memberId: row.memberId, name: row.name, color: row.color, delta, you: row.you };
  });
}

function buildCallouts(
  markets: readonly Market[],
  released: readonly Delivery[],
  result: ScoreState["result"],
  picks: readonly UserPick[],
  botPicks: readonly BotPick[],
  over: number,
): { callouts: string[]; take: string | null } {
  if (over < 1 || !overFinished(over, released, result)) return { callouts: [], take: null };
  const names = new Map(POD.map((member) => [member.id, member.name]));
  const everyone: { name: string; pick: UserPick }[] = [
    ...picks.filter((pick) => pick.marketId.startsWith(`${over}:`)).map((pick) => ({ name: "You", pick })),
    ...botPicks
      .filter((pick) => pick.marketId.startsWith(`${over}:`))
      .map((pick) => ({ name: names.get(pick.memberId) ?? "Pod", pick })),
  ];
  const callouts: string[] = [];
  let take: { text: string; profit: number } | null = null;
  for (const entry of everyone) {
    const market = markets.find((item) => item.id === entry.pick.marketId);
    if (!market) continue;
    const settlement = settlePick(entry.pick, resolveMarket(market, overDeliveries(released, over - 1)));
    callouts.push(callout(entry.name, market, settlement));
    if (settlement.won && (!take || settlement.profit > take.profit)) {
      take = {
        profit: settlement.profit,
        text: `${entry.name} called “${market.prompt.replace(/\?$/, "")}” at ${entry.pick.odds.toFixed(2)}`,
      };
    }
  }
  return { callouts, take: take ? `${take.text} — take of the over.` : null };
}

function badgesFor(
  input: SelectorInput,
  bestStreak: number,
  settled: readonly PickSettlement[],
  standings: readonly StandingRow[],
): Badge[] {
  const badges: Badge[] = [];
  if (input.picks.length > 0) {
    badges.push({ id: "first", label: "First call", detail: "You put Pulse Points on a line." });
  }
  if (bestStreak >= 3) badges.push({ id: "three", label: "Three straight", detail: "Three correct calls in a row." });
  if (bestStreak >= 5) badges.push({ id: "five", label: "Five alive", detail: "Five correct calls in a row." });
  if (settled.some((item) => item.won && Number(item.marketId.split(":")[0]) >= 18)) {
    badges.push({ id: "death", label: "Death overs", detail: "A correct call from over 18 on." });
  }
  const you = standings.find((row) => row.you);
  if (you?.rank === 1 && settled.length > 0) {
    badges.push({ id: "pod", label: "Top of the pod", detail: "You lead the friend group." });
  }
  return badges;
}

function overlayLine(
  market: Market,
  lines: readonly { kind: MarketKind; prompt: string; detail: string }[] | null,
): Market {
  const line = lines?.find((item) => item.kind === market.kind);
  if (!line) return market;
  return { ...market, prompt: line.prompt, detail: line.detail };
}

function applyEnrichment(card: MomentCard, enrichment: Enrichment | undefined): MomentCard {
  if (!enrichment) return card;
  return {
    ...card,
    headline: enrichment.headline ?? card.headline,
    dek: enrichment.dek ?? card.dek,
    why: enrichment.why ?? card.why,
    whisper: enrichment.whisper ?? card.whisper,
  };
}
