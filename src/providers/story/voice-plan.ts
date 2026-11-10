import { createHash } from "node:crypto";
import { secondsForSpeech } from "@/domain/summary";
import { recallSpeech, recallSpeechVoice, rememberSpeech } from "@/providers/story/speech-cache";
import { wavDataUrl, wavDuration, type TtsProvider } from "@/providers/story/tts";

export interface VoiceClip {
  id?: string;
  durationSec: number;
  url: string | null;
  voice: string;
}

export interface VoicePlan {
  voice: string;
  clips: VoiceClip[];
}

/** No server speaker. The browser reads these lines in time with the scenes. */
export function browserVoicePlan(lines: readonly string[]): VoicePlan {
  return {
    voice: "browser",
    clips: lines.map((line) => ({
      durationSec: secondsForSpeech(line),
      url: null,
      voice: "browser",
    })),
  };
}

export async function planVoice(provider: TtsProvider, lines: readonly string[], state = ""): Promise<VoicePlan> {
  if (provider.id === "silent") return browserVoicePlan(lines);
  const clips: VoiceClip[] = [];
  for (const line of lines) {
    const id = createHash("sha256").update(`${state}:${line}`).digest("hex").slice(0, 16);
    const cached = recallSpeech(id);
    if (cached) {
      clips.push({
        id,
        durationSec: wavDuration(cached),
        url: wavDataUrl(cached),
        voice: recallSpeechVoice(id) ?? provider.id,
      });
      continue;
    }
    const audio = await provider.synthesize(line);
    if (provider.id === "silent") return browserVoicePlan(lines);
    rememberSpeech(id, audio.wav, provider.id);
    clips.push({
      id,
      durationSec: audio.durationSec,
      url: wavDataUrl(audio.wav),
      voice: provider.id,
    });
  }
  return { voice: provider.id, clips };
}
