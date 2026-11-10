import { loadMatchRecord } from "@/domain/matches";
import type { Delivery, InningsMeta } from "@/domain/types";
import { cricApiGet, type CricApiResult } from "@/providers/cricapi/client";
import { nextCricApiDelayMs, nextCricbuzzDelayMs, type CricPhase } from "@/providers/cricapi/budget";
import { chaseLine, readHits, snapshotFromMatch, type CricMatch } from "@/providers/cricapi/delta";
import { CRICBUZZ_LIVE_URL, cricbuzzMatchUrl, fetchCricbuzz } from "@/providers/cricbuzz/fetch";
import { parseLiveScoresHtml, parseMatchHtml, type CricbuzzListItem } from "@/providers/cricbuzz/parse";
import { CricbuzzDataSource } from "@/providers/cricbuzz/source";
import { demoMatches, isDemoMatch } from "@/providers/live/demos";
import type { Catalog, CatalogMatch, FeedBadge } from "@/providers/live/types";

export interface MatchSnap {
  id: string;
  badge: FeedBadge;
  note: string | null;
  meta: InningsMeta;
  deliveries: Delivery[];
  hitsToday: number | null;
  hitsLimit: number | null;
  waitMs: number;
  ended: boolean;
}

export interface PollerDeps {
  now(): number;
  cricbuzzLive(): Promise<string>;
  cricbuzzMatch(matchId: number): Promise<string>;
  cricApi(path: string, params: Record<string, string>): Promise<CricApiResult>;
  log(message: string): void;
}

interface Board {
  at: number;
  nextAt: number;
  failures: number;
  snap: MatchSnap;
  signature: string;
}

