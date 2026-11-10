import { containsBannedLanguage } from "@/domain/guard";
import { playerName } from "@/domain/players";
import { equationFor, foldDeliveries, formatRate } from "@/domain/score";
import type { Delivery, InningsMeta, ScoreState } from "@/domain/types";
import { winProbability } from "@/domain/win-prob";

export type Voice = "english" | "hinglish" | "plain";

export interface BatterLine {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
}

export interface BowlerLine {
  name: string;
  legalBalls: number;
  runs: number;
  wickets: number;
}

export interface OverLine {
  over: number;
  runs: number;
  wickets: number;
  tape: string;
}

/**
 * Everything the companion and the commentary model are allowed to know.
 * Built only from the contiguous deliveries received so far.
 */
export interface GroundedSnapshot {
  seenThroughSeq: number;
  battingTeam: string;
  bowlingTeam: string;
  target: number;
  runs: number;
  wickets: number;
  wicketsInHand: number;
  overs: string;
  ballsLeft: number;
  toWin: number;
  crr: number;
  rrr: number | null;
  /** 0–1. Percent form is added to the allowed-number set separately. */
  winProb: number;
  winPercent: number;
  result: ScoreState["result"];
  equation: string;
  phase: ScoreState["phase"];
  striker: BatterLine | null;
  nonStriker: BatterLine | null;
  bowler: BowlerLine | null;
  batters: BatterLine[];
  bowlers: BowlerLine[];
  recentOvers: OverLine[];
}

export function buildGroundedSnapshot(meta: InningsMeta, deliveries: readonly Delivery[]): GroundedSnapshot {
  const score = foldDeliveries(deliveries, meta);
  const prob = deliveries.length ? winProbability(score, meta.target) : winProbability(score, meta.target);
  const batting = meta.teams.find((team) => team.id === meta.battingTeamId)?.name ?? "The chase";
  const bowling = meta.teams.find((team) => team.id === meta.bowlingTeamId)?.name ?? "The bowling side";
  const batterLine = (id: string | null): BatterLine | null => {
    if (!id) return null;
    const card = score.batters[id];
    return {
      name: playerName(meta, id),
      runs: card?.runs ?? 0,
      balls: card?.balls ?? 0,
      fours: card?.fours ?? 0,
      sixes: card?.sixes ?? 0,
      out: card?.out ?? false,
    };
  };
  const bowlerLine = (id: string | null): BowlerLine | null => {
    if (!id) return null;
    const card = score.bowlers[id];
    return {
      name: playerName(meta, id, "Bowler"),
      legalBalls: card?.legalBalls ?? 0,
      runs: card?.runs ?? 0,
      wickets: card?.wickets ?? 0,
    };
  };

  return {
    seenThroughSeq: deliveries.at(-1)?.seq ?? 0,
    battingTeam: batting,
    bowlingTeam: bowling,
    target: meta.target,
    runs: score.runs,
    wickets: score.wickets,
    wicketsInHand: 10 - score.wickets,
    overs: score.oversLabel,
    ballsLeft: score.ballsLeft,
    toWin: score.toWin,
    crr: round2(score.crr),
    rrr: score.rrr === null ? null : round2(score.rrr),
    winProb: round2(prob),
    winPercent: Math.round(prob * 100),
    result: score.result,
    equation: equationText(score),
    phase: score.phase,
    striker: batterLine(score.strikerId),
    nonStriker: batterLine(score.nonStrikerId),
    bowler: bowlerLine(score.bowlerId),
    batters: Object.keys(score.batters).map((id) => batterLine(id)!).filter(Boolean),
    bowlers: Object.keys(score.bowlers).map((id) => bowlerLine(id)!).filter(Boolean),
    recentOvers: lastOvers(deliveries, meta),
  };
}

/** Numeric tokens a grounded answer may quote. Derived from the snapshot only. */
export function allowedNumberTokens(snapshot: GroundedSnapshot): Set<string> {
  const tokens = new Set<string>();
  walk(snapshot, tokens);
  return tokens;
}

export function validateGroundedAnswer(
  text: string,
  allowed: ReadonlySet<string>,
): { ok: true } | { ok: false; reason: string } {
  if (containsBannedLanguage(text)) return { ok: false, reason: "banned-language" };
  for (const raw of text.match(/\d+(?:\.\d+)?/g) ?? []) {
    if (!numberAllowed(raw, allowed)) return { ok: false, reason: `ungrounded-number:${raw}` };
  }
  return { ok: true };
}

