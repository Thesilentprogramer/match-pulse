import { z } from "zod";
import { containsBannedLanguage } from "@/domain/guard";
import type { StoryBeat } from "@/domain/story";

/**
 * Typed prompts for anime match clips.
 * The fact stays on the shot for traceability. The prompt never copies a name.
 */

export const SHOT_EVENTS = [
  "spell",
  "bowled",
  "catch",
  "boundary",
  "six",
  "block",
  "collapse",
  "partnership",
  "rain",
  "celebration",
  "establish",
] as const;

export type ShotEvent = (typeof SHOT_EVENTS)[number];

export type Kit = "blue" | "black";

const SECONDS: Record<ShotEvent, 2 | 3 | 4> = {
  establish: 4,
  spell: 3,
  bowled: 2,
  catch: 2,
  boundary: 3,
  six: 3,
  block: 4,
  collapse: 3,
  partnership: 4,
  rain: 4,
  celebration: 3,
};

/** The verb a rewrite must still contain, so the event cannot drift. */
export const EVENT_VERB: Record<ShotEvent, string> = {
  spell: "bowls",
  bowled: "bowls",
  catch: "takes a catch",
  boundary: "plays a four",
  six: "hits a six",
  block: "blocks",
  collapse: "loses a wicket",
  partnership: "rotate the strike",
  rain: "pull the covers",
  celebration: "celebrate",
  establish: "waits",
};

const CAMERAS: Record<ShotEvent, { size: string; angle: string; movement: string }> = {
  spell: { size: "full figure", angle: "low angle", movement: "tracking the run-up" },
  bowled: { size: "close-up", angle: "low angle", movement: "locked off" },
  catch: { size: "medium", angle: "eye level", movement: "whip to the hands" },
  boundary: { size: "wide", angle: "side on", movement: "follow the ball along the ground" },
  six: { size: "wide", angle: "low angle", movement: "tilt up with the ball" },
  block: { size: "medium close-up", angle: "side on", movement: "static" },
  collapse: { size: "extreme close-up", angle: "eye level", movement: "static on the eyes" },
  partnership: { size: "medium two-shot", angle: "side on", movement: "slow lateral" },
  rain: { size: "extreme wide", angle: "high crane", movement: "slow rise over the ground" },
  celebration: { size: "medium", angle: "low angle", movement: "push in" },
  establish: { size: "extreme wide", angle: "high crane", movement: "hold" },
};

export const STYLE_BLOCK =
  "2D Japanese sports anime, Haikyuu-like cel shading, speed lines, red and black accent palette, vertical 9:16";

export const CONSTRAINTS_BLOCK = [
  "No text, no subtitles, no scoreboard, no numbers, no letters.",
  "No logos, no crests, no badges, no flags, no shirt numbers, no real faces, no likeness of a real player.",
  "Cricket gear only: a flat bat, three wooden stumps, pads, and a grilled helmet.",
  "Anatomically correct hands. One cricket ball. No baseball and no baseball bat.",
  "Do not depict an event this action does not name.",
].join(" ");

export const actionBlockSchema = z.object({
  event: z.enum(SHOT_EVENTS),
  subject: z.string().min(1),
  verb: z.string().min(1),
  object: z.string().min(1),
});

export const cameraBlockSchema = z.object({
  size: z.string().min(1),
  angle: z.string().min(1),
  movement: z.string().min(1),
});

export const moodBlockSchema = z.object({
  lighting: z.string().min(1),
  swing: z.number(),
  tension: z.number(),
});

export const globalsSchema = z.object({
  style: z.string().min(1),
  world: z.string().min(1),
  characters: z.string().min(1),
  constraints: z.string().min(1),
});

export const layeredPromptSchema = globalsSchema.extend({
  action: actionBlockSchema,
  camera: cameraBlockSchema,
  mood: moodBlockSchema,
});

export type ActionBlock = z.infer<typeof actionBlockSchema>;
export type PromptGlobals = z.infer<typeof globalsSchema>;
export type LayeredPrompt = z.infer<typeof layeredPromptSchema>;

export interface Shot {
  beatId: string;
  /** Sourced line from the beat. Traceability only. Not copied into the prompt. */
  fact: string;
  seconds: 2 | 3 | 4;
  event: ShotEvent;
  action: ActionBlock;
  camera: z.infer<typeof cameraBlockSchema>;
  mood: z.infer<typeof moodBlockSchema>;
}

