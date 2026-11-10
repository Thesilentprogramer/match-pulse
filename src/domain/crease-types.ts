import type { Delivery, Dismissal } from "@/domain/types";

/** Structural slice so crease logic does not depend on a full delivery. */
export interface CreaseDelivery {
  runsBat: number;
  kind: Delivery["kind"];
  legalBall: number;
  wicket?: { playerOutId: string; dismissal: Dismissal; end: "striker" | "nonstriker" };
}
