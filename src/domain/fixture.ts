import { creaseAfter, openingCrease } from "@/domain/crease";
import { PACE } from "@/domain/pacing";
import type { Delivery, Dismissal, InningsMeta, Player, Team } from "@/domain/types";

const HARBOR = "harbor";
const RIDGE = "ridge";

const teams: Team[] = [
  { id: HARBOR, name: "Harbor Kings", short: "KINGS", color: "#3ee0b0" },
  { id: RIDGE, name: "Ridge Lions", short: "LIONS", color: "#ff6a45" },
];

function player(
  id: string,
  name: string,
  role: Player["role"],
  teamId: string,
  extra: Partial<Player> = {},
): Player {
  return { id, name, role, teamId, ...extra };
}

const players: Player[] = [
  player("hk-arjun", "Arjun Mehta", "bat", HARBOR, { batStyle: "right-hand" }),
  player("hk-dev", "Dev Kapoor", "bat", HARBOR, { batStyle: "left-hand" }),
  player("hk-ishan", "Ishan Rao", "wk", HARBOR, { batStyle: "right-hand" }),
  player("hk-kabir", "Kabir Sethi", "bat", HARBOR, { batStyle: "right-hand" }),
  player("hk-rehan", "Rehan Qureshi", "ar", HARBOR, { batStyle: "left-hand", bowlStyle: "medium" }),
  player("hk-vihaan", "Vihaan Das", "bat", HARBOR, { batStyle: "right-hand" }),
  player("hk-omar", "Omar Sheikh", "ar", HARBOR, { batStyle: "right-hand", bowlStyle: "off spin" }),
  player("hk-harsh", "Harsh Purohit", "bowl", HARBOR, { bowlStyle: "fast" }),
  player("hk-leo", "Leo D'Silva", "bowl", HARBOR, { bowlStyle: "fast-medium" }),
  player("hk-yash", "Yash Bedi", "bowl", HARBOR, { bowlStyle: "leg spin" }),
  player("hk-aman", "Aman Kohli", "bowl", HARBOR, { bowlStyle: "left-arm seam" }),
  player("rl-harpreet", "Harpreet Gill", "bowl", RIDGE, { bowlStyle: "left-arm swing" }),
  player("rl-neil", "Neil D'Souza", "bowl", RIDGE, { bowlStyle: "right-arm pace" }),
  player("rl-farhan", "Farhan Ali", "bowl", RIDGE, { bowlStyle: "off spin" }),
  player("rl-surya", "Surya Nair", "bowl", RIDGE, { bowlStyle: "leg spin" }),
  player("rl-imran", "Imran Varghese", "bowl", RIDGE, { bowlStyle: "death pace" }),
  player("rl-zaid", "Zaid Khan", "bowl", RIDGE, { bowlStyle: "hit-the-deck pace" }),
  player("rl-karan", "Karan Seth", "wk", RIDGE, { batStyle: "right-hand" }),
  player("rl-jatin", "Jatin Malhotra", "bat", RIDGE, { batStyle: "left-hand" }),
  player("rl-vivek", "Vivek Rao", "ar", RIDGE, { bowlStyle: "medium" }),
];

const battingOrder = [
  "hk-arjun",
  "hk-dev",
  "hk-ishan",
  "hk-kabir",
  "hk-rehan",
  "hk-vihaan",
  "hk-omar",
  "hk-harsh",
  "hk-leo",
  "hk-yash",
  "hk-aman",
];

interface ScriptOver {
  bowlerId: string;
  balls: string[];
}

/**
 * Compact ball tokens. Wickets are 0 runs unless a number prefix is added later.
 * W:caught:fielder, W:bowled, W:lbw, W:runout:fielder
 */
