import type { StoryBeat } from "@/domain/story";

const WIDTH = 720;
const HEIGHT = 1280;

export async function recordStoryVideo(beats: readonly StoryBeat[]): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");
  const stream = canvas.captureStream(30);
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "";
  if (!mime) throw new Error("This browser cannot record WebM.");
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });
  recorder.start();
  for (let index = 0; index < beats.length; index += 1) {
    const beat = beats[index];
    if (!beat) continue;
    for (let frame = 0; frame < 50; frame += 1) {
      drawBeat(context, beat, index, beats.length, frame / 50);
      await nextFrame();
    }
  }
  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());
  return stopped;
}

export async function renderStoryCard(beat: StoryBeat): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");
  drawBeat(context, beat, 0, 1, 1);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not encode the card.");
  return blob;
}

function drawBeat(
  context: CanvasRenderingContext2D,
  beat: StoryBeat,
  index: number,
  total: number,
  progress: number,
) {
  context.fillStyle = "#090909";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = context.createRadialGradient(WIDTH / 2, 180, 40, WIDTH / 2, 180, 520);
  glow.addColorStop(0, "rgba(225,0,0,0.55)");
  glow.addColorStop(1, "rgba(225,0,0,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = "rgba(255,255,255,0.25)";
  const gap = 10;
  const barWidth = (WIDTH - 48 - gap * (total - 1)) / total;
  for (let i = 0; i < total; i += 1) {
    const x = 24 + i * (barWidth + gap);
    context.fillRect(x, 36, barWidth, 6);
    if (i < index) {
      context.fillStyle = "#e10000";
      context.fillRect(x, 36, barWidth, 6);
      context.fillStyle = "rgba(255,255,255,0.25)";
    } else if (i === index) {
      context.fillStyle = "#e10000";
      context.fillRect(x, 36, barWidth * progress, 6);
      context.fillStyle = "rgba(255,255,255,0.25)";
    }
  }

  context.fillStyle = "#ff2a2a";
  context.font = "600 22px sans-serif";
  context.fillText(beat.kicker.toUpperCase(), 40, 140);
  context.fillStyle = "#ffffff";
  context.font = "700 64px Impact, sans-serif";
  wrapText(context, beat.title.toUpperCase(), 40, 230, WIDTH - 80, 72);
  context.fillStyle = "#e8e8e8";
  context.font = "500 32px sans-serif";
  wrapText(context, beat.body, 40, 520, WIDTH - 80, 44);
  context.fillStyle = "#e10000";
  context.font = "700 54px Impact, sans-serif";
  context.fillText(beat.stat.toUpperCase(), 40, 1120);
  context.fillStyle = "#ffffff";
  context.font = "600 22px sans-serif";
  context.fillText("MATCH PULSE", 40, 1200);
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let cursor = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (context.measureText(trial).width > maxWidth && line) {
      context.fillText(line, x, cursor);
      line = word;
      cursor += lineHeight;
    } else {
      line = trial;
    }
  }
  if (line) context.fillText(line, x, cursor);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