export function answerFromSnapshot(question: string, snapshot: GroundedSnapshot, voice: Voice): string {
  const q = question.toLowerCase();
  if (/\bdls\b|rain rule|duckworth/.test(q)) return dlsAnswer(voice);
  const named = findBatter(snapshot, q) ?? findBowler(snapshot, q);
  if (named) return playerAnswer(named, snapshot, voice);
  if (/need|required|rrr|chase|equation/.test(q)) return needAnswer(snapshot, voice);
  if (/win|chance|probab/.test(q)) return winAnswer(snapshot, voice);
  if (/bowler|bring|why/.test(q)) return bowlerAnswer(snapshot, voice);
  return summaryAnswer(snapshot, voice);
}

export function explainTerm(term: string): string {
  const key = term.toLowerCase();
  if (key.includes("dls") || key.includes("rain")) {
    return "DLS is the rain rule. It rebuilds a target from overs left and wickets in hand. This chase has not used it.";
  }
  if (key.includes("required") || key.includes("rrr")) {
    return "Required rate is runs still needed divided by overs still left. Higher means the chase is harder.";
  }
  if (key.includes("power")) {
    return "The powerplay is the first six overs, with only two fielders outside the circle.";
  }
  if (key.includes("death")) {
    return "The death overs are the last five. Every ball changes the chase more.";
  }
  if (key.includes("wicket")) {
    return "A wicket means the batter is out. A new batter starts on zero.";
  }
  return "Say which word you want in plain language: DLS, required rate, powerplay, death, or wicket.";
}

function dlsAnswer(voice: Voice): string {
  if (voice === "hinglish") return "DLS ek rain rule hai. Overs aur wickets se naya target banta hai. Is chase mein DLS use nahi hua.";
  if (voice === "plain") return "DLS is a rain rule that sets a new target. This match has not used it. Nothing on your screen is a DLS number.";
  return "DLS rebuilds a target when rain cuts a match short. This chase has not used it, so the target on your screen is the original one.";
}

function needAnswer(snapshot: GroundedSnapshot, voice: Voice): string {
  if (snapshot.result === "won") {
    return voice === "hinglish"
      ? `${snapshot.battingTeam} jeet chuke hain. Balls bache the ${snapshot.ballsLeft}.`
      : `${snapshot.battingTeam} have already won. ${snapshot.ballsLeft} balls were left.`;
  }
  if (voice === "hinglish") {
    return `${snapshot.toWin} run chahiye ${snapshot.ballsLeft} balls mein. Required rate ${formatRate(snapshot.rrr)} hai.`;
  }
  if (voice === "plain") {
    return `They still need ${snapshot.toWin} runs. There are ${snapshot.ballsLeft} balls left. That is ${formatRate(snapshot.rrr)} runs per over.`;
  }
  return `${snapshot.equation}. Current rate is ${formatRate(snapshot.crr)}.`;
}

function winAnswer(snapshot: GroundedSnapshot, voice: Voice): string {
  if (voice === "hinglish") {
    return `Win chance ${snapshot.winPercent} percent hai. Ye model hai, price nahi. ${snapshot.equation}.`;
  }
  if (voice === "plain") {
    return `The model says a team in this spot wins ${snapshot.winPercent} times out of 100. It is not a price. ${snapshot.equation}.`;
  }
  return `Win chance is ${snapshot.winPercent} percent. ${snapshot.equation}. The number is a model, not a price.`;
}

function bowlerAnswer(snapshot: GroundedSnapshot, voice: Voice): string {
  const name = snapshot.bowler?.name;
  if (!name) {
    return voice === "plain"
      ? "No bowler has bowled in the balls received so far."
      : "No bowler is in the log yet.";
  }
  if (voice === "hinglish") {
    return `Abhi ${name} bowling kar rahe hain. Phase ${snapshot.phase} hai. Required rate ${formatRate(snapshot.rrr)}.`;
  }
  if (voice === "plain") {
    return `${name} is the bowler you can see. The match is in the ${snapshot.phase}. They need ${formatRate(snapshot.rrr)} an over.`;
  }
  return `${name} is the bowler on the balls you have seen. Phase: ${snapshot.phase}. Required rate ${formatRate(snapshot.rrr)}.`;
}

