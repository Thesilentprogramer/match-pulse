import type { InningsMeta, Player, Team } from "@/domain/types";

export function teamById(meta: InningsMeta, id: string): Team | undefined {
  return meta.teams.find((team) => team.id === id);
}

export function playerById(meta: InningsMeta, id: string | null | undefined): Player | undefined {
  if (!id) return undefined;
  return meta.players.find((player) => player.id === id);
}

export function playerName(meta: InningsMeta, id: string | null | undefined, fallback = "Batter"): string {
  return playerById(meta, id)?.name ?? fallback;
}

export function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}
