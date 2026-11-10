import type { InningsMeta } from "@/domain/types";

export type FeedBadge = "cricbuzz" | "cricapi" | "demo";

export interface CatalogMatch {
  id: string;
  label: string;
  badge: FeedBadge;
  live: boolean;
  detail: string;
  meta?: InningsMeta;
}

export interface Catalog {
  source: FeedBadge;
  note: string | null;
  hitsToday: number | null;
  hitsLimit: number | null;
  matches: CatalogMatch[];
}

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
