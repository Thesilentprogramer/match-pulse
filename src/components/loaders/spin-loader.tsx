import type { LucideIcon } from "lucide-react";
import { Loader } from "lucide-react";
import { cn } from "cn";

/**
 * Spin loader from Opensource UI (MIT).
 * https://opensourceui.in/components/spin-loader
 * Copyright (c) Opensource UI / Bidyut Kundu.
 */
export type SpinLoaderSize = "sm" | "md" | "lg";

export type SpinLoaderProps = Readonly<{
  size?: SpinLoaderSize;
  icon?: LucideIcon;
  label?: string;
  className?: string;
  iconClassName?: string;
}>;

const SIZE: Record<SpinLoaderSize, number> = { sm: 18, md: 24, lg: 32 };

export function SpinLoader({
  size = "md",
  icon: Icon = Loader,
  label = "Loading",
  className,
  iconClassName,
}: SpinLoaderProps) {
  return (
    <div
      data-slot="spin-loader"
      data-size={size}
      className={cn("inline-flex items-center justify-center", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Icon
        size={SIZE[size]}
        strokeWidth={2}
        className={cn("animate-spin text-neutral-100 motion-reduce:animate-none", iconClassName)}
        aria-hidden
      />
    </div>
  );
}
