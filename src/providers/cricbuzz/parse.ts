import { flightText, sliceJson } from "@/providers/cricbuzz/flight";
import { passageDeliveries } from "@/providers/live/passage";
import type { Delivery, Dismissal, InningsMeta, Player, Team } from "@/domain/types";

export interface CricbuzzListItem {
  matchId: number;
  title: string;
  format: string;
  state: string;
  status: string;
  teams: { id: string; name: string; short: string }[];
  venue: string;
  city: string;
  scoreText: string;
  inProgress: boolean;
}

export interface CricbuzzSnapshot {
  meta: InningsMeta;
  deliveries: Delivery[];
  inProgress: boolean;
}

const EARLIER_BAT = "cb-earlier-bat";
const EARLIER_BOWL = "cb-earlier-bowl";

export function parseLiveScoresHtml(html: string): CricbuzzListItem[] {
  const text = flightText(html);
  const parsed = sliceJson(text, '"matches":[');
  const matches = Array.isArray(parsed) ? parsed : asRecord(parsed).matches;
  if (!Array.isArray(matches)) throw new Error("Cricbuzz live list had no matches.");
  return matches.map(readListItem).filter((item): item is CricbuzzListItem => item !== null);
}

export function parseMatchHtml(html: string): CricbuzzSnapshot {
  const text = flightText(html);
  const page = asRecord(sliceJson(text, '"commentaryPageData":'));
  return snapshotFromPage(page);
}

export function snapshotFromPage(page: Record<string, unknown>): CricbuzzSnapshot {
  const header = asRecord(page.matchHeader);
  const mini = asRecord(page.miniscore);
  const commentary = asRecord(page.matchCommentary);
  const team1 = readTeam(header.team1, "Team 1", "#3ee0b0");
  const team2 = readTeam(header.team2, "Team 2", "#ff6a45");
  const batTeamId = numberish(asRecord(mini.batTeam).teamId) ?? team1.id;
  const batting = batTeamId === team2.id ? team2 : team1;
  const bowling = batting.id === team1.id ? team2 : team1;
  const striker = readMiniPlayer(mini.batsmanStriker, batting.id, "Striker");
  const nonStriker = readMiniPlayer(mini.batsmanNonStriker, batting.id, "Non-striker");
  const bowler = readMiniPlayer(mini.bowlerStriker, bowling.id, "Bowler");
  const balls = commentaryBalls(commentary, striker, nonStriker, bowler, batting.id, bowling.id);
  const totalRuns = numberish(asRecord(mini.batTeam).teamScore) ?? balls.runs;
  const totalWickets = numberish(asRecord(mini.batTeam).teamWkts) ?? balls.wickets;
  const totalBalls = legalBallsFromOvers(numberish(mini.overs) ?? balls.legalBalls);
  const prefix = prefixPassage({
    totalRuns,
    totalWickets,
    totalBalls,
    ballRuns: balls.runs,
    ballWickets: balls.wickets,
    ballLegal: balls.legalBalls,
    strikerId: striker.id,
    nonStrikerId: nonStriker.id,
    bowlerId: bowler.id,
  });
  const deliveries = [...prefix, ...shiftSeq(balls.deliveries, prefix.length)];
  const players = uniquePlayers([
    player(EARLIER_BAT, "Earlier batter", "bat", batting.id),
    player(EARLIER_BOWL, "Earlier bowler", "bowl", bowling.id),
    striker,
    nonStriker,
    bowler,
    ...balls.players,
  ]);
  const format = stringish(header.matchFormat) ?? "T20";
  const target = chaseTarget(mini, totalRuns, totalBalls, format);
  const status = stringish(header.status) ?? stringish(mini.status) ?? "Live";
  const toss = readToss(header.tossResults);
  const venue = asRecord(header.venue);
  const meta: InningsMeta = {
    id: `cb-${numberish(header.matchId) ?? "live"}`,
    competition: stringish(header.seriesName) ?? stringish(header.matchDescription) ?? "Cricbuzz",
    venue: stringish(venue.name) ?? "Ground",
    city: stringish(venue.city) ?? "",
    toss,
    firstInnings: target.provisional ? `First innings. ${status}` : status,
    battingTeamId: batting.id,
    bowlingTeamId: bowling.id,
    target: target.runs,
    balls: target.balls,
    teams: [team1, team2],
    players,
    battingOrder: [striker.id, nonStriker.id, EARLIER_BAT],
    overs: [],
    overStarts: [],
    fantasy: { name: "No XI on this feed", slots: [] },
  };
  meta.overStarts = [];
  return { meta, deliveries, inProgress: !header.complete && /progress|live/i.test(stringish(header.state) ?? status) };
}

