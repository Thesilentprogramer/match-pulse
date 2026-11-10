import type { MatchDataSource } from "@/domain/fixture";
import type { Delivery, InningsMeta } from "@/domain/types";
import type { CricbuzzSnapshot } from "@/providers/cricbuzz/parse";

/** Live Cricbuzz score, already parsed. The domain only sees the log. */
export class CricbuzzDataSource implements MatchDataSource {
  constructor(private readonly snapshot: CricbuzzSnapshot) {}

  meta(): InningsMeta {
    return this.snapshot.meta;
  }

  deliveries(): readonly Delivery[] {
    return this.snapshot.deliveries;
  }
}
