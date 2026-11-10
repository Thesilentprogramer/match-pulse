/**
 * Match Pulse domain contracts.
 *
 * These types are the boundary every adapter, selector, and test shares.
 * They are intentionally free of React, Next.js, and vendor SDKs.
 */

export type Dismissal = "bowled" | "caught" | "lbw" | "runout" | "stumped" | "unspecified";

export type DeliveryKind = "legal" | "wide" | "noball";

export interface WicketInfo {
  playerOutId: string;
  dismissal: Dismissal;
  fielderId?: string;
  /** Which end was dismissed, recorded at the moment of the ball. */
  end: "striker" | "nonstriker";
}

export interface Delivery {
  /** 1-based, gap-free for a single innings feed. */
  seq: number;
  /** 0-based over index. */
  over: number;
  /** 1-6 for a legal ball. 0 for a wide. */
  legalBall: number;
  kind: DeliveryKind;
  runsBat: number;
  extras: number;
  boundary?: 4 | 6;
  wicket?: WicketInfo;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  /** Broadcast-clock offset from the first scheduled ball, in ms. */
  groundOffsetMs: number;
  /** Optional desk note. Never required for copy to work. */
  note?: string;
  /**
   * Legal balls this row stands for. 1 for a real ball.
   * A scoreboard passage uses a larger span instead of inventing the missing balls.
   */
  boardSpan?: number;
  /** Absent on the recorded demo. `scoreboard` is an aggregate, not one delivery. */
  feed?: "ball" | "scoreboard";
}

export type PlayerRole = "bat" | "wk" | "ar" | "bowl";

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  teamId: string;
  batStyle?: string;
  bowlStyle?: string;
}

export interface Team {
  id: string;
  name: string;
  short: string;
  color: string;
}

export interface OverPlan {
  /** 0-based. */
  over: number;
  bowlerId: string;
}

export interface FantasySlot {
  playerId: string;
  role: "WK" | "BAT" | "AR" | "BOWL";
  multiplier: 1 | 1.5 | 2;
  badge?: "C" | "VC";
}

export interface FantasyXi {
  name: string;
  slots: FantasySlot[];
}

export interface InningsMeta {
  id: string;
  competition: string;
  venue: string;
  city: string;
  toss: string;
  firstInnings: string;
  battingTeamId: string;
  bowlingTeamId: string;
  /** Runs required to win. A tie is target - 1 at the end of the innings. */
  target: number;
  balls: number;
  teams: Team[];
  players: Player[];
  battingOrder: string[];
  overs: OverPlan[];
  /** Seq of the first ball of each over. Lets the client seek without the full tape. */
  overStarts: number[];
  fantasy: FantasyXi;
}

export interface BatterCard {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissal?: Dismissal;
}

export interface BowlerCard {
  legalBalls: number;
  runs: number;
  wickets: number;
  dots: number;
  maidens: number;
}

export type Phase = "powerplay" | "middle" | "death" | "complete";
export type Result = "chasing" | "won" | "lost" | "tied";

export interface ScoreState {
  runs: number;
  wickets: number;
  legalBalls: number;
  oversLabel: string;
  ballsLeft: number;
  toWin: number;
  crr: number;
  rrr: number | null;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  phase: Phase;
  result: Result;
  overIndex: number;
  thisOver: string[];
  thisOverRuns: number;
  partnershipRuns: number;
  partnershipBalls: number;
  batters: Record<string, BatterCard>;
  bowlers: Record<string, BowlerCard>;
  dismissed: string[];
  yetToBat: string[];
  recent: string[];
}

export type MarketKind = "wicket" | "runs10" | "lastBoundary" | "six" | "dots3";

export interface Market {
  id: string;
  /** 1-based over the question is about. */
  over: number;
  kind: MarketKind;
  prompt: string;
  detail: string;
  yesProb: number;
  yesOdds: number;
  noOdds: number;
  bowlerId: string;
}

export interface UserPick {
  marketId: string;
  side: "yes" | "no";
  stake: number;
  odds: number;
}

export type MarketPhase = "upcoming" | "open" | "locked" | "resolved";

export type PodStyle = "favorites" | "longshot" | "balanced" | "contrarian" | "momentum";

export interface PodMember {
  id: string;
  name: string;
  you: boolean;
  style: PodStyle;
  color: string;
}

export interface BotPick {
  memberId: string;
  marketId: string;
  side: "yes" | "no";
  stake: number;
  odds: number;
}

export type CardTone = "boundary" | "six" | "wicket" | "dot" | "run" | "extra" | "result";

export interface GlossaryTerm {
  term: string;
  plain: string;
}

export interface MomentCard {
  id: string;
  seq: number;
  overLabel: string;
  tone: CardTone;
  kicker: string;
  headline: string;
  dek: string;
  why: string;
  playerId: string;
  playerName: string;
  winProb: number;
  winDelta: number;
  equation: string;
  whisper: string;
  terms: GlossaryTerm[];
  battingTeam: string;
  runsBat: number;
  result: "chasing" | "won" | "lost" | "tied";
}

export interface MomentContext {
  seq: number;
  overLabel: string;
  tone: CardTone;
  playerName: string;
  bowlerName: string;
  battingTeam: string;
  equation: string;
  scoreLabel: string;
  winProb: number;
  winDelta: number;
  rrr: number | null;
  crr: number;
  ballsLeft: number;
  wicketsInHand: number;
  note?: string;
  dismissal?: Dismissal;
  runsBat: number;
  boundary?: 4 | 6;
  phase: Phase;
  result: Result;
}

export interface MomentCopy {
  headline: string;
  dek: string;
  why: string;
  whisper: string;
  source: "template" | "model";
}

export interface ExplainCopy {
  whisper: string;
  terms: GlossaryTerm[];
  source: "template" | "model";
}

export interface PredictionCopy {
  lines: { kind: MarketKind; prompt: string; detail: string }[];
  source: "template" | "model";
}

export type FeedStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "paused"
  | "ended"
  | "error";

/** A frame on the wire. Adapters parse bytes into this. */
export type FeedFrame =
  | { event: "meta"; data: InningsMeta }
  | { event: "delivery"; data: Delivery }
  | { event: "end"; data: { ok: true } };
