const clips = new Map<string, Uint8Array>();

export function rememberSpeech(id: string, wav: Uint8Array): void {
  clips.set(id, wav);
}

export function recallSpeech(id: string): Uint8Array | null {
  return clips.get(id) ?? null;
}
