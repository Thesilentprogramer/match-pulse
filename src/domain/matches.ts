import { FIXTURE } from "@/domain/fixture";
import type { ScorecardRecap } from "@/domain/story";
import type { Delivery, InningsMeta } from "@/domain/types";
import { indiaWicketBalls, indNzCard, indNzMeta } from "../../fixtures/ind-nz-2nd-odi-2026";

export interface LoadedMatch {
  id: string;
  label: string;
  /** Live matches arrive over the feed. Scorecard matches are already complete. */
  live: boolean;
  meta: InningsMeta;
  deliveries: Delivery[];
  card: ScorecardRecap | null;
}

const wellington: LoadedMatch = {
  id: indNzMeta.id,
  label: "NZ vs India, 2nd ODI",
  live: false,
  meta: indNzMeta,
  deliveries: indiaWicketBalls,
  card: indNzCard,
};

export function matchChoices(): { id: string; label: string }[] {
  return [
    { id: FIXTURE.meta.id, label: "Harbor Cup final" },
    { id: wellington.id, label: wellington.label },
  ];
}

export function loadMatchRecord(id: string): LoadedMatch {
  if (id === wellington.id) return wellington;
  return {
    id: FIXTURE.meta.id,
    label: "Harbor Cup final",
    live: true,
    meta: FIXTURE.meta,
    deliveries: [],
    card: null,
  };
}
