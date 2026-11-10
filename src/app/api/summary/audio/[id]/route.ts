import { recallSpeech } from "@/providers/story/speech-cache";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const wav = recallSpeech(id);
  if (!wav) return new Response("Missing speech.", { status: 404 });
  return new Response(Buffer.from(wav), {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