export function createLivePoller(deps: PollerDeps) {
  let catalog: { nextAt: number; value: Catalog } | null = null;
  let cricList: { nextAt: number; matches: CricMatch[]; hitsToday: number | null; hitsLimit: number | null } | null = null;
  const boards = new Map<string, Board>();
  const inflight = new Map<string, Promise<unknown>>();
  let buzzItems: CricbuzzListItem[] = [];

  async function once<T>(key: string, run: () => Promise<T>): Promise<T> {
    const pending = inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
    const job = run().finally(() => inflight.delete(key));
    inflight.set(key, job);
    return job;
  }

  async function getCatalog(): Promise<Catalog> {
    if (catalog && deps.now() < catalog.nextAt) return catalog.value;
    return once("catalog", async () => {
      const value = await loadCatalog();
      catalog = { value, nextAt: deps.now() + (value.source === "cricbuzz" ? 20_000 : 60_000) };
      return value;
    });
  }

  async function loadCatalog(): Promise<Catalog> {
    try {
      const html = await deps.cricbuzzLive();
      const items = parseLiveScoresHtml(html).filter((item) => item.inProgress);
      buzzItems = items;
      return {
        source: "cricbuzz",
        note: items.length === 0 ? "No Cricbuzz match is in progress. The demo fixtures are still here." : null,
        hitsToday: null,
        hitsLimit: null,
        matches: [...demoMatches(), ...items.map(buzzCatalogItem)],
      };
    } catch (error) {
      deps.log(`Cricbuzz live list failed: ${messageOf(error)}`);
    }
    try {
      const api = await loadCricList();
      return {
        source: "cricapi",
        note: "Cricbuzz did not answer. Scores are the CricAPI board, about a minute behind.",
        hitsToday: api.hitsToday,
        hitsLimit: api.hitsLimit,
        matches: [...demoMatches(), ...api.matches.filter(started).map(cricCatalogItem)],
      };
    } catch (error) {
      const reason = messageOf(error);
      deps.log(`CricAPI list failed: ${reason}`);
      return {
        source: "demo",
        note: catalogNote(reason),
        hitsToday: null,
        hitsLimit: null,
        matches: demoMatches(),
      };
    }
  }

  async function loadCricList(): Promise<{ matches: CricMatch[]; hitsToday: number | null; hitsLimit: number | null }> {
    if (cricList && deps.now() < cricList.nextAt) return cricList;
    const result = await deps.cricApi("currentMatches", { offset: "0" });
    const matches = Array.isArray(result.body.data) ? (result.body.data as CricMatch[]) : [];
    const hits = readHits(result.body.info);
    const phase: CricPhase = matches.some(started) ? "live" : "soon";
    const wait = nextCricApiDelayMs({
      hitsToday: hits.hitsToday ?? 0,
      hitsLimit: hits.hitsLimit ?? 100,
      now: deps.now(),
      phase,
      changed: true,
    });
    cricList = { nextAt: deps.now() + wait, matches, hitsToday: hits.hitsToday, hitsLimit: hits.hitsLimit };
    return cricList;
  }

  async function getMatch(id: string): Promise<MatchSnap> {
    if (isDemoMatch(id)) return demoSnap(id);
    const board = boards.get(id);
    if (board && deps.now() < board.nextAt) return board.snap;
    return once(`match:${id}`, () => refreshMatch(id));
  }

  async function refreshMatch(id: string): Promise<MatchSnap> {
    if (id.startsWith("cb-")) return refreshBuzz(id);
    if (id.startsWith("cric-")) return refreshCric(id);
    return demoSnap(id, "That match is not on a live feed. Showing the demo.");
  }

  async function refreshBuzz(id: string): Promise<MatchSnap> {
    const numeric = Number(id.slice(3));
    const previous = boards.get(id);
    try {
      const html = await deps.cricbuzzMatch(numeric);
      const snapshot = parseMatchHtml(html);
      const source = new CricbuzzDataSource(snapshot);
      const signature = `${source.meta().id}:${source.deliveries().length}:${source.deliveries().at(-1)?.seq}`;
      const changed = signature !== previous?.signature;
      const snap: MatchSnap = {
        id,
        badge: "cricbuzz",
        note: null,
        meta: source.meta(),
        deliveries: [...source.deliveries()],
        hitsToday: null,
        hitsLimit: null,
        waitMs: nextCricbuzzDelayMs({ live: snapshot.inProgress, changed, failures: 0 }),
        ended: !snapshot.inProgress,
      };
      boards.set(id, { at: deps.now(), nextAt: deps.now() + snap.waitMs, failures: 0, snap, signature });
      return snap;
    } catch (error) {
      deps.log(`Cricbuzz match ${id} failed: ${messageOf(error)}`);
      const failures = (previous?.failures ?? 0) + 1;
      const fallback = await cricFallback(id);
      if (fallback) {
        boards.set(id, { at: deps.now(), nextAt: deps.now() + fallback.waitMs, failures, snap: fallback, signature: previous?.signature ?? "" });
        return fallback;
      }
      if (previous) {
        const snap = { ...previous.snap, note: "Cricbuzz stumbled. Showing the last score we parsed.", waitMs: 30_000 };
        boards.set(id, { ...previous, failures, nextAt: deps.now() + snap.waitMs, snap });
        return snap;
      }
      return demoSnap(id, "Cricbuzz did not answer. Showing the demo until it does.");
    }
  }

  async function cricFallback(id: string): Promise<MatchSnap | null> {
    const item = buzzItems.find((match) => `cb-${match.matchId}` === id);
    if (!item) return null;
    try {
      const list = await loadCricList();
      const found = list.matches.find((match) => teamsOverlap(item, match));
      if (!found) return null;
      const built = snapshotFromMatch(found);
      return {
        id,
        badge: "cricapi",
        note: "Cricbuzz failed over. This score is the CricAPI board, about a minute behind.",
        meta: built.meta,
        deliveries: built.deliveries,
        hitsToday: list.hitsToday,
        hitsLimit: list.hitsLimit,
        waitMs: nextCricApiDelayMs({
          hitsToday: list.hitsToday ?? 0,
          hitsLimit: list.hitsLimit ?? 100,
          now: deps.now(),
          phase: "live",
          changed: true,
        }),
        ended: Boolean(found.matchEnded),
      };
    } catch (error) {
      deps.log(`CricAPI failover failed: ${messageOf(error)}`);
      return null;
    }
  }

  async function refreshCric(id: string): Promise<MatchSnap> {
    try {
      const list = await loadCricList();
      const rawId = id.slice("cric-".length);
      const found = list.matches.find((match) => match.id === rawId) ?? list.matches[0];
      if (!found) throw new Error("CricAPI returned no matches.");
      const built = snapshotFromMatch(found);
      const chase = chaseLine(Array.isArray(found.score) ? found.score : []);
      const snap: MatchSnap = {
        id,
        badge: "cricapi",
        note: "CricAPI scoreboard, about a minute behind. Ball-by-ball is not on the free tier.",
        meta: { ...built.meta, id },
        deliveries: built.deliveries,
        hitsToday: list.hitsToday,
        hitsLimit: list.hitsLimit,
        waitMs: nextCricApiDelayMs({
          hitsToday: list.hitsToday ?? 0,
          hitsLimit: list.hitsLimit ?? 100,
          now: deps.now(),
          phase: found.matchEnded ? "finished" : chase.current.legalBalls > 0 ? "live" : "soon",
          changed: true,
        }),
        ended: Boolean(found.matchEnded),
      };
      boards.set(id, { at: deps.now(), nextAt: deps.now() + snap.waitMs, failures: 0, snap, signature: String(chase.current.runs) });
      return snap;
    } catch (error) {
      deps.log(`CricAPI match failed: ${messageOf(error)}`);
      const previous = boards.get(id);
      if (previous) return { ...previous.snap, note: catalogNote(messageOf(error)) };
      return demoSnap(id, catalogNote(messageOf(error)));
    }
  }

  return { getCatalog, getMatch };
}

