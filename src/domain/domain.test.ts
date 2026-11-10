import { describe, expect, it } from "vitest";
import { projectFantasy } from "@/domain/fantasy";
import { FIXTURE } from "@/domain/fixture";
import { copyIsSafe, renderMoment } from "@/domain/copy";
import { POD, botPicksForOver } from "@/domain/pod";
import {
  decimalOdds,
  marketPhase,
  projectLedger,
  proposeMarkets,
  resolveMarket,
  settlePick,
  STARTING_BANK,
} from "@/domain/predictions";
import { projectInnings } from "@/domain/project";
import { createReorder, pushReorder } from "@/domain/reorder";
import { applyDelivery, emptyScore, equationFor, foldDeliveries } from "@/domain/score";
import { selectMatchView } from "@/domain/selectors";
import type { Delivery, InningsMeta, UserPick } from "@/domain/types";
import { winProbability } from "@/domain/win-prob";

function ball(partial: Partial<Delivery> & Pick<Delivery, "seq">): Delivery {
  return {
    over: 0,
    legalBall: partial.seq,
    kind: "legal",
    runsBat: 0,
    extras: 0,
    strikerId: "hk-kabir",
    nonStrikerId: "hk-arjun",
    bowlerId: "rl-imran",
    groundOffsetMs: partial.seq * 1000,
    ...partial,
  };
}

describe("fixture story", () => {
  const { meta, deliveries } = FIXTURE;

  it("plays a full chase that Harbor Kings win", () => {
    const score = foldDeliveries(deliveries, meta);
    expect(score.runs).toBe(meta.target);
    expect(score.result).toBe("won");
    expect(score.wickets).toBeLessThan(10);
    expect(deliveries[0]?.strikerId).toBe("hk-arjun");
    expect(deliveries.at(-1)?.boundary).toBe(6);
    expect(deliveries.at(-1)?.strikerId).toBe("hk-harsh");
  });

  it("dismisses the planned batters", () => {
    const outs = deliveries
      .filter((delivery) => delivery.wicket)
      .map((delivery) => `${delivery.over + 1}:${delivery.wicket?.playerOutId}:${delivery.wicket?.dismissal}`);
    expect(outs).toEqual([
      "4:hk-arjun:caught",
      "11:hk-dev:caught",
      "14:hk-kabir:lbw",
      "15:hk-ishan:bowled",
      "17:hk-vihaan:caught",
      "19:hk-rehan:runout",
    ]);
  });

  it("never bowls the same bowler in consecutive overs", () => {
    const order = meta.overs.map((over) => over.bowlerId);
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i]).not.toBe(order[i - 1]);
    }
  });
});

describe("reorder buffer", () => {
  it("ignores duplicates and flushes a reordered pair in seq order", () => {
    let buffer = createReorder<{ seq: number }>(1);
    const first = pushReorder(buffer, { seq: 2 });
    expect(first.ready).toEqual([]);
    buffer = first.buffer;
    const second = pushReorder(buffer, { seq: 2 });
    expect(second.duplicate).toBe(true);
    const third = pushReorder(second.buffer, { seq: 1 });
    expect(third.ready.map((item) => item.seq)).toEqual([1, 2]);
    expect(third.buffer.next).toBe(3);
    const again = pushReorder(third.buffer, { seq: 1 });
    expect(again.duplicate).toBe(true);
    expect(again.ready).toEqual([]);
  });
});

describe("win probability", () => {
  const { meta, deliveries } = FIXTURE;
  const start = emptyScore(meta);

  it("starts near a coin flip for a par total", () => {
    const prob = winProbability(start, meta.target);
    expect(prob).toBeGreaterThan(0.4);
    expect(prob).toBeLessThan(0.62);
  });

  it("reaches 1 on the win and falls after a wicket", () => {
    const before = foldDeliveries(deliveries.slice(0, 20), meta);
    const wicketIndex = deliveries.findIndex((delivery) => delivery.wicket);
    const prior = foldDeliveries(deliveries.slice(0, wicketIndex), meta);
    const after = foldDeliveries(deliveries.slice(0, wicketIndex + 1), meta);
    expect(winProbability(after, meta.target)).toBeLessThan(winProbability(prior, meta.target));
    expect(before.runs).toBeGreaterThan(0);
    const won = foldDeliveries(deliveries, meta);
    expect(winProbability(won, meta.target)).toBe(1);
  });

  it("is zero when the chase is lost", () => {
    const lost = { ...start, result: "lost" as const, runs: 100, wickets: 10, legalBalls: 80, ballsLeft: 40 };
    expect(winProbability(lost, meta.target)).toBe(0);
  });
});

