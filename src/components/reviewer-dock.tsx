"use client";

import { Gauge } from "lucide-react";
import { toast } from "sonner";
import type { PlaybackSpeed } from "@/domain/pacing";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getFeed } from "@/state/use-live-feed";
import { useMatchStore } from "@/state/match-store";

const SPEEDS: { speed: PlaybackSpeed; label: string; hint: string }[] = [
  { speed: 1, label: "1×", hint: "Read every ball" },
  { speed: 5, label: "5×", hint: "Full arc ~3 min" },
  { speed: 20, label: "20×", hint: "Skim the chase" },
];

export function ReviewerDock() {
  const speed = useMatchStore((state) => state.speed);
  const playback = useMatchStore((state) => state.playback);
  const jitter = useMatchStore((state) => state.jitter);
  const setSpeed = useMatchStore((state) => state.setSpeed);
  const setPlayback = useMatchStore((state) => state.setPlayback);
  const setJitter = useMatchStore((state) => state.setJitter);
  const seek = useMatchStore((state) => state.seekToOver);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" data-testid="demo-toggle" variant="secondary" className="h-9 rounded-full px-3">
          <Gauge />
          Demo
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="mp-display text-3xl">Reviewer controls</SheetTitle>
          <SheetDescription>
            The innings is a recorded Harbor Cup final. Speed changes how fast the ground feed arrives. The score is whatever has landed, in order.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-8">
          <div className="grid grid-cols-3 gap-2">
            {SPEEDS.map((item) => (
              <Button
                key={item.speed}
                type="button"
                variant={speed === item.speed ? "default" : "secondary"}
                className="h-14 flex-col"
                onClick={() => setSpeed(item.speed)}
              >
                {item.label}
                <span className="text-[0.65rem] font-normal opacity-70">{item.hint}</span>
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setPlayback(playback === "paused" ? "playing" : "paused")}>
              {playback === "paused" ? "Resume" : "Pause"}
            </Button>
            <Button
              type="button"
              variant={jitter ? "default" : "secondary"}
              onClick={() => {
                setJitter(!jitter);
                toast(jitter ? "Jitter off" : "Jitter on — a pair of balls may arrive out of order");
              }}
            >
              Jitter {jitter ? "on" : "off"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void getFeed()?.drop(2500);
                toast("Dropping the link for 2.5s");
              }}
            >
              Drop link
            </Button>
          </div>
          <div>
            <p className="mp-kicker text-white/40">Jump</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 6, 11, 16, 19].map((over) => (
                <Button key={over} type="button" size="sm" variant="outline" onClick={() => seek(over)}>
                  Over {over}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-white/45">A jump resets Pulse Points so the leaderboard stays fair.</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
