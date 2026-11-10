import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { SummaryFilmInput } from "./summary-schema";
import { display } from "./fonts";

const PAPER = "#f4efe4";
const INK = "#161616";
const RED = "#e10000";

export const SummaryFilm = ({ scenes }: SummaryFilmInput) => {
  const rows = scenes.reduce<{ scene: SummaryFilmInput["scenes"][number]; from: number; frames: number }[]>((acc, scene) => {
    const frames = Math.max(30, Math.round(scene.durationSec * 30));
    const from = acc.at(-1) ? acc.at(-1)!.from + acc.at(-1)!.frames : 0;
    acc.push({ scene, from, frames });
    return acc;
  }, []);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      {rows.map((row) => (
        <Sequence key={row.scene.id} from={row.from} durationInFrames={row.frames} name={row.scene.headline}>
          <Sketch scene={row.scene} />
          {row.scene.audioSrc ? <Audio src={mediaSrc(row.scene.audioSrc)} /> : null}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

function mediaSrc(src: string): string {
  if (/^(https?:|blob:|data:)/.test(src)) return src;
  return staticFile(src);
}

const Sketch = ({ scene }: { scene: SummaryFilmInput["scenes"][number] }) => {
  const frame = useCurrentFrame();
  const wobble = Math.sin(frame / 5) * 7;
  return (
    <AbsoluteFill style={{ background: PAPER, backgroundImage: "radial-gradient(#ddd6c6 0.7px, transparent 0.7px)", backgroundSize: "8px 8px" }}>
      <svg viewBox="0 0 1080 1180" width="1080" height="1180" style={{ position: "absolute", left: 0, top: 40 }}>
        {scene.kind === "toss" ? <Toss wobble={wobble} /> : null}
        {scene.kind === "rain" ? <Rain wobble={wobble} /> : null}
        {scene.kind === "wicket" ? <Wicket wobble={wobble} /> : null}
        {scene.kind === "fighter" ? <Fighter wobble={wobble} /> : null}
        {scene.kind === "collapse" ? <Collapse wobble={wobble} /> : null}
        {scene.kind === "partnership" ? <Pair wobble={wobble} /> : null}
        {scene.kind === "result" ? <Cheer wobble={wobble} /> : null}
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 560,
          background: "#101010",
          borderTop: `10px solid ${RED}`,
          padding: "36px 64px",
          color: "white",
          fontFamily: display.fontFamily,
        }}
      >
        <div style={{ color: RED, fontWeight: 700, fontSize: 64, letterSpacing: 1, lineHeight: 0.95, textTransform: "uppercase" }}>
          {scene.headline}
        </div>
        <div style={{ marginTop: 18, fontWeight: 600, fontSize: 40, lineHeight: 1.15 }}>{scene.caption}</div>
      </div>
    </AbsoluteFill>
  );
};

const stroke = { fill: "none", stroke: INK, strokeWidth: 8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Figure({ x, y, arm, blue }: { x: number; y: number; arm: number; blue?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx="0" cy="0" r="28" fill="#fff" stroke={INK} strokeWidth="8" />
      <line x1="0" y1="28" x2="0" y2="150" {...stroke} />
      {blue ? <rect x="-26" y="48" width="52" height="70" rx="8" fill="#1d4e89" /> : null}
      <line x1="0" y1="60" x2={-50 + arm} y2={120} {...stroke} />
      <line x1="0" y1="60" x2={50 - arm} y2={110} {...stroke} />
      <line x1="0" y1="150" x2="-36" y2="250" {...stroke} />
      <line x1="0" y1="150" x2="36" y2="250" {...stroke} />
    </g>
  );
}

function Stumps({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={INK} strokeWidth="8" strokeLinecap="round">
      <line x1={x} y1={y} x2={x} y2={y + 150} />
      <line x1={x + 28} y1={y} x2={x + 28} y2={y + 150} />
      <line x1={x + 56} y1={y} x2={x + 56} y2={y + 150} />
      <line x1={x - 6} y1={y} x2={x + 62} y2={y} />
    </g>
  );
}

function Bat({ x, y, rot }: { x: number; y: number; rot: number }) {
  return <rect x={x} y={y} width="22" height="150" rx="6" fill="#fff" stroke={INK} strokeWidth="6" transform={`rotate(${rot} ${x + 11} ${y})`} />;
}

function Toss({ wobble }: { wobble: number }) {
  return (
    <g>
      <Figure x={360} y={420} arm={wobble} />
      <Figure x={700} y={420} arm={-wobble} blue />
      <circle cx="540" cy="360" r="18" fill={RED} />
    </g>
  );
}

function Rain({ wobble }: { wobble: number }) {
  const drops = Array.from({ length: 18 }, (_, i) => (
    <line key={i} x1={80 + i * 54} y1={80 + (i % 3) * 30} x2={70 + i * 54} y2={150 + (i % 3) * 30} stroke="#8aa" strokeWidth="4" />
  ));
  return (
    <g>
      {drops}
      <rect x="250" y="560" width="580" height="36" fill="#ddd" stroke={INK} strokeWidth="6" />
      <Figure x={420} y={620} arm={wobble} blue />
      <Figure x={650} y={620} arm={-wobble} />
    </g>
  );
}

function Wicket({ wobble }: { wobble: number }) {
  return (
    <g>
      <Figure x={240} y={430} arm={20 + wobble} />
      <circle cx={420 + wobble} cy={760} r="16" fill={RED} />
      <Figure x={620} y={470} arm={-30} blue />
      <Bat x={690} y={520} rot={-20 + wobble} />
      <Stumps x={860} y={620} />
    </g>
  );
}

function Fighter({ wobble }: { wobble: number }) {
  return (
    <g>
      {[180, 300, 780, 900].map((x) => (
        <g key={x} opacity="0.35">
          <Figure x={x} y={520} arm={0} />
        </g>
      ))}
      <Figure x={520} y={400} arm={wobble} />
      <Bat x={600} y={470} rot={-50 + wobble} />
      <Stumps x={300} y={640} />
      <circle cx="250" cy="900" r="16" fill={RED} />
    </g>
  );
}

function Collapse({ wobble }: { wobble: number }) {
  return (
    <g>
      <Figure x={540} y={480} arm={30 + wobble} blue />
      <Bat x={470} y={640} rot={70} />
      <Stumps x={760} y={640} />
      <path d="M470 340 q30 -40 70 10 q-40 -20 -70 -10" fill="none" stroke={INK} strokeWidth="5" />
    </g>
  );
}

function Pair({ wobble }: { wobble: number }) {
  return (
    <g>
      <Figure x={400} y={440} arm={wobble} blue />
      <Bat x={470} y={500} rot={-16} />
      <Figure x={680} y={460} arm={-wobble} blue />
      <Bat x={750} y={540} rot={12} />
    </g>
  );
}

function Cheer({ wobble }: { wobble: number }) {
  return (
    <g>
      <Figure x={400} y={460} arm={-40 + wobble} blue />
      <Figure x={680} y={460} arm={40 - wobble} blue />
      <circle cx="540" cy="300" r="22" fill={RED} />
    </g>
  );
}

export function summaryDurationFrames(scenes: readonly { durationSec: number }[]): number {
  return scenes.reduce((sum, scene) => sum + Math.max(30, Math.round(scene.durationSec * 30)), 0);
}
