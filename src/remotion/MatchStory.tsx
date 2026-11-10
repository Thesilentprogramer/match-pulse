import type { ReactNode } from "react";
import type { Caption } from "@remotion/captions";
import { Audio } from "@remotion/media";
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { MatchStoryProps } from "../domain/story-schema";
import { body, display } from "./fonts";
import { ARC_BEAT_FRAMES, clipFrames, isPlayableClip, montageFrames, STORY_FPS, STORY_SCENES, type StoryClip } from "./timing";

const RED = "#e10000";
const INK = "#090909";
const PAPER = "#f7f7f7";

export const MatchStory = (story: MatchStoryProps) => {
  const arc = story.beats.filter((beat) => beat.id.startsWith("arc-"));
  if (arc.length > 0) return <ArcStory story={story} beats={arc} />;
  const intro = story.introClipUrl ? STORY_SCENES.intro : 0;
  const montage = montageFrames(story.shotClips);
  const titleFrom = intro + montage;
  const chartFrom = titleFrom + STORY_SCENES.title;
  const callsFrom = chartFrom + STORY_SCENES.chart;
  const podFrom = callsFrom + STORY_SCENES.calls;
  const mvpFrom = podFrom + STORY_SCENES.pod;
  const finalFrom = mvpFrom + STORY_SCENES.mvp;
  const outroFrom = finalFrom + STORY_SCENES.final;

  return (
    <AbsoluteFill style={{ background: INK, color: PAPER, fontFamily: body.fontFamily }}>
      {story.introClipUrl ? (
        <Sequence from={0} durationInFrames={STORY_SCENES.intro} name="Intro">
          <OffthreadVideo src={story.introClipUrl} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Sequence>
      ) : null}
      <ClipMontage clips={story.shotClips} beats={story.beats} from={intro} />
      <Sequence from={titleFrom} durationInFrames={STORY_SCENES.title} name="Title">
        <TitleCard story={story} />
        <Sting />
      </Sequence>
      <Sequence from={chartFrom} durationInFrames={STORY_SCENES.chart} name="Turning points">
        <ChartCard story={story} />
        <Sting />
      </Sequence>
      <Sequence from={callsFrom} durationInFrames={STORY_SCENES.calls} name="Calls">
        <CallsCard story={story} />
        <Sting />
      </Sequence>
      <Sequence from={podFrom} durationInFrames={STORY_SCENES.pod} name="Pod">
        <PodCard story={story} />
        <Sting />
      </Sequence>
      <Sequence from={mvpFrom} durationInFrames={STORY_SCENES.mvp} name="MVP">
        <MvpCard story={story} />
        <Sting />
      </Sequence>
      <Sequence from={finalFrom} durationInFrames={STORY_SCENES.final} name="Final">
        <FinalCard story={story} />
        <Sting />
      </Sequence>
      <Sequence from={outroFrom} durationInFrames={STORY_SCENES.outro} name="Outro">
        <OutroCard />
      </Sequence>
    </AbsoluteFill>
  );
};

