"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Clapperboard, MessageCircle, Radio, Swords, Users, WifiOff } from "lucide-react";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { LiveBadge } from "@/components/live-badge";
import { cn } from "cn";
import { toast } from "sonner";
import type { Voice } from "@/domain/grounding";
import { buildMatchStory, type MatchStory } from "@/domain/story";
import type { MomentCard } from "@/domain/types";
import { FantasyCard } from "@/components/fantasy-card";
import { PulseFeed } from "@/components/pulse-feed";
import { ReviewerDock } from "@/components/reviewer-dock";
import { Scorebug } from "@/components/scorebug";
import { MatchSummaryButton } from "@/components/match-summary";

const CompanionPanel = dynamic(() => import("@/components/companion-panel").then((mod) => mod.CompanionPanel), { ssr: false });
const OverWar = dynamic(() => import("@/components/over-war").then((mod) => mod.OverWar), { ssr: false });
const PodPanel = dynamic(() => import("@/components/pod-panel").then((mod) => mod.PodPanel), { ssr: false });
const StoryReel = dynamic(() => import("@/components/story-reel").then((mod) => mod.StoryReel), { ssr: false });
import { loadMatchRecord, matchChoices } from "@/domain/matches";
import type { InningsMeta } from "@/domain/types";
import type { CatalogMatch } from "@/providers/live/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMatchStore } from "@/state/match-store";
import { useLiveFeed } from "@/state/use-live-feed";

type Tab = "pulse" | "war" | "pod" | "ask";

