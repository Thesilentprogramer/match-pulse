import { connection } from "next/server";
import { resolveCopyProvider } from "@/providers/ai/model-provider";

export async function GET(): Promise<Response> {
  await connection();
  const provider = resolveCopyProvider();
  return Response.json({ provider: provider.id });
}
