"use client";

import { useEffect, type RefObject } from "react";
import type { PlayerRef } from "@remotion/player";
import { nextNarrationScene } from "@/remotion/summary-clock";
import { browserCanSpeak } from "@/components/summary-voice";

/**
 * Speaks the scene that just came on screen, and stops when playback pauses
 * or the scene changes. Server audio takes this path only when it is absent.
 */
export function useSummarySpeech(
  playerRef: RefObject<PlayerRef | null>,
  scenes: readonly { durationSec: number; narration: string }[] | null,
  enabled: boolean,
): void {
  useEffect(() => {
    const player = playerRef.current;
    if (!enabled || !scenes || scenes.length === 0 || !player) return;
    if (!browserCanSpeak()) return;

    let previous: number | null = null;
    let playing = player.isPlaying();

    const speak = (index: number) => {
      const line = scenes[index]?.narration.trim();
      if (!line) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.rate = 1;
      window.speechSynthesis.speak(utterance);
    };

    const sync = (frame: number) => {
      const next = nextNarrationScene(previous, frame, playing, scenes);
      if (next === null) return;
      previous = next;
      speak(next);
    };

    const onPlay = () => {
      playing = true;
      previous = null;
      sync(player.getCurrentFrame());
    };
    const onPause = () => {
      playing = false;
      previous = null;
      window.speechSynthesis.cancel();
    };
    const onFrame = (event: { detail: { frame: number } }) => {
      sync(event.detail.frame);
    };

    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onPause);
    player.addEventListener("frameupdate", onFrame);
    if (playing) sync(player.getCurrentFrame());

    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onPause);
      player.removeEventListener("frameupdate", onFrame);
      window.speechSynthesis.cancel();
    };
  }, [playerRef, scenes, enabled]);
}
