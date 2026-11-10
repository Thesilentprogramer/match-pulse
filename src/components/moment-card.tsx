"use client";

import { useRef } from "react";
import { Sparkles } from "lucide-react";
import { renderCommentary } from "@/domain/commentary";
import type { Voice } from "@/domain/grounding";
import type { MomentCard as Card } from "@/domain/types";
import { formatPct } from "@/domain/score";
import { Button } from "@/components/ui/button";

const toneBar: Record<Card["tone"], string> = {
  six: "bg-[var(--mp-lime)]",
  boundary: "bg-[var(--mp-teal)]",
  wicket: "bg-[var(--mp-coral)]",
  dot: "bg-white/20",
  run: "bg-white/30",
  extra: "bg-[var(--mp-gold)]",
  result: "bg-[var(--mp-lime)]",
};

export function MomentCardView({
  card,
  voice,
  onExplain,
}: {
  card: Card;
  voice: Voice;
  onExplain: (card: Card) => void;
}) {
  const timer = useRef<number | null>(null);

  return (
    <article
      data-testid="moment-card"
      className="mp-card mp-rise mp-glass relative min-h-72 overflow-hidden rounded-3xl"
      onPointerDown={() => {
        timer.current = window.setTimeout(() => onExplain(card), 480);
      }}
      onPointerUp={() => {
        if (timer.current) window.clearTimeout(timer.current);
      }}
      onPointerLeave={() => {
        if (timer.current) window.clearTimeout(timer.current);
      }}
    >
      <div className={`absolute inset-y-0 left-0 w-1.5 ${toneBar[card.tone]}`} />
      <div className="px-4 py-4 pl-5">
        <p className="mp-kicker text-white/45">{card.kicker}</p>
        <h3 className="mp-display mt-2 text-4xl text-white">{card.headline}</h3>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-white">{renderCommentary(card, voice)}</p>
        <p className="mt-2 text-sm leading-relaxed text-white/80">{card.dek}</p>
        <p className="mt-3 rounded-2xl bg-black/40 px-3 py-2 text-sm leading-relaxed text-white/80">{card.why}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="font-mono text-xs text-[var(--mp-lime)] tabular-nums">
            {formatPct(card.winProb)}
            <span className={card.winDelta >= 0 ? "text-[var(--mp-teal)]" : "text-[var(--mp-coral)]"}>
              {" "}
              {card.winDelta >= 0 ? "+" : ""}
              {Math.round(card.winDelta * 100)}
            </span>
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onExplain(card)}
            aria-label={`Explain ${card.headline} like I'm new`}
          >
            <Sparkles />
            Whisper
          </Button>
        </div>
      </div>
    </article>
  );
}