const SCRIPT: ScriptOver[] = [
  { bowlerId: "rl-harpreet", balls: ["1", "0", "4", "1", "0", "2"] },
  { bowlerId: "rl-neil", balls: ["0", "4", "1", "1", "1", "0"] },
  { bowlerId: "rl-harpreet", balls: ["1", "1", "4", "0", "2", "1"] },
  { bowlerId: "rl-neil", balls: ["0", "1", "W:caught:rl-karan", "1", "4", "0"] },
  { bowlerId: "rl-harpreet", balls: ["1", "4", "1", "0", "1", "2"] },
  { bowlerId: "rl-neil", balls: ["1", "1", "4", "0", "1", "6"] },
  { bowlerId: "rl-farhan", balls: ["0", "1", "0", "0", "1", "1"] },
  { bowlerId: "rl-surya", balls: ["1", "0", "0", "1", "0", "1"] },
  { bowlerId: "rl-farhan", balls: ["0", "1", "1", "0", "4", "1"] },
  { bowlerId: "rl-surya", balls: ["1", "1", "0", "0", "1", "4"] },
  { bowlerId: "rl-zaid", balls: ["4", "1", "W:caught:rl-jatin", "6", "1", "1"] },
  { bowlerId: "rl-farhan", balls: ["1", "6", "1", "4", "0", "2"] },
  { bowlerId: "rl-zaid", balls: ["6", "1", "1", "4", "1", "0"] },
  { bowlerId: "rl-imran", balls: ["1", "0", "1", "W:lbw", "1", "4"] },
  { bowlerId: "rl-surya", balls: ["0", "1", "W:bowled", "1", "4", "1"] },
  { bowlerId: "rl-imran", balls: ["4", "1", "6", "1", "0", "2"] },
  { bowlerId: "rl-zaid", balls: ["1", "1", "6", "W:caught:rl-vivek", "1", "0"] },
  { bowlerId: "rl-imran", balls: ["1", "4", "1", "0", "2", "6"] },
  { bowlerId: "rl-zaid", balls: ["4", "1", "1", "W:runout:rl-zaid", "2", "1"] },
  { bowlerId: "rl-imran", balls: ["1", "4", "2", "1", "6"] },
];

const NOTES: Record<string, string> = {
  "3:2": "Thin nick. The keeper takes it in front of first slip.",
  "5:5": "Slog-swept flat over midwicket. The powerplay has a pulse again.",
  "10:2": "Extra bounce, a top-edge, and deep third doesn't have to move.",
  "13:3": "Beaten on the inside edge. The finger is up before the appeal ends.",
  "14:2": "Through the gate. The stumps light up.",
  "15:2": "Vihaan stands tall and lofts the slower one into the sight screen.",
  "16:3": "Long-on steadies himself under the high one. The finisher walks off.",
  "18:3": "Direct hit. He was ball-watching on the second.",
  "19:4": "Harsh clears long-on. The harbor stands finally get to shout.",
};

interface ParsedBall {
  runsBat: number;
  extras: number;
  boundary?: 4 | 6;
  kind: Delivery["kind"];
  wicket?: { dismissal: Dismissal; fielderId?: string; end: "striker" | "nonstriker" };
}

function parseToken(token: string): ParsedBall {
  if (token.startsWith("W")) {
    const [, dismissalRaw = "caught", fielderId] = token.split(":");
    const dismissal = (dismissalRaw === "W" ? "caught" : dismissalRaw) as Dismissal;
    return {
      runsBat: 0,
      extras: 0,
      kind: "legal",
      wicket: {
        dismissal,
        fielderId: fielderId || undefined,
        end: "striker",
      },
    };
  }
  const runs = Number(token);
  return {
    runsBat: runs,
    extras: 0,
    kind: "legal",
    boundary: runs === 4 ? 4 : runs === 6 ? 6 : undefined,
  };
}

export interface CompiledMatch {
  meta: InningsMeta;
  deliveries: Delivery[];
}

