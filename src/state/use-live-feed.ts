"use client";

import { useEffect } from "react";
import type { PlaybackSpeed } from "@/domain/pacing";
import { feedUrl, FetchSseTransport } from "@/providers/match/fetch-transport";
import { FeedSession, type FeedQuery } from "@/providers/match/feed-session";
import { useMatchStore } from "@/state/match-store";

let active: FeedSession | null = null;

export function getFeed(): FeedSession | null {
  return active;
}

function queryFromState(state: {
  speed: PlaybackSpeed;
  jitter: boolean;
  burstUntilSeq: number;
  generation: number;
}): FeedQuery {
  return {
    afterSeq: 0,
    speed: state.speed,
    jitter: state.jitter,
    burstUntilSeq: state.burstUntilSeq,
    generation: state.generation,
  };
}

export function useLiveFeed(): void {
  useEffect(() => {
    const store = useMatchStore.getState();
    const session = new FeedSession({
      transport: new FetchSseTransport(),
      url: feedUrl,
      onMeta: (meta) => useMatchStore.getState().setMeta(meta),
      onDelivery: (delivery) => useMatchStore.getState().ingest(delivery),
      onStatus: (status, detail) => useMatchStore.getState().setStatus(status, detail),
    });
    active = session;
    session.start(queryFromState(store));

    const unsub = useMatchStore.subscribe((state, prev) => {
      if (
        state.speed !== prev.speed ||
        state.jitter !== prev.jitter ||
        state.burstUntilSeq !== prev.burstUntilSeq ||
        state.generation !== prev.generation
      ) {
        session.configure(queryFromState(state));
      }
      if (state.playback !== prev.playback) {
        if (state.playback === "paused") session.pause();
        else if (!state.holdFeed) session.resume();
      }
      if (state.holdFeed !== prev.holdFeed) {
        if (state.holdFeed) session.pause();
        else session.resume();
      }
    });

    const status = fetch("/api/ai/status")
      .then((response) => response.json())
      .then((body: { provider?: "template" | "openai" | "gateway" }) => {
        if (body.provider) useMatchStore.getState().setProvider(body.provider);
      })
      .catch(() => useMatchStore.getState().setProvider("template"));

    return () => {
      unsub();
      session.stop();
      if (active === session) active = null;
      void status;
    };
  }, []);
}
