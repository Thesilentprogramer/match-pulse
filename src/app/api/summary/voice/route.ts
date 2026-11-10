import { serverMp4Available } from "@/lib/host";
import { browserVoicePlan, planVoice } from "@/providers/story/voice-plan";
import { createTtsProvider } from "@/providers/story/tts";

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const json = (await request.json().catch(() => null)) as { lines?: unknown } | null;
  const lines = Array.isArray(json?.lines) ? json.lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0) : [];
  if (lines.length === 0 || lines.length > 8) {
    return Response.json({ error: "Send between one and eight narration lines." }, { status: 400 });
  }
  const mp4 = serverMp4Available();
  try {
    const provider = await createTtsProvider();
    const plan = await planVoice(provider, lines);
    return Response.json({ ...plan, mp4 });
  } catch {
    return Response.json({ ...browserVoicePlan(lines), mp4 });
  }
}