describe("predictions", () => {
  const { meta } = FIXTURE;
  const score = emptyScore(meta);

  it("prices both sides and keeps odds off 1.00", () => {
    const markets = proposeMarkets(score, 1, meta.players.find((player) => player.id === "rl-harpreet"));
    expect(markets).toHaveLength(3);
    for (const market of markets) {
      expect(market.yesOdds).toBeGreaterThanOrEqual(1.25);
      expect(market.noOdds).toBeGreaterThanOrEqual(1.25);
      expect(market.id).toBe(`1:${market.kind}`);
    }
    expect(decimalOdds(0.5)).toBe(2);
  });

  it("opens over 1, locks on the first ball, and settles a winning stake", () => {
    expect(marketPhase(1, [], meta)).toBe("open");
    const first = FIXTURE.deliveries[0];
    expect(first).toBeDefined();
    expect(marketPhase(1, [first!], meta)).toBe("locked");
    const over = FIXTURE.deliveries.filter((delivery) => delivery.over === 0);
    expect(marketPhase(1, over, meta)).toBe("resolved");
    expect(marketPhase(2, over, meta)).toBe("open");

    const market = proposeMarkets(score, 1, undefined).find((item) => item.kind === "runs10");
    expect(market).toBeDefined();
    const outcome = resolveMarket(market!, over);
    const pick: UserPick = { marketId: market!.id, side: outcome, stake: 50, odds: 2 };
    const settlement = settlePick(pick, outcome);
    expect(settlement.won).toBe(true);
    expect(settlement.returned).toBe(100);
    const ledger = projectLedger([pick], [market!], over, "chasing");
    expect(ledger.bank).toBe(STARTING_BANK - 50 + 100);
    expect(ledger.streak).toBe(1);
  });

  it("does not pay a pick twice if the ledger is recomputed", () => {
    const market = proposeMarkets(score, 1, undefined)[0]!;
    const over = FIXTURE.deliveries.filter((delivery) => delivery.over === 0);
    const outcome = resolveMarket(market, over);
    const pick: UserPick = {
      marketId: market.id,
      side: outcome === "yes" ? "no" : "yes",
      stake: 25,
      odds: 3,
    };
    const once = projectLedger([pick], [market], over, "chasing");
    const twice = projectLedger([pick], [market], over, "chasing");
    expect(once.bank).toBe(STARTING_BANK - 25);
    expect(twice.bank).toBe(once.bank);
  });
});

describe("fantasy explanations", () => {
  const meta = FIXTURE.meta;

  it("pays a captain six as 6 runs + 2 bonus, doubled", () => {
    const view = projectFantasy(
      [ball({ seq: 1, strikerId: "hk-kabir", runsBat: 6, boundary: 6, legalBall: 1 })],
      meta,
    );
    expect(view.delta).toBe(16);
    expect(view.summary).toMatch(/Kabir Sethi \(C\)/);
    expect(view.summary).toMatch(/captain/);
  });

  it("docks a duck and does not pay the bowler for a run-out", () => {
    const duck = projectFantasy(
      [
        ball({
          seq: 1,
          strikerId: "hk-dev",
          bowlerId: "rl-neil",
          legalBall: 1,
          wicket: { playerOutId: "hk-dev", dismissal: "caught", end: "striker", fielderId: "rl-karan" },
        }),
      ],
      meta,
    );
    expect(duck.delta).toBe(-2);

    const runout = projectFantasy(
      [
        ball({
          seq: 1,
          strikerId: "hk-omar",
          bowlerId: "rl-imran",
          legalBall: 4,
          wicket: { playerOutId: "hk-omar", dismissal: "runout", end: "striker", fielderId: "rl-karan" },
        }),
      ],
      meta,
    );
    expect(runout.summary).toMatch(/does not pay the bowler/);
    expect(runout.summary).toMatch(/duck/);
    expect(runout.delta).toBe(-2);
  });

  it("pays 25 plus the lbw bonus", () => {
    const view = projectFantasy(
      [
        ball({
          seq: 1,
          strikerId: "hk-leo",
          bowlerId: "rl-imran",
          legalBall: 2,
          wicket: { playerOutId: "hk-leo", dismissal: "lbw", end: "striker" },
        }),
      ],
      meta,
    );
    expect(view.delta).toBe(33);
    expect(view.summary).toMatch(/bowled or lbw/);
  });
});

