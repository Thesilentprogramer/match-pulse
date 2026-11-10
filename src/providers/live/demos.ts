import { FIXTURE } from "@/domain/fixture";
import { loadMatchRecord, matchChoices } from "@/domain/matches";
import type { CatalogMatch } from "@/providers/live/types";

export function demoMatches(): CatalogMatch[] {
  return matchChoices().map((choice) => {
    const loaded = loadMatchRecord(choice.id);
    return {
      id: loaded.id,
      label: loaded.label,
      badge: "demo",
      live: loaded.live,
      detail: loaded.live ? "Recorded Harbor Cup final" : "Finished scorecard",
      meta: loaded.meta,
    };
  });
}

export function isDemoMatch(id: string): boolean {
  return id === FIXTURE.meta.id || demoMatches().some((match) => match.id === id);
}
