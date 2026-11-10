"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { STAKE_CHOICES } from "@/domain/predictions";
import type { MatchView } from "@/domain/selectors";
import { useMatchStore } from "@/state/match-store";
import { Button } from "@/components/ui/button";

export function OverWar({ view }: { view: MatchView }) {
  const reduce = useReducedMotion();
  const stake = useMatchStore((state) => state.stake);
  const setStake = useMatchStore((state) => state.setStake);
  const placePick = useMatchStore((state) => state.placePick);
  const phase = view.focusPhase;

  return (
    <section aria-label="Over-War" className="mp-glass rounded-3xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mp-kicker text-[var(--mp-gold)]">Over-War</p>
          <h2 className="mp-display mt-1 text-4xl">
            {view.focusOver ? `Over ${view.focusOver}` : "Between overs"}
          </h2>
        </div>
        <div className="text-right">
          <p className="mp-kicker text-white/40">Pulse Points</p>
          <p className="font-mono text-lg text-[var(--mp-gold)] tabular-nums">{view.ledgerBank}</p>
          {view.streak > 1 ? <p className="text-xs text-white/60">{view.streak} straight</p> : null}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Free calls. They lock when the over starts on your stream, then settle with the last ball.
      </p>
      <div className="mt-3 flex gap-2" role="group" aria-label="Stake">
        {STAKE_CHOICES.map((amount) => (
          <Button
            key={amount}
            type="button"
            size="sm"
            variant={stake === amount ? "default" : "secondary"}
            aria-pressed={stake === amount}
            onClick={() => setStake(amount)}
          >
            {amount}
          </Button>
        ))}
      </div>
      <div className="mt-4 grid gap-3">
        {view.markets.length === 0 ? (
          <p className="rounded-2xl bg-black/25 px-3 py-6 text-center text-sm text-muted-foreground">
            {phase === "waiting" ? "Calls open in the break before the next over." : "Reading the over."}
          </p>
        ) : (
          view.markets.map((item) => {
            const locked = item.phase === "locked";
            const resolved = item.phase === "resolved";
            return (
              <article key={item.market.id} className="relative overflow-hidden rounded-2xl bg-black/25 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-medium">{item.market.prompt}</h3>
                  {resolved && item.pick ? (
                    <span className={`mp-kicker ${item.profit !== null && item.profit >= 0 ? "text-[var(--mp-lime)]" : "text-[var(--mp-coral)]"}`}>
                      {item.profit !== null && item.profit >= 0 ? "In" : "Miss"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/55">{item.market.detail}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <CallButton
                    label="Yes"
                    odds={item.market.yesOdds}
                    pressed={item.pick?.side === "yes"}
                    disabled={item.phase !== "open" || Boolean(item.pick)}
                    onClick={() => {
                      const reason = placePick(item.market.id, "yes");
                      if (reason) toast(reason);
                    }}
                  />
                  <CallButton
                    label="No"
                    odds={item.market.noOdds}
                    pressed={item.pick?.side === "no"}
                    disabled={item.phase !== "open" || Boolean(item.pick)}
                    onClick={() => {
                      const reason = placePick(item.market.id, "no");
                      if (reason) toast(reason);
                    }}
                  />
                </div>
                <AnimatePresence>
                  {locked ? (
                    <motion.div
                      className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[2px]"
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <p className="mp-kicker flex items-center gap-2 text-white">
                        <Lock className="size-3.5" /> Locked · ball in play
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </article>
            );
          })
        )}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-white/45">
        Pulse Points are free. They cannot be bought, cashed out, or turned into DreamBucks.
      </p>
    </section>
  );
}

function CallButton({
  label,
  odds,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  odds: number;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={label === "Yes" ? "market-yes" : "market-no"}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-14 items-center justify-between rounded-xl px-3 text-left font-medium transition disabled:opacity-60 ${
        pressed ? "bg-[var(--mp-accent)] text-white" : "bg-white/10 text-white hover:bg-white/15"
      }`}
    >
      <span>{label}</span>
      <span className="font-mono text-sm tabular-nums">{odds.toFixed(2)}</span>
    </button>
  );
}
