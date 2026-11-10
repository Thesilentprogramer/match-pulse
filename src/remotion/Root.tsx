import { Composition } from "remotion";
import { matchStorySchema, type MatchStoryProps } from "../domain/story-schema";
import { MatchStory } from "./MatchStory";
import { SummaryFilm, summaryDurationFrames } from "./SummaryFilm";
import { summaryFilmSchema, type SummaryFilmInput } from "./summary-schema";
import { STORY_FPS, storyDurationInFrames } from "./timing";

const sample: MatchStoryProps = {
  competition: "Harbor Cup · Final",
  venue: "Marina Oval, Kochi",
  team: "Harbor Kings",
  target: 186,
  beats: [
    {
      id: "open",
      kicker: "Harbor Cup · Final",
      title: "Harbor Kings chase 186",
      body: "Ridge Lions posted 185/6. Marina Oval, Kochi.",
      stat: "Target 186",
      tone: "open",
    },
    {
      id: "drop",
      kicker: "The swing",
      title: "Mehta is gone",
      body: "156 needed from 99. Win chance moved 8 points.",
      stat: "41%",
      tone: "swing",
    },
    {
      id: "calls",
      kicker: "Your calls",
      title: "You watched",
      body: "No Over-War call on this timeline. The reel is still yours.",
      stat: "1000 pts",
      tone: "call",
    },
    {
      id: "finish",
      kicker: "Final whistle",
      title: "Harbor Kings win",
      body: "Harbor Kings 186/6 in 19.5. 1 balls left.",
      stat: "100%",
      tone: "finish",
    },
  ],
  winSeries: [0.48, 0.52, 0.44, 0.61, 0.39, 0.7, 0.93],
  calls: [],
  podLines: ["No call has landed in the pod yet."],
  mvp: { name: "Kabir Sethi", line: "48 from 21" },
  final: { runs: 186, wickets: 6, overs: "19.5", result: "won", ballsLeft: 1 },
  introClipUrl: null,
};

export const RemotionRoot = () => {
  return (
    <>
    <Composition
      id="MatchStory"
      component={MatchStory}
      durationInFrames={storyDurationInFrames(false)}
      fps={STORY_FPS}
      width={1080}
      height={1920}
      schema={matchStorySchema}
      defaultProps={sample}
      calculateMetadata={({ props }) => ({
        durationInFrames: storyDurationInFrames(Boolean(props.introClipUrl), props.beats, props.shotClips),
        props,
      })}
    />
    <Composition
      id="SummaryFilm"
      component={SummaryFilm}
      durationInFrames={90}
      fps={STORY_FPS}
      width={1080}
      height={1920}
      schema={summaryFilmSchema}
      defaultProps={summarySample}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(30, summaryDurationFrames(props.scenes)),
        props,
      })}
    />
    </>
  );
};

const summarySample: SummaryFilmInput = {
  matchId: "sample",
  competition: "Harbor Cup",
  venue: "Marina Oval",
  scenes: [
    {
      id: "sample",
      kind: "toss",
      headline: "THE MATCH IS LIVE",
      caption: "A chase, told in pencil.",
      narration: "The match is live.",
      durationSec: 3,
      audioSrc: null,
    },
  ],
};
