import { containsBannedLanguage } from "@/domain/guard";
import {
  allowedNumberTokens,
  buildGroundedSnapshot,
  validateGroundedAnswer,
  type GroundedSnapshot,
} from "@/domain/grounding";
import { buildMatchStory, type MatchStory, type ScorecardRecap, type StoryBeat } from "@/domain/story";
import { buildShotPlan, type Shot, type ShotEvent } from "@/domain/shot-plan";
import type { Delivery, InningsMeta, UserPick } from "@/domain/types";

export const SKETCH_KINDS = ["toss", "rain", "wicket", "fighter", "collapse", "partnership", "result"] as const;
export type SketchKind = (typeof SKETCH_KINDS)[number];

export interface SummaryScene {
  id: string;
  kind: SketchKind;
  headline: string;
  caption: string;
  narration: string;
  /** Seconds. Replaced by the spoken length once a TtsProvider returns. */
  durationSec: number;
  audioSrc: string | null;
}

export interface SummaryFilm {
  matchId: string;
  competition: string;
  venue: string;
  scenes: SummaryScene[];
}

const KIND: Record<ShotEvent, SketchKind> = {
  establish: "toss",
  rain: "rain",
  spell: "wicket",
  bowled: "wicket",
  catch: "wicket",
  block: "fighter",
  boundary: "fighter",
  six: "fighter",
  collapse: "collapse",
  partnership: "partnership",
  celebration: "result",
};

export function sketchKind(event: ShotEvent): SketchKind {
  return KIND[event];
}

export function summaryCacheKey(matchId: string, deliveries: readonly { seq: number }[], cardId: string | null): string {
  const last = deliveries.at(-1)?.seq ?? 0;
  return `${matchId}:${deliveries.length}:${last}:${cardId ?? "log"}`;
}

export function allowedSummaryNumbers(story: MatchStory, snapshot: GroundedSnapshot | null): Set<string> {
  const tokens = snapshot ? allowedNumberTokens(snapshot) : new Set<string>();
  const blob = [
    story.team,
    String(story.target),
    story.mvp.line,
    story.final.overs,
    String(story.final.runs),
    String(story.final.wickets),
    String(story.final.ballsLeft),
    ...story.beats.flatMap((beat) => [beat.title, beat.body, beat.stat]),
  ].join(" ");
  for (const raw of blob.match(/\d+(?:\.\d+)?/g) ?? []) tokens.add(raw);
  return tokens;
}

export function narrateBeat(beat: StoryBeat, allowed: ReadonlySet<string>): string {
  const spoken = `${beat.title}. ${beat.body}`.replace(/\s+/g, " ").trim();
  if (validateGroundedAnswer(spoken, allowed).ok) return spoken;
  const safeBody = beat.body.replace(/\s+/g, " ").trim();
  if (validateGroundedAnswer(safeBody, allowed).ok) return safeBody;
  const stripped = spoken.replace(/\d+(?:\.\d+)?/g, "").replace(/\s+/g, " ").trim();
  if (stripped && !containsBannedLanguage(stripped)) return stripped;
  return "The match turns.";
}

/** Words per second of the template voice, used until real speech returns. */
const WORDS_PER_SEC = 2.4;

export function secondsForSpeech(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.min(12, Math.max(2.4, Math.round((words / WORDS_PER_SEC) * 10) / 10));
}

export function buildMatchSummary(input: {
  meta: InningsMeta;
  deliveries: readonly Delivery[];
  picks?: readonly UserPick[];
  card?: ScorecardRecap | null;
}): SummaryFilm {
  const story = buildMatchStory({
    meta: input.meta,
    deliveries: input.deliveries,
    picks: input.picks ?? [],
    card: input.card ?? undefined,
  });
  const plan = buildShotPlan(story.beats, {
    venue: story.venue,
    chaseTeam: story.team,
    winSeries: story.winSeries,
  });
  const snapshot = input.card ? null : buildGroundedSnapshot(input.meta, input.deliveries);
  const allowed = allowedSummaryNumbers(story, snapshot);
  const byId = new Map(story.beats.map((beat) => [beat.id, beat]));
  const scenes = plan.shots.map((shot) => sceneFromShot(shot, byId.get(shot.beatId), allowed));
  if (scenes.length === 0) {
    scenes.push(sceneFromShotFallback(story, allowed));
  }
  return {
    matchId: input.meta.id,
    competition: story.competition,
    venue: story.venue,
    scenes,
  };
}

export function withSpokenDurations(
  film: SummaryFilm,
  clips: readonly { durationSec: number; url: string | null }[],
): SummaryFilm {
  return {
    ...film,
    scenes: film.scenes.map((scene, index) => {
      const clip = clips[index];
      if (!clip) return scene;
      const durationSec = Math.min(14, Math.max(2.2, Math.round((clip.durationSec + 0.35) * 10) / 10));
      return { ...scene, durationSec, audioSrc: clip.url };
    }),
  };
}

function sceneFromShot(shot: Shot, beat: StoryBeat | undefined, allowed: ReadonlySet<string>): SummaryScene {
  const narration = beat ? narrateBeat(beat, allowed) : shot.fact;
  return {
    id: shot.beatId,
    kind: sketchKind(shot.event),
    headline: (beat?.title ?? shot.event).toUpperCase(),
    caption: beat?.body ?? shot.fact,
    narration,
    durationSec: secondsForSpeech(narration),
    audioSrc: null,
  };
}

function sceneFromShotFallback(story: MatchStory, allowed: ReadonlySet<string>): SummaryScene {
  const beat = story.beats[0];
  const narration = beat ? narrateBeat(beat, allowed) : "The match is underway.";
  return {
    id: "summary-open",
    kind: "toss",
    headline: (beat?.title ?? story.team).toUpperCase(),
    caption: beat?.body ?? story.venue,
    narration,
    durationSec: secondsForSpeech(narration),
    audioSrc: null,
  };
}
