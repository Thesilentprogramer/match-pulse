import { describe, expect, it } from "vitest";
import { renderCommentary } from "@/domain/commentary";
import { FIXTURE } from "@/domain/fixture";
import {
  allowedNumberTokens,
  answerFromSnapshot,
  buildGroundedSnapshot,
  validateGroundedAnswer,
} from "@/domain/grounding";
import { buildMatchStory } from "@/domain/story";
import { projectInnings } from "@/domain/project";
import { foldDeliveries } from "@/domain/score";

const meta = FIXTURE.meta;

describe("grounding", () => {
  const early = FIXTURE.deliveries.slice(0, 8);
  const snapshot = buildGroundedSnapshot(meta, early);
  const allowed = allowedNumberTokens(snapshot);

  it("does not include a later wicket in the snapshot", () => {
    const later = FIXTURE.deliveries.find((delivery) => delivery.wicket);
    expect(later).toBeDefined();
    expect(snapshot.seenThroughSeq).toBeLessThan(later!.seq);
    expect(snapshot.wickets).toBe(0);
  });

  it("answers the chase from the received log only", () => {
    const text = answerFromSnapshot("what does my team need?", snapshot, "english");
    expect(validateGroundedAnswer(text, allowed).ok).toBe(true);
    expect(text).toContain(String(snapshot.toWin));
    expect(text).toContain(String(snapshot.ballsLeft));
  });

  it("explains DLS without inventing a target", () => {
    const text = answerFromSnapshot("explain DLS", snapshot, "plain");
    expect(text.toLowerCase()).toContain("rain");
    expect(validateGroundedAnswer(text, allowed).ok).toBe(true);
    expect(text).not.toMatch(/\d/);
  });

  it("refuses a bowler who is not in the log", () => {
    const text = answerFromSnapshot("why did they bring Bumrah on?", snapshot, "english");
    expect(text.toLowerCase()).not.toContain("bumrah is bowling");
    expect(validateGroundedAnswer(text, allowed).ok).toBe(true);
  });

  it("rejects betting language and numbers that were not in the tool payload", () => {
    expect(validateGroundedAnswer("Put a bet on the next ball.", allowed).ok).toBe(false);
    expect(validateGroundedAnswer("Win chance is 99 percent.", allowed).ok).toBe(snapshot.winPercent === 99);
    const fake = validateGroundedAnswer("They need 400 from 3.", allowed);
    expect(fake.ok).toBe(false);
    if (!fake.ok) expect(fake.reason).toMatch(/ungrounded-number/);
  });

  it("accepts the hinglish chase line", () => {
    const text = answerFromSnapshot("required rate kya hai", snapshot, "hinglish");
    expect(validateGroundedAnswer(text, allowed).ok).toBe(true);
  });
});

describe("commentary voices", () => {
  it("quotes the moment win chance in each voice", () => {
    const projection = projectInnings(FIXTURE.deliveries.slice(0, 20), meta);
    const frame = projection.frames.at(-1)!;
    const allowed = allowedNumberTokens(buildGroundedSnapshot(meta, FIXTURE.deliveries.slice(0, 20)));
    for (const voice of ["english", "hinglish", "plain"] as const) {
      const line = renderCommentary(frame.context, voice);
      expect(line.length).toBeGreaterThan(8);
      expect(validateGroundedAnswer(line, allowed).ok).toBe(true);
    }
  });
});

describe("match story", () => {
  it("builds a recap from the log and stays behind a partial timeline", () => {
    const full = buildMatchStory({ meta, deliveries: FIXTURE.deliveries, picks: [] });
    const score = foldDeliveries(FIXTURE.deliveries, meta);
    expect(full.beats.at(-1)?.title).toMatch(/win/i);
    expect(full.beats.some((beat) => beat.stat.includes(String(meta.target)) || beat.title.includes(String(meta.target)))).toBe(true);
    expect(full.beats.map((beat) => beat.body + beat.title).join(" ").toLowerCase()).not.toMatch(/\bbet\b/);
    expect(full.winSeries.length).toBeGreaterThan(2);
    expect(full.mvp.name.length).toBeGreaterThan(1);
    expect(full.introClipUrl).toBeNull();

    const partial = buildMatchStory({ meta, deliveries: FIXTURE.deliveries.slice(0, 12), picks: [] });
    expect(partial.beats.at(-1)?.kicker).toBe("So far");
    expect(partial.beats.at(-1)?.title).not.toBe(`${score.runs}/${score.wickets}`);
  });

  it("records a hit when the user called the resolved over", () => {
    const over = FIXTURE.deliveries.filter((delivery) => delivery.over === 0);
    const story = buildMatchStory({
      meta,
      deliveries: over,
      picks: [{ marketId: "1:runs10", side: "yes", stake: 25, odds: 2 }],
    });
    const calls = story.beats.find((beat) => beat.id === "calls");
    expect(calls?.body).toContain("1000");
  });
});