function demoSnap(id: string, note: string | null = null): MatchSnap {
  const loaded = loadMatchRecord(isDemoMatch(id) ? id : "harbor-cup-final");
  return {
    id: loaded.id,
    badge: "demo",
    note,
    meta: loaded.meta,
    deliveries: [...loaded.deliveries],
    hitsToday: null,
    hitsLimit: null,
    waitMs: 0,
    ended: !loaded.live,
  };
}

function buzzCatalogItem(item: CricbuzzListItem): CatalogMatch {
  return {
    id: `cb-${item.matchId}`,
    label: item.title,
    badge: "cricbuzz",
    live: true,
    detail: [item.status, item.scoreText].filter(Boolean).join(" · "),
  };
}

function cricCatalogItem(match: CricMatch): CatalogMatch {
  const built = snapshotFromMatch(match);
  return {
    id: built.meta.id,
    label: built.meta.competition,
    badge: "cricapi",
    live: !match.matchEnded,
    detail: typeof match.status === "string" ? match.status : "Scoreboard",
    meta: built.meta,
  };
}

function started(match: CricMatch): boolean {
  return match.matchStarted !== false && match.matchEnded !== true;
}

function teamsOverlap(item: CricbuzzListItem, match: CricMatch): boolean {
  const hay = `${typeof match.name === "string" ? match.name : ""} ${(Array.isArray(match.teams) ? match.teams : []).join(" ")}`.toLowerCase();
  return item.teams.every((team) => hay.includes(team.name.toLowerCase()) || hay.includes(team.short.toLowerCase()));
}

function catalogNote(reason: string): string {
  if (reason === "no-key") return "Cricbuzz did not answer, and CRICAPI_KEY is not set. Showing the demo matches.";
  if (reason === "quota") return "CricAPI quota is used for today. Showing the demo matches.";
  return "Live scores did not answer. Showing the demo matches.";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}

export const livePoller = createLivePoller({
  now: () => Date.now(),
  cricbuzzLive: () => fetchCricbuzz(CRICBUZZ_LIVE_URL),
  cricbuzzMatch: (matchId) => fetchCricbuzz(cricbuzzMatchUrl(matchId)),
  cricApi: (path, params) => cricApiGet(path, params),
  log: (message) => console.warn(`[match-pulse] ${message}`),
});
