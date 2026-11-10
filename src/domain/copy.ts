import { containsBannedLanguage } from "@/domain/guard";
import { formatPct, formatRate } from "@/domain/score";
import type { GlossaryTerm, MomentCard, MomentContext, MomentCopy } from "@/domain/types";

export function glossaryFor(ctx: MomentContext): GlossaryTerm[] {
  const terms: GlossaryTerm[] = [];
  if (ctx.dismissal || ctx.tone === "wicket") {
    terms.push({
      term: "Wicket",
      plain: "The batter is out. The bowling side is one step closer to ending the innings.",
    });
  }
  if (ctx.boundary === 6 || ctx.tone === "six") {
    terms.push({
      term: "Six",
      plain: "The ball cleared the rope on the full. It counts as six runs, no running needed.",
    });
  }
  if (ctx.boundary === 4) {
    terms.push({
      term: "Four",
      plain: "The ball reached the boundary along the ground. Four runs.",
    });
  }
  if (ctx.rrr !== null) {
    terms.push({
      term: "Required rate",
      plain: "How many runs the chasing side needs per over from this moment. Higher means the chase is getting harder.",
    });
  }
  terms.push({
    term: "Win chance",
    plain: "A simple model of how often a chase in this spot gets home. It is not a price and it is not money.",
  });
  if (ctx.phase === "powerplay") {
    terms.push({
      term: "Powerplay",
      plain: "The first six overs, with only two fielders outside the circle. Easier to find a boundary.",
    });
  }
  if (ctx.phase === "death") {
    terms.push({
      term: "Death overs",
      plain: "The last five overs. This is where matches swing, because every ball is worth more.",
    });
  }
  return terms;
}

export function renderMoment(ctx: MomentContext): MomentCopy {
  const name = ctx.playerName;
  const last = name.split(" ").slice(-1)[0] ?? name;
  const swing = describeSwing(ctx.winDelta);
  const equation = ctx.equation;

  let headline = `${last} works it around`;
  if (ctx.result === "won") headline = `${ctx.battingTeam} finish it`;
  else if (ctx.tone === "wicket") headline = `${last} is gone`;
  else if (ctx.tone === "six") headline = `${last} goes the distance`;
  else if (ctx.tone === "boundary") headline = `${last} finds the rope`;
  else if (ctx.tone === "dot" && (ctx.rrr ?? 0) >= 11) headline = "A dot they could not spare";
  else if (ctx.tone === "dot") headline = `${ctx.bowlerName.split(" ").slice(-1)[0] ?? "The bowler"} wins the ball`;
  else if (ctx.runsBat >= 2) headline = `${last} keeps the strike moving`;

  const shot = ctx.note ? `${ctx.note} ` : "";
  const dek =
    ctx.result === "won"
      ? `${shot}${ctx.battingTeam} are home. ${ctx.scoreLabel}.`
      : `${shot}${ctx.scoreLabel}. ${equation}.`;

  const whyBits = [swing];
  if (ctx.rrr !== null && ctx.result === "chasing") {
    whyBits.push(`The chase now wants ${formatRate(ctx.rrr)} an over, with ${ctx.wicketsInHand} wickets in hand.`);
  }
  if (ctx.tone === "wicket") {
    whyBits.push("A new batter walks in cold. That is the swing, more than the runs on the ball.");
  } else if (ctx.tone === "six" || ctx.tone === "boundary") {
    whyBits.push("A boundary changes the rate faster than a single, which is why the win chance moved.");
  } else if (ctx.phase === "death") {
    whyBits.push("This late, one quiet ball shows up in the win chance.");
  }
  const why = whyBits.join(" ");

  const whisper = [
    `Here is the plain version. ${headline.endsWith("it") ? ctx.battingTeam + " have reached the target." : name + " was the batter on strike."}`,
    ctx.tone === "wicket"
      ? `A wicket means ${last} is out${ctx.dismissal ? ` (${ctx.dismissal})` : ""}. The new batter starts on zero, so the chase just got harder even if the scoreboard barely moved.`
      : ctx.tone === "six"
        ? "A six is the biggest legal score off one ball. Fans yell because it knocks the required rate down in one shot."
        : ctx.tone === "dot"
          ? "A dot ball scores nothing. In a chase, dots are how the bowling side steals the over."
          : "They took the runs that were there. Singles keep the scoreboard moving without the risk of a catch.",
    ctx.rrr !== null
      ? `Required rate is ${formatRate(ctx.rrr)}. That is runs needed divided by overs left. Win chance is ${formatPct(ctx.winProb)}. It is a model of the chase, not a price.`
      : `Win chance is ${formatPct(ctx.winProb)}. It is a model of the chase, not a price.`,
  ].join(" ");

  return { headline, dek, why, whisper, source: "template" };
}

export function cardFromCopy(ctx: MomentContext, copy: MomentCopy, playerId: string): MomentCard {
  return {
    id: `ball-${ctx.seq}`,
    seq: ctx.seq,
    overLabel: ctx.overLabel,
    tone: ctx.tone,
    kicker: kickerFor(ctx),
    headline: copy.headline,
    dek: copy.dek,
    why: copy.why,
    playerId,
    playerName: ctx.playerName,
    winProb: ctx.winProb,
    winDelta: ctx.winDelta,
    equation: ctx.equation,
    whisper: copy.whisper,
    terms: glossaryFor(ctx),
    battingTeam: ctx.battingTeam,
    runsBat: ctx.runsBat,
    result: ctx.result,
  };
}

export function copyIsSafe(copy: Pick<MomentCopy, "headline" | "dek" | "why" | "whisper">): boolean {
  const blob = `${copy.headline}\n${copy.dek}\n${copy.why}\n${copy.whisper}`;
  if (containsBannedLanguage(blob)) return false;
  if (copy.headline.trim().length < 8 || copy.headline.length > 90) return false;
  if (copy.dek.trim().length < 12 || copy.dek.length > 280) return false;
  if (copy.why.trim().length < 12 || copy.why.length > 360) return false;
  if (copy.whisper.trim().length < 40 || copy.whisper.length > 900) return false;
  return true;
}

function kickerFor(ctx: MomentContext): string {
  const label = ctx.overLabel.replace(".", ".");
  if (ctx.result === "won") return `OVER ${label} · RESULT`;
  if (ctx.tone === "wicket") return `OVER ${label} · WICKET`;
  if (ctx.tone === "six") return `OVER ${label} · SIX`;
  if (ctx.tone === "boundary") return `OVER ${label} · FOUR`;
  if (ctx.tone === "dot") return `OVER ${label} · DOT`;
  return `OVER ${label}`;
}

function describeSwing(delta: number): string {
  const points = Math.abs(Math.round(delta * 100));
  if (points === 0) return "Win chance barely budged.";
  return delta > 0
    ? `Win chance is up ${points} point${points === 1 ? "" : "s"}.`
    : `Win chance drops ${points} point${points === 1 ? "" : "s"}.`;
}

export function toneFor(ctx: Pick<MomentContext, "result" | "dismissal" | "boundary" | "runsBat" | "tone">): MomentCard["tone"] {
  if (ctx.result === "won") return "result";
  if (ctx.dismissal) return "wicket";
  if (ctx.boundary === 6) return "six";
  if (ctx.boundary === 4) return "boundary";
  if (ctx.runsBat === 0) return "dot";
  return "run";
}
