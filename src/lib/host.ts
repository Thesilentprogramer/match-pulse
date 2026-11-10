import path from "node:path";
import { tmpdir } from "node:os";

/** Remotion `renderMedia` needs a long-lived Node process and a browser binary. */
export function serverMp4Available(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL !== "1";
}

/** Inlined at build time so client screens can hide a download the host cannot serve. */
export function clientMp4Available(): boolean {
  return process.env.NEXT_PUBLIC_MP4_RENDER !== "0";
}

export const MP4_UNAVAILABLE_MESSAGE =
  "MP4 download isn't available on this host. The in-browser player is the film.";

export function mp4UnavailableResponse(): Response {
  return Response.json({ unavailable: true, error: MP4_UNAVAILABLE_MESSAGE }, { status: 501 });
}

/** Vercel can write only under the temp directory. Refuse any other destination. */
export function tempDownloadPath(name: string): string {
  const root = path.resolve(tmpdir());
  const file = path.resolve(root, path.basename(name));
  if (!file.startsWith(`${root}${path.sep}`)) {
    throw new Error("Refusing to write outside the temp directory.");
  }
  return file;
}
