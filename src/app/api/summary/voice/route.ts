import { createHash } from "node:crypto";
import { rememberSpeech } from "@/providers/story/speech-cache";
import { createTtsProvider } from "@/providers/story/tts";

export const maxDuration = 60;

const spoken = new Map<string, { durationSec: number }>();

export async function POST(request: Request): Promise<Response> {
  const json = (await request.json().catch(() => null)) as { lines?: unknown } | null;
  const lines = Array.isArray(json?.lines) ? json.lines.filter((line): line is string => typeof line === "string") : [];
  if (lines.length === 0 || lines.length > 8) {
    return Response.json({ error: "Send between one and eight narration lines." }, { status: 400 });
  }
  const provider = await createTtsProvider();
  const origin = new URL(request.url).origin;
  const clips = [];
  for (const line of lines) {
    const hash = createHash("sha256").update(`${provider.id}:${line}`).digest("hex").slice(0, 16);
    let durationSec = spoken.get(hash)?.durationSec;
    if (!recallHas(hash)) {
      const audio = await provider.synthesize(line);
      rememberSpeech(hash, audio.wav);
      durationSec = audio.durationSec;
      spoken.set(hash, { durationSec });
    }
    clips.push({
      id: hash,
      durationSec: durationSec ?? 2.4,
      url: `${origin}/api/summary/audio/${hash}`,
      voice: provider.id,
    });
  }
  return Response.json({ clips, voice: provider.id });
}

function recallHas(id: string): boolean {
  return spoken.has(id);
}
