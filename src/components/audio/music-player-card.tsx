"use client";

import { forwardRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "cn";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

/**
 * Music player card from Opensource UI (MIT).
 * https://opensourceui.in/components/music-player
 * Copyright (c) Opensource UI / Bidyut Kundu.
 * Optional cover, progress and transport callbacks are the match-summary wiring.
 */
export type MusicPlayerCardProps = Readonly<
  {
    coverImage?: string;
    cover?: ReactNode;
    title?: string;
    artist?: string;
    album?: string;
    currentTime?: string;
    duration?: string;
    progress?: number;
    defaultPlaying?: boolean;
    playing?: boolean;
    onPlayingChange?: (playing: boolean) => void;
    onPrevious?: () => void;
    onNext?: () => void;
  } & ComponentPropsWithoutRef<"div">
>;

export const MusicPlayerCard = forwardRef<HTMLDivElement, MusicPlayerCardProps>(
  (
    {
      className,
      coverImage,
      cover,
      title = "Midnight Dreams",
      artist = "The Weekend",
      album = "After Hours",
      currentTime = "1:24",
      duration = "3:42",
      progress = 42,
      defaultPlaying = true,
      playing: playingProp,
      onPlayingChange,
      onPrevious,
      onNext,
      ...props
    },
    ref,
  ) => {
    const [uncontrolled, setUncontrolled] = useState(defaultPlaying);
    const playing = playingProp ?? uncontrolled;

    function toggle() {
      const next = !playing;
      if (playingProp === undefined) setUncontrolled(next);
      onPlayingChange?.(next);
    }

    const width = `${Math.min(Math.max(progress, 0), 100)}%`;

    return (
      <div
        ref={ref}
        data-slot="music-player-card"
        className={cn("w-full overflow-hidden rounded-2xl bg-neutral-950 font-sans shadow-lg", className)}
        {...props}
      >
        <div data-slot="music-player-card-cover" className="relative">
          {cover ??
            (coverImage ? (
              // Plain img: the card is a frame, not a next/image remote allow-list.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverImage} alt="" className="h-36 w-full object-cover opacity-80" />
            ) : (
              <div className="h-24 bg-[var(--mp-accent)]/30" />
            ))}
          <div
            data-slot="music-player-card-overlay"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-neutral-950 to-transparent"
          />
        </div>
        <div data-slot="music-player-card-content" className="relative -mt-2 p-4">
          <div data-slot="music-player-card-info">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-[11px] text-neutral-300">
              {artist} · {album}
            </p>
          </div>
          <div data-slot="music-player-card-progress" className="mt-4">
            <div className="h-1 overflow-hidden rounded-full bg-neutral-800">
              <div className="relative h-full rounded-full bg-[var(--mp-accent)]" style={{ width }}>
                <div className="absolute top-1/2 right-0 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white shadow" />
              </div>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="font-mono text-[10px] text-neutral-300">{currentTime}</span>
              <span className="font-mono text-[10px] text-neutral-300">{duration}</span>
            </div>
          </div>
          <div data-slot="music-player-card-controls" className="mt-3 flex items-center justify-center gap-5">
            <button type="button" aria-label="Previous scene" onClick={onPrevious} className="text-neutral-300 hover:text-white">
              <SkipBack size={14} />
            </button>
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play"}
              onClick={toggle}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white"
            >
              {playing ? <Pause size={14} fill="black" /> : <Play size={14} fill="black" />}
            </button>
            <button type="button" aria-label="Next scene" onClick={onNext} className="text-neutral-300 hover:text-white">
              <SkipForward size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  },
);

MusicPlayerCard.displayName = "MusicPlayerCard";
