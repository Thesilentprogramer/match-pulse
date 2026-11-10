import { playerById, playerName, teamById } from "@/domain/players";
import { botPicksForOver, POD } from "@/domain/pod";
import {
  projectLedger,
  proposeMarkets,
  resolveMarket,
  overDeliveries,
  overFinished,
  settlePick,
  STARTING_BANK,
} from "@/domain/predictions";
import { projectInnings, projectPrefix } from "@/domain/project";
import { formatPct, openBoard } from "@/domain/score";
import type { Delivery, InningsMeta, ScoreState, UserPick } from "@/domain/types";
import { winProbability } from "@/domain/win-prob";
export interface StoryBeat {
  id: string;
  kicker: string;
  title: string;
  body: string;
  stat: string;
  tone: "open" | "swing" | "call" | "room" | "finish";
}

export interface StoryCall {
  prompt: string;
  won: boolean;
  profit: number;
}

/**
 * Scorecard recap used when ball-by-ball is not published.
 * Beats must already be sourced copy. Win chance is filled here and labeled a model estimate.
 */
export interface ScorecardRecap {
  competition: string;
  venue: string;
  team: string;
  target: number;
  beats: StoryBeat[];
  /** Chase states we can actually point at. Balls in the innings come from the same source. */
  checkpoints: { runs: number; wickets: number; legalBalls: number; ballsInInnings: number }[];
  mvp: { name: string; line: string };
  final: MatchStory["final"];
  podLines: string[];
}

/** Serializable props for the Remotion composition. The generator stays pure. */
export interface MatchStory {
  competition: string;
  venue: string;
  team: string;
  target: number;
  beats: StoryBeat[];
  winSeries: number[];
  calls: StoryCall[];
  podLines: string[];
  mvp: { name: string; line: string };
  final: {
    runs: number;
    wickets: number;
    overs: string;
    result: "chasing" | "won" | "lost" | "tied";
    ballsLeft: number;
  };
  /** Filled by an intro-clip provider. The pure generator always leaves this null. */
  introClipUrl: string | null;
}

/**
 * Pure recap. Captions quote the delivery log and the pod ledger.
 * Rendering (the 9:16 reel, the video) is not this function's job.
 */
export function buildMatchStory(input: {
  meta: InningsMeta;
  deliveries: readonly Delivery[];
  picks: readonly UserPick[];
  card?: ScorecardRecap;
}): MatchStory {
  if (input.card) return storyFromCard(input.card);
  const { meta, deliveries, picks } = input;
  const batting = teamById(meta, meta.battingTeamId)?.name ?? "The chase";
  const bowling = teamById(meta, meta.bowlingTeamId)?.name ?? "the bowling side";
  const projection = projectInnings(deliveries, meta);
  const final = projection.final;
  const markets = marketsFor(deliveries, meta, picks);
  const result = final.result;
  const ledger = projectLedger(picks, markets, deliveries, result);

  const powerplay = projection.frames.filter((frame) => frame.after.legalBalls <= 36).at(-1);
  const drop = [...projection.frames].sort((a, b) => a.card.winDelta - b.card.winDelta)[0];
  const lift = [...projection.frames].sort((a, b) => b.card.winDelta - a.card.winDelta)[0];

  const beats: StoryBeat[] = [
    {
      id: "open",
      kicker: meta.competition,
      title: openBoard(meta.target) ? batting : `${batting} chase ${meta.target}`,
      body: `${bowling} posted ${meta.firstInnings.replace(`${bowling} `, "")}. ${meta.venue}, ${meta.city}.`,
      stat: openBoard(meta.target) ? "No target yet" : `Target ${meta.target}`,
      tone: "open",
    },
  ];

  if (powerplay) {
    beats.push({
      id: "powerplay",
      kicker: "Powerplay",
      title: `${batting} ${powerplay.after.runs}/${powerplay.after.wickets}`,
      body: openBoard(meta.target)
        ? `After ${powerplay.after.oversLabel} overs there is no target on the board.`
        : `After ${powerplay.after.oversLabel} overs the chase wants ${powerplay.after.toWin} from ${powerplay.after.ballsLeft}.`,
      stat: formatPct(powerplay.prob),
      tone: "swing",
    });
  }

  if (drop && drop.card.winDelta < 0) {
    beats.push({
      id: "drop",
      kicker: "The swing",
      title: drop.card.headline,
      body: `${drop.card.equation}. Win chance moved ${Math.round(drop.card.winDelta * 100)} points.`,
      stat: formatPct(drop.prob),
      tone: "swing",
    });
  }

  if (lift && lift.card.winDelta > 0 && lift.delivery.seq !== drop?.delivery.seq) {
    beats.push({
      id: "lift",
      kicker: "The lift",
      title: lift.card.headline,
      body: `${lift.card.equation}. Win chance moved ${Math.round(lift.card.winDelta * 100)} points.`,
      stat: formatPct(lift.prob),
      tone: "swing",
    });
  }

  const wins = ledger.settled.filter((item) => item.won);
  beats.push({
    id: "calls",
    kicker: "Your calls",
    title: picks.length ? `${wins.length} of ${ledger.settled.length} hit` : "You watched",
    body: picks.length
      ? `Bank went from ${STARTING_BANK} to ${ledger.bank}. Best streak ${ledger.bestStreak}.`
      : "No Over-War call on this timeline. The reel is still yours.",
    stat: `${ledger.bank} pts`,
    tone: "call",
  });

  const take = bestCall(deliveries, markets, picks, result);
  if (take) {
    beats.push({
      id: "room",
      kicker: "The room",
      title: take.title,
      body: take.body,
      stat: take.stat,
      tone: "room",
    });
  }

  beats.push({
    id: "finish",
    kicker: result === "chasing" ? "So far" : "Final whistle",
    title:
      result === "won"
        ? `${batting} win`
        : result === "lost"
          ? `${batting} fall short`
          : result === "tied"
            ? "Scores level"
            : `${batting} ${final.runs}/${final.wickets}`,
    body:
      result === "chasing"
        ? `${final.toWin} still needed from ${final.ballsLeft}. This reel is the match received so far.`
        : `${batting} ${final.runs}/${final.wickets} in ${final.oversLabel}. ${final.result === "won" ? `${final.ballsLeft} balls left.` : "That is the chase."}`,
    stat: formatPct(projection.frames.at(-1)?.prob ?? 0.5),
    tone: "finish",
  });

  const calls: StoryCall[] = ledger.settled.map((item) => ({
    prompt: markets.find((market) => market.id === item.marketId)?.prompt ?? item.marketId,
    won: item.won,
    profit: item.profit,
  }));
  const probs = projection.frames.map((frame) => Math.round(frame.prob * 1000) / 1000);
  const step = Math.max(1, Math.floor(probs.length / 36));
  const winSeries = probs.filter((_, index) => index % step === 0);
  const lastProb = probs.at(-1);
  if (lastProb !== undefined && winSeries.at(-1) !== lastProb) winSeries.push(lastProb);

  const top = Object.entries(final.batters).sort((a, b) => b[1].runs - a[1].runs)[0];
  const mvp = top
    ? { name: playerName(meta, top[0]), line: `${top[1].runs} from ${top[1].balls}` }
    : { name: batting, line: "No batter has faced a ball yet." };

  const podLines = [take?.body, take ? `${take.title}.` : null].filter((line): line is string => Boolean(line));
  if (podLines.length === 0) podLines.push("No call has landed in the pod yet.");

  return {
    competition: meta.competition,
    venue: `${meta.venue}, ${meta.city}`,
    team: batting,
    target: meta.target,
    beats,
    winSeries: winSeries.length > 0 ? winSeries : [0.5],
    calls,
    podLines,
    mvp,
    final: {
      runs: final.runs,
      wickets: final.wickets,
      overs: final.oversLabel,
      result,
      ballsLeft: final.ballsLeft,
    },
    introClipUrl: null,
  };
}

