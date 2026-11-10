"use client";

import { Sparkles } from "lucide-react";
import type { Voice } from "@/domain/grounding";
import type { MomentCard } from "@/domain/types";
import type { MatchView } from "@/domain/selectors";
import { MomentCardView } from "@/components/moment-card";

export function PulseFeed({
  view,
  voice,
  onExplain,
}: {
  view: MatchView;
  voice: Voice;
  onExplain: (card: MomentCard) => void;
}) {
  const cards = [...view.cards].reverse();

  return (
    <section aria-label="Pulse feed" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="mp-display text-3xl">Pulse</h2>
          <p className="text-sm text-white/70">What just happened. Long-press a card for Whisper Mode.</p>
        </div>
      </div>
      {view.ready && view.ballCount === 0 ? (
        <div className="grid gap-3">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : null}
      {cards.length === 0 && view.ballCount > 0 ? (
        <p className="text-sm text-muted-foreground">The over is quiet. Cards land after each ball.</p>
      ) : null}
      <div className="flex flex-col gap-3">
        {cards.map((card) => (
          <MomentCardView key={card.id} card={card} voice={voice} onExplain={onExplain} />
        ))}
      </div>
      {view.result === "won" || view.result === "lost" || view.result === "tied" ? (
        <div className="mp-glass flex items-center gap-3 rounded-3xl px-4 py-4">
          <Sparkles className="text-[var(--mp-lime)]" />
          <div>
            <p className="mp-kicker text-white/45">Full time</p>
            <p className="mp-display text-3xl">{view.equation}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Skeleton() {
  return <div className="h-36 animate-pulse rounded-3xl bg-white/5 motion-reduce:animate-none" />;
}
