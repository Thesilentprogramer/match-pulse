/** A click has to unlock speech before the voice request returns. */
export function primeSpeechSynthesis(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const primer = new SpeechSynthesisUtterance(" ");
  primer.volume = 0;
  window.speechSynthesis.speak(primer);
}

export function cancelSpeechSynthesis(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function browserCanSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
