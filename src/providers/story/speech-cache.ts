const clips = new Map<string, { wav: Uint8Array; voice: string }>();

export function rememberSpeech(id: string, wav: Uint8Array, voice = ""): void {
  clips.set(id, { wav, voice });
}

export function recallSpeech(id: string): Uint8Array | null {
  return clips.get(id)?.wav ?? null;
}

export function recallSpeechVoice(id: string): string | null {
  const voice = clips.get(id)?.voice;
  return voice ? voice : null;
}