function summaryAnswer(snapshot: GroundedSnapshot, voice: Voice): string {
  if (voice === "hinglish") {
    return `${snapshot.battingTeam} ${snapshot.runs}/${snapshot.wickets} ${snapshot.overs} overs par. ${needAnswer(snapshot, voice)} Win chance ${snapshot.winPercent} percent.`;
  }
  if (voice === "plain") {
    return `${snapshot.battingTeam} have ${snapshot.runs} runs and have lost ${snapshot.wickets} wickets after ${snapshot.overs} overs. ${needAnswer(snapshot, "plain")} Win chance ${snapshot.winPercent} percent.`;
  }
  return `${snapshot.battingTeam} are ${snapshot.runs}/${snapshot.wickets} after ${snapshot.overs}. ${snapshot.equation}. Win chance ${snapshot.winPercent} percent.`;
}

function playerAnswer(
  player: BatterLine | BowlerLine,
  snapshot: GroundedSnapshot,
  voice: Voice,
): string {
  if ("balls" in player) {
    if (voice === "hinglish") return `${player.name} ${player.runs} runs ${player.balls} balls se. Out: ${player.out ? "haan" : "nahi"}.`;
    if (voice === "plain") return `${player.name} has scored ${player.runs} from ${player.balls} balls on the timeline you can see.`;
    return `${player.name} is on ${player.runs} from ${player.balls} balls in the log so far.`;
  }
  if (voice === "plain") return `${player.name} has bowled ${player.legalBalls} legal balls, conceded ${player.runs}, and taken ${player.wickets} wickets.`;
  return `${player.name}: ${player.wickets} wickets, ${player.runs} runs from ${player.legalBalls} balls. Seen only through seq ${snapshot.seenThroughSeq}.`;
}

function findBatter(snapshot: GroundedSnapshot, q: string): BatterLine | undefined {
  return snapshot.batters.find((batter) => {
    const name = batter.name.toLowerCase();
    const last = name.split(" ").slice(-1)[0] ?? name;
    return q.includes(name) || q.includes(last);
  });
}

function findBowler(snapshot: GroundedSnapshot, q: string): BowlerLine | undefined {
  return snapshot.bowlers.find((bowler) => {
    const name = bowler.name.toLowerCase();
    const last = name.split(" ").slice(-1)[0] ?? name;
    return last.length > 2 && (q.includes(name) || q.includes(last));
  });
}

function lastOvers(deliveries: readonly Delivery[], meta: InningsMeta): OverLine[] {
  const grouped = new Map<number, Delivery[]>();
  for (const delivery of deliveries) {
    const list = grouped.get(delivery.over) ?? [];
    list.push(delivery);
    grouped.set(delivery.over, list);
  }
  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-3)
    .map(([over, balls]) => ({
      over: over + 1,
      runs: balls.reduce((sum, ball) => sum + ball.runsBat + ball.extras, 0),
      wickets: balls.filter((ball) => ball.wicket).length,
      tape: balls.map((ball) => (ball.wicket ? "W" : String(ball.runsBat + ball.extras))).join(" "),
    }))
    .map((line) => line)
    .filter(() => meta.id.length > 0);
}

function equationText(score: ScoreState): string {
  return equationFor(score);
}

function walk(value: unknown, tokens: Set<string>): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    addNumber(tokens, value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, tokens);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) walk(item, tokens);
  }
}

function addNumber(tokens: Set<string>, value: number): void {
  tokens.add(String(value));
  tokens.add(String(Math.trunc(value)));
  tokens.add(value.toFixed(1));
  tokens.add(value.toFixed(2));
  if (Number.isInteger(value)) tokens.add(String(value));
}

function numberAllowed(raw: string, allowed: ReadonlySet<string>): boolean {
  if (allowed.has(raw)) return true;
  const value = Number(raw);
  if (!Number.isFinite(value)) return false;
  if (allowed.has(String(value)) || allowed.has(value.toFixed(1)) || allowed.has(value.toFixed(2))) return true;
  if (allowed.has(String(Math.trunc(value))) || allowed.has(String(Math.round(value)))) return true;
  for (const token of allowed) {
    const other = Number(token);
    if (Number.isFinite(other) && Math.abs(other - value) < 0.001) return true;
  }
  return false;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
