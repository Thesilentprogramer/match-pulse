"use client";

import { Player } from "@remotion/player";
import type { MatchStory } from "@/domain/story";
import { MatchStory as MatchStoryVideo } from "@/remotion/MatchStory";
import { STORY_FPS, storyDurationInFrames } from "@/remotion/timing";

export function StoryPlayer({ story }: { story: MatchStory }) {
  return (
    <Player
      component={MatchStoryVideo}
      inputProps={story}
      durationInFrames={storyDurationInFrames(Boolean(story.introClipUrl))}
      compositionWidth={1080}
      compositionHeight={1920}
      fps={STORY_FPS}
      style={{ width: "100%", aspectRatio: "9 / 16", borderRadius: 24, overflow: "hidden" }}
      controls
      autoPlay
      loop
    />
  );
}
