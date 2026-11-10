import { connection } from "next/server";
import { livePoller } from "@/providers/live/poller";

export const maxDuration = 20;

export async function GET(): Promise<Response> {
  await connection();
  const catalog = await livePoller.getCatalog();
  return Response.json(catalog, { headers: { "cache-control": "no-store" } });
}
