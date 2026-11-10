"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Clapperboard, MessageCircle, Radio, Swords, Users, WifiOff } from "lucide-react";
import { cn } from "cn";
import { toast } from "sonner";
import type { Voice } from "@/domain/grounding";
import { buildMatchStory, type MatchStory } from "@/domain/story";
import type { MomentCard } from "@/domain/types";
import { CompanionPanel } from "@/components/companion-panel";
import { FantasyCard } from "@/components/fantasy-card";
import { OverWar } from "@/components/over-war";
import { PodPanel } from "@/components/pod-panel";
import { PulseFeed } from "@/components/pulse-feed";
import { ReviewerDock } from "@/components/reviewer-dock";
import { Scorebug } from "@/components/scorebug";
import { MatchSummaryButton } from "@/components/match-summary";
import { StoryReel } from "@/components/story-reel";
import { loadMatchRecord, matchChoices } from "@/domain/matches";
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
  const card = useMatchStore((state) => state.card);
  const holdFeed = useMatchStore((state) => state.holdFeed);
  const loadMatch = useMatchStore((state) => state.loadMatch);
  const [tab, setTab] = useState<Tab>("pulse");
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
    <div className="mx-auto min-h-dvh w-full max-w-[1240px] px-3 pt-3 pb-28 lg:px-6 lg:pb-8">
      <a href="#pulse" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to the pulse
      </a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PulseMark />
          <div>
            <h1 className="mp-display text-3xl leading-none">Match Pulse</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {meta ? `${meta.competition} · ${meta.venue}, ${meta.city}` : "Linking Marina Oval"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={holdFeed ? "scorecard" : status} />
          <label className="sr-only" htmlFor="match-choice">
            Match
          </label>
          <select
            id="match-choice"
            className="h-9 rounded-full border border-white/15 bg-black/40 px-3 text-sm"
            value={matchId}
            onChange={(event) => {
              const next = loadMatchRecord(event.target.value);
              loadMatch({ id: next.id, live: next.live, meta: next.meta, deliveries: next.deliveries, card: next.card });
            }}
          >
            {matchChoices().map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
          <MatchSummaryButton />
          <Button type="button" size="sm" variant="secondary" className="h-9 rounded-full" onClick={openStory}>
            <Clapperboard />
            Story
          </Button>
          <ReviewerDock />
        </div>
      </header>
      {status === "reconnecting" || status === "error" ? (
        <p role="alert" className="mb-3 flex items-center gap-2 rounded-2xl border border-[var(--mp-coral)]/40 bg-[var(--mp-coral)]/10 px-3 py-2 text-sm">
          <WifiOff className="size-4 shrink-0" />
          {detail ?? "The ground link dropped."}
        </p>
      ) : null}
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
        <p className="text-xs text-white/45">
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
          <div className={tab === "ask" ? "block" : "hidden lg:block"}>
            <CompanionPanel seenThroughSeq={view.latestCard?.seq ?? 0} voice={voice} />
          </div>
        </div>
        <div className={cn("grid gap-4 xl:contents", tab === "pulse" && "max-lg:hidden")}>
          <div className={tab === "war" ? "block" : "hidden lg:block"}>
            <OverWar view={view} />
          </div>
          <div className={tab === "pod" ? "block" : "hidden lg:block"}>
            <PodPanel view={view} />
          </div>
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[var(--mp-ink)]/90 px-3 py-2 backdrop-blur-md lg:hidden" aria-label="Sections">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          <TabButton id="pulse" current={tab} icon={<Radio />} label="Pulse" onSelect={setTab} />
          <TabButton id="war" current={tab} icon={<Swords />} label="War" onSelect={setTab} />
          <TabButton id="pod" current={tab} icon={<Users />} label="Pod" onSelect={setTab} />
          <TabButton id="ask" current={tab} icon={<MessageCircle />} label="Ask" onSelect={setTab} />
        </div>
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

function TabButton({
  id,
  current,
  icon,
  label,
  onSelect,
}: {
  id: Tab;
  current: Tab;
  icon: ReactNode;
  label: string;
  onSelect: (tab: Tab) => void;
}) {
  const selected = current === id;
  return (
    <button
      type="button"
      data-testid={`tab-${id}`}
      aria-current={selected ? "page" : undefined}
      onClick={() => onSelect(id)}
      className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.7rem] ${selected ? "bg-[var(--mp-accent)] text-white" : "text-white/70"}`}
    >
      {icon}
      {label}
    </button>
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

function PulseMark() {
  return (
    <span className="grid size-11 place-items-center rounded-2xl bg-black/40 shadow-[var(--mp-elev-1)]" aria-hidden>
      <svg viewBox="0 0 32 32" className="size-7">
        <path d="M3 17h6l2.2-7 3.4 13 2.5-8H29" fill="none" stroke="var(--mp-lime)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const live = status === "live" || status === "ended";
  return (
    <span data-testid="feed-status" className="mp-kicker inline-flex items-center gap-1.5 text-white/50">
      <span className={`size-1.5 rounded-full ${live ? "bg-[var(--mp-lime)]" : "bg-[var(--mp-gold)]"}`} />
      {status}
    </span>
  );
}

function FeedSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden>
      <div className="h-40 animate-pulse rounded-3xl bg-white/5 motion-reduce:animate-none" />
      <div className="h-40 animate-pulse rounded-3xl bg-white/5 motion-reduce:animate-none" />
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
