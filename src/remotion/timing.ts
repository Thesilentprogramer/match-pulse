export const STORY_FPS = 30;

export const STORY_SCENES = {
  title: 90,
  chart: 150,
  calls: 110,
  pod: 100,
  mvp: 90,
  final: 100,
  outro: 80,
  intro: 90,
} as const;

/** One sourced chapter. Nine of these is 45 seconds, long enough to read a sentence. */
export const ARC_BEAT_FRAMES = 150;

export interface StoryClip {
  beatId: string;
  url: string;
  seconds: number;
}

/** A generated clip is playable only when it is a real media URL. */
export function isPlayableClip(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/");
}

export function clipFrames(beatId: string, clips?: readonly StoryClip[]): number {
  const clip = clips?.find((item) => item.beatId === beatId && isPlayableClip(item.url));
  return clip ? Math.round(clip.seconds * STORY_FPS) : 0;
}

export function montageFrames(clips?: readonly StoryClip[]): number {
  return (clips ?? []).reduce((sum, clip) => sum + (isPlayableClip(clip.url) ? Math.round(clip.seconds * STORY_FPS) : 0), 0);
}

export function storyDurationInFrames(hasIntro: boolean, beats?: { id: string }[], clips?: readonly StoryClip[]): number {
  const intro = hasIntro ? STORY_SCENES.intro : 0;
  const arc = beats?.filter((beat) => beat.id.startsWith("arc-")) ?? [];
  if (arc.length > 0) {
    const extra = arc.reduce((sum, beat) => sum + clipFrames(beat.id, clips), 0);
    return arc.length * ARC_BEAT_FRAMES + extra + intro;
  }
  const body =
    STORY_SCENES.title +
    STORY_SCENES.chart +
    STORY_SCENES.calls +
    STORY_SCENES.pod +
    STORY_SCENES.mvp +
    STORY_SCENES.final +
    STORY_SCENES.outro;
  return intro + montageFrames(clips) + body;
}
