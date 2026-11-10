import { resolveCopyProvider } from "@/providers/ai/model-provider";

export async function GET(): Promise<Response> {
  const provider = resolveCopyProvider();
  return Response.json({ provider: provider.id });
}
