import { mkdir } from "node:fs/promises";
import path from "node:path";
import { FIXTURE } from "../src/domain/fixture";
import { buildMatchStory } from "../src/domain/story";
import { matchStorySchema } from "../src/domain/story-schema";
import { renderStoryMp4 } from "../src/remotion/render-story";

const story = matchStorySchema.parse(
  buildMatchStory({
    meta: FIXTURE.meta,
    deliveries: FIXTURE.deliveries,
    picks: [],
  }),
);

async function main(): Promise<void> {
  const output = path.resolve(process.env.STORY_OUT ?? "artifacts/match-story.mp4");
  await mkdir(path.dirname(output), { recursive: true });
  console.log(`Rendering Match Story to ${output}`);
  await renderStoryMp4(story, output, (progress) => {
    process.stdout.write(`\r${Math.round(progress * 100)}%`);
  });
  process.stdout.write("\n");
  console.log("Done");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