function commentaryBalls(
  commentary: Record<string, unknown>,
  striker: Player,
  nonStriker: Player,
  bowler: Player,
  batTeamId: string,
  bowlTeamId: string,
): { deliveries: Delivery[]; players: Player[]; runs: number; wickets: number; legalBalls: number } {
  const items = Object.values(commentary)
    .map((value) => asRecord(value))
    .filter((item) => stringish(item.commType) === "commentary" && typeof item.ballMetric === "number")
    .sort((a, b) => (numberish(a.timestamp) ?? 0) - (numberish(b.timestamp) ?? 0));
  const players: Player[] = [];
  const deliveries: Delivery[] = [];
  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;
  items.forEach((item, index) => {
    const metric = item.ballMetric as number;
    const over = Math.max(0, Math.floor(metric));
    const legalBall = Math.min(6, Math.max(0, Math.round((metric - over) * 10)));
    const parsed = readBall(item);
    const batter = readNamed(item.batsmanDetails, batTeamId, striker);
    const bowl = readNamed(item.bowlerDetails, bowlTeamId, bowler);
    players.push(batter, bowl);
    const delivery: Delivery = {
      seq: index + 1,
      over,
      legalBall: parsed.kind === "wide" ? 0 : legalBall,
      kind: parsed.kind,
      runsBat: parsed.runsBat,
      extras: parsed.extras,
      boundary: parsed.boundary,
      feed: "ball",
      wicket: parsed.wicket
        ? { playerOutId: batter.id, dismissal: parsed.dismissal, end: "striker" }
        : undefined,
      strikerId: batter.id,
      nonStrikerId: nonStriker.id,
      bowlerId: bowl.id,
      groundOffsetMs: index * 1000,
      note: stripTags(stringish(item.commText) ?? "").slice(0, 280),
    };
    deliveries.push(delivery);
    runs += parsed.runsBat + parsed.extras;
    if (parsed.wicket) wickets += 1;
    if (parsed.kind !== "wide") legalBalls += 1;
  });
  return { deliveries, players, runs, wickets, legalBalls };
}

function prefixPassage(input: {
  totalRuns: number;
  totalWickets: number;
  totalBalls: number;
  ballRuns: number;
  ballWickets: number;
  ballLegal: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
}): Delivery[] {
  const runs = input.totalRuns - input.ballRuns;
  const wickets = input.totalWickets - input.ballWickets;
  const balls = input.totalBalls - input.ballLegal;
  if (runs < 0 || wickets < 0 || balls < 0) return [];
  if (runs === 0 && wickets === 0 && balls === 0) return [];
  return passageDeliveries({
    seq: 1,
    fromBalls: 0,
    balls,
    runs,
    wickets,
    strikerId: EARLIER_BAT,
    nonStrikerId: input.nonStrikerId,
    bowlerId: EARLIER_BOWL,
    groundOffsetMs: 0,
    note: `Scoreboard before the live commentary: ${runs} runs and ${wickets} wickets in ${balls} balls. Those balls were not in the published commentary.`,
  });
}

function shiftSeq(deliveries: Delivery[], by: number): Delivery[] {
  if (by === 0) return deliveries;
  return deliveries.map((delivery) => ({ ...delivery, seq: delivery.seq + by }));
}

function readBall(item: Record<string, unknown>): {
  kind: Delivery["kind"];
  runsBat: number;
  extras: number;
  boundary?: 4 | 6;
  wicket: boolean;
  dismissal: Dismissal;
} {
  const events = Array.isArray(item.event) ? item.event.map((event) => String(event).toLowerCase()) : [];
  const raw = stringish(item.commText) ?? "";
  const plain = stripTags(raw).toLowerCase();
  const wide = events.includes("wide") || /<b>\s*wide\s*<\/b>|\bwide\b/.test(raw.toLowerCase());
  const noball = events.includes("noball") || /no-?ball/.test(plain);
  const wicket = events.includes("wicket");
  let runs = 0;
  if (events.includes("six")) runs = 6;
  else if (events.includes("four")) runs = 4;
  else if (events.includes("three")) runs = 3;
  else if (events.includes("two")) runs = 2;
  else if (events.includes("one")) runs = 1;
  else {
    const match = stripTags(raw).match(/,\s*(\d+)\s*runs?\b/i);
    if (match?.[1]) runs = Number(match[1]);
  }
  const dismissal = dismissalFrom(plain);
  if (wide) return { kind: "wide", runsBat: 0, extras: Math.max(1, runs || 1), wicket, dismissal };
  if (noball) {
    return {
      kind: "noball",
      runsBat: runs,
      extras: 1,
      boundary: runs === 4 ? 4 : runs === 6 ? 6 : undefined,
      wicket,
      dismissal,
    };
  }
  return {
    kind: "legal",
    runsBat: runs,
    extras: 0,
    boundary: runs === 4 ? 4 : runs === 6 ? 6 : undefined,
    wicket,
    dismissal,
  };
}