describe("copy", () => {
  it("writes a wicket card a new fan can read, with no betting language", () => {
    const { meta, deliveries } = FIXTURE;
    const projection = projectInnings(deliveries, meta);
    const wicket = projection.frames.find((frame) => frame.delivery.wicket);
    expect(wicket).toBeDefined();
    const copy = renderMoment(wicket!.context);
    expect(copy.headline.length).toBeGreaterThan(8);
    expect(copy.whisper.toLowerCase()).toMatch(/wicket/);
    expect(copy.whisper.toLowerCase()).toMatch(/required rate|win chance/);
    expect(copyIsSafe(copy)).toBe(true);
    expect(copyIsSafe({ ...copy, dek: "Put a cash bet on this wicket now." })).toBe(false);
  });
});

describe("selector log", () => {
  it("scores every ball that has arrived, including the wicket", () => {
    const { meta, deliveries } = FIXTURE;
    const wicket = deliveries.find((delivery) => delivery.wicket)!;
    const throughWicket = deliveries.filter((delivery) => delivery.seq <= wicket.seq);
    const before = selectMatchView({
      meta,
      deliveries: throughWicket.slice(0, -1),
      picks: [],
      fantasyOn: false,
      enrichments: {},
      stake: 25,
    });
    const shown = selectMatchView({
      meta,
      deliveries: throughWicket,
      picks: [],
      fantasyOn: true,
      enrichments: {},
      stake: 25,
    });
    expect(before.score?.wickets).toBe(0);
    expect(before.ballCount).toBe(wicket.seq - 1);
    expect(shown.score?.wickets).toBe(1);
    expect(shown.cards.some((card) => card.tone === "wicket")).toBe(true);
    expect(shown.fantasy?.summary.length).toBeGreaterThan(10);
    expect(shown.announcement).not.toMatch(/shield/i);
  });
});

describe("pod bots", () => {
  it("are deterministic and skip the human", () => {
    const markets = proposeMarkets(emptyScore(FIXTURE.meta), 3, undefined);
    const once = botPicksForOver(POD, markets, 3);
    const twice = botPicksForOver(POD, markets, 3);
    expect(once).toEqual(twice);
    expect(once.every((pick) => pick.memberId !== "you")).toBe(true);
    expect(once.length).toBe(POD.filter((member) => !member.you).length);
  });
});

describe("a scoreboard with no target", () => {
  it("does not read as a chase price", () => {
    const score = { ...emptyScore(FIXTURE.meta), toWin: 10000, ballsLeft: 6, runs: 12, wickets: 1, oversLabel: "2.3" };
    expect(equationFor(score)).toMatch(/no target/i);
    expect(winProbability(score, score.runs + score.toWin)).toBe(0.5);
  });
});

describe("wide and strike", () => {
  it("does not count a wide as a legal ball and does change strike on a single", () => {
    const meta: InningsMeta = FIXTURE.meta;
    const wide = ball({ seq: 1, kind: "wide", legalBall: 0, extras: 1, runsBat: 0, strikerId: "hk-arjun", nonStrikerId: "hk-dev" });
    const afterWide = applyDelivery(emptyScore(meta), wide, meta);
    expect(afterWide.legalBalls).toBe(0);
    expect(afterWide.runs).toBe(1);
    const single = ball({
      seq: 2,
      legalBall: 1,
      runsBat: 1,
      over: 0,
      strikerId: "hk-arjun",
      nonStrikerId: "hk-dev",
    });
    const afterSingle = applyDelivery(afterWide, single, meta);
    expect(afterSingle.strikerId).toBe("hk-dev");
    expect(afterSingle.legalBalls).toBe(1);
  });
});
