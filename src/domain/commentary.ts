import type { Voice } from "@/domain/grounding";
import { formatPct } from "@/domain/score";
import type { MomentContext } from "@/domain/types";

type CommentaryInput = Pick<
  MomentContext,
  "result" | "tone" | "playerName" | "winProb" | "equation" | "battingTeam" | "runsBat"
>;

/** One line of live commentary. Numbers come only from this ball's moment. */
export function renderCommentary(ctx: CommentaryInput, voice: Voice): string {
  const last = ctx.playerName.split(" ").slice(-1)[0] ?? ctx.playerName;
  const pct = formatPct(ctx.winProb);
  if (ctx.result === "won") {
    if (voice === "hinglish") return `${ctx.battingTeam} ne chase khatam kiya. ${ctx.equation}.`;
    if (voice === "plain") return `${ctx.battingTeam} reached the target. ${ctx.equation}.`;
    return `${ctx.battingTeam} finish it. ${ctx.equation}.`;
  }
  if (ctx.tone === "wicket") {
    if (voice === "hinglish") return `${last} out. Win chance ${pct}. ${ctx.equation}.`;
    if (voice === "plain") return `${last} is out. The model now says ${pct}. ${ctx.equation}.`;
    return `${last} goes. Win chance ${pct}. ${ctx.equation}.`;
  }
  if (ctx.tone === "six") {
    if (voice === "hinglish") return `${last} ne six mara. Win chance ${pct}. ${ctx.equation}.`;
    if (voice === "plain") return `${last} hits a six, the biggest score off one ball. Win chance ${pct}. ${ctx.equation}.`;
    return `Six from ${last}. Win chance ${pct}. ${ctx.equation}.`;
  }
  if (ctx.tone === "boundary") {
    if (voice === "hinglish") return `${last} ne four lagaya. Win chance ${pct}. ${ctx.equation}.`;
    if (voice === "plain") return `${last} hits the ball to the rope for four. Win chance ${pct}. ${ctx.equation}.`;
    return `Four by ${last}. Win chance ${pct}. ${ctx.equation}.`;
  }
  if (ctx.tone === "dot") {
    if (voice === "hinglish") return `Dot ball. Win chance ${pct}. ${ctx.equation}.`;
    if (voice === "plain") return `That ball scored nothing. Win chance ${pct}. ${ctx.equation}.`;
    return `Dot. Win chance ${pct}. ${ctx.equation}.`;
  }
  if (voice === "hinglish") return `${last} ne ${ctx.runsBat} liye. Win chance ${pct}. ${ctx.equation}.`;
  if (voice === "plain") return `${last} scores ${ctx.runsBat}. Win chance ${pct}. ${ctx.equation}.`;
  return `${ctx.runsBat} to ${last}. Win chance ${pct}. ${ctx.equation}.`;
}
