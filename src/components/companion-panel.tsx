"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import type { Voice } from "@/domain/grounding";
import { Button } from "@/components/ui/button";

const PROMPTS = ["What does the chase need?", "Why is the win chance there?", "Explain DLS", "Who is batting?"];

export function CompanionPanel({ seenThroughSeq, voice }: { seenThroughSeq: number; voice: Voice }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: "you" | "pulse"; text: string; source?: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setQuestion("");
    setMessages((current) => [...current, { role: "you", text: trimmed }, { role: "pulse", text: "" }]);
    setBusy(true);
    try {
      const response = await fetch("/api/ai/companion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed, seenThroughSeq, voice }),
      });
      const source = response.headers.get("x-pulse-source") ?? "template";
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let full = "";
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          const next = full;
          setMessages((current) => {
            const copy = [...current];
            copy[copy.length - 1] = { role: "pulse", text: next, source };
            return copy;
          });
        }
      } else {
        full = await response.text();
        setMessages((current) => {
          const copy = [...current];
          copy[copy.length - 1] = { role: "pulse", text: full, source };
          return copy;
        });
      }
    } catch {
      setMessages((current) => {
        const copy = [...current];
        copy[copy.length - 1] = { role: "pulse", text: "The companion dropped. Ask again in a moment.", source: "template" };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Match companion" data-testid="companion" className="mp-glass rounded-3xl p-4">
      <p className="mp-kicker text-[var(--mp-accent-bright)]">Companion</p>
      <h2 className="mp-display mt-1 text-4xl">Ask the match</h2>
      <p className="mt-1 text-sm text-white/75">
        Answers use only the balls already in the log{seenThroughSeq ? ` (through ball ${seenThroughSeq})` : ""}. Numbers come from the score, not from a guess.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PROMPTS.map((prompt) => (
          <Button key={prompt} type="button" size="sm" variant="secondary" onClick={() => void ask(prompt)}>
            {prompt}
          </Button>
        ))}
      </div>
      <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto" aria-live="polite">
        {messages.length === 0 ? (
          <p className="rounded-2xl bg-black/40 px-3 py-4 text-sm text-white/70">Nothing asked yet. Try the chase, or a word like DLS.</p>
        ) : (
          messages.map((message, index) => (
            <p
              key={`${message.role}-${index}`}
              className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${message.role === "you" ? "bg-[var(--mp-accent)] text-white" : "bg-black/40 text-white"}`}
            >
              {message.text || (busy ? "Reading the balls you have seen…" : "")}
              {message.source ? <span className="mt-1 block text-[0.65rem] uppercase tracking-widest opacity-70">{message.source === "model" ? "Live model" : "Desk voice"}</span> : null}
            </p>
          ))
        )}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <label className="sr-only" htmlFor="companion-question">
          Question about the match
        </label>
        <input
          id="companion-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about the balls you can see"
          className="h-11 flex-1 rounded-xl border border-white/15 bg-black/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-accent)]"
        />
        <Button type="submit" disabled={busy} className="h-11">
          <MessageCircle />
          Ask
        </Button>
      </form>
    </section>
  );
}