export interface ShotPlan {
  globals: PromptGlobals;
  shots: Shot[];
}

export interface ShotContext {
  venue?: string;
  chaseTeam?: string;
  winSeries?: readonly number[];
}

export function buildShotPlan(beats: readonly StoryBeat[], context: ShotContext = {}): ShotPlan {
  const kits = kitsFor(context.chaseTeam ?? "");
  const split = beats.findIndex((beat) => /all out|need \d+/i.test(`${beat.title} ${beat.body}`));
  const chosen = new Map<ShotEvent, { beat: StoryBeat; index: number; score: number }>();

  beats.forEach((beat, index) => {
    const event = classifyBeat(beat);
    if (!event) return;
    const text = beatText(beat);
    const score = drama(event, text);
    const current = chosen.get(event);
    if (!current || score > current.score) chosen.set(event, { beat, index, score });
  });

  const shots = [...chosen.values()]
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 6)
    .sort((a, b) => a.index - b.index)
    .map(({ beat, index }) => {
      const event = classifyBeat(beat);
      if (!event) throw new Error("classified beat lost its event");
      const firstInnings = split === -1 ? false : index < split;
      const bat: Kit = firstInnings ? kits.field : kits.chase;
      const bowl: Kit = firstInnings ? kits.chase : kits.field;
      const celebrating: Kit = event === "celebration" ? kits.chase : bowl;
      const swing = swingAt(index, beats.length, context.winSeries ?? []);
      return {
        beatId: beat.id,
        fact: beat.body,
        seconds: SECONDS[event],
        event,
        action: actionFor(event, bat, celebrating),
        camera: CAMERAS[event],
        mood: moodFor(event, beatText(beat), swing),
      } satisfies Shot;
    });

  return {
    globals: {
      style: STYLE_BLOCK,
      world: worldBlock(beats, context.venue),
      characters: characterSheet(kits.chase, kits.field),
      constraints: CONSTRAINTS_BLOCK,
    },
    shots,
  };
}

export function renderPrompt(shot: Shot, globals: PromptGlobals): string {
  const prompt = layeredPromptSchema.parse({
    ...globals,
    action: shot.action,
    camera: shot.camera,
    mood: shot.mood,
  });
  return [
    `Style: ${prompt.style}`,
    `World: ${prompt.world}`,
    `Characters: ${prompt.characters}`,
    `Action: ${prompt.action.subject} ${prompt.action.verb} ${prompt.action.object}`,
    `Camera: ${prompt.camera.size}; ${prompt.camera.angle}; ${prompt.camera.movement}`,
    `Mood: ${prompt.mood.lighting} Swing ${prompt.mood.swing.toFixed(2)}. Tension ${prompt.mood.tension.toFixed(2)}.`,
    `Constraints: ${prompt.constraints}`,
  ].join("\n");
}

export function negativePrompt(event: ShotEvent): string {
  const base = [
    "text, subtitles, scoreboard, numbers, letters, watermark",
    "logos, crests, badges, flags, shirt numbers, real faces, celebrity likeness",
    "baseball, baseball bat, tennis, extra balls, extra stumps, malformed hands",
  ].join(", ");
  if (event === "six") return `${base}, more than one six`;
  return `${base}, six, six signal`;
}

export function acceptRewrite(original: Shot, next: LayeredPrompt, names: readonly string[]): boolean {
  if (next.action.event !== original.event) return false;
  const stem = EVENT_VERB[original.event];
  if (!next.action.verb.toLowerCase().includes(stem)) return false;
  const spoken = [next.style, next.world, next.characters, next.action.subject, next.action.verb, next.action.object, next.camera.size, next.camera.angle, next.camera.movement, next.mood.lighting].join("\n");
  if (containsBannedLanguage(spoken)) return false;
  if (names.some((name) => nameMentioned(spoken, name))) return false;
  if (/\b(logo|crest|badge|flag)\b/i.test(spoken)) return false;
  return true;
}

