"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { Player, type PlayerRef } from "@remotion/player";
import type { SummaryFilm } from "@/domain/summary";
import { MP4_UNAVAILABLE_MESSAGE } from "@/lib/host";
import { SummaryFilm as SummaryVideo } from "@/remotion/SummaryFilm";
import { summaryDurationFrames } from "@/remotion/summary-clock";
import { STORY_FPS } from "@/remotion/timing";
import { MusicPlayerCard } from "@/components/audio/music-player-card";
import { useSummarySpeech } from "@/components/summary-speech";
import { Button } from "@/components/ui/button";

export function SummaryStage({
  film,
  note,
  mp4,
  job,
  browserVoice,
  onDownload,
  onShare,
}: {
  film: SummaryFilm;
  note: string | null;
  mp4: boolean;
  job: { id: string; progress: number } | null;
  browserVoice: boolean;
  onDownload: () => void;
  onShare: () => void;
}) {
  const playerRef = useRef<PlayerRef>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const duration = Math.max(30, summaryDurationFrames(film.scenes));
  useSummarySpeech(playerRef, film.scenes, browserVoice);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = () => setProgress((player.getCurrentFrame() / duration) * 100);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  }, [duration]);

  function nudge(frames: number) {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(Math.min(duration - 1, Math.max(0, player.getCurrentFrame() + frames)));
  }

  return (
    <div className="grid min-h-[36rem] gap-3">
      <MusicPlayerCard
        title="Match Summary"
        artist={film.competition}
        album={note ?? "Spoken from the balls already in"}
        progress={progress}
        currentTime={clock((progress / 100) * duration)}
        duration={clock(duration)}
        playing={playing}
        onPlayingChange={(next) => {
          const player = playerRef.current;
          if (!player) return;
          if (next) void player.play();
          else player.pause();
        }}
        onPrevious={() => nudge(-STORY_FPS * 3)}
        onNext={() => nudge(STORY_FPS * 3)}
        cover={
          <div className="h-[min(52dvh,420px)] overflow-hidden bg-black">
            <Player
              ref={playerRef}
              component={SummaryVideo}
              inputProps={film}
              durationInFrames={duration}
              compositionWidth={1080}
              compositionHeight={1920}
              fps={STORY_FPS}
              style={{ width: "100%", height: "100%" }}
              autoPlay
            />
          </div>
        }
      />
      <div className="flex h-10 items-center gap-2">
        {mp4 ? (
          <Button type="button" onClick={onDownload} disabled={Boolean(job)}>
            <Download />
            {job ? `Rendering ${Math.round(job.progress * 100)}%` : "Download"}
          </Button>
        ) : (
          <p className="text-xs text-white/55">{MP4_UNAVAILABLE_MESSAGE}</p>
        )}
        <Button type="button" variant="secondary" onClick={onShare}>
          <Share2 />
          Share
        </Button>
      </div>
    </div>
  );
}

function clock(frames: number): string {
  const sec = Math.max(0, Math.floor(frames / STORY_FPS));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