function storyFromCard(card: ScorecardRecap): MatchStory {
  const winSeries = card.checkpoints.map((point) => {
    const ballsLeft = Math.max(0, point.ballsInInnings - point.legalBalls);
    const estimate = winProbability(
      { runs: point.runs, wickets: point.wickets, ballsLeft, result: "chasing" } as ScoreState,
      card.target,
    );
    return Math.round(estimate * 1000) / 1000;
  });
  return {
    competition: card.competition,
    venue: card.venue,
    team: card.team,
    target: card.target,
    beats: card.beats,
    winSeries: winSeries.length > 0 ? winSeries : [0.5],
    calls: [],
    podLines: card.podLines,
    mvp: card.mvp,
    final: card.final,
    introClipUrl: null,
  };
}

function marketsFor(deliveries: readonly Delivery[], meta: InningsMeta, picks: readonly UserPick[]) {
  const wanted = new Set<number>();
  for (const delivery of deliveries) wanted.add(delivery.over + 1);
  for (const pick of picks) wanted.add(Number(pick.marketId.split(":")[0]));
  const markets = [];
  for (const over of [...wanted].sort((a, b) => a - b)) {
    if (!Number.isFinite(over) || over < 1 || over > meta.overs.length) continue;
    const before = projectPrefix(deliveries, meta, over - 1);
    const bowler = playerById(meta, meta.overs[over - 1]?.bowlerId);
    markets.push(...proposeMarkets(before, over, bowler));
  }
  return markets;
}

function bestCall(
  deliveries: readonly Delivery[],
  markets: ReturnType<typeof marketsFor>,
  picks: readonly UserPick[],
  result: ReturnType<typeof projectInnings>["final"]["result"],
): { title: string; body: string; stat: string } | null {
  const names = new Map(POD.map((member) => [member.id, member.name]));
  let best: { name: string; profit: number; prompt: string } | null = null;
  const overs = new Set(markets.map((market) => market.over));
  const bots = [...overs].flatMap((over) => botPicksForOver(POD, markets.filter((market) => market.over === over), over));
  const everyone = [
    ...picks.map((pick) => ({ name: "You", pick })),
    ...bots.map((pick) => ({ name: names.get(pick.memberId) ?? "Pod", pick })),
  ];
  for (const entry of everyone) {
    const market = markets.find((item) => item.id === entry.pick.marketId);
    if (!market || !overFinished(market.over, deliveries, result)) continue;
    const settlement = settlePick(entry.pick, resolveMarket(market, overDeliveries(deliveries, market.over - 1)));
    if (!settlement.won) continue;
    if (!best || settlement.profit > best.profit) {
      best = { name: entry.name, profit: settlement.profit, prompt: market.prompt.replace(/\?$/, "") };
    }
  }
  if (!best) return null;
  return {
    title: `${best.name} called it`,
    body: `${best.prompt}. Profit ${best.profit} Pulse Points, from a free stack that cannot be cashed.`,
    stat: `+${best.profit}`,
  };
}
