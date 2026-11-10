import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { indiaWicketBalls, indNzCard, indNzMeta } from "../fixtures/ind-nz-2nd-odi-2026";
import { buildMatchSummary, withSpokenDurations } from "../src/domain/summary";
import { renderComposition } from "../src/remotion/render-story";
import { createTtsProvider } from "../src/providers/story/tts";

async function main(): Promise<void> {
  const draft = buildMatchSummary({
    meta: indNzMeta,
    deliveries: indiaWicketBalls,
    picks: [],
    card: indNzCard,
  });
  const tts = await createTtsProvider();
  const dir = path.join(process.cwd(), "public", "summary-cache");
  await mkdir(dir, { recursive: true });
  const clips = [];
  for (const [index, scene] of draft.scenes.entries()) {
    const spoken = await tts.synthesize(scene.narration);
    const name = `summary-cache/ind-nz-${index}.wav`;
    await writeFile(path.join(process.cwd(), "public", name), spoken.wav);
    clips.push({ durationSec: spoken.durationSec, url: name });
    console.log(`${scene.kind} ${spoken.durationSec.toFixed(1)}s via ${tts.id}`);
  }
  const film = withSpokenDurations(draft, clips);
  const output = path.resolve(process.env.STORY_OUT ?? "/opt/cursor/artifacts/ind-nz-summary.mp4");
  await mkdir(path.dirname(output), { recursive: true });
  console.log(`Rendering ${output}`);
  await renderComposition("SummaryFilm", film as unknown as Record<string, unknown>, output, (progress) => {
    process.stdout.write(`\r${Math.round(progress * 100)}%`);
  });
  process.stdout.write("\n");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
