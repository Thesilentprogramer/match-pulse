import type { Delivery, InningsMeta, Player, Team } from "@/domain/types";
import { passageDeliveries } from "@/providers/live/passage";
import { legalBallsFromOvers, formatBalls } from "@/providers/cricbuzz/parse";

export interface CricScoreLine {
  r?: unknown;
  w?: unknown;
  o?: unknown;
  inning?: unknown;
}

export interface CricMatch {
  id?: unknown;
  name?: unknown;
  matchType?: unknown;
  status?: unknown;
  venue?: unknown;
  teams?: unknown;
  teamInfo?: unknown;
  score?: unknown;
  matchStarted?: unknown;
  matchEnded?: unknown;
  tossWinner?: unknown;
  tossChoice?: unknown;
}

export interface CricEnvelope {
  status?: unknown;
  data?: unknown;
  info?: { hitsToday?: unknown; hitsLimit?: unknown };
  reason?: unknown;
}

export interface CricTick {
  runs: number;
  wickets: number;
  legalBalls: number;
}

/** A missing or odd score becomes zeros. The mapper does not throw. */
export function readTick(line: CricScoreLine | null | undefined): CricTick {
  return {
    runs: nonNegative(line?.r),
    wickets: nonNegative(line?.w),
    legalBalls: legalBallsFromOvers(nonNegative(line?.o)),
  };
}

export function chaseLine(lines: readonly CricScoreLine[] | null | undefined): {
  current: CricTick;
  target: number | null;
  inning: string;
} {
  const usable = (lines ?? []).filter((line) => nonNegative(line?.r) > 0 || nonNegative(line?.o) > 0 || nonNegative(line?.w) > 0);
  if (usable.length === 0) return { current: { runs: 0, wickets: 0, legalBalls: 0 }, target: null, inning: "" };
  const last = usable[usable.length - 1];
  const current = readTick(last);
  const first = usable.length > 1 ? readTick(usable[0]) : null;
  const inning = last?.inning;
  return {
    current,
    target: first ? first.runs + 1 : null,
    inning: typeof inning === "string" ? inning : "",
  };
}

/** Fold successive scoreboard readings into one honest log. */
export function deliveriesFromTicks(ticks: readonly CricTick[]): Delivery[] {
  const deliveries: Delivery[] = [];
  let prev: CricTick = { runs: 0, wickets: 0, legalBalls: 0 };
  for (const tick of ticks) {
    const balls = tick.legalBalls - prev.legalBalls;
    const runs = tick.runs - prev.runs;
    const wickets = tick.wickets - prev.wickets;
    if (balls < 0 || runs < 0 || wickets < 0) continue;
    const rows = passageDeliveries({
      seq: deliveries.length + 1,
      fromBalls: prev.legalBalls,
      balls,
      runs,
      wickets,
      strikerId: "cric-batter",
      nonStrikerId: "cric-batter-2",
      bowlerId: "cric-bowler",
      groundOffsetMs: deliveries.length * 1000,
      note: `Over summary from the scoreboard: ${runs} runs and ${wickets} wickets across ${balls} balls. Not a ball-by-ball feed.`,
    });
    deliveries.push(...rows);
    prev = tick;
  }
  return deliveries;
}

export function snapshotFromMatch(match: CricMatch): { meta: InningsMeta; deliveries: Delivery[] } {
  const score = Array.isArray(match.score) ? (match.score as CricScoreLine[]) : [];
  const chase = chaseLine(score);
  const teams = readTeams(match);
  const batting = teams[0] ?? team("a", "Team A", "TMA");
  const bowling = teams[1] ?? team("b", "Team B", "TMB");
  const format = typeof match.matchType === "string" ? match.matchType : "t20";
  const deliveries = deliveriesFromTicks([chase.current]);
  const names = [player("cric-batter", "Batter", batting.id), player("cric-batter-2", "Other batter", batting.id), player("cric-bowler", "Bowler", bowling.id)];
  const target = chase.target && chase.target > chase.current.runs ? chase.target : chase.current.runs + Math.max(1, formatBalls(format) - chase.current.legalBalls);
  const meta: InningsMeta = {
    id: `cric-${typeof match.id === "string" ? match.id : "match"}`,
    competition: typeof match.name === "string" ? match.name : "CricAPI",
    venue: typeof match.venue === "string" ? match.venue : "Ground",
    city: "",
    toss: tossText(match),
    firstInnings: chase.target ? `Target ${chase.target}` : "First innings. The feed has no target yet.",
    battingTeamId: batting.id,
    bowlingTeamId: bowling.id,
    target,
    balls: formatBalls(format),
    teams: [batting, bowling],
    players: names,
    battingOrder: ["cric-batter", "cric-batter-2"],
    overs: [],
    overStarts: [],
    fantasy: { name: "No XI on this feed", slots: [] },
  };
  return { meta, deliveries };
}

export function readHits(info: { hitsToday?: unknown; hitsLimit?: unknown } | undefined): { hitsToday: number | null; hitsLimit: number | null } {
  const hitsToday = typeof info?.hitsToday === "number" ? info.hitsToday : null;
  const hitsLimit = typeof info?.hitsLimit === "number" ? info.hitsLimit : null;
  return { hitsToday, hitsLimit };
}

function readTeams(match: CricMatch): Team[] {
  if (Array.isArray(match.teamInfo) && match.teamInfo.length > 0) {
    return match.teamInfo.slice(0, 2).map((value, index) => {
      const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      const name = typeof row.name === "string" ? row.name : `Team ${index + 1}`;
      const short = typeof row.shortname === "string" ? row.shortname : name.slice(0, 4).toUpperCase();
      return team(slug(name), name, short);
    });
  }
  if (Array.isArray(match.teams)) {
    return match.teams.slice(0, 2).map((name, index) => {
      const label = typeof name === "string" ? name : `Team ${index + 1}`;
      return team(slug(label), label, label.slice(0, 4).toUpperCase());
    });
  }
  return [];
}

function tossText(match: CricMatch): string {
  if (typeof match.tossWinner !== "string" || !match.tossWinner) return typeof match.status === "string" ? match.status : "Toss not in the feed";
  const choice = typeof match.tossChoice === "string" ? match.tossChoice : "bat";
  return `${match.tossWinner} elected to ${choice}`;
}

function team(id: string, name: string, short: string): Team {
  return { id, name, short, color: id.endsWith("2") || id === "b" ? "#ff6a45" : "#3ee0b0" };
}

function player(id: string, name: string, teamId: string): Player {
  return { id, name, role: "bat", teamId };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team";
}

function nonNegative(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}