function compile(): CompiledMatch {
  const meta: InningsMeta = {
    id: "harbor-cup-final",
    competition: "Harbor Cup · Final",
    venue: "Marina Oval",
    city: "Kochi",
    toss: "Ridge Lions elected to bat",
    firstInnings: "Ridge Lions 185/6",
    battingTeamId: HARBOR,
    bowlingTeamId: RIDGE,
    target: 186,
    balls: 120,
    teams,
    players,
    battingOrder,
    overs: SCRIPT.map((over, index) => ({ over: index, bowlerId: over.bowlerId })),
    overStarts: [],
    fantasy: {
      name: "Your Flex XI",
      slots: [
        { playerId: "hk-ishan", role: "WK", multiplier: 1 },
        { playerId: "hk-arjun", role: "BAT", multiplier: 1.5, badge: "VC" },
        { playerId: "hk-dev", role: "BAT", multiplier: 1 },
        { playerId: "hk-kabir", role: "BAT", multiplier: 2, badge: "C" },
        { playerId: "hk-vihaan", role: "BAT", multiplier: 1 },
        { playerId: "hk-rehan", role: "AR", multiplier: 1 },
        { playerId: "hk-omar", role: "AR", multiplier: 1 },
        { playerId: "rl-harpreet", role: "BOWL", multiplier: 1 },
        { playerId: "rl-farhan", role: "BOWL", multiplier: 1 },
        { playerId: "rl-imran", role: "BOWL", multiplier: 1 },
        { playerId: "rl-zaid", role: "BOWL", multiplier: 1 },
      ],
    },
  };

  const deliveries: Delivery[] = [];
  let crease = openingCrease(battingOrder);
  let seq = 1;
  let ground = 0;
  let runs = 0;

  for (let over = 0; over < SCRIPT.length; over += 1) {
    const script = SCRIPT[over];
    if (!script) break;
    let legalBall = 0;
    for (let ball = 0; ball < script.balls.length; ball += 1) {
      const token = script.balls[ball];
      if (!token || !crease.strikerId || !crease.nonStrikerId) break;
      const parsed = parseToken(token);
      legalBall += parsed.kind === "wide" ? 0 : 1;
      ground += over > 0 && ball === 0 ? PACE.overBreakMs : PACE.ballGapMs;
      const wicket = parsed.wicket
        ? {
            ...parsed.wicket,
            playerOutId: parsed.wicket.end === "nonstriker" ? crease.nonStrikerId : crease.strikerId,
          }
        : undefined;
      const delivery: Delivery = {
        seq,
        over,
        legalBall: parsed.kind === "wide" ? 0 : legalBall,
        kind: parsed.kind,
        runsBat: parsed.runsBat,
        extras: parsed.extras,
        boundary: parsed.boundary,
        wicket,
        strikerId: crease.strikerId,
        nonStrikerId: crease.nonStrikerId,
        bowlerId: script.bowlerId,
        groundOffsetMs: ground,
        note: NOTES[`${over}:${ball}`],
      };
      deliveries.push(delivery);
      seq += 1;
      runs += delivery.runsBat + delivery.extras;
      crease = creaseAfter(crease, delivery, battingOrder);
      if (runs >= meta.target) {
        return finish(meta, deliveries);
      }
    }
  }

  return finish(meta, deliveries);
}

function finish(meta: InningsMeta, deliveries: Delivery[]): CompiledMatch {
  return {
    meta: {
      ...meta,
      overStarts: meta.overs.map((over) => deliveries.find((delivery) => delivery.over === over.over)?.seq ?? 0),
    },
    deliveries,
  };
}

export const FIXTURE: CompiledMatch = compile();

export interface MatchDataSource {
  meta(): InningsMeta;
  deliveries(): readonly Delivery[];
}

export class FixtureSource implements MatchDataSource {
  meta(): InningsMeta {
    return FIXTURE.meta;
  }

  deliveries(): readonly Delivery[] {
    return FIXTURE.deliveries;
  }
}

export const fixtureSource = new FixtureSource();
