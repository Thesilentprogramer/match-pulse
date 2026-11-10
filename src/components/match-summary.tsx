"use client";

import { useEffect, useRef, useState } from "react";
import { Clapperboard, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Player, type PlayerRef } from "@remotion/player";
import { buildMatchSummary, summaryCacheKey, withSpokenDurations, type SummaryFilm } from "@/domain/summary";
import { MP4_UNAVAILABLE_MESSAGE } from "@/lib/host";
import { SummaryFilm as SummaryVideo } from "@/remotion/SummaryFilm";
import { summaryDurationFrames } from "@/remotion/summary-clock";
import { STORY_FPS } from "@/remotion/timing";
import { useMatchStore } from "@/state/match-store";
import { browserCanSpeak, cancelSpeechSynthesis, primeSpeechSynthesis, useSummarySpeech } from "@/components/summary-speech";
import { MusicPlayerCard } from "@/components/audio/music-player-card";
import { SpinLoader } from "@/components/loaders/spin-loader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CachedSummary = { film: SummaryFilm; voice: string; mp4: boolean };

const cache = new Map<string, CachedSummary>();

type Phase = "read" | "voice" | "ready" | "error";

export function MatchSummaryButton() {
  const playerRef = useRef<PlayerRef>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("read");
  const [film, setFilm] = useState<SummaryFilm | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [mp4, setMp4] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [job, setJob] = useState<{ id: string; progress: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const opening = useRef(false);
  const [language, setLanguage] = useState<"en-IN" | "hi-IN">("en-IN");
  const speakInBrowser = open && phase === "ready" && voice === "browser" && Boolean(film?.scenes.every((scene) => !scene.audioSrc));
  useSummarySpeech(playerRef, film?.scenes ?? null, speakInBrowser);

  useEffect(() => () => cancelSpeechSynthesis(), []);

  useEffect(() => {
    const player = playerRef.current;
    if (!open || !film || !player) return;
    const duration = Math.max(1, summaryDurationFrames(film.scenes));
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
  }, [open, film]);

  async function openSummary() {
    if (opening.current) return;
    opening.current = true;
    primeSpeechSynthesis();
    const state = useMatchStore.getState();
    if (!state.meta) {
      opening.current = false;
      return;
    }
    const key = `${summaryCacheKey(state.meta.id, state.deliveries, state.card ? state.meta.id : null)}:${language}`;
    const hit = cache.get(key);
    setOpen(true);
    setJob(null);
    if (hit) {
      setFilm(hit.film);
      setVoice(hit.voice);
      setMp4(hit.mp4);
      setPhase("ready");
      setNote(voiceNote(hit.voice));
      opening.current = false;
      return;
    }
    setPhase("read");
    setFilm(null);
    setVoice(null);
    const draft = buildMatchSummary({
      meta: state.meta,
      deliveries: state.deliveries,
      picks: state.picks,
      card: state.card,
    });
    setPhase("voice");
    try {
      const response = await fetch("/api/summary/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: draft.scenes.map((scene) => scene.narration),
          state: key,
          language,
        }),
      });
      const body = (await response.json()) as {
        clips?: { durationSec: number; url: string | null }[];
        voice?: string;
        mp4?: boolean;
        error?: string;
      };
      if (!response.ok || !body.clips || !body.voice) throw new Error(body.error ?? "Voice failed.");
      const ready = withSpokenDurations(
        draft,
        body.clips.map((clip) => ({ durationSec: clip.durationSec, url: clip.url })),
      );
      const hostedMp4 = body.mp4 !== false;
      cache.set(key, { film: ready, voice: body.voice, mp4: hostedMp4 });
      setFilm(ready);
      setVoice(body.voice);
      setMp4(hostedMp4);
      setNote(voiceNote(body.voice));
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      setNote(error instanceof Error ? error.message : "Could not build the summary.");
    } finally {
      opening.current = false;
    }
  }

  function nudge(frames: number) {
    const player = playerRef.current;
    if (!player || !film) return;
    const duration = Math.max(1, summaryDurationFrames(film.scenes));
    player.seekTo(Math.min(duration - 1, Math.max(0, player.getCurrentFrame() + frames)));
  }

  async function download() {
    if (!film || !mp4) {
      toast(MP4_UNAVAILABLE_MESSAGE);
      return;
    }
    setJob({ id: "", progress: 0.05 });
    const response = await fetch("/api/summary/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(film),
    });
    const started = (await response.json().catch(() => null)) as { jobId?: string; error?: string; unavailable?: boolean } | null;
    if (!response.ok || !started?.jobId) {
      setJob(null);
      toast(started?.error ?? MP4_UNAVAILABLE_MESSAGE);
      return;
    }
    const jobId = started.jobId;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const status = await fetch(`/api/summary/render?jobId=${jobId}`);
      const body = (await status.json()) as { status: string; progress: number; error?: string | null };
      setJob({ id: jobId, progress: body.progress });
      if (body.status === "error") {
        setJob(null);
        toast(body.error ?? "Render failed.");
        return;
      }
      if (body.status === "done") {
        const link = document.createElement("a");
        link.href = `/api/summary/render?jobId=${jobId}&download=1`;
        link.download = "match-summary.mp4";
        link.click();
        setJob(null);
        return;
      }
    }
    setJob(null);
    toast("The render is still going. Try the download again in a moment.");
  }

  async function share() {
    if (!film) return;
    const text = film.scenes.map((scene) => scene.narration).join(" ");
    if (navigator.share) {
      try {
        await navigator.share({ title: film.competition, text });
        return;
      } catch {
        /* the user dismissed the sheet */
      }
    }
    await navigator.clipboard.writeText(text);
    toast("Summary copied.");
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <div role="group" aria-label="Narration language" className="flex rounded-full bg-black/40 p-0.5">
          {(["en-IN", "hi-IN"] as const).map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={language === code}
              onClick={() => setLanguage(code)}
              className={`rounded-full px-2 py-1 text-xs ${language === code ? "bg-[var(--mp-accent)] text-white" : "text-white/80"}`}
            >
              {code === "en-IN" ? "EN" : "HI"}
            </button>
          ))}
        </div>
        <Button type="button" size="sm" className="h-9 rounded-full" data-testid="match-summary" onClick={() => void openSummary()}>
          <Clapperboard />
          Match Summary
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) cancelSpeechSynthesis();
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="mp-display text-3xl">Match Summary</DialogTitle>
            <DialogDescription>
              {phase === "ready" ? "Pencil scenes, spoken from the balls already in." : "Building this match."}
            </DialogDescription>
          </DialogHeader>
          {phase !== "ready" ? (
            <p role="status" className="flex items-center gap-2 text-sm text-white/80">
              <SpinLoader size="sm" label={phase === "error" ? "Summary failed" : "Building the summary"} />
              {phase === "read" ? "Reading the log…" : phase === "voice" ? "Recording the voice…" : note}
            </p>
          ) : null}
          {phase === "ready" && film ? (
            <div className="grid gap-3">
              <MusicPlayerCard
                title="Match Summary"
                artist={film.competition}
                album={note ?? "Spoken from the balls already in"}
                progress={progress}
                currentTime={clock((progress / 100) * summaryDurationFrames(film.scenes))}
                duration={clock(summaryDurationFrames(film.scenes))}
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
                      durationInFrames={Math.max(30, summaryDurationFrames(film.scenes))}
                      compositionWidth={1080}
                      compositionHeight={1920}
                      fps={STORY_FPS}
                      style={{ width: "100%", height: "100%" }}
                      autoPlay
                    />
                  </div>
                }
              />
              <div className="flex gap-2">
                {mp4 ? (
                  <Button type="button" onClick={() => void download()} disabled={Boolean(job)}>
                    <Download />
                    {job ? `Rendering ${Math.round(job.progress * 100)}%` : "Download"}
                  </Button>
                ) : (
                  <p className="self-center text-xs text-white/55">{MP4_UNAVAILABLE_MESSAGE}</p>
                )}
                <Button type="button" variant="secondary" onClick={() => void share()}>
                  <Share2 />
                  Share
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function clock(frames: number): string {
  const sec = Math.max(0, Math.floor(frames / STORY_FPS));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function voiceNote(voice: string): string | null {
  if (voice !== "browser") return null;
  if (browserCanSpeak()) return "No server voice on this host. The browser reads each scene.";
  return "No speaker on this host. The captions are the narration.";
}
