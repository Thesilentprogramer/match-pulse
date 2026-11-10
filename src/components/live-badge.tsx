import { StatusDot } from "@/components/base/badges/status-dot";
import { Chip, type ChipColor } from "@/components/base/badges/chip";

/**
 * Live badge shape from 21st.dev (MIT, f0rextasy / Bigbull UI):
 * blinking dot, mono uppercase label, optional detail.
 * https://21st.dev/@f0rextasy/components/live-badge
 * The registry install needs an API key, so the dot and chip are BoardUI's
 * StatusDot and Chip, which install without one.
 */
export function LiveBadge({
  label,
  detail,
  tone = "rose",
  pulse = false,
  testId,
}: {
  label: string;
  detail?: string;
  tone?: ChipColor;
  pulse?: boolean;
  testId?: string;
}) {
  const dot = tone === "yellow" ? "yellow" : tone === "rose" || tone === "lime" ? "green" : "indigo";
  return (
    <Chip color={tone} variant="caption" data-testid={testId} className="gap-1.5 font-mono tracking-widest uppercase">
      <StatusDot color={dot} className={pulse ? "motion-safe:animate-pulse" : undefined} />
      {label}
      {detail ? <span className="normal-case tracking-normal opacity-80">{detail}</span> : null}
    </Chip>
  );
}
