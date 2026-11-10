import type { ScoreState } from "@/domain/types";

/**
 * A transparent chase model, not a betting price.
 *
 * Expected scoring rate starts at a par T20 rate and falls as wickets fall.
 * The death overs get a hitting bump. Win chance is a logistic of
 * (expected remaining runs − runs still needed), scaled so early overs
 * move gently and the last two overs move a lot.
 */
export function winProbability(score: ScoreState, target: number): number {
  if (score.result === "won" || score.runs >= target) return 1;
  if (score.result === "lost") return 0;
  if (score.result === "tied") return 0.5;

  const balls = score.ballsLeft;
  const wicketsLeft = 10 - score.wickets;
  if (balls <= 0 || wicketsLeft <= 0) return 0;
  const need = target - score.runs;
  if (need <= 0) return 1;
  if (need > 5000) return 0.5;

  const deathBoost = (balls <= 24 ? 1.15 : 0) + (balls <= 12 ? 1.05 : 0);
  const expectedRpo = clamp(9.55 - score.wickets * 0.42 + deathBoost, 3.5, 13);
  const expected = (balls / 6) * expectedRpo;
  const diff = expected - need;
  const scale = 7.5 + balls * 0.11;
  const probability = 1 / (1 + Math.exp(-diff / scale));
  return clamp(probability, 0.01, 0.99);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
