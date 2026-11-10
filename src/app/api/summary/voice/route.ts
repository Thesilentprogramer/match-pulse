import { serverMp4Available } from "@/lib/host";
import { browserVoicePlan, planVoice } from "@/providers/story/voice-plan";
import { createTtsProvider } from "@/providers/story/tts";

/** Eight lines at the 7s Gnani budget fit in this window, including one 429 retry. */
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const json = (await request.json().catch(() => null)) as { lines?: unknown; state?: unknown; language?: unknown } | null;
  const lines = Array.isArray(json?.lines) ? json.lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0) : [];
  if (lines.length === 0 || lines.length > 8) {
    return Response.json({ error: "Send between one and eight narration lines." }, { status: 400 });
  }
  const language = json?.language === "hi-IN" ? "hi-IN" : "en-IN";
  const state = typeof json?.state === "string" ? json.state.slice(0, 160) : "";
  const mp4 = serverMp4Available();
  try {
    const provider = await createTtsProvider(process.env, { language });
    const plan = await planVoice(provider, lines, `${state}:${language}`);
    return Response.json({ ...plan, mp4 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "failed";
    console.warn(`[match-pulse] summary voice fell back to the browser: ${reason}`);
    return Response.json({ ...browserVoicePlan(lines), mp4 });
  }
}