export async function resolveShotPrompt(
  shot: Shot,
  globals: PromptGlobals,
  names: readonly string[],
  director?: { rewrite(prompt: LayeredPrompt): Promise<LayeredPrompt | null> },
): Promise<{ prompt: string; negativePrompt: string; source: "template" | "director" }> {
  const template = { prompt: renderPrompt(shot, globals), negativePrompt: negativePrompt(shot.event), source: "template" as const };
  if (!director) return template;
  try {
    const next = await director.rewrite(layeredPromptSchema.parse({ ...globals, action: shot.action, camera: shot.camera, mood: shot.mood }));
    if (!next || !acceptRewrite(shot, next, names)) return template;
    const rewritten: Shot = { ...shot, action: next.action, camera: next.camera, mood: next.mood };
    return { prompt: renderPrompt(rewritten, { style: next.style, world: next.world, characters: next.characters, constraints: next.constraints }), negativePrompt: negativePrompt(shot.event), source: "director" };
  } catch {
    return template;
  }
}

function beatText(beat: StoryBeat): string {
  return `${beat.kicker} ${beat.title} ${beat.body}`.toLowerCase();
}

function classifyBeat(beat: StoryBeat): ShotEvent | null {
  if (beat.id === "calls" || beat.id === "room") return null;
  const text = beatText(beat);
  if (/rain|dls|covers|ahead of par/.test(text)) return "rain";
  if (/player of the match|lead the .*series/.test(text)) return "celebration";
  if (/stand|partnership/.test(text)) return "partnership";
  if (/only fifty|lone|resistance|off 104/.test(text)) return "block";
  if (/bounces out|spell/.test(text) || bowlingFigures(text)) return "spell";
  if (/\bsix\b|hits a 6|hit a six/.test(text)) return "six";
  if (/for [4-9]|all out|collapse|out for 0/.test(text)) return "collapse";
  if (/catch/.test(text)) return "catch";
  if (/bowled|stumps|is gone/.test(text)) return "bowled";
  if (/four|boundary/.test(text)) return "boundary";
  if (beat.tone === "open") return "establish";
  return null;
}

function bowlingFigures(text: string): boolean {
  const match = text.match(/(\d+) for (\d+)/);
  if (!match) return false;
  const left = Number(match[1]);
  const right = Number(match[2]);
  return left <= 10 && right > left;
}

function drama(event: ShotEvent, text: string): number {
  const base: Record<ShotEvent, number> = {
    spell: 90,
    rain: 88,
    collapse: 80,
    block: 76,
    partnership: 74,
    celebration: 70,
    bowled: 55,
    six: 52,
    catch: 48,
    boundary: 40,
    establish: 20,
  };
  let score = base[event];
  if (/for 4|for 5/.test(text)) score += 8;
  if (/all out/.test(text)) score += 3;
  return score;
}

function kitsFor(team: string): { chase: Kit; field: Kit } {
  if (/zealand|\bnz\b/i.test(team)) return { chase: "black", field: "blue" };
  return { chase: "blue", field: "black" };
}

function actionFor(event: ShotEvent, bat: Kit, celebrating: Kit): ActionBlock {
  const batter = `the anchor batter in the ${bat} kit`;
  const bowlingKit: Kit = bat === "blue" ? "black" : "blue";
  const table: Record<ShotEvent, ActionBlock> = {
    spell: { event, subject: `the fast bowler in the ${bowlingKit} kit`, verb: "bowls a hostile length", object: "at the stumps while the batter plays late" },
    bowled: { event, subject: `the fast bowler in the ${bowlingKit} kit`, verb: "bowls", object: "and the ball hits the stumps" },
    catch: { event, subject: `the wicketkeeper in the ${bowlingKit} kit`, verb: "takes a catch", object: "in front of the chest" },
    boundary: { event, subject: batter, verb: "plays a four", object: "along the ground past the infield" },
    six: { event, subject: batter, verb: "hits a six", object: "over the rope" },
    block: { event, subject: batter, verb: "blocks", object: "a good-length ball and holds the crease" },
    collapse: { event, subject: batter, verb: "loses a wicket", object: "as the field closes in" },
    partnership: { event, subject: `two batters in the ${bat} kit`, verb: "rotate the strike", object: "with defensive pushes" },
    rain: { event, subject: "ground staff in plain grey", verb: "pull the covers", object: "as rain reaches the pitch" },
    celebration: { event, subject: `the ${celebrating}-kit side`, verb: "celebrate", object: "with raised arms and no banner" },
    establish: { event, subject: "the ground", verb: "waits", object: "with both XIs in blue and black kits" },
  };
  return table[event];
}

