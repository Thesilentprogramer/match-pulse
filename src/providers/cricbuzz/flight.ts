import * as cheerio from "cheerio";

/** Pull the Next.js flight text Cricbuzz embeds in the match and live-score pages. */
export function flightText(html: string): string {
  const $ = cheerio.load(html);
  const chunks: string[] = [];
  $("script").each((_, el) => {
    const raw = $(el).text();
    const match = raw.match(/self\.__next_f\.push\(\[1,"([\s\S]*)"\]\)\s*$/);
    if (!match?.[1]) return;
    try {
      const decoded = JSON.parse(`"${match[1]}"`) as unknown;
      if (typeof decoded === "string") chunks.push(decoded);
    } catch {
      /* a script that is not a flight chunk */
    }
  });
  if (chunks.length === 0) throw new Error("Cricbuzz page had no match payload.");
  return chunks.join("");
}

/** Slice one JSON value out of a flight blob, starting at a marker such as `"matches":[`. */
export function sliceJson(text: string, marker: string): unknown {
  const at = text.indexOf(marker);
  if (at < 0) throw new Error(`Cricbuzz payload is missing ${marker}.`);
  const openAt = findIndexFrom(text, at, (ch) => ch === "{" || ch === "[");
  if (openAt < 0) throw new Error(`Cricbuzz payload has no JSON value after ${marker}.`);
  const end = balancedEnd(text, openAt);
  try {
    return JSON.parse(text.slice(openAt, end)) as unknown;
  } catch {
    throw new Error(`Cricbuzz payload at ${marker} was not JSON.`);
  }
}

function balancedEnd(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let quote = false;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') quote = false;
      continue;
    }
    if (ch === '"') {
      quote = true;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error("Cricbuzz payload ended before the JSON value closed.");
}

function findIndexFrom(text: string, start: number, pred: (ch: string) => boolean): number {
  for (let i = start; i < text.length; i += 1) {
    if (pred(text[i] ?? "")) return i;
  }
  return -1;
}
