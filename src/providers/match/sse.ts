export interface SseMessage {
  event: string;
  data: string;
  id?: string;
}

export function encodeSse(event: string, data: unknown, id?: number): string {
  const idLine = id === undefined ? "" : `id: ${id}\n`;
  return `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Pull complete SSE messages out of a byte stream buffer. Incomplete tails stay in `rest`. */
export function consumeSse(buffer: string): { rest: string; messages: SseMessage[] } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const messages: SseMessage[] = [];
  let rest = normalized;
  while (true) {
    const split = rest.indexOf("\n\n");
    if (split === -1) break;
    const block = rest.slice(0, split);
    rest = rest.slice(split + 2);
    const message = parseBlock(block);
    if (message) messages.push(message);
  }
  return { rest, messages };
}

function parseBlock(block: string): SseMessage | null {
  let event = "message";
  let id: string | undefined;
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const raw = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = raw;
    else if (field === "data") data.push(raw);
    else if (field === "id") id = raw;
  }
  if (data.length === 0) return null;
  return { event, data: data.join("\n"), id };
}
