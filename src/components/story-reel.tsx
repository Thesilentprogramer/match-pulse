"use client";

import { Component, useState, type ReactNode } from "react";
import { Download, Share2, X } from "lucide-react";
import { toast } from "sonner";
import type { MatchStory } from "@/domain/story";
import { renderStoryCard, recordStoryVideo } from "@/components/story-export";
import { StoryPlayer } from "@/components/story-player";
import { Button } from "@/components/ui/button";

export function StoryReel({ story, onClose }: { story: MatchStory; onClose: () => void }) {
  const [playerFailed, setPlayerFailed] = useState(false);
  const [busy, setBusy] = useState<"mp4" | "webm" | "card" | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const cardBeat = story.beats.at(-1) ?? story.beats[0];

  async function exportMp4() {
    setBusy("mp4");
    setProgress(0);
    try {
      const started = await fetch("/api/story/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(story),
      });
      if (!started.ok) throw new Error("Server render is unavailable.");
      const { jobId } = (await started.json()) as { jobId: string };
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const status = await fetch(`/api/story/render?jobId=${jobId}`);
        const body = (await status.json()) as { progress: number; status: string; error?: string | null };
        setProgress(body.progress);
        if (body.status === "error") throw new Error(body.error ?? "Render failed.");
        if (body.status === "done") {
          const file = await fetch(`/api/story/render?jobId=${jobId}&download=1`);
          if (!file.ok) throw new Error("Download failed.");
          downloadBlob(await file.blob(), "match-pulse-story.mp4");
          toast.success("MP4 saved");
          return;
        }
      }
      throw new Error("Render timed out.");
    } catch (error) {
      toast(error instanceof Error ? `${error.message} Saving a WebM instead.` : "Saving a WebM instead.");
      await exportWebm();
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function exportWebm() {
    setBusy("webm");
    try {
      const blob = await recordStoryVideo(story.beats);
      downloadBlob(blob, "match-pulse-story.webm");
      toast.success("WebM saved");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not record the story");
    } finally {
      setBusy(null);
    }
  }

  async function exportCard() {
    if (!cardBeat) return;
    setBusy("card");
    try {
      const blob = await renderStoryCard(cardBeat);
      downloadBlob(blob, "match-pulse-card.png");
      toast.success("Share card saved");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not draw the card");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    const text = story.beats.map((item) => `${item.title}. ${item.body}`).join("\n");
    if (navigator.share && cardBeat) {
      try {
        const blob = await renderStoryCard(cardBeat);
        const file = new File([blob], "match-pulse-card.png", { type: "image/png" });
        const payload: ShareData = { title: "Match Pulse story", text, files: [file] };
        if (!navigator.canShare || navigator.canShare(payload)) {
          await navigator.share(payload);
          return;
        }
        await navigator.share({ title: "Match Pulse story", text });
        return;
      } catch {
        // Copy the text when share is dismissed or unsupported.
      }
    }
    await navigator.clipboard.writeText(text);
    toast("Story copied. Share it from your clipboard.");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-3" role="dialog" aria-label="Match story">
      <div className="flex w-full max-w-[420px] flex-col gap-3">
        <div className="flex justify-end">
          <button type="button" className="rounded-full bg-white/10 p-2" onClick={onClose} aria-label="Close story">
            <X className="size-4" />
          </button>
        </div>
        {playerFailed ? <FallbackCards story={story} /> : (
          <PlayerBoundary onError={() => setPlayerFailed(true)}>
            <div data-testid="story-card">
              <StoryPlayer story={story} />
            </div>
          </PlayerBoundary>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void exportMp4()}>
            <Download />
            {busy === "mp4" ? `${Math.round((progress ?? 0) * 100)}%` : "MP4"}
          </Button>
          <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void exportCard()}>
            PNG
          </Button>
          <Button type="button" disabled={busy !== null} onClick={() => void share()}>
            <Share2 />
            Share
          </Button>
        </div>
      </div>
    </div>
  );
}

function FallbackCards({ story }: { story: MatchStory }) {
  const [index, setIndex] = useState(0);
  const beat = story.beats[index] ?? story.beats[0];
  if (!beat) return null;
  return (
    <article data-testid="story-card" className="relative aspect-[9/16] overflow-hidden rounded-3xl border border-white/10 bg-[#090909] p-6">
      <p className="mp-kicker text-[var(--mp-accent-bright)]">{beat.kicker}</p>
      <h2 className="mp-display mt-4 text-5xl text-white">{beat.title}</h2>
      <p className="mt-4 text-base leading-relaxed text-white/85">{beat.body}</p>
      <button type="button" className="absolute inset-y-0 left-0 w-1/2" aria-label="Previous card" onClick={() => setIndex((current) => (current - 1 + story.beats.length) % story.beats.length)} />
      <button type="button" className="absolute inset-y-0 right-0 w-1/2" aria-label="Next card" onClick={() => setIndex((current) => (current + 1) % story.beats.length)} />
    </article>
  );
}

class PlayerBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
