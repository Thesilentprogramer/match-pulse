import type { CreaseDelivery } from "@/domain/crease-types";
import type { Dismissal } from "@/domain/types";

export interface Crease {
  strikerId: string | null;
  nonStrikerId: string | null;
  nextIndex: number;
  dismissed: string[];
}

export function openingCrease(battingOrder: readonly string[]): Crease {
  return {
    strikerId: battingOrder[0] ?? null,
    nonStrikerId: battingOrder[1] ?? null,
    nextIndex: 2,
    dismissed: [],
  };
}

function swapEnds(crease: Crease): Crease {
  return { ...crease, strikerId: crease.nonStrikerId, nonStrikerId: crease.strikerId };
}

function nextBatter(crease: Crease, order: readonly string[], keep: string | null): string | null {
  for (let i = crease.nextIndex; i < order.length; i += 1) {
    const id = order[i];
    if (!id || crease.dismissed.includes(id) || id === keep) continue;
    return id;
  }
  return null;
}

/**
 * Ends after a delivery. Crossing (odd runs off the bat) happens before the
 * wicket is applied, then the dismissed batter is replaced at the end they
 * occupy. A legal sixth ball changes ends for the new over.
 */
export function creaseAfter(
  crease: Crease,
  delivery: CreaseDelivery,
  battingOrder: readonly string[],
): Crease {
  let next: Crease = {
    strikerId: crease.strikerId,
    nonStrikerId: crease.nonStrikerId,
    nextIndex: crease.nextIndex,
    dismissed: crease.dismissed,
  };

  if (delivery.runsBat % 2 === 1) next = swapEnds(next);

  if (delivery.wicket) {
    const outId = delivery.wicket.playerOutId;
    const dismissed = next.dismissed.includes(outId) ? next.dismissed : [...next.dismissed, outId];
    const keep = outId === next.strikerId ? next.nonStrikerId : next.strikerId;
    const incoming = nextBatter({ ...next, dismissed }, battingOrder, keep);
    const consumed = incoming
      ? Math.max(next.nextIndex, battingOrder.indexOf(incoming) + 1)
      : next.nextIndex;
    next = {
      ...next,
      dismissed,
      nextIndex: consumed,
      strikerId: outId === next.strikerId ? incoming : next.strikerId,
      nonStrikerId: outId === next.nonStrikerId ? incoming : next.nonStrikerId,
    };
  }

  const endOfOver = delivery.kind !== "wide" && delivery.legalBall === 6;
  if (endOfOver) next = swapEnds(next);
  return next;
}

export function dismissalLabel(dismissal: Dismissal): string {
  switch (dismissal) {
    case "bowled":
      return "bowled";
    case "caught":
      return "caught";
    case "lbw":
      return "lbw";
    case "runout":
      return "run out";
    case "stumped":
      return "stumped";
    case "unspecified":
      return "out";
  }
}
