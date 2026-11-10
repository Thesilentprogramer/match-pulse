"use client";

import { useState } from "react";
import { Clapperboard, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Player } from "@remotion/player";
import { buildMatchSummary, summaryCacheKey, withSpokenDurations, type SummaryFilm } from "@/domain/summary";
import { SummaryFilm as SummaryVideo } from "@/remotion/SummaryFilm";
import { summaryDurationFrames } from "@/remotion/SummaryFilm";
import { STORY_FPS } from "@/remotion/timing";
import { useMatchStore } from "@/state/match-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const cache = new Map<string, SummaryFilm>();

type Phase = "read" | "voice" | "ready" | "error";

export function MatchSummaryButton() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("read");
  const [film, setFilm] = useState<SummaryFilm | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [job, setJob] = useState<{ id: string; progress: number } | null>(null);

  async function openSummary() {
    const state = useMatchStore.getState();
    if (!state.meta) return;
    const key = summaryCacheKey(state.meta.id, state.deliveries, state.card ? state.meta.id : null);
    const hit = cache.get(key);
    setOpen(true);
    setJob(null);
    if (hit) {
      setFilm(hit);
      setPhase("ready");
      setNote(null);
      return;
    }
    setPhase("read");
    setFilm(null);
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
        body: JSON.stringify({ lines: draft.scenes.map((scene) => scene.narration) }),
      });
      const body = (await response.json()) as {
        clips?: { durationSec: number; url: string }[];
        voice?: string;
        error?: string;
      };
      if (!response.ok || !body.clips) throw new Error(body.error ?? "Voice failed.");
      const ready = withSpokenDurations(
        draft,
        body.clips.map((clip) => ({ durationSec: clip.durationSec, url: clip.url })),
      );
      cache.set(key, ready);
      setFilm(ready);
      setNote(body.voice === "silent" ? "No speaker on this host. The captions are the narration." : null);
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      setNote(error instanceof Error ? error.message : "Could not build the summary.");
    }
  }

  async function download() {
    if (!film) return;
    setJob({ id: "", progress: 0.05 });
    const response = await fetch("/api/summary/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(film),
    });
    const started = (await response.json()) as { jobId?: string; error?: string };
    if (!response.ok || !started.jobId) {
      setJob(null);
      toast(started.error ?? "This host cannot render an MP4. The player above is the summary.");
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
      <Button type="button" size="sm" className="h-9 rounded-full" data-testid="match-summary" onClick={() => void openSummary()}>
        <Clapperboard />
        Match Summary
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="mp-display text-3xl">Match Summary</DialogTitle>
            <DialogDescription>
              {phase === "ready" ? "Pencil scenes, spoken from the balls already in." : "Building this match."}
            </DialogDescription>
          </DialogHeader>
          {phase !== "ready" ? (
            <p role="status" className="text-sm text-white/70">
              {phase === "read" ? "Reading the log…" : phase === "voice" ? "Recording the voice…" : note}
            </p>
          ) : null}
          {phase === "ready" && film ? (
            <div className="grid gap-3">
              <Player
                component={SummaryVideo}
                inputProps={film}
                durationInFrames={Math.max(30, summaryDurationFrames(film.scenes))}
                compositionWidth={1080}
                compositionHeight={1920}
                fps={STORY_FPS}
                style={{ width: "100%", aspectRatio: "9 / 16", borderRadius: 16, overflow: "hidden" }}
                controls
                autoPlay
              />
              {note ? <p className="text-xs text-white/55">{note}</p> : null}
              <div className="flex gap-2">
                <Button type="button" onClick={() => void download()} disabled={Boolean(job)}>
                  <Download />
                  {job ? `Rendering ${Math.round(job.progress * 100)}%` : "Download"}
                </Button>
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
