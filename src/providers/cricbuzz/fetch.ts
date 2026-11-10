import { BROWSER_UA } from "@/providers/live/types";

export async function fetchCricbuzz(url: string, timeoutMs = 8000): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
    cache: "no-store",
    headers: {
      "user-agent": BROWSER_UA,
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
    },
  });
  if (!response.ok) throw new Error(`Cricbuzz responded ${response.status}.`);
  const html = await response.text();
  if (html.length < 500 || /access denied|captcha|just a moment/i.test(html.slice(0, 800))) {
    throw new Error("Cricbuzz blocked the request.");
  }
  return html;
}

export const CRICBUZZ_LIVE_URL = "https://www.cricbuzz.com/cricket-match/live-scores";

export function cricbuzzMatchUrl(matchId: number, slug = "live"): string {
  return `https://www.cricbuzz.com/live-cricket-scores/${matchId}/${slug}`;
}
