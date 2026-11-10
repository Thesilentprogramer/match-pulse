import type { ScorecardRecap, StoryBeat } from "@/domain/story";
import type { Delivery, Dismissal, InningsMeta, Player, Team } from "@/domain/types";

/**
 * New Zealand vs India, 2nd ODI, 7 Nov 2026, Hnry Stadium, Wellington.
 * Facts are the Cricbuzz scorecard and the match-page close.
 * Ball-by-ball was not on the page, so this log is wicket balls only:
 * runsBat stays 0, and the fall-of-wicket score lives in `note`.
 * A 47-over innings is derived, not printed as a headline: at 26 overs
 * India needed 22 from 21, and a further 12 overs lost would have left 35.
 */

const NZ = "nz";
const IND = "ind";

const teams: Team[] = [
  { id: NZ, name: "New Zealand", short: "NZ", color: "#f4f4f4" },
  { id: IND, name: "India", short: "IND", color: "#e10000" },
];

function player(id: string, name: string, role: Player["role"], teamId: string): Player {
  return { id, name, role, teamId };
}

const players: Player[] = [
  player("nz-young", "Will Young", "bat", NZ),
  player("nz-seifert", "Tim Seifert", "bat", NZ),
  player("nz-nicholls", "Henry Nicholls", "bat", NZ),
  player("nz-mitchell", "Daryl Mitchell", "bat", NZ),
  player("nz-latham", "Tom Latham", "wk", NZ),
  player("nz-phillips", "Glenn Phillips", "bat", NZ),
  player("nz-santner", "Mitchell Santner", "ar", NZ),
  player("nz-smith", "Nathan Smith", "ar", NZ),
  player("nz-jamieson", "Kyle Jamieson", "bowl", NZ),
  player("nz-duffy", "Jacob Duffy", "bowl", NZ),
  player("nz-tickner", "Blair Tickner", "bowl", NZ),
  player("nz-fisher", "Matthew Fisher", "bowl", NZ),
  player("ind-rohit", "Rohit Sharma", "bat", IND),
  player("ind-gill", "Shubman Gill", "bat", IND),
  player("ind-kohli", "Virat Kohli", "bat", IND),
  player("ind-iyer", "Shreyas Iyer", "bat", IND),
  player("ind-rahul", "KL Rahul", "wk", IND),
  player("ind-axar", "Axar Patel", "ar", IND),
  player("ind-dhir", "Naman Dhir", "bat", IND),
  player("ind-kamboj", "Anshul Kamboj", "bowl", IND),
  player("ind-nabi", "Auqib Nabi", "bowl", IND),
  player("ind-brar", "Gurnoor Brar", "bowl", IND),
  player("ind-arshdeep", "Arshdeep Singh", "bowl", IND),
];

interface WicketBall {
  fow: string;
  over: string;
  out: string;
  partner: string;
  bowler: string;
  dismissal: Dismissal;
  fielder?: string;
  note: string;
}

function wicketBalls(rows: WicketBall[]): Delivery[] {
  return rows.map((row, index) => {
    const [overText, ballText] = row.over.split(".");
    return {
      seq: index + 1,
      over: Number(overText),
      legalBall: Number(ballText),
      kind: "legal",
      runsBat: 0,
      extras: 0,
      wicket: {
        playerOutId: row.out,
        dismissal: row.dismissal,
        fielderId: row.fielder,
        end: "striker",
      },
      strikerId: row.out,
      nonStrikerId: row.partner,
      bowlerId: row.bowler,
      groundOffsetMs: 0,
      note: `${row.fow} at ${row.over}. ${row.note} Runs on this ball are not published.`,
    };
  });
}