export function MatchApp() {
  useLiveFeed();
  const view = useMatchStore((state) => state.view);
  const status = useMatchStore((state) => state.status);
  const detail = useMatchStore((state) => state.statusDetail);
  const meta = useMatchStore((state) => state.meta);
  const speed = useMatchStore((state) => state.speed);
  const fantasyOn = useMatchStore((state) => state.fantasyOn);
  const toggleFantasy = useMatchStore((state) => state.toggleFantasy);
  const provider = useMatchStore((state) => state.provider);
  const matchId = useMatchStore((state) => state.matchId);
  const feedBadge = useMatchStore((state) => state.feedBadge);
  const feedNote = useMatchStore((state) => state.feedNote);
  const hitsToday = useMatchStore((state) => state.hitsToday);
  const hitsLimit = useMatchStore((state) => state.hitsLimit);
  const card = useMatchStore((state) => state.card);
  const holdFeed = useMatchStore((state) => state.holdFeed);
  const [tab, setTab] = useState<Tab>("pulse");
  const [choices, setChoices] = useState<CatalogMatch[]>(() =>
    matchChoices().map((choice) => ({ id: choice.id, label: choice.label, badge: "demo" as const, live: true, detail: "" })),
  );
  const [catalogNote, setCatalogNote] = useState<string | null>(null);
  const picked = useRef(false);
  const desktop = useDesktopColumns();
  const holdDemo = useRef(typeof window !== "undefined" && window.localStorage.getItem("mp-hold-demo") === "1");
  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const response = await fetch("/api/matches", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { note?: string | null; matches?: CatalogMatch[]; hitsToday?: number | null; hitsLimit?: number | null };
        if (stop || !body.matches?.length) return;
        const ordered = [...body.matches].sort((a, b) => rank(a) - rank(b));
        setChoices(ordered);
        if (!holdDemo.current && !picked.current) {
          const live = ordered.find((match) => match.badge === "cricbuzz" && match.live);
          if (live) {
            picked.current = true;
            applyChoice(live);
          }
        }
        setCatalogNote(body.note ?? null);
        if (typeof body.hitsToday === "number") {
          const state = useMatchStore.getState();
          state.setFeedSource({ badge: state.feedBadge, note: state.feedNote, hitsToday: body.hitsToday, hitsLimit: body.hitsLimit ?? null });
        }
      } catch {
        /* the demo list stays */
      }
    }
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);
  const [voice, setVoice] = useState<Voice>("english");
  const [explain, setExplain] = useState<MomentCard | null>(null);
  const [story, setStory] = useState<MatchStory | null>(null);
  const burst = useBurst(view.latestCard, speed);
  const announce = useScoreAnnouncement(view.announcement, view.score?.wickets ?? 0, view.score?.legalBalls ?? 0);
  useBankToasts();
  useModelEnrichment(provider, view.latestContext, view.focusOver, view.focusPhase);

  function openStory() {
    const state = useMatchStore.getState();
    if (!state.meta) return;
    setStory(buildMatchStory({ meta: state.meta, deliveries: state.deliveries, picks: state.picks }));
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1240px] overflow-x-clip px-3 pt-3 pb-28 lg:px-6 lg:pb-8">
      <a href="#pulse" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to the pulse
      </a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      <header className="mb-3 grid min-w-0 gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <PulseMark />
          <div className="min-w-0 flex-1">
            <h1 className="mp-display h-9 text-3xl leading-none">Match Pulse</h1>
            <p className="h-5 truncate text-sm text-white/80">
              {meta ? `${meta.competition}${meta.city ? ` · ${meta.city}` : ""}` : "Live score, the chase, and a companion that only quotes balls you have seen."}
            </p>
            <div className="mt-1 flex h-6 items-center gap-2 overflow-x-auto">
              <span className="shrink-0">
                <SourceBadge badge={feedBadge} />
              </span>
              <span className="shrink-0">
                <StatusPill status={holdFeed ? "scorecard" : status} />
              </span>
            </div>
          </div>
        </div>
        <div id="match-choice" className="flex h-10 items-center gap-2 overflow-x-auto" role="tablist" aria-label="Matches">
          {choices.map((choice) => {
            const selected = choice.id === matchId;
            return (
              <button
                key={choice.id}
                type="button"
                role="tab"
                aria-selected={selected}
                title={choice.detail || choice.label}
                onClick={() => {
                  picked.current = true;
                  applyChoice(choice);
                }}
                className={`max-w-[14rem] shrink-0 truncate rounded-full border px-3 py-1.5 text-left text-sm ${
                  selected ? "border-[var(--mp-accent)] bg-[var(--mp-accent)] text-white" : "border-white/15 bg-black/40 text-white/85"
                }`}
              >
                {choice.badge === "cricbuzz" ? "Live · " : choice.badge === "cricapi" ? "Delayed · " : ""}
                {choice.label}
              </button>
            );
          })}
        </div>
        <div className="flex h-11 items-center gap-2 overflow-x-auto">
          <MatchSummaryButton key={matchId} />
          <Button type="button" size="sm" variant="secondary" className="h-9 rounded-full" onClick={openStory}>
            <Clapperboard />
            Story
          </Button>
          {feedBadge === "demo" ? <ReviewerDock /> : null}
        </div>
      </header>
      <div className="mb-3 h-12">
        {status === "reconnecting" || status === "error" ? (
          <p role="alert" className="flex h-12 items-center gap-2 overflow-hidden rounded-2xl border border-[var(--mp-coral)]/40 bg-[var(--mp-coral)]/10 px-3 text-sm">
            <WifiOff className="size-4 shrink-0" />
            <span className="truncate">{detail ?? "The ground link dropped."}</span>
          </p>
        ) : catalogNote || feedNote ? (
          <p role="status" className="flex h-12 items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/75">
            <span className="line-clamp-2">
              {feedNote ?? catalogNote}
              {hitsToday !== null ? ` CricAPI ${hitsToday}/${hitsLimit ?? 100} hits today.` : ""}
            </span>
          </p>
        ) : null}
      </div>
      {card ? (
        <section className="mb-4 rounded-3xl border border-white/10 bg-black/30 p-4" aria-label="Scorecard">
          <p className="text-xs tracking-[0.2em] text-[var(--mp-accent)]">SCORECARD</p>
          <ul className="mt-3 grid gap-2">
            {card.beats.slice(0, 6).map((beat) => (
              <li key={beat.id} className="text-sm text-white/80">
                <span className="mp-display text-lg text-white">{beat.title}</span>
                <span className="mt-0.5 block text-white/55">{beat.body}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className={card ? "hidden" : tab === "ask" ? "hidden lg:block" : "block"}>
      <Scorebug meta={meta} view={view} burst={burst} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-white/75">
          Pulse Points are free, not purchasable, and not redeemable.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <VoiceSwitch voice={voice} onChange={setVoice} />
          <Button type="button" size="sm" variant={fantasyOn ? "default" : "secondary"} aria-pressed={fantasyOn} onClick={() => toggleFantasy()}>
            Why points moved
          </Button>
        </div>
      </div>
      </div>
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1.1fr)_320px_300px]">
        <div id="pulse" className={tab === "pulse" || tab === "ask" ? "grid gap-4" : "hidden gap-4 lg:grid"}>
          <div className={tab === "ask" ? "hidden lg:grid lg:gap-4" : "grid gap-4"}>
            {fantasyOn ? <FantasyCard view={view} /> : null}
            {!view.ready ? <FeedSkeleton /> : <PulseFeed view={view} voice={voice} onExplain={setExplain} />}
          </div>
          {tab === "ask" || desktop ? (
            <div className={tab === "ask" ? "block" : "hidden lg:block"}>
              <CompanionPanel key={matchId} seenThroughSeq={view.latestCard?.seq ?? 0} voice={voice} matchId={matchId} />
            </div>
          ) : null}
        </div>
        <div className={cn("grid gap-4 xl:contents", tab === "pulse" && "max-lg:hidden")}>
          {tab === "war" || desktop ? (
            <div className={tab === "war" ? "block" : "hidden lg:block"}>
              <OverWar view={view} />
            </div>
          ) : null}
          {tab === "pod" || desktop ? (
            <div className={tab === "pod" ? "block" : "hidden lg:block"}>
              <PodPanel view={view} />
            </div>
          ) : null}
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[var(--mp-ink)]/95 px-3 py-2 backdrop-blur-md lg:hidden" aria-label="Sections">
        <SegmentedControl
          aria-label="Sections"
          selectedKeys={[tab]}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (next === "pulse" || next === "war" || next === "pod" || next === "ask") setTab(next);
          }}
          className="grid w-full grid-cols-4"
        >
          <SegmentedControlItem id="pulse" data-testid="tab-pulse" className="flex-col gap-0.5 py-1.5 text-[0.7rem]">
            <Radio className="size-4" />
            Balls
          </SegmentedControlItem>
          <SegmentedControlItem id="war" data-testid="tab-war" className="flex-col gap-0.5 py-1.5 text-[0.7rem]">
            <Swords className="size-4" />
            Calls
          </SegmentedControlItem>
          <SegmentedControlItem id="pod" data-testid="tab-pod" className="flex-col gap-0.5 py-1.5 text-[0.7rem]">
            <Users className="size-4" />
            Pod
          </SegmentedControlItem>
          <SegmentedControlItem id="ask" data-testid="tab-ask" className="flex-col gap-0.5 py-1.5 text-[0.7rem]">
            <MessageCircle className="size-4" />
            Ask
          </SegmentedControlItem>
        </SegmentedControl>
      </nav>
      {story ? <StoryReel story={story} onClose={() => setStory(null)} /> : null}
      <Dialog open={Boolean(explain)} onOpenChange={(open) => !open && setExplain(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="mp-display text-3xl">{explain?.headline}</DialogTitle>
            <DialogDescription>Whisper Mode · explain it like you are new.</DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-relaxed">{explain?.whisper}</p>
          <dl className="grid gap-2">
            {explain?.terms.map((term) => (
              <div key={term.term} className="rounded-xl bg-black/30 px-3 py-2">
                <dt className="text-sm font-medium">{term.term}</dt>
                <dd className="text-sm text-muted-foreground">{term.plain}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VoiceSwitch({ voice, onChange }: { voice: Voice; onChange: (voice: Voice) => void }) {
  const options: { id: Voice; label: string }[] = [
    { id: "english", label: "EN" },
    { id: "hinglish", label: "Hinglish" },
    { id: "plain", label: "Plain" },
  ];
  return (
    <div role="group" aria-label="Commentary voice" className="flex rounded-full bg-black/40 p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={voice === option.id}
          onClick={() => onChange(option.id)}
          className={`rounded-full px-2.5 py-1 text-xs ${voice === option.id ? "bg-[var(--mp-accent)] text-white" : "text-white/70"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function useDesktopColumns(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWide(media.matches);
    media.addEventListener("change", apply);
    const frame = requestAnimationFrame(apply);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", apply);
    };
  }, []);
  return wide;
}

function PulseMark() {
  return (
    <span className="grid size-11 place-items-center rounded-2xl bg-black/40 shadow-[var(--mp-elev-1)]" aria-hidden>
      <svg viewBox="0 0 32 32" className="size-7">
        <path d="M3 17h6l2.2-7 3.4 13 2.5-8H29" fill="none" stroke="var(--mp-lime)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function SourceBadge({ badge }: { badge: "cricbuzz" | "cricapi" | "demo" }) {
  if (badge === "cricbuzz") return <LiveBadge testId="source-badge" label="Live" detail="Cricbuzz" tone="rose" pulse />;
  if (badge === "cricapi") return <LiveBadge testId="source-badge" label="Delayed" detail="CricAPI" tone="yellow" />;
  return <LiveBadge testId="source-badge" label="Demo" tone="neutral" />;
}

function applyChoice(next: CatalogMatch) {
  const loadMatch = useMatchStore.getState().loadMatch;
  if (next.badge === "demo") {
    const loaded = loadMatchRecord(next.id);
    loadMatch({ id: loaded.id, live: loaded.live, meta: loaded.meta, deliveries: loaded.deliveries, card: loaded.card });
    return;
  }
  loadMatch({
    id: next.id,
    live: true,
    meta: next.meta ?? stubMeta(next.id, next.label),
    deliveries: [],
    card: null,
  });
}

function rank(match: CatalogMatch): number {
  if (match.badge === "cricbuzz" && match.live) return 0;
  if (match.badge === "cricapi") return 1;
  return 2;
}

function stubMeta(id: string, label: string): InningsMeta {
  return {
    id,
    competition: label,
    venue: "Live",
    city: "",
    toss: "Waiting for the feed",
    firstInnings: "",
    battingTeamId: "live-bat",
    bowlingTeamId: "live-bowl",
    target: 100000,
    balls: 120,
    teams: [
      { id: "live-bat", name: label, short: "LIVE", color: "#3ee0b0" },
      { id: "live-bowl", name: "Opposition", short: "OPP", color: "#ff6a45" },
    ],
    players: [],
    battingOrder: [],
    overs: [],
    overStarts: [],
    fantasy: { name: "No XI on this feed", slots: [] },
  };
}

function StatusPill({ status }: { status: string }) {
  const live = status === "live" || status === "ended";
  return (
    <span data-testid="feed-status" className="mp-kicker inline-flex items-center gap-1.5 whitespace-nowrap text-white/75">
      <span className={`size-1.5 rounded-full ${live ? "bg-[var(--mp-lime)]" : "bg-[var(--mp-gold)]"}`} />
      {status === "live" ? "In play" : status === "connecting" ? "Linking" : status === "reconnecting" ? "Reconnecting" : status === "scorecard" ? "Final" : status === "ended" ? "Final" : status === "error" ? "No link" : status}
    </span>
  );
}

function FeedSkeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading the balls">
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

function useBurst(card: MomentCard | null, speed: number): "six" | "wicket" | "result" | null {
  const [burst, setBurst] = useState<"six" | "wicket" | "result" | null>(null);
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (!card || speed >= 20) return;
    if (card.tone !== "six" && card.tone !== "wicket" && card.tone !== "result") return;
    if (seen.current === card.seq) return;
    seen.current = card.seq;
    setBurst(card.tone);
    const timer = window.setTimeout(() => setBurst(null), 1600);
    return () => window.clearTimeout(timer);
  }, [card, speed]);
  return burst;
}

function useScoreAnnouncement(text: string, wickets: number, legalBalls: number): string {
  const [live, setLive] = useState(text);
  const prev = useRef({ wickets: -1, over: -1 });
  useEffect(() => {
    const over = Math.floor(legalBalls / 6);
    const before = prev.current;
    if (before.wickets !== wickets || before.over !== over || before.wickets === -1) {
      setLive(text);
    }
    prev.current = { wickets, over };
  }, [legalBalls, text, wickets]);
  return live;
}

function useBankToasts(): void {
  const bank = useMatchStore((state) => state.view.ledgerBank);
  const epoch = useMatchStore((state) => state.uiEpoch);
  const prev = useRef<number | null>(null);
  const epochSeen = useRef(epoch);
  useEffect(() => {
    if (epoch !== epochSeen.current) {
      epochSeen.current = epoch;
      prev.current = bank;
      return;
    }
    if (prev.current === null) {
      prev.current = bank;
      return;
    }
    const delta = bank - prev.current;
    if (delta > 0 && delta <= 400) toast.success(`Called it. +${delta} Pulse Points`);
    if (delta < 0 && delta >= -100) toast(`Locked ${Math.abs(delta)} Pulse Points`);
    prev.current = bank;
  }, [bank, epoch]);
}

function useModelEnrichment(
  provider: string,
  context: ReturnType<typeof useMatchStore.getState>["view"]["latestContext"],
  focusOver: number | null,
  phase: string,
): void {
  const asked = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (provider === "template" || provider === "unknown" || !context) return;
    if (asked.current.has(context.seq)) return;
    asked.current.add(context.seq);
    void fetch("/api/ai/moment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(context),
    })
      .then((response) => response.json())
      .then((copy: { headline?: string; dek?: string; why?: string; whisper?: string; source?: string }) => {
        if (copy.source !== "model") return;
        useMatchStore.getState().enrich(context.seq, {
          headline: copy.headline,
          dek: copy.dek,
          why: copy.why,
          whisper: copy.whisper,
          source: "model",
        });
      })
      .catch(() => undefined);
  }, [context, provider]);

  useEffect(() => {
    if (provider === "template" || provider === "unknown" || phase !== "open" || !focusOver) return;
    const markets = useMatchStore.getState().view.markets;
    if (markets.length === 0) return;
    void fetch("/api/ai/predictions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        over: focusOver,
        bowlerName: "Bowler",
        equation: useMatchStore.getState().view.equation,
        phase: "open",
        markets: markets.map((item) => ({
          kind: item.market.kind,
          yesProb: item.market.yesProb,
          prompt: item.market.prompt,
          detail: item.market.detail,
        })),
      }),
    })
      .then((response) => response.json())
      .then((body: { source?: string; lines?: { kind: "wicket"; prompt: string; detail: string }[] }) => {
        if (body.source === "model" && body.lines) useMatchStore.getState().setPredictionLines(body.lines);
      })
      .catch(() => undefined);
  }, [focusOver, phase, provider]);
}
