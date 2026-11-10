import { afterEach, describe, expect, it } from "vitest";
import { MP4_UNAVAILABLE_MESSAGE } from "@/lib/host";
import { POST as renderStory } from "@/app/api/story/render/route";
import { POST as renderSummary } from "@/app/api/summary/render/route";

const previous = process.env.VERCEL;

afterEach(() => {
  if (previous === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = previous;
});

describe("mp4 routes on Vercel", () => {
  it("refuses summary and story renders before starting Remotion", async () => {
    process.env.VERCEL = "1";
    const summary = await renderSummary(
      new Request("http://127.0.0.1/api/summary/render", {
        method: "POST",
        body: JSON.stringify({ not: "a film" }),
        headers: { "content-type": "application/json" },
      }),
    );
    const story = await renderStory(
      new Request("http://127.0.0.1/api/story/render", {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(summary.status).toBe(501);
    expect(story.status).toBe(501);
    const body = (await summary.json()) as { error: string; unavailable: boolean };
    expect(body.unavailable).toBe(true);
    expect(body.error).toBe(MP4_UNAVAILABLE_MESSAGE);
  });
});
