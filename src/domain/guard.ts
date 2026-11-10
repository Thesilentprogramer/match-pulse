/** Shared language guard. Copy, commentary, and the companion all use it. */
const BANNED =
  /\b(bet|bets|betting|wager|wagers|gambling|gamble|bookie|punter|cash|dreambucks|dream11)\b/i;

export function containsBannedLanguage(text: string): boolean {
  return BANNED.test(text);
}
