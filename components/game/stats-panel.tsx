"use client";

import { useGameStore } from "@/lib/game-store";
import { StatBar } from "./stat-bar";
import type { StatType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatsPanelProps {
  compact?: boolean;
  className?: string;
}

const STAT_ORDER: StatType[] = [
  "money",
  "stability",
  "status",
  "health",
  "stress",
  "freedom",
  "exposure",
];

export function StatsPanel({ compact = false, className }: StatsPanelProps) {
  const stats = useGameStore((state) => state.stats);
  const previousStats = useGameStore((state) => state.previousStats);

  return (
    <div
      className={cn(
        "relative",
        compact 
          ? "panel-inset flex flex-col gap-0.5 p-2" 
          : "glow-border flex flex-col gap-2 p-3",
        className
      )}
    >
      {/* Header (non-compact only) */}
      {!compact && (
        <div className="mb-1 border-b border-gb-dark/50 pb-2">
          <h3 className="font-pixel text-[9px] uppercase tracking-wider text-gb-light">
            Life Stats
          </h3>
        </div>
      )}
      
      {/* Stats list */}
      <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
        {STAT_ORDER.map((stat) => (
          <StatBar
            key={stat}
            stat={stat}
            value={stats[stat]}
            previousValue={previousStats?.[stat]}
            compact={compact}
          />
        ))}
      </div>

      {/* Decorative corner accents (non-compact only) */}
      {!compact && (
        <>
          <div className="absolute top-1 left-1 w-2 h-2 border-l border-t border-gb-glow/30" />
          <div className="absolute top-1 right-1 w-2 h-2 border-r border-t border-gb-glow/30" />
          <div className="absolute bottom-1 left-1 w-2 h-2 border-l border-b border-gb-glow/30" />
          <div className="absolute bottom-1 right-1 w-2 h-2 border-r border-b border-gb-glow/30" />
        </>
      )}
    </div>
  );
}