/** New Zealand first innings. Ten wicket balls. Duffy was not out. */
export const nzWicketBalls: Delivery[] = wicketBalls([
  { fow: "0/1", over: "1.5", out: "nz-seifert", partner: "nz-young", bowler: "ind-nabi", dismissal: "caught", fielder: "ind-kamboj", note: "Tim Seifert c Anshul Kamboj b Auqib Nabi 0 (5)." },
  { fow: "11/2", over: "5.4", out: "nz-young", partner: "nz-nicholls", bowler: "ind-nabi", dismissal: "caught", fielder: "ind-rahul", note: "Will Young c KL Rahul b Auqib Nabi 6 (17)." },
  { fow: "23/3", over: "8.4", out: "nz-nicholls", partner: "nz-mitchell", bowler: "ind-kamboj", dismissal: "bowled", note: "Henry Nicholls b Anshul Kamboj 11 (26)." },
  { fow: "53/4", over: "19.2", out: "nz-latham", partner: "nz-mitchell", bowler: "ind-brar", dismissal: "caught", fielder: "ind-dhir", note: "Tom Latham c Naman Dhir b Gurnoor Brar 7 (22)." },
  { fow: "53/5", over: "19.6", out: "nz-phillips", partner: "nz-mitchell", bowler: "ind-brar", dismissal: "caught", fielder: "ind-kamboj", note: "Glenn Phillips c Anshul Kamboj b Gurnoor Brar 0 (4)." },
  { fow: "112/6", over: "34.6", out: "nz-mitchell", partner: "nz-santner", bowler: "ind-axar", dismissal: "caught", fielder: "ind-kamboj", note: "Daryl Mitchell c Anshul Kamboj b Axar Patel 55 (104)." },
  { fow: "119/7", over: "35.5", out: "nz-santner", partner: "nz-smith", bowler: "ind-brar", dismissal: "caught", fielder: "ind-rahul", note: "Mitchell Santner c KL Rahul b Gurnoor Brar 31 (38)." },
  { fow: "127/8", over: "38.2", out: "nz-jamieson", partner: "nz-smith", bowler: "ind-axar", dismissal: "bowled", note: "Kyle Jamieson b Axar Patel 7 (14)." },
  { fow: "132/9", over: "39.5", out: "nz-smith", partner: "nz-tickner", bowler: "ind-brar", dismissal: "caught", fielder: "ind-rohit", note: "Nathan Smith c Rohit Sharma b Gurnoor Brar 3 (9)." },
  { fow: "134/10", over: "40.6", out: "nz-tickner", partner: "nz-duffy", bowler: "ind-kamboj", dismissal: "bowled", note: "Blair Tickner b Anshul Kamboj 2 (5). Jacob Duffy 1* (3)." },
]);

/** India second innings. Seven wicket balls. Rahul and Nabi were not out. */
export const indiaWicketBalls: Delivery[] = wicketBalls([
  { fow: "4/1", over: "1.1", out: "ind-gill", partner: "ind-rohit", bowler: "nz-duffy", dismissal: "caught", fielder: "nz-nicholls", note: "Shubman Gill c Henry Nicholls b Jacob Duffy 0 (1)." },
  { fow: "17/2", over: "3.4", out: "ind-kohli", partner: "ind-rohit", bowler: "nz-duffy", dismissal: "caught", fielder: "nz-young", note: "Virat Kohli c Will Young b Jacob Duffy 7 (7)." },
  { fow: "39/3", over: "8.4", out: "ind-rohit", partner: "ind-iyer", bowler: "nz-jamieson", dismissal: "caught", fielder: "nz-nicholls", note: "Rohit Sharma c Henry Nicholls b Kyle Jamieson 23 (28)." },
  { fow: "47/4", over: "12.5", out: "ind-axar", partner: "ind-iyer", bowler: "nz-fisher", dismissal: "caught", fielder: "nz-duffy", note: "Axar Patel c Jacob Duffy b Matthew Fisher 7 (17)." },
  { fow: "86/5", over: "19.6", out: "ind-iyer", partner: "ind-rahul", bowler: "nz-jamieson", dismissal: "caught", fielder: "nz-latham", note: "Shreyas Iyer c Tom Latham b Kyle Jamieson 30 (46)." },
  { fow: "108/6", over: "24.4", out: "ind-dhir", partner: "ind-rahul", bowler: "nz-duffy", dismissal: "caught", fielder: "nz-seifert", note: "Naman Dhir c Tim Seifert b Jacob Duffy 12 (16)." },
  { fow: "111/7", over: "25.3", out: "ind-kamboj", partner: "ind-rahul", bowler: "nz-jamieson", dismissal: "caught", fielder: "nz-duffy", note: "Anshul Kamboj c Jacob Duffy b Kyle Jamieson 1 (3)." },
]);

const ballsInInnings = 282;

