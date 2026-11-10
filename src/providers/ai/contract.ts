import type { ExplainCopy, MarketKind, MomentContext, MomentCopy, PredictionCopy } from "@/domain/types";

export interface PredictionContext {
  over: number;
  bowlerName: string;
  equation: string;
  phase: string;
  markets: { kind: MarketKind; yesProb: number; prompt: string; detail: string }[];
}

/**
 * The only thing a model is allowed to change is language.
 * Probabilities, resolution, and points stay in the domain.
 */
export interface CopyProvider {
  readonly id: "template" | "openai" | "gateway";
  moment(ctx: MomentContext): Promise<MomentCopy>;
  explain(ctx: MomentContext): Promise<ExplainCopy>;
  predictions(ctx: PredictionContext): Promise<PredictionCopy>;
}
