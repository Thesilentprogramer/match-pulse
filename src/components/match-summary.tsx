"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Clapperboard } from "lucide-react";
import { toast } from "sonner";
import { buildMatchSummary, summaryCacheKey, withSpokenDurations, type SummaryFilm } from "@/domain/summary";
import { MP4_UNAVAILABLE_MESSAGE } from "@/lib/host";
import { useMatchStore } from "@/state/match-store";
import { browserCanSpeak, cancelSpeechSynthesis, primeSpeechSynthesis } from "@/components/summary-voice";
import { SpinLoader } from "@/components/loaders/spin-loader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SummaryStage = dynamic(() => import("@/components/summary-stage").then((mod) => mod.SummaryStage), {
  ssr: false,
  loading: () => <div className="h-[min(52dvh,420px)] min-h-[36rem] rounded-2xl bg-black" aria-busy="true" aria-label="Loading the summary" />,
});

type CachedSummary = { film: SummaryFilm; voice: string; mp4: boolean };

const cache = new Map<string, CachedSummary>();

type Phase = "read" | "voice" | "ready" | "error";

export function MatchSummaryButton() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("read");
  const [film, setFilm] = useState<SummaryFilm | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [mp4, setMp4] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [job, setJob] = useState<{ id: string; progress: number } | null>(null);
  const opening = useRef(false);
  const [language, setLanguage] = useState<"en-IN" | "hi-IN">("en-IN");

  useEffect(() => () => cancelSpeechSynthesis(), []);

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
            <SummaryStage
              film={film}
              note={note}
              mp4={mp4}
              job={job}
              browserVoice={voice === "browser" && film.scenes.every((scene) => !scene.audioSrc)}
              onDownload={() => void download()}
              onShare={() => void share()}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function voiceNote(voice: string): string | null {
  if (voice !== "browser") return null;
  if (browserCanSpeak()) return "No server voice on this host. The browser reads each scene.";
  return "No speaker on this host. The captions are the narration.";
}
