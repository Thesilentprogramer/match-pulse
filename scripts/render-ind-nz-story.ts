import { mkdir } from "node:fs/promises";
import path from "node:path";
import { indiaWicketBalls, indNzCard, indNzMeta } from "../fixtures/ind-nz-2nd-odi-2026";
import { buildMatchStory } from "../src/domain/story";
import { matchStorySchema } from "../src/domain/story-schema";
import { renderStoryMp4 } from "../src/remotion/render-story";

const story = matchStorySchema.parse(
  buildMatchStory({
    meta: indNzMeta,
    deliveries: indiaWicketBalls,
    picks: [],
    card: indNzCard,
  }),
);

async function main(): Promise<void> {
  const output = path.resolve(process.env.STORY_OUT ?? "/opt/cursor/artifacts/ind-nz-2nd-odi-story.mp4");
  await mkdir(path.dirname(output), { recursive: true });
  console.log(`Rendering India vs New Zealand story to ${output}`);
  await renderStoryMp4(story, output, (progress) => {
    process.stdout.write(`\r${Math.round(progress * 100)}%`);
  });
  process.stdout.write("\n");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