const beats: StoryBeat[] = [
  {
    id: "arc-open",
    kicker: "India tour of New Zealand 2026",
    title: "2nd ODI",
    body: "India won the toss and bowled, after a delayed start. Hnry Stadium, Wellington.",
    stat: "7 Nov 2026",
    tone: "open",
  },
  {
    id: "arc-openers",
    kicker: "New Zealand",
    title: "11 for 2",
    body: "Nabi takes both openers. Seifert 0 off 5. Young 6 off 17.",
    stat: "0/1 at 1.5",
    tone: "swing",
  },
  {
    id: "arc-brar",
    kicker: "Gurnoor Brar",
    title: "53 for 5",
    body: "Brar bounces out Latham and Phillips in one over. He finishes with 4 for 30.",
    stat: "10 overs, 2 maidens",
    tone: "swing",
  },
  {
    id: "arc-mitchell",
    kicker: "Daryl Mitchell",
    title: "55 off 104",
    body: "The only fifty. Caught Kamboj, bowled Axar, at 112 for 6. Dropped on 21.",
    stat: "Santner 31 off 38",
    tone: "swing",
  },
  {
    id: "arc-total",
    kicker: "New Zealand",
    title: "134 all out",
    body: "41 overs. India need 135.",
    stat: "RR 3.27",
    tone: "swing",
  },
  {
    id: "arc-wobble",
    kicker: "India",
    title: "47 for 4",
    body: "Gill is out for 0. Kohli makes 7. Rohit 23. Axar goes at 47 for 4.",
    stat: "Model estimate",
    tone: "swing",
  },
  {
    id: "arc-stand",
    kicker: "The stand",
    title: "Iyer and Rahul",
    body: "30 and 26 not out. A 39-run stand. India then slip to 111 for 7.",
    stat: "86/5 at 19.6",
    tone: "swing",
  },
  {
    id: "arc-rain",
    kicker: "Rain",
    title: "Four ahead of par",
    body: "113 for 7 after 26. 22 needed from 21. DLS par was 109. India win by 4.",
    stat: "DLS par 109",
    tone: "finish",
  },
  {
    id: "arc-potm",
    kicker: "Player of the Match",
    title: "Gurnoor Brar",
    body: "4 for 30. India lead the five-match series 2-0.",
    stat: "Match Pulse",
    tone: "finish",
  },
];

export const indNzCard: ScorecardRecap = {
  competition: "India tour of New Zealand 2026",
  venue: "Hnry Stadium, Wellington",
  team: "India",
  target: 135,
  beats,
  checkpoints: [
    { runs: 0, wickets: 0, legalBalls: 0, ballsInInnings },
    { runs: 4, wickets: 1, legalBalls: 7, ballsInInnings },
    { runs: 17, wickets: 2, legalBalls: 22, ballsInInnings },
    { runs: 39, wickets: 3, legalBalls: 52, ballsInInnings },
    { runs: 47, wickets: 4, legalBalls: 77, ballsInInnings },
    { runs: 86, wickets: 5, legalBalls: 120, ballsInInnings },
    { runs: 108, wickets: 6, legalBalls: 148, ballsInInnings },
    { runs: 111, wickets: 7, legalBalls: 153, ballsInInnings },
    { runs: 113, wickets: 7, legalBalls: 156, ballsInInnings },
  ],
  mvp: { name: "Gurnoor Brar", line: "4 for 30. Player of the Match." },
  final: { runs: 113, wickets: 7, overs: "26", result: "won", ballsLeft: 126 },
  podLines: [
    "Nabi takes both openers. New Zealand are 11 for 2.",
    "Brar finishes with 4 for 30.",
  ],
};

export const indNzMeta: InningsMeta = {
  id: "ind-nz-2nd-odi-2026",
  competition: "India tour of New Zealand 2026 · 2nd ODI",
  venue: "Hnry Stadium",
  city: "Wellington",
  toss: "India won the toss and bowled",
  firstInnings: "New Zealand 134/10 in 41 overs",
  battingTeamId: IND,
  bowlingTeamId: NZ,
  target: 135,
  balls: ballsInInnings,
  teams,
  players,
  battingOrder: [
    "ind-rohit",
    "ind-gill",
    "ind-kohli",
    "ind-iyer",
    "ind-axar",
    "ind-rahul",
    "ind-dhir",
    "ind-kamboj",
    "ind-nabi",
    "ind-brar",
    "ind-arshdeep",
  ],
  overs: [],
  overStarts: [],
  fantasy: { name: "Unused", slots: [] },
};