function worldBlock(beats: readonly StoryBeat[], venue?: string): string {
  const blob = beats.map((beat) => `${beat.title} ${beat.body}`).join(" ").toLowerCase();
  const place = venue?.trim() || "a cricket ground";
  const weather = /rain|dls|covers|ahead of par/.test(blob) ? "rain arriving" : "clear air";
  const time = /night|under lights/.test(blob) ? "night" : "daytime";
  return `${place}. ${time}. ${weather}. A crowd in plain clothes. No signage.`;
}

function characterSheet(chase: Kit, field: Kit): string {
  return `Same cast in every shot. The chasing XI wears a ${chase} kit. The fielding XI wears a ${field} kit. Each XI has only these archetypes: fast bowler, spinner, anchor batter, wicketkeeper. Generic faces. No likeness, no names, no shirt numbers, no crests.`;
}

/** Data tension never reaches the celebration band. A real swing still can. */
const TENSION_CAP = 0.84;

export const MOOD_TABLE = [
  { min: 0, lighting: "calm overcast" },
  { min: 0.4, lighting: "brooding storm light" },
  { min: 0.85, lighting: "electric rim light" },
] as const;

const TENSION_NOTE = {
  cluster: "a cluster of wickets",
  wickets: "wickets are down",
  rate: "the asking rate is climbing",
  rain: "rain has stopped play",
  margin: "the margin is thin",
  none: "the innings is quiet",
} as const;

type TensionCause = keyof typeof TENSION_NOTE;

export function moodFor(event: ShotEvent, text: string, swing: number): { lighting: string; swing: number; tension: number } {
  const reading = tensionFrom(text);
  const tension = Math.min(TENSION_CAP, reading.value);
  const drive = event === "celebration" ? 1 : Math.max(tension, swing);
  const band = [...MOOD_TABLE].reverse().find((row) => drive >= row.min) ?? MOOD_TABLE[0];
  const fromSwing = event !== "celebration" && swing > tension;
  const note = event === "celebration" ? "the side has won" : fromSwing ? "the chance has jumped" : TENSION_NOTE[reading.cause];
  return {
    lighting: `${band.lighting}, ${note}`,
    swing: round2(swing),
    tension: round2(tension),
  };
}

function tensionFrom(text: string): { value: number; cause: TensionCause } {
  const parts: { value: number; cause: TensionCause }[] = [];
  for (const match of text.matchAll(/(\d+)\s+for\s+(\d+)/gi)) {
    const left = Number(match[1]);
    const right = Number(match[2]);
    if (left <= 10 && right > left) parts.push({ value: clamp01(left / 5) * 0.8, cause: "wickets" });
    else if (right <= 10) parts.push({ value: clamp01(right / 8) * 0.8, cause: "wickets" });
  }
  if (/in one over|same over/.test(text)) parts.push({ value: 0.8, cause: "cluster" });
  const needed = text.match(/(\d+)\s+needed from\s+(\d+)/i);
  if (needed) {
    const rate = Number(needed[1]) / Math.max(1, Number(needed[2]));
    parts.push({ value: clamp01((rate - 5) / 7), cause: "rate" });
  }
  if (/rain|dls|ahead of par|covers/.test(text)) parts.push({ value: 0.82, cause: "rain" });
  const margin = text.match(/win by\s+(\d+)/i);
  if (margin) {
    const runs = Number(margin[1]);
    parts.push({ value: runs <= 5 ? 0.74 : runs <= 15 ? 0.4 : 0.15, cause: "margin" });
  }
  if (/out for 0|golden duck/.test(text)) parts.push({ value: 0.58, cause: "wickets" });
  if (parts.length === 0) return { value: 0, cause: "none" };
  return parts.reduce((best, part) => (part.value >= best.value ? part : best));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function swingAt(index: number, count: number, series: readonly number[]): number {
  if (series.length < 2) return 0;
  const cursor = Math.round((index / Math.max(1, count - 1)) * (series.length - 1));
  const current = series[cursor] ?? series[0] ?? 0;
  const previous = series[Math.max(0, cursor - 1)] ?? current;
  return current - previous;
}

function nameMentioned(text: string, name: string): boolean {
  return name.split(/\s+/).some((part) => {
    if (part.length < 4) return false;
    return new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
  });
}