const ArcStory = ({ story, beats }: { story: MatchStoryProps; beats: MatchStoryProps["beats"] }) => {
  const intro = story.introClipUrl ? STORY_SCENES.intro : 0;
  const placed = beats.reduce<{ from: number; rows: { key: string; from: number; frames: number; beat: (typeof beats)[number]; url?: string }[] }>(
    (acc, beat) => {
      const frames = clipFrames(beat.id, story.shotClips);
      const rows = [...acc.rows];
      let from = acc.from;
      const clip = story.shotClips?.find((item) => item.beatId === beat.id && isPlayableClip(item.url));
      if (clip && frames > 0) {
        rows.push({ key: `${beat.id}-clip`, from, frames, beat, url: clip.url });
        from += frames;
      }
      rows.push({ key: beat.id, from, frames: ARC_BEAT_FRAMES, beat });
      return { from: from + ARC_BEAT_FRAMES, rows };
    },
    { from: intro, rows: [] },
  );
  return (
    <AbsoluteFill style={{ background: INK, color: PAPER, fontFamily: body.fontFamily }}>
      {story.introClipUrl && intro > 0 ? (
        <Sequence from={0} durationInFrames={intro} name="Intro">
          <OffthreadVideo src={story.introClipUrl} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <StatCaption text={story.competition} />
        </Sequence>
      ) : null}
      {placed.rows.map((row) => (
        <Sequence key={row.key} from={row.from} durationInFrames={row.frames} name={row.url ? `${row.beat.title} clip` : row.beat.title}>
          {row.url ? <ShotClip url={row.url} caption={row.beat.body} stat={row.beat.stat} /> : <ArcCard story={story} beat={row.beat} />}
          <Sting />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const ClipMontage = ({ clips, beats, from }: { clips?: readonly StoryClip[]; beats: MatchStoryProps["beats"]; from: number }) => {
  const rows = (clips ?? []).reduce<{ from: number; items: { clip: StoryClip; from: number; frames: number }[] }>(
    (acc, clip) => {
      if (!isPlayableClip(clip.url)) return acc;
      const frames = Math.round(clip.seconds * STORY_FPS);
      return { from: acc.from + frames, items: [...acc.items, { clip, from: acc.from, frames }] };
    },
    { from, items: [] },
  );
  return (
    <>
      {rows.items.map((row) => {
        const beat = beats.find((item) => item.id === row.clip.beatId);
        return (
          <Sequence key={row.clip.beatId} from={row.from} durationInFrames={row.frames} name={`${row.clip.beatId} clip`}>
            <ShotClip url={row.clip.url} caption={beat?.body ?? ""} stat={beat?.stat ?? ""} />
          </Sequence>
        );
      })}
    </>
  );
};

const ShotClip = ({ url, caption, stat }: { url: string; caption: string; stat: string }) => (
  <AbsoluteFill>
    <OffthreadVideo src={url} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    <StatCaption text={stat ? `${stat}. ${caption}` : caption} />
  </AbsoluteFill>
);

const StatCaption = ({ text }: { text: string }) => (
  <div
    style={{
      position: "absolute",
      left: 80,
      right: 80,
      bottom: 220,
      fontSize: 36,
      lineHeight: 1.25,
      color: PAPER,
      fontFamily: body.fontFamily,
    }}
  >
    {text}
  </div>
);

const ArcCard = ({ story, beat }: { story: MatchStoryProps; beat: MatchStoryProps["beats"][number] }) => (
  <Stage kicker={beat.kicker} caption="">
    <h1 style={{ fontFamily: display.fontFamily, fontWeight: 700, fontSize: 92, lineHeight: 0.92, margin: "24px 0 0", textTransform: "uppercase" }}>
      {beat.title}
    </h1>
    <p style={{ fontSize: 42, lineHeight: 1.25, marginTop: 28, maxWidth: 900 }}>{beat.body}</p>
    {beat.id === "arc-wobble" ? (
      <>
        <WinLine series={story.winSeries} />
        <p style={{ fontSize: 32, color: "#ff2a2a" }}>Model estimate. Not a broadcast win chance.</p>
      </>
    ) : (
      <p style={{ marginTop: 28, fontSize: 34, letterSpacing: 1, color: "#ff2a2a" }}>{beat.stat}</p>
    )}
  </Stage>
);

const WinLine = ({ series }: { series: number[] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame, fps, config: { damping: 18 } });
  const count = Math.max(2, Math.round(interpolate(reveal, [0, 1], [2, series.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const shown = series.slice(0, count);
  const width = 860;
  const height = 280;
  const points = shown
    .map((value, index) => {
      const x = (index / Math.max(1, series.length - 1)) * width;
      const y = height - value * (height - 16) - 8;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ marginTop: 24 }}>
      <polyline fill="none" stroke={RED} strokeWidth={8} points={points} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const Sting = () => (
  <Sequence from={0} durationInFrames={20} layout="none">
    <Audio src={staticFile("story-hit.wav")} volume={0.35} />
  </Sequence>
);

const Stage = ({ kicker, children, caption }: { kicker: string; children: ReactNode; caption: string }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16, mass: 0.8 } });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const captions: Caption[] = caption
    ? [
        {
          text: caption,
          startMs: 200,
          endMs: Math.max(400, ((durationInFrames - 4) / fps) * 1000),
          timestampMs: 200,
          confidence: 1,
        },
      ]
    : [];
  const ms = (frame / fps) * 1000;
  const active = captions.find((line) => ms >= line.startMs && ms <= line.endMs);
  return (
    <AbsoluteFill
      style={{
        padding: "140px 90px 180px",
        background: `radial-gradient(900px 480px at 50% 0%, rgba(225,0,0,0.45), transparent 70%), ${INK}`,
        opacity,
        transform: `translateY(${(1 - enter) * 36}px)`,
      }}
    >
      <div style={{ color: "#ff2a2a", fontFamily: display.fontFamily, fontWeight: 700, letterSpacing: 4, fontSize: 28 }}>
        {kicker.toUpperCase()}
      </div>
      {children}
      {active ? (
        <div
          style={{
            position: "absolute",
            left: 90,
            right: 90,
            bottom: 220,
            fontSize: 36,
            lineHeight: 1.25,
            color: PAPER,
          }}
        >
          {active.text}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const TitleCard = ({ story }: { story: MatchStoryProps }) => {
  const open = story.beats.find((beat) => beat.id === "open") ?? story.beats[0];
  return (
    <Stage kicker={story.competition} caption={open?.body ?? story.venue}>
      <h1 style={{ fontFamily: display.fontFamily, fontWeight: 700, fontSize: 108, lineHeight: 0.9, margin: "28px 0 0", textTransform: "uppercase" }}>
        {story.team}
        <br />
        chase {story.target}
      </h1>
      <p style={{ fontSize: 40, marginTop: 28, maxWidth: 860 }}>{story.venue}</p>
    </Stage>
  );
};

const ChartCard = ({ story }: { story: MatchStoryProps }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame, fps, config: { damping: 18 } });
  const series = story.winSeries;
  const count = Math.max(2, Math.round(interpolate(reveal, [0, 1], [2, series.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const shown = series.slice(0, count);
  const width = 900;
  const height = 420;
  const points = shown
    .map((value, index) => {
      const x = (index / Math.max(1, series.length - 1)) * width;
      const y = height - value * (height - 20) - 10;
      return `${x},${y}`;
    })
    .join(" ");
  const swing = story.beats.find((beat) => beat.id === "drop");
  return (
    <Stage kicker="Turning points" caption={swing?.body ?? "Win chance across the balls received."}>
      <h2 style={{ fontFamily: display.fontFamily, fontSize: 84, margin: "20px 0", textTransform: "uppercase" }}>Win chance</h2>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <polyline fill="none" stroke={RED} strokeWidth={10} points={points} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <p style={{ fontSize: 40 }}>{swing?.title ?? "The chase moved."}</p>
    </Stage>
  );
};

const CallsCard = ({ story }: { story: MatchStoryProps }) => {
  const callBeat = story.beats.find((beat) => beat.id === "calls");
  const rows = story.calls.slice(0, 4);
  return (
    <Stage kicker="Over-War" caption={callBeat?.body ?? "No call on this timeline."}>
      <h2 style={{ fontFamily: display.fontFamily, fontSize: 84, margin: "16px 0", textTransform: "uppercase" }}>{callBeat?.title ?? "Your calls"}</h2>
      {rows.length === 0 ? <p style={{ fontSize: 40 }}>You watched without staking a call.</p> : null}
      {rows.map((call) => (
        <p key={call.prompt} style={{ fontSize: 36, margin: "10px 0" }}>
          {call.won ? "Hit" : "Miss"} · {call.prompt} · {call.profit > 0 ? "+" : ""}
          {call.profit}
        </p>
      ))}
    </Stage>
  );
};

const PodCard = ({ story }: { story: MatchStoryProps }) => (
  <Stage kicker="The pod" caption={story.podLines[0] ?? "The pod watched."}>
    <h2 style={{ fontFamily: display.fontFamily, fontSize: 84, margin: "16px 0", textTransform: "uppercase" }}>Banter</h2>
    {story.podLines.slice(0, 3).map((line) => (
      <p key={line} style={{ fontSize: 36, margin: "12px 0" }}>
        {line}
      </p>
    ))}
  </Stage>
);

const MvpCard = ({ story }: { story: MatchStoryProps }) => (
  <Stage kicker="MVP" caption={`${story.mvp.name}. ${story.mvp.line}.`}>
    <h2 style={{ fontFamily: display.fontFamily, fontSize: 108, margin: "20px 0", textTransform: "uppercase" }}>{story.mvp.name}</h2>
    <p style={{ fontSize: 48 }}>{story.mvp.line}</p>
  </Stage>
);

const FinalCard = ({ story }: { story: MatchStoryProps }) => {
  const finish = story.beats.find((beat) => beat.id === "finish");
  return (
    <Stage kicker={finish?.kicker ?? "Final"} caption={finish?.body ?? story.final.overs}>
      <h2 style={{ fontFamily: display.fontFamily, fontSize: 120, margin: "12px 0", textTransform: "uppercase" }}>
        {story.final.runs}/{story.final.wickets}
      </h2>
      <p style={{ fontSize: 44 }}>{story.final.overs} overs · {story.final.result}</p>
    </Stage>
  );
};

const OutroCard = () => (
  <Stage kicker="Match Pulse" caption="Free points. A private pod. A story you can send.">
    <h2 style={{ fontFamily: display.fontFamily, fontSize: 120, marginTop: 40, textTransform: "uppercase" }}>Match Pulse</h2>
    <p style={{ fontSize: 40, color: RED }}>Watch it. Call it. Send it.</p>
  </Stage>
);
