import { readHits, type CricEnvelope } from "@/providers/cricapi/delta";

export interface CricApiResult {
  body: CricEnvelope;
  hitsToday: number | null;
  hitsLimit: number | null;
}

/** Server-only. The key never leaves this function. */
export async function cricApiGet(path: string, params: Record<string, string> = {}, env: NodeJS.ProcessEnv = process.env): Promise<CricApiResult> {
  const key = env.CRICAPI_KEY;
  if (!key) throw new Error("no-key");
  const url = new URL(`https://api.cricapi.com/v1/${path}`);
  url.searchParams.set("apikey", key);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch {
    throw new Error("CricAPI did not answer.");
  }
  const body = (await response.json().catch(() => null)) as CricEnvelope | null;
  const hits = readHits(body?.info);
  if (!response.ok || !body || body.status === "failure") {
    const reason = typeof body?.reason === "string" ? body.reason : `CricAPI responded ${response.status}.`;
    const error = new Error(/limit|quota|exceed/i.test(reason) ? "quota" : reason);
    (error as Error & { hits?: typeof hits }).hits = hits;
    throw error;
  }
  return { body, ...hits };
}
