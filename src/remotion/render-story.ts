import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { MatchStoryProps } from "@/domain/story-schema";

let bundled: Promise<string> | null = null;

function serveUrl(): Promise<string> {
  bundled ??= bundle({
    entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
    publicDir: path.join(process.cwd(), "public"),
  });
  return bundled;
}

function asInput(props: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) out[key] = value;
  return out;
}

export async function renderStoryMp4(
  story: MatchStoryProps,
  outputLocation: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  await renderComposition("MatchStory", story, outputLocation, onProgress);
}

export async function renderComposition(
  id: string,
  inputProps: object,
  outputLocation: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const props = asInput(inputProps);
  const serve = await serveUrl();
  const composition = await selectComposition({
    serveUrl: serve,
    id,
    inputProps: props,
  });
  await renderMedia({
    composition,
    serveUrl: serve,
    codec: "h264",
    outputLocation,
    inputProps: props,
    onProgress: ({ progress }) => onProgress?.(progress),
  });
}
