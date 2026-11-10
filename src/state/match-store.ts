"use client";

import { STAKE_CHOICES, canStake } from "@/domain/predictions";
import { selectMatchView, type Enrichment, type MatchView } from "@/domain/selectors";
import type { PlaybackSpeed } from "@/domain/pacing";
import type { ScorecardRecap } from "@/domain/story";
import type { Delivery, FeedStatus, InningsMeta, MarketKind, UserPick } from "@/domain/types";
import { create } from "zustand";

export interface MatchStore {
  status: FeedStatus;
  statusDetail: string | null;
  meta: InningsMeta | null;
  /** Contiguous deliveries, in seq order. This is the match. */
  deliveries: Delivery[];
  speed: PlaybackSpeed;
  jitter: boolean;
  playback: "playing" | "paused";
  picks: UserPick[];
  stake: (typeof STAKE_CHOICES)[number];
  fantasyOn: boolean;
  enrichments: Record<number, Enrichment>;
  predictionLines: { kind: MarketKind; prompt: string; detail: string }[] | null;
  provider: "template" | "openai" | "gateway" | "unknown";
  generation: number;
  burstUntilSeq: number;
  /** When true the live feed is held so a finished scorecard can sit in the store. */
  holdFeed: boolean;
  card: ScorecardRecap | null;
  matchId: string;
  uiEpoch: number;
  view: MatchView;
  setStatus: (status: FeedStatus, detail?: string) => void;
  setMeta: (meta: InningsMeta) => void;
  setProvider: (provider: MatchStore["provider"]) => void;
  ingest: (delivery: Delivery) => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  setJitter: (jitter: boolean) => void;
  setPlayback: (playback: "playing" | "paused") => void;
  setStake: (stake: (typeof STAKE_CHOICES)[number]) => void;
  placePick: (marketId: string, side: "yes" | "no") => string | null;
  toggleFantasy: () => void;
  enrich: (seq: number, enrichment: Enrichment) => void;
  setPredictionLines: (lines: { kind: MarketKind; prompt: string; detail: string }[] | null) => void;
  seekToOver: (overNumber: number) => void;
  loadMatch: (input: { id: string; live: boolean; meta: InningsMeta; deliveries: Delivery[]; card: ScorecardRecap | null }) => void;
  recompute: () => void;
}

function viewFor(
  state: Pick<MatchStore, "meta" | "deliveries" | "picks" | "stake" | "fantasyOn" | "enrichments" | "predictionLines">,
): MatchView {
  return selectMatchView({
    meta: state.meta,
    deliveries: state.deliveries,
    picks: state.picks,
    fantasyOn: state.fantasyOn,
    enrichments: state.enrichments,
    predictionLines: state.predictionLines,
    stake: state.stake,
  });
}

const initialView = selectMatchView({
  meta: null,
  deliveries: [],
  picks: [],
  stake: 25,
  fantasyOn: false,
  enrichments: {},
  predictionLines: null,
});

export const useMatchStore = create<MatchStore>((set, get) => ({
  status: "connecting",
  statusDetail: null,
  meta: null,
  deliveries: [],
  speed: 1,
  jitter: false,
  playback: "playing",
  picks: [],
  stake: 25,
  fantasyOn: false,
  enrichments: {},
  predictionLines: null,
  provider: "unknown",
  generation: 0,
  burstUntilSeq: 0,
  holdFeed: false,
  card: null,
  matchId: "harbor-cup-final",
  uiEpoch: 0,
  view: initialView,
  setStatus: (status, detail) => set({ status, statusDetail: detail ?? null }),
  setMeta: (meta) => {
    if (get().holdFeed) return;
    set({ meta });
    get().recompute();
  },
  setProvider: (provider) => set({ provider }),
  ingest: (delivery) => {
    const state = get();
    if (state.holdFeed) return;
    const last = state.deliveries.at(-1)?.seq ?? 0;
    if (delivery.seq <= last) return;
    if (delivery.seq !== last + 1) return;
    set({ deliveries: [...state.deliveries, delivery] });
    get().recompute();
  },
  setSpeed: (speed) => set({ speed }),
  setJitter: (jitter) => set({ jitter }),
  setPlayback: (playback) => set({ playback }),
  setStake: (stake) => {
    set({ stake });
    get().recompute();
  },
  placePick: (marketId, side) => {
    const state = get();
    const market = state.view.markets.find((item) => item.market.id === marketId);
    if (!market) return "That call is not on the card.";
    const reason = canStake(
      state.view.ledgerBank,
      state.stake,
      state.picks.some((pick) => pick.marketId === marketId),
      market.phase,
    );
    if (reason) return reason;
    const pick: UserPick = {
      marketId,
      side,
      stake: state.stake,
      odds: side === "yes" ? market.market.yesOdds : market.market.noOdds,
    };
    set({ picks: [...state.picks, pick] });
    get().recompute();
    return null;
  },
  toggleFantasy: () => {
    set({ fantasyOn: !get().fantasyOn });
    get().recompute();
  },
  enrich: (seq, enrichment) => {
    set({ enrichments: { ...get().enrichments, [seq]: enrichment } });
    get().recompute();
  },
  setPredictionLines: (lines) => {
    set({ predictionLines: lines });
    get().recompute();
  },
  loadMatch: (input) => {
    set({
      matchId: input.id,
      holdFeed: !input.live,
      card: input.card,
      meta: input.meta,
      deliveries: input.live ? [] : [...input.deliveries],
      picks: [],
      enrichments: {},
      predictionLines: null,
      generation: get().generation + 1,
      burstUntilSeq: 0,
      uiEpoch: get().uiEpoch + 1,
      status: input.live ? "connecting" : "live",
      statusDetail: input.live ? "Back on the live feed." : "Scorecard loaded.",
    });
    get().recompute();
  },
  seekToOver: (overNumber) => {
    const start = get().meta?.overStarts[overNumber - 1] ?? 1;
    set({
      generation: get().generation + 1,
      burstUntilSeq: Math.max(0, start - 1),
      deliveries: [],
      picks: [],
      enrichments: {},
      predictionLines: null,
      uiEpoch: get().uiEpoch + 1,
      status: "connecting",
      statusDetail: `Jumping to over ${overNumber}. Points reset so the arc stays fair.`,
    });
    get().recompute();
  },
  recompute: () => {
    set({ view: viewFor(get()) });
  },
}));
