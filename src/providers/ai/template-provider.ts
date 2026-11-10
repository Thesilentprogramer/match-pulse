import { glossaryFor, renderMoment } from "@/domain/copy";
import type { CopyProvider, PredictionContext } from "@/providers/ai/contract";
import type { MomentContext } from "@/domain/types";

export function createTemplateProvider(): CopyProvider {
  return {
    id: "template",
    async moment(ctx: MomentContext) {
      return renderMoment(ctx);
    },
    async explain(ctx: MomentContext) {
      const copy = renderMoment(ctx);
      return { whisper: copy.whisper, terms: glossaryFor(ctx), source: "template" };
    },
    async predictions(ctx: PredictionContext) {
      return {
        source: "template",
        lines: ctx.markets.map((market) => ({
          kind: market.kind,
          prompt: market.prompt,
          detail: market.detail,
        })),
      };
    },
  };
}
