import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { clientMp4Available, MP4_UNAVAILABLE_MESSAGE, mp4UnavailableResponse, serverMp4Available, tempDownloadPath } from "@/lib/host";

describe("vercel host", () => {
  it("keeps MP4 rendering off Vercel and on a local Node process", () => {
    expect(serverMp4Available({ NODE_ENV: "test", VERCEL: "1" })).toBe(false);
    expect(serverMp4Available({ NODE_ENV: "test" })).toBe(true);
  });

  it("hides the client download when the build was made for Vercel", () => {
    const previous = process.env.NEXT_PUBLIC_MP4_RENDER;
    process.env.NEXT_PUBLIC_MP4_RENDER = "0";
    expect(clientMp4Available()).toBe(false);
    process.env.NEXT_PUBLIC_MP4_RENDER = "1";
    expect(clientMp4Available()).toBe(true);
    if (previous === undefined) delete process.env.NEXT_PUBLIC_MP4_RENDER;
    else process.env.NEXT_PUBLIC_MP4_RENDER = previous;
  });

  it("answers a serverless render with a message instead of a server error", async () => {
    const response = mp4UnavailableResponse();
    expect(response.status).toBe(501);
    const body = (await response.json()) as { unavailable: boolean; error: string };
    expect(body.unavailable).toBe(true);
    expect(body.error).toBe(MP4_UNAVAILABLE_MESSAGE);
  });

  it("keeps render output inside the temp directory", () => {
    const file = tempDownloadPath("../etc/passwd");
    expect(file.startsWith(`${path.resolve(tmpdir())}${path.sep}`)).toBe(true);
    expect(path.basename(file)).toBe("passwd");
    expect(tempDownloadPath("match-summary.mp4").endsWith(`${path.sep}match-summary.mp4`)).toBe(true);
  });
});