function dismissalFrom(text: string): Dismissal {
  if (/run out|run-out/.test(text)) return "runout";
  if (/stumped|\bst\s/.test(text)) return "stumped";
  if (/\blbw\b/.test(text)) return "lbw";
  if (/caught|\bc\s+\S+.*\bb\s/.test(text)) return "caught";
  if (/\bbowled\b/.test(text) || /\bb\s+\S+/.test(text)) return "bowled";
  return "unspecified";
}

function readListItem(value: unknown): CricbuzzListItem | null {
  const match = asRecord(asRecord(value).match);
  const info = asRecord(match.matchInfo);
  const id = numberish(info.matchId);
  if (id === null) return null;
  const team1 = readSide(info.team1);
  const team2 = readSide(info.team2);
  const venue = asRecord(info.venueInfo);
  const state = stringish(info.state) ?? "";
  return {
    matchId: id,
    title: [team1.short, "vs", team2.short, stringish(info.matchDesc)].filter(Boolean).join(" "),
    format: stringish(info.matchFormat) ?? "T20",
    state,
    status: stringish(info.status) ?? state,
    teams: [team1, team2],
    venue: stringish(venue.ground) ?? "",
    city: stringish(venue.city) ?? "",
    scoreText: scoreText(asRecord(match.matchScore)),
    inProgress: /in progress|live/i.test(state),
  };
}

function scoreText(score: Record<string, unknown>): string {
  const parts = ["team1Score", "team2Score"].flatMap((key) => inningsText(asRecord(score[key])));
  return parts.filter(Boolean).join(" · ");
}

function inningsText(teamScore: Record<string, unknown>): string[] {
  return Object.values(teamScore).map((value) => {
    const inn = asRecord(value);
    const runs = numberish(inn.runs);
    if (runs === null) return "";
    const wickets = numberish(inn.wickets);
    const overs = numberish(inn.overs);
    return `${runs}/${wickets ?? 0}${overs === null ? "" : ` (${overs})`}`;
  });
}

function chaseTarget(
  mini: Record<string, unknown>,
  runs: number,
  legalBalls: number,
  format: string,
): { runs: number; balls: number; provisional: boolean } {
  const published = numberish(mini.target);
  if (published && published > runs) {
    return { runs: published, balls: formatBalls(format), provisional: false };
  }
  // No target yet (first innings, a break, a Test day). Keep the innings open
  // for a few balls without inventing a 50-over or 450-over chase. The win
  // model and the equation treat a 10000-run sentinel as "no target".
  return { runs: runs + 10000, balls: legalBalls + 6, provisional: true };
}

export function legalBallsFromOvers(overs: number): number {
  if (!Number.isFinite(overs) || overs < 0) return 0;
  const whole = Math.floor(overs + 1e-6);
  const balls = Math.round((overs - whole) * 10);
  return whole * 6 + Math.min(6, Math.max(0, balls));
}

export function formatBalls(format: string): number {
  const name = format.toUpperCase();
  if (name.includes("TEST")) return 2700;
  if (name.includes("ODI")) return 300;
  if (name.includes("T10")) return 60;
  if (name.includes("100")) return 100;
  return 120;
}

function readTeam(value: unknown, fallback: string, color: string): Team {
  const team = asRecord(value);
  const id = String(numberish(team.id) ?? numberish(team.teamId) ?? fallback);
  return {
    id,
    name: stringish(team.name) ?? stringish(team.teamName) ?? fallback,
    short: stringish(team.shortName) ?? stringish(team.teamSName) ?? fallback.slice(0, 4).toUpperCase(),
    color,
  };
}

function readSide(value: unknown): { id: string; name: string; short: string } {
  const team = readTeam(value, "Team", "#888");
  return { id: team.id, name: team.name, short: team.short };
}

function readMiniPlayer(value: unknown, teamId: string, fallback: string): Player {
  const row = asRecord(value);
  return player(String(numberish(row.id) ?? fallback), stringish(row.name) ?? fallback, "bat", teamId);
}

function readNamed(value: unknown, teamId: string, fallback: Player): Player {
  const row = asRecord(value);
  const id = numberish(row.playerId);
  const name = stringish(row.playerName);
  if (id === null || !name) return fallback;
  return player(String(id), name, "bat", teamId);
}

function readToss(value: unknown): string {
  const toss = asRecord(value);
  const name = stringish(toss.tossWinnerName);
  const decision = stringish(toss.decision);
  if (!name) return "Toss not in the feed";
  return `${name} elected to ${decision?.toLowerCase() ?? "bat"}`;
}

function player(id: string, name: string, role: Player["role"], teamId: string): Player {
  return { id, name, role, teamId };
}

function uniquePlayers(players: Player[]): Player[] {
  const seen = new Set<string>();
  return players.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function stringish(value: unknown): string | null {
  if (typeof value === "string" && value.trim() && value !== "$undefined") return value.trim();
  return null;
}

function numberish(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && value !== "$undefined" && Number.isFinite(Number(value))) return Number(value);
  return null;
}
